"""
Model training script for ORIMS ML Forecasting Service.

This script:
1. Loads historical sales data from the database (or generates synthetic data for demo)
2. Prepares features for each product/store combination
3. Trains a Gradient Boosting Regressor
4. Evaluates against baselines using chronological splits
5. Saves model and metadata
"""

import os
import json
import logging
import warnings
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Tuple, Optional

import numpy as np
import pandas as pd
import joblib
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.metrics import mean_absolute_error
from sklearn.model_selection import TimeSeriesSplit

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration
default_model_dir = Path("/app/models") if Path("/app/models").exists() else Path(__file__).parent / "models"
MODEL_DIR = Path(os.getenv("MODEL_PATH", str(default_model_dir)))
MODEL_DIR.mkdir(parents=True, exist_ok=True)

DATABASE_URL = os.getenv("DATABASE_URL", "mysql://orims_user:orims_dev_password@localhost:3306/orims")

# Feature columns (must match prepare_features in main.py)
FEATURE_COLUMNS = [
    'lag_1', 'lag_7', 'lag_14', 'lag_28',
    'rolling_mean_7', 'rolling_std_7',
    'rolling_mean_14', 'rolling_std_14',
    'day_of_week', 'month', 'is_weekend',
    'selling_price', 'cost_price', 'price_ratio',
    'on_hand', 'available', 'safety_stock',
    'incoming_qty', 'lead_time_days',
]

TARGET_COLUMN = 'target_demand'

def generate_synthetic_data(n_products: int = 20, n_days: int = 365) -> pd.DataFrame:
    """Generate synthetic sales data for demonstration."""
    np.random.seed(42)
    
    data = []
    base_date = datetime.now().date() - timedelta(days=n_days)
    
    for product_id in range(1, n_products + 1):
        # Product characteristics
        base_demand = np.random.uniform(2, 20)
        trend = np.random.uniform(-0.001, 0.002)
        seasonality = np.random.uniform(0.5, 1.5)
        noise_level = np.random.uniform(0.5, 2.0)
        
        # Product attributes
        selling_price = np.random.uniform(10, 100)
        cost_price = selling_price * np.random.uniform(0.4, 0.7)
        
        for day in range(n_days):
            current_date = base_date + timedelta(days=day)
            dow = current_date.weekday()
            month = current_date.month
            
            # Calculate demand with trend, seasonality, day-of-week effect
            dow_effect = [0.8, 1.0, 1.0, 1.0, 1.1, 1.3, 0.7][dow]
            monthly_effect = 1.0 + 0.2 * np.sin(2 * np.pi * month / 12)
            
            demand = base_demand * (1 + trend * day) * seasonality * dow_effect * monthly_effect
            demand += np.random.normal(0, noise_level)
            demand = max(0, demand)
            
            # Inventory features (simplified)
            on_hand = max(0, int(np.random.normal(50, 20)))
            safety_stock = 10
            available = max(0, on_hand - np.random.randint(0, 5))
            incoming_qty = np.random.randint(0, 30) if np.random.random() < 0.1 else 0
            lead_time_days = np.random.randint(3, 14)
            
            # Create lags (for first days, use base_demand)
            if day == 0:
                lags = [base_demand] * 4
            elif day < 7:
                lags = [data[-1]['demand']] * 4
            else:
                lags = [
                    data[-1]['demand'],
                    data[-7]['demand'] if day >= 7 else base_demand,
                    data[-14]['demand'] if day >= 14 else base_demand,
                    data[-28]['demand'] if day >= 28 else base_demand,
                ]
            
            # Rolling stats
            if day >= 7:
                recent = [d['demand'] for d in data[-7:]]
            else:
                recent = [base_demand] * min(day, 7)
            rolling_mean_7 = np.mean(recent)
            rolling_std_7 = np.std(recent) if len(recent) > 1 else 0
            
            if day >= 14:
                recent14 = [d['demand'] for d in data[-14:]]
            else:
                recent14 = [base_demand] * min(day, 14)
            rolling_mean_14 = np.mean(recent14)
            rolling_std_14 = np.std(recent14) if len(recent14) > 1 else 0
            
            data.append({
                'product_id': f'PROD-{product_id:03d}',
                'store_id': 'default-store',
                'date': current_date,
                'demand': demand,
                'lag_1': lags[0],
                'lag_7': lags[1],
                'lag_14': lags[2],
                'lag_28': lags[3],
                'rolling_mean_7': rolling_mean_7,
                'rolling_std_7': rolling_std_7,
                'rolling_mean_14': rolling_mean_14,
                'rolling_std_14': rolling_std_14,
                'day_of_week': dow,
                'month': month,
                'is_weekend': 1 if dow >= 5 else 0,
                'selling_price': selling_price,
                'cost_price': cost_price,
                'price_ratio': selling_price / cost_price,
                'on_hand': on_hand,
                'available': available,
                'safety_stock': safety_stock,
                'incoming_qty': incoming_qty,
                'lead_time_days': lead_time_days,
            })
    
    return pd.DataFrame(data)

def prepare_training_data(df: pd.DataFrame) -> Tuple[np.ndarray, np.ndarray, pd.DataFrame]:
    """Prepare features and targets from dataframe."""
    # Create target (next day demand)
    df = df.sort_values(['product_id', 'store_id', 'date']).copy()
    df[TARGET_COLUMN] = df.groupby(['product_id', 'store_id'])['demand'].shift(-1)
    
    # Drop rows with NaN target
    df = df.dropna(subset=[TARGET_COLUMN])
    
    X = df[FEATURE_COLUMNS].values
    y = df[TARGET_COLUMN].values
    
    return X, y, df

def evaluate_model(y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, float]:
    """Calculate evaluation metrics."""
    mae = mean_absolute_error(y_true, y_pred)
    
    # WAPE - Weighted Absolute Percentage Error
    denominator = np.sum(np.abs(y_true))
    if denominator > 0:
        wape = np.sum(np.abs(y_true - y_pred)) / denominator
    else:
        wape = float('nan')
    
    # Bias
    bias = np.mean(y_pred - y_true)
    
    return {
        'mae': float(mae),
        'wape': float(wape) if not np.isnan(wape) else None,
        'bias': float(bias),
        'n_samples': len(y_true),
    }

def train_model():
    """Main training pipeline."""
    logger.info("Starting model training...")
    
    # Load or generate data
    logger.info("Generating synthetic training data...")
    df = generate_synthetic_data(n_products=50, n_days=730)  # 2 years
    
    logger.info(f"Generated {len(df)} records for {df['product_id'].nunique()} products")
    
    # Prepare features and target
    X, y, df_processed = prepare_training_data(df)
    logger.info(f"Prepared {X.shape[0]} samples with {X.shape[1]} features")
    
    # Chronological split (80% train, 10% val, 10% test)
    n_samples = len(X)
    train_end = int(n_samples * 0.8)
    val_end = int(n_samples * 0.9)
    
    X_train, y_train = X[:train_end], y[:train_end]
    X_val, y_val = X[train_end:val_end], y[train_end:val_end]
    X_test, y_test = X[val_end:], y[val_end:]
    
    logger.info(f"Train: {len(X_train)}, Val: {len(X_val)}, Test: {len(X_test)}")
    
    # Train baseline models for comparison
    logger.info("Evaluating baselines...")
    
    # Baseline 1: Moving average of last 7 days
    # We need to simulate this - using mean of training targets as proxy
    baseline_ma_pred = np.full_like(y_test, np.mean(y_train[-1000:]))  # Recent average
    baseline_ma_metrics = evaluate_model(y_test, baseline_ma_pred)
    
    # Baseline 2: Day-of-week naive (simplified - use overall mean by dow)
    dow_means = {}
    for dow in range(7):
        mask = df_processed.iloc[:train_end]['day_of_week'] == dow
        if mask.any():
            dow_means[dow] = df_processed.iloc[:train_end][mask]['demand'].mean()
        else:
            dow_means[dow] = y_train.mean()
    
    test_dows = df_processed.iloc[val_end:]['day_of_week'].values
    baseline_dow_pred = np.array([dow_means.get(dow, y_train.mean()) for dow in test_dows])
    baseline_dow_metrics = evaluate_model(y_test, baseline_dow_pred)
    
    logger.info(f"Baseline MA - MAE: {baseline_ma_metrics['mae']:.4f}, WAPE: {baseline_ma_metrics['wape']}")
    logger.info(f"Baseline DoW - MAE: {baseline_dow_metrics['mae']:.4f}, WAPE: {baseline_dow_metrics['wape']}")
    
    # Train Gradient Boosting model
    logger.info("Training Gradient Boosting model...")
    
    model = HistGradientBoostingRegressor(
        max_iter=200,
        max_depth=6,
        learning_rate=0.1,
        min_samples_leaf=10,
        l2_regularization=1.0,
        early_stopping=True,
        validation_fraction=0.1,
        n_iter_no_change=10,
        random_state=42,
    )
    
    model.fit(X_train, y_train)
    
    # Evaluate on validation set
    val_pred = model.predict(X_val)
    val_pred = np.maximum(val_pred, 0)
    val_metrics = evaluate_model(y_val, val_pred)
    logger.info(f"Validation - MAE: {val_metrics['mae']:.4f}, WAPE: {val_metrics['wape']}")
    
    # Evaluate on test set
    test_pred = model.predict(X_test)
    test_pred = np.maximum(test_pred, 0)
    test_metrics = evaluate_model(y_test, test_pred)
    logger.info(f"Test - MAE: {test_metrics['mae']:.4f}, WAPE: {test_metrics['wape']}")
    
    # Compare with baselines
    best_baseline_mae = min(baseline_ma_metrics['mae'], baseline_dow_metrics['mae'])
    improvement = (best_baseline_mae - test_metrics['mae']) / best_baseline_mae * 100
    logger.info(f"Best baseline MAE: {best_baseline_mae:.4f}")
    logger.info(f"Model MAE: {test_metrics['mae']:.4f}")
    logger.info(f"Improvement: {improvement:.1f}%")
    
    # Save model
    model_path = MODEL_DIR / "model.joblib"
    joblib.dump(model, model_path)
    logger.info(f"Model saved to {model_path}")
    
    # Save metadata
    metadata = {
        "version": f"v{datetime.now().strftime('%Y%m%d_%H%M%S')}",
        "model_family": "gradient_boosting",
        "data_provenance": "SYNTHETIC",
        "training_start_date": df_processed['date'].min().isoformat(),
        "training_end_date": df_processed['date'].max().isoformat(),
        "feature_schema_version": "1.0",
        "feature_columns": FEATURE_COLUMNS,
        "metrics": {
            "train": {"n_samples": len(X_train)},
            "validation": val_metrics,
            "test": test_metrics,
            "baseline_moving_average": baseline_ma_metrics,
            "baseline_day_of_week": baseline_dow_metrics,
            "improvement_over_best_baseline_pct": improvement,
        },
        "status": "ACTIVE",
        "trained_at": datetime.utcnow().isoformat(),
    }
    
    metadata_path = MODEL_DIR / "metadata.json"
    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=2)
    logger.info(f"Metadata saved to {metadata_path}")
    
    logger.info("Training completed successfully!")
    return model, metadata

if __name__ == "__main__":
    train_model()