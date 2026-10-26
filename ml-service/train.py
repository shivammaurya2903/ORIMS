"""
Training Pipeline for ORIMS ML Service.

Trains:
1. Quantile Demand Models (P50, P90, P95) using HistGradientBoostingRegressor
2. Standard Demand Model (Mean)
3. Stockout Risk Classifier using HistGradientBoostingClassifier
4. Serializes models and comprehensive metadata to disk
"""

import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Tuple
import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor, HistGradientBoostingClassifier

from utils.config import MODELS_DIR, DATASET
from utils.data import load_dataset
from utils.features import build_features
from utils.metrics import evaluate_forecast, classification_metrics, pinball_loss
from utils.schema import FEATURE_COLUMNS_V2, TARGET_DEMAND, TARGET_STOCKOUT

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger(__name__)


def train_models(dataset_name: str = None) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """
    Executes end-to-end model training:
    Loads data -> builds features -> splits chronologically -> fits models -> serializes artifacts.
    """
    ds_name = dataset_name or DATASET or 'm5'
    logger.info(f"Initiating model training on dataset source: '{ds_name}'...")

    # 1. Load data
    df_raw, provenance = load_dataset(ds_name)
    logger.info(f"Loaded {len(df_raw)} records (Provenance: {provenance})")

    # 2. Feature engineering
    df_features = build_features(df_raw)
    n_samples = len(df_features)
    logger.info(f"Engineered {n_samples} valid training instances with {len(FEATURE_COLUMNS_V2)} features")

    if n_samples < 20:
        raise ValueError(f"Insufficient training instances ({n_samples}) to fit model reliably.")

    # 3. Chronological Train / Val / Test split
    unique_dates = np.sort(df_features['date'].unique())
    n_dates = len(unique_dates)

    if n_dates >= 10:
        train_dates = unique_dates[:int(n_dates * 0.80)]
        val_dates = unique_dates[int(n_dates * 0.80):int(n_dates * 0.90)]
        test_dates = unique_dates[int(n_dates * 0.90):]

        train_mask = df_features['date'].isin(train_dates).values
        val_mask = df_features['date'].isin(val_dates).values
        test_mask = df_features['date'].isin(test_dates).values
    else:
        # Fallback split for small test datasets
        n_train = int(n_samples * 0.8)
        train_mask = np.zeros(n_samples, dtype=bool)
        train_mask[:n_train] = True
        val_mask = ~train_mask
        test_mask = val_mask

    X_train = df_features.loc[train_mask, FEATURE_COLUMNS_V2].values.astype(np.float32)
    y_demand_train = df_features.loc[train_mask, TARGET_DEMAND].values.astype(np.float32)
    y_stockout_train = df_features.loc[train_mask, TARGET_STOCKOUT].values.astype(int)

    X_test = df_features.loc[test_mask, FEATURE_COLUMNS_V2].values.astype(np.float32)
    y_demand_test = df_features.loc[test_mask, TARGET_DEMAND].values.astype(np.float32)
    y_stockout_test = df_features.loc[test_mask, TARGET_STOCKOUT].values.astype(int)

    logger.info(f"Training split sizes -> Train: {len(X_train)}, Test: {len(X_test)}")

    # 4. Train Quantile Regressors (P50, P90, P95)
    logger.info("Training Quantile Regressors (P50, P90, P95)...")
    q50 = HistGradientBoostingRegressor(loss='quantile', quantile=0.5, max_iter=150, min_samples_leaf=10, random_state=42)
    q50.fit(X_train, y_demand_train)

    q90 = HistGradientBoostingRegressor(loss='quantile', quantile=0.9, max_iter=150, min_samples_leaf=10, random_state=42)
    q90.fit(X_train, y_demand_train)

    q95 = HistGradientBoostingRegressor(loss='quantile', quantile=0.95, max_iter=150, min_samples_leaf=10, random_state=42)
    q95.fit(X_train, y_demand_train)

    # 5. Train Standard Mean Regressor (for model.joblib)
    logger.info("Training Standard Regressor (model.joblib)...")
    base_reg = HistGradientBoostingRegressor(loss='squared_error', max_iter=150, min_samples_leaf=10, random_state=42)
    base_reg.fit(X_train, y_demand_train)

    # 6. Train Stockout Classifier
    logger.info("Training Stockout Classifier...")
    clf = HistGradientBoostingClassifier(max_iter=150, min_samples_leaf=10, random_state=42)
    # Check if multiple classes exist
    if len(np.unique(y_stockout_train)) > 1:
        clf.fit(X_train, y_stockout_train)
    else:
        # Balanced synthetic dummy row if stockout flag has 0 variance
        synthetic_x = X_train[0:1]
        synthetic_y = np.array([1 if y_stockout_train[0] == 0 else 0])
        clf.fit(np.vstack([X_train, synthetic_x]), np.concatenate([y_stockout_train, synthetic_y]))

    # 7. Evaluate on Test Split
    preds_50 = np.maximum(0.0, q50.predict(X_test))
    preds_90 = np.maximum(0.0, q90.predict(X_test))
    preds_95 = np.maximum(0.0, q95.predict(X_test))
    preds_base = np.maximum(0.0, base_reg.predict(X_test))

    metrics_p50 = evaluate_forecast(y_demand_test, preds_50)
    metrics_base = evaluate_forecast(y_demand_test, preds_base)
    pinball_50 = pinball_loss(y_demand_test, preds_50, 0.5)
    pinball_90 = pinball_loss(y_demand_test, preds_90, 0.9)
    pinball_95 = pinball_loss(y_demand_test, preds_95, 0.95)

    try:
        clf_probs = clf.predict_proba(X_test)[:, 1]
    except Exception:
        clf_probs = np.zeros(len(X_test))
    metrics_clf = classification_metrics(y_stockout_test, clf_probs)

    logger.info(f"P50 Metrics -> MAE: {metrics_p50['mae']}, WAPE: {metrics_p50['wape']}")
    logger.info(f"Base Metrics -> MAE: {metrics_base['mae']}, WAPE: {metrics_base['wape']}")

    # 8. Persist Artifacts
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    models = {
        'demand_q50.joblib': q50,
        'demand_q90.joblib': q90,
        'demand_q95.joblib': q95,
        'stockout_classifier.joblib': clf,
        'model.joblib': base_reg,
    }

    for name, obj in models.items():
        joblib.dump(obj, MODELS_DIR / name)
        logger.info(f"Saved artifact: {MODELS_DIR / name}")

    version = f"v{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}"
    metadata = {
        'version': version,
        'model_family': 'hgb_quantile_plus_classifier',
        'data_provenance': provenance,
        'feature_schema_version': '2.0',
        'feature_columns': FEATURE_COLUMNS_V2,
        'target_demand': TARGET_DEMAND,
        'target_stockout': TARGET_STOCKOUT,
        'metrics': {
            'demand_p50': metrics_p50,
            'demand_mean': metrics_base,
            'pinball_loss': {
                'q50': round(pinball_50, 4),
                'q90': round(pinball_90, 4),
                'q95': round(pinball_95, 4),
            },
            'stockout_classifier': metrics_clf,
            'test_samples': len(X_test),
        },
        'status': 'ACTIVE',
        'trained_at': datetime.now(timezone.utc).isoformat(),
    }

    with open(MODELS_DIR / 'metadata.json', 'w', encoding='utf-8') as f:
        json.dump(metadata, f, indent=2)
    logger.info(f"Saved metadata: {MODELS_DIR / 'metadata.json'}")

    return models, metadata


if __name__ == '__main__':
    train_models()
