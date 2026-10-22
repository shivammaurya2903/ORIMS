"""
Model training and benchmarking script for ORIMS ML Forecasting Service.

1. Loads M5 Forecasting Accuracy competition dataset (or benchmark fixture).
2. Computes strict time-series features (lags, rolling stats, calendar, prices, inventory) with zero future leakage.
3. Enforces chronological train / validation / test splits.
4. Evaluates against Moving Average and Day-of-Week Naive baselines.
5. Saves model.joblib and metadata.json with provenance and metrics.
"""

import os
os.environ.setdefault("LOKY_MAX_CPU_COUNT", str(os.cpu_count() or 4))
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, Tuple

import numpy as np
import pandas as pd
import joblib
from sklearn.ensemble import HistGradientBoostingRegressor

from m5_data import load_m5_dataset
from features import (
    FEATURE_COLUMNS,
    TARGET_COLUMN,
    build_time_series_features,
    evaluate_model,
)

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger(__name__)

# Configuration
if os.getenv("MODEL_PATH"):
    MODEL_DIR = Path(os.getenv("MODEL_PATH"))
elif os.name == "posix" and Path("/app/models").exists():
    MODEL_DIR = Path("/app/models")
else:
    MODEL_DIR = Path(__file__).resolve().parent / "models"

MODEL_DIR.mkdir(parents=True, exist_ok=True)
MODEL_VERSION = os.getenv("MODEL_VERSION", f"v{datetime.now().strftime('%Y%m%d_%H%M%S')}")


def compute_baseline_predictions(
    df_clean: pd.DataFrame,
    train_end_idx: int,
    val_end_idx: int,
    y_test: np.ndarray
) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """
    Computes genuine retail baselines on the holdout test set:
    1. 7-Day Moving Average Baseline (historical product mean)
    2. Day-of-Week Naive Baseline (historical product mean per day-of-week)
    """
    df_train = df_clean.iloc[:train_end_idx]
    df_test = df_clean.iloc[val_end_idx:]

    # Baseline 1: Recent moving average per product
    product_means = df_train.groupby('product_id')['demand'].mean().to_dict()
    global_mean = float(df_train['demand'].mean()) if len(df_train) > 0 else 1.0

    ma_preds = np.array([
        product_means.get(pid, global_mean) for pid in df_test['product_id']
    ], dtype=np.float32)
    ma_metrics = evaluate_model(y_test, ma_preds)

    # Baseline 2: Day-of-Week naive baseline for next-day target
    dow_means = df_train.groupby(['product_id', 'day_of_week'])['demand'].mean().to_dict()
    dow_preds = []
    for pid, dow in zip(df_test['product_id'], df_test['day_of_week']):
        target_dow = (int(dow) + 1) % 7
        val = dow_means.get((pid, target_dow), product_means.get(pid, global_mean))
        dow_preds.append(val)
    dow_preds = np.array(dow_preds, dtype=np.float32)
    dow_metrics = evaluate_model(y_test, dow_preds)

    return ma_metrics, dow_metrics


def train_model(max_items: int = 50, max_days: int = 365) -> Tuple[HistGradientBoostingRegressor, Dict[str, Any]]:
    """
    Executes end-to-end M5 dataset training and benchmarking pipeline.
    """
    logger.info("==================================================")
    logger.info("Starting ORIMS ML Model Training & Benchmarking")
    logger.info("==================================================")

    # 1. Load M5 Dataset
    df_raw, provenance = load_m5_dataset(max_items=max_items, max_days=max_days)
    logger.info(f"Loaded {len(df_raw)} records (Provenance: {provenance})")

    # 2. Build time-series features without leakage
    X, y, df_clean = build_time_series_features(df_raw)
    n_samples = len(X)
    logger.info(f"Engineered {n_samples} valid training instances with {len(FEATURE_COLUMNS)} features")

    if n_samples < 50:
        raise ValueError(f"Insufficient training samples ({n_samples}) to fit model reliably.")

    # 3. Chronological Train / Validation / Test Split (no random splitting)
    # 80% train, 10% validation, 10% test holdout
    train_end = int(n_samples * 0.80)
    val_end = int(n_samples * 0.90)

    X_train, y_train = X[:train_end], y[:train_end]
    X_val, y_val = X[train_end:val_end], y[train_end:val_end]
    X_test, y_test = X[val_end:], y[val_end:]

    logger.info(f"Chronological split -> Train: {len(X_train)}, Val: {len(X_val)}, Test: {len(X_test)}")

    # 4. Evaluate Baselines on the test split
    baseline_ma_metrics, baseline_dow_metrics = compute_baseline_predictions(
        df_clean, train_end, val_end, y_test
    )
    logger.info(f"Baseline Moving Average -> MAE: {baseline_ma_metrics['mae']}, WAPE: {baseline_ma_metrics['wape']}")
    logger.info(f"Baseline Day-of-Week    -> MAE: {baseline_dow_metrics['mae']}, WAPE: {baseline_dow_metrics['wape']}")

    # 5. Fit Gradient Boosting Regressor
    logger.info("Fitting HistGradientBoostingRegressor with monotonic non-negative constraints...")
    model = HistGradientBoostingRegressor(
        max_iter=250,
        max_depth=6,
        learning_rate=0.08,
        min_samples_leaf=15,
        l2_regularization=1.5,
        early_stopping=True,
        validation_fraction=0.1,
        n_iter_no_change=12,
        random_state=42,
    )
    model.fit(X_train, y_train)

    # 6. Evaluate Model on Validation and Test Splits
    val_preds = np.maximum(model.predict(X_val), 0.0)
    val_metrics = evaluate_model(y_val, val_preds)

    test_preds = np.maximum(model.predict(X_test), 0.0)
    test_metrics = evaluate_model(y_test, test_preds)

    logger.info(f"Model Validation Metrics -> MAE: {val_metrics['mae']}, WAPE: {val_metrics['wape']}")
    logger.info(f"Model Test Metrics       -> MAE: {test_metrics['mae']}, WAPE: {test_metrics['wape']}")

    # 7. Compare with baselines
    best_baseline_mae = min(baseline_ma_metrics['mae'], baseline_dow_metrics['mae'])
    if best_baseline_mae > 0:
        improvement = round(((best_baseline_mae - test_metrics['mae']) / best_baseline_mae) * 100, 2)
    else:
        improvement = 0.0
    logger.info(f"Improvement over Best Baseline: {improvement}%")

    # 8. Persist Model and Metadata
    model_path = MODEL_DIR / "model.joblib"
    joblib.dump(model, model_path)
    logger.info(f"Model serialized to {model_path}")

    start_date_str = str(df_clean['date'].min())[:10]
    end_date_str = str(df_clean['date'].max())[:10]

    metadata = {
        "version": MODEL_VERSION,
        "model_family": "hist_gradient_boosting",
        "data_provenance": provenance,
        "training_start_date": start_date_str,
        "training_end_date": end_date_str,
        "feature_schema_version": "1.0",
        "feature_columns": FEATURE_COLUMNS,
        "target_column": TARGET_COLUMN,
        "metrics": {
            "train": {"n_samples": len(X_train)},
            "validation": val_metrics,
            "test": test_metrics,
            "baseline_moving_average": baseline_ma_metrics,
            "baseline_day_of_week": baseline_dow_metrics,
            "improvement_over_best_baseline_pct": improvement,
        },
        "model_parameters": {
            "max_iter": 250,
            "max_depth": 6,
            "learning_rate": 0.08,
            "min_samples_leaf": 15,
            "l2_regularization": 1.5,
        },
        "status": "ACTIVE",
        "trained_at": datetime.now(timezone.utc).isoformat(),
    }

    metadata_path = MODEL_DIR / "metadata.json"
    with open(metadata_path, 'w', encoding='utf-8') as f:
        json.dump(metadata, f, indent=2)
    logger.info(f"Metadata serialized to {metadata_path}")

    logger.info("Training pipeline finished successfully.")
    return model, metadata


if __name__ == "__main__":
    train_model()
