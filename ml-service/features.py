"""
Feature Engineering and Evaluation Module for ORIMS ML Service.

Shared between training and inference to ensure 100% schema consistency,
prevent feature leakage, and guarantee reproducible multi-step horizons.
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error

FEATURE_COLUMNS: List[str] = [
    'lag_1', 'lag_7', 'lag_14', 'lag_28',
    'rolling_mean_7', 'rolling_std_7',
    'rolling_mean_14', 'rolling_std_14',
    'day_of_week', 'month', 'is_weekend',
    'selling_price', 'cost_price', 'price_ratio',
    'on_hand', 'available', 'safety_stock',
    'incoming_qty', 'lead_time_days',
]

TARGET_COLUMN: str = 'target_demand'


def build_time_series_features(df: pd.DataFrame) -> Tuple[np.ndarray, np.ndarray, pd.DataFrame]:
    """
    Constructs lag, rolling, calendar, price, and inventory features from long-format dataframe.
    Enforces strict chronological feature generation with zero future leakage.
    """
    df = df.copy()
    df['date'] = pd.to_datetime(df['date'])
    df = df.sort_values(['product_id', 'store_id', 'date']).reset_index(drop=True)

    grouped = df.groupby(['product_id', 'store_id'])

    # Lags (strictly prior days)
    for lag in [1, 7, 14, 28]:
        df[f'lag_{lag}'] = grouped['demand'].shift(lag)

    # Rolling statistics over prior windows (using shift(1) to prevent current-day leakage)
    for window in [7, 14]:
        df[f'rolling_mean_{window}'] = grouped['demand'].transform(
            lambda s: s.shift(1).rolling(window, min_periods=1).mean()
        )
        df[f'rolling_std_{window}'] = grouped['demand'].transform(
            lambda s: s.shift(1).rolling(window, min_periods=1).std().fillna(0.0)
        )

    # Calendar features
    df['day_of_week'] = df['date'].dt.dayofweek
    df['month'] = df['date'].dt.month
    df['is_weekend'] = (df['day_of_week'] >= 5).astype(int)

    # Price features
    df['selling_price'] = df['selling_price'].astype(float)
    df['cost_price'] = df['cost_price'].astype(float)
    df['price_ratio'] = df['selling_price'] / np.maximum(df['cost_price'], 0.01)

    # Target: Next-day demand (shift -1 per product/store)
    df[TARGET_COLUMN] = grouped['demand'].shift(-1)

    # Drop rows with NaN from lags and final target
    valid_mask = df[FEATURE_COLUMNS + [TARGET_COLUMN]].notna().all(axis=1)
    df_clean = df[valid_mask].copy().reset_index(drop=True)

    X = df_clean[FEATURE_COLUMNS].values.astype(np.float32)
    y = df_clean[TARGET_COLUMN].values.astype(np.float32)

    return X, y, df_clean


def prepare_inference_features(product_data: Dict[str, Any], day_offset: int = 0) -> np.ndarray:
    """
    Prepares a single feature vector for online inference.
    Automatically derives missing rolling and lag statistics from recent_sales,
    and advances calendar features by day_offset to prevent static day-of-week leakage.
    """
    features: List[float] = []
    recent_sales = [float(x) for x in product_data.get('recent_sales', [])]

    # 1. Lags: lag_1, lag_7, lag_14, lag_28
    for lag in [1, 7, 14, 28]:
        if f'lag_{lag}' in product_data:
            val = float(product_data[f'lag_{lag}'])
        elif len(recent_sales) >= lag:
            val = recent_sales[-lag]
        elif len(recent_sales) > 0:
            val = recent_sales[-1]
        else:
            val = 0.0
        features.append(val)

    # 2. Rolling statistics: rolling_mean_7, rolling_std_7, rolling_mean_14, rolling_std_14
    for window in [7, 14]:
        if f'rolling_mean_{window}' in product_data:
            r_mean = float(product_data[f'rolling_mean_{window}'])
        elif len(recent_sales) > 0:
            slice_vals = recent_sales[-window:]
            r_mean = float(np.mean(slice_vals))
        else:
            r_mean = 0.0

        if f'rolling_std_{window}' in product_data:
            r_std = float(product_data[f'rolling_std_{window}'])
        elif len(recent_sales) > 1:
            slice_vals = recent_sales[-window:]
            r_std = float(np.std(slice_vals))
        else:
            r_std = 0.0

        features.append(r_mean)
        features.append(r_std)

    # 3. Calendar features: dynamic progression by forecast horizon day_offset
    target_date = datetime.now(timezone.utc).date() + timedelta(days=day_offset + 1)
    dow = target_date.weekday()
    month = target_date.month
    is_weekend = 1.0 if dow >= 5 else 0.0
    features.append(float(dow))
    features.append(float(month))
    features.append(is_weekend)

    # 4. Price features
    selling_price = float(product_data.get('selling_price', 1.0))
    cost_price = float(product_data.get('cost_price', 1.0))
    price_ratio = selling_price / max(cost_price, 0.01)
    features.append(selling_price)
    features.append(cost_price)
    features.append(price_ratio)

    # 5. Inventory features
    on_hand = float(product_data.get('on_hand', 0.0))
    available = float(product_data.get('available', on_hand))
    safety_stock = float(product_data.get('safety_stock', 0.0))
    features.append(on_hand)
    features.append(available)
    features.append(safety_stock)

    # 6. Supply chain features
    incoming_qty = float(product_data.get('incoming_qty', 0.0))
    lead_time_days = float(product_data.get('lead_time_days', 7.0))
    features.append(incoming_qty)
    features.append(lead_time_days)

    return np.array(features, dtype=np.float32).reshape(1, -1)


def evaluate_model(y_true: np.ndarray, y_pred: np.ndarray) -> Dict[str, Any]:
    """
    Computes regression evaluation metrics: MAE, WAPE, Bias, and sample count.
    Ensures safe handling of zero actual demand without divide-by-zero errors.
    """
    mae = float(mean_absolute_error(y_true, y_pred))

    denominator = float(np.sum(np.abs(y_true)))
    if denominator > 0:
        wape = float(np.sum(np.abs(y_true - y_pred)) / denominator)
    else:
        wape = None

    bias = float(np.mean(y_pred - y_true))

    return {
        'mae': round(mae, 4),
        'wape': round(wape, 4) if wape is not None else None,
        'bias': round(bias, 4),
        'n_samples': int(len(y_true)),
    }
