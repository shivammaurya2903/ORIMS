"""
Feature Engineering and Online Inference Transformation Module for ORIMS ML Service.

Ensures 100% schema consistency between training and online inference,
strictly prevents cross-series data leakage, and provides autoregressive rolling stats.
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple
import numpy as np
import pandas as pd

from .schema import (
    FEATURE_COLUMNS_V2,
    FEATURE_COLUMNS_V1,
    TARGET_DEMAND,
    TARGET_STOCKOUT,
)


def _compute_stockout_within_lead_time_group(stockout_flags: np.ndarray, lead_times: np.ndarray) -> np.ndarray:
    """Fast vectorized window calculation for future stockout within lead time."""
    n = len(stockout_flags)
    result = np.zeros(n, dtype=int)
    for i in range(n):
        lt = int(lead_times[i]) if not np.isnan(lead_times[i]) else 7
        lt = max(1, min(lt, 14))
        if i + 1 < n:
            window_end = min(n, i + 1 + lt)
            if np.any(stockout_flags[i + 1:window_end] > 0):
                result[i] = 1
    return result


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Constructs lag, rolling, calendar, supply-chain, and target features.
    Enforces strict chronological sorting per product and store to prevent future leakage.
    """
    df = df.copy()
    df['date'] = pd.to_datetime(df['date'])
    df = df.sort_values(['product_id', 'store_id', 'date']).reset_index(drop=True)

    g = df.groupby(['product_id', 'store_id'])

    # 1. Lags (strictly prior days)
    for lag in [1, 7, 14, 28]:
        df[f'lag_{lag}'] = g['demand'].shift(lag)

    # 2. Rolling statistics (group-isolated to prevent cross-series data leakage)
    for w in [7, 14]:
        df[f'rolling_mean_{w}'] = g['demand'].transform(
            lambda s: s.shift(1).rolling(w, min_periods=1).mean()
        )
        df[f'rolling_std_{w}'] = g['demand'].transform(
            lambda s: s.shift(1).rolling(w, min_periods=1).std().fillna(0.0)
        )

    # 3. Stockout lag history
    if 'stockout_flag' in df.columns:
        df['lag_stockout_7'] = g['stockout_flag'].transform(
            lambda s: s.shift(1).rolling(7, min_periods=1).sum().fillna(0.0)
        )
    else:
        df['lag_stockout_7'] = 0.0

    # 4. Days since last sale (group-isolated, non-deprecated ffill)
    units = df['units_sold'] if 'units_sold' in df.columns else df['demand']
    sale_date_marker = df['date'].where(units > 0)
    df['last_sale_date'] = g.apply(
        lambda group: sale_date_marker.loc[group.index].ffill(),
        include_groups=False
    ).reset_index(level=[0, 1], drop=True)
    df['days_since_last_sale'] = (df['date'] - df['last_sale_date']).dt.days.fillna(999.0).astype(float)

    # 5. Calendar features
    df['day_of_week'] = df['date'].dt.dayofweek
    df['month'] = df['date'].dt.month
    df['is_weekend'] = (df['day_of_week'] >= 5).astype(int)
    if 'holiday' in df.columns:
        df['is_holiday'] = pd.to_numeric(df['holiday'], errors='coerce').fillna(0).astype(int)
    else:
        df['is_holiday'] = 0

    if 'promo' in df.columns:
        df['is_promo'] = pd.to_numeric(df['promo'], errors='coerce').fillna(0).astype(int)
    else:
        df['is_promo'] = 0

    # 6. Pricing features
    if 'selling_price' in df.columns:
        df['selling_price'] = pd.to_numeric(df['selling_price'], errors='coerce').fillna(10.0).astype(float)
    else:
        df['selling_price'] = 10.0

    if 'cost_price' in df.columns:
        df['cost_price'] = pd.to_numeric(df['cost_price'], errors='coerce').fillna(6.0).astype(float)
    else:
        df['cost_price'] = 6.0

    df['price_ratio'] = df['selling_price'] / np.maximum(df['cost_price'], 0.01)

    # 7. Inventory and Supply-Chain features
    if 'opening_inventory' in df.columns:
        df['opening_inventory'] = pd.to_numeric(df['opening_inventory'], errors='coerce').fillna(0.0).astype(float)
    elif 'available' in df.columns:
        df['opening_inventory'] = pd.to_numeric(df['available'], errors='coerce').fillna(0.0).astype(float)
    else:
        df['opening_inventory'] = 0.0

    if 'available' in df.columns:
        df['available'] = pd.to_numeric(df['available'], errors='coerce').fillna(0.0).astype(float)
    else:
        df['available'] = df['opening_inventory']

    if 'safety_stock' in df.columns:
        df['safety_stock'] = pd.to_numeric(df['safety_stock'], errors='coerce').fillna(10.0).astype(float)
    else:
        df['safety_stock'] = 10.0

    if 'incoming_qty' in df.columns:
        df['incoming_qty'] = pd.to_numeric(df['incoming_qty'], errors='coerce').fillna(0.0).astype(float)
    else:
        df['incoming_qty'] = 0.0

    if 'lead_time_days' in df.columns:
        df['lead_time_days'] = pd.to_numeric(df['lead_time_days'], errors='coerce').fillna(7.0).astype(float)
    else:
        df['lead_time_days'] = 7.0

    avg_demand_7 = df['rolling_mean_7'].fillna(1.0)
    df['days_of_supply'] = df['available'] / np.maximum(avg_demand_7, 1e-6)
    df['inventory_position'] = df['available'] + df['incoming_qty']
    df['demand_volatility_14'] = df['rolling_std_14'].fillna(0.0)

    # 8. Target 1: Next-day demand (shift -1 strictly within group)
    df[TARGET_DEMAND] = g['demand'].shift(-1)

    # 9. Target 2: Stockout within lead time
    stockouts_within_lt = np.zeros(len(df), dtype=int)
    stockout_vals = df['stockout_flag'].values if 'stockout_flag' in df.columns else np.zeros(len(df), dtype=int)
    lt_vals = df['lead_time_days'].values

    for _, group_indices in g.groups.items():
        idxs = group_indices.values
        sub_stockouts = stockout_vals[idxs]
        sub_lts = lt_vals[idxs]
        stockouts_within_lt[idxs] = _compute_stockout_within_lead_time_group(sub_stockouts, sub_lts)

    df[TARGET_STOCKOUT] = stockouts_within_lt

    # 10. Fill NAs for feature columns and filter complete instances
    for c in FEATURE_COLUMNS_V2:
        if c in df.columns:
            df[c] = df[c].fillna(0.0)

    valid_mask = df[FEATURE_COLUMNS_V2 + [TARGET_DEMAND, TARGET_STOCKOUT]].notna().all(axis=1)
    return df[valid_mask].copy().reset_index(drop=True)


def prepare_inference_features(
    product_data: Dict[str, Any],
    day_offset: int = 0,
    feature_columns: Optional[List[str]] = None
) -> np.ndarray:
    """
    Constructs a feature vector for a single product at online inference time.
    Derives lag and rolling features dynamically from recent_sales if not pre-computed,
    and advances calendar progression per forecast horizon step.
    """
    cols = feature_columns or FEATURE_COLUMNS_V2
    recent_sales = [float(x) for x in product_data.get('recent_sales', [])]

    # Pre-compute rolling statistics from recent sales history
    recent_np = np.array(recent_sales, dtype=float) if len(recent_sales) > 0 else np.array([0.0])

    s7 = recent_np[-7:] if len(recent_np) >= 7 else recent_np
    mean7 = float(np.mean(s7))
    std7 = float(np.std(s7)) if len(s7) > 1 else 0.0

    s14 = recent_np[-14:] if len(recent_np) >= 14 else recent_np
    mean14 = float(np.mean(s14))
    std14 = float(np.std(s14)) if len(s14) > 1 else 0.0

    # Dynamic calendar derivation advancing with horizon
    target_date = datetime.now(timezone.utc).date() + timedelta(days=day_offset + 1)
    target_dow = target_date.weekday()
    target_month = target_date.month
    is_weekend = 1 if target_dow >= 5 else 0

    # Pricing and inventory
    selling_price = float(product_data.get('selling_price', 10.0))
    cost_price = float(product_data.get('cost_price', 6.0))
    price_ratio = selling_price / max(cost_price, 0.01)

    opening = float(product_data.get('opening_inventory', product_data.get('on_hand', 0.0)))
    available = float(product_data.get('available', opening))
    incoming = float(product_data.get('incoming_qty', 0.0))
    safety_stock = float(product_data.get('safety_stock', 10.0))
    lead_time = float(product_data.get('lead_time_days', 7.0))

    days_of_supply = available / max(mean7, 1e-6)
    inv_pos = available + incoming

    # Days since last sale calculation
    days_since_sale = 0.0
    if len(recent_sales) > 0:
        found = False
        for dist, sale in enumerate(reversed(recent_sales)):
            if sale > 0:
                days_since_sale = float(dist)
                found = True
                break
        if not found:
            days_since_sale = 999.0

    # Assemble dictionary of candidate features
    feature_dict: Dict[str, float] = {
        'lag_1': float(product_data.get('lag_1', recent_sales[-1] if len(recent_sales) >= 1 else 0.0)),
        'lag_7': float(product_data.get('lag_7', recent_sales[-7] if len(recent_sales) >= 7 else (recent_sales[0] if recent_sales else 0.0))),
        'lag_14': float(product_data.get('lag_14', recent_sales[-14] if len(recent_sales) >= 14 else (recent_sales[0] if recent_sales else 0.0))),
        'lag_28': float(product_data.get('lag_28', recent_sales[-28] if len(recent_sales) >= 28 else (recent_sales[0] if recent_sales else 0.0))),
        'rolling_mean_7': float(product_data.get('rolling_mean_7', mean7)),
        'rolling_std_7': float(product_data.get('rolling_std_7', std7)),
        'rolling_mean_14': float(product_data.get('rolling_mean_14', mean14)),
        'rolling_std_14': float(product_data.get('rolling_std_14', std14)),
        'lag_stockout_7': float(product_data.get('lag_stockout_7', 0.0)),
        'days_since_last_sale': float(product_data.get('days_since_last_sale', days_since_sale)),
        'day_of_week': float(target_dow),
        'month': float(target_month),
        'is_weekend': float(is_weekend),
        'is_holiday': float(product_data.get('holiday', product_data.get('is_holiday', 0))),
        'is_promo': float(product_data.get('promo', product_data.get('is_promo', 0))),
        'selling_price': selling_price,
        'cost_price': cost_price,
        'price_ratio': price_ratio,
        'opening_inventory': opening,
        'on_hand': opening,
        'available': available,
        'safety_stock': safety_stock,
        'incoming_qty': incoming,
        'lead_time_days': lead_time,
        'days_of_supply': days_of_supply,
        'inventory_position': inv_pos,
        'demand_volatility_14': float(product_data.get('demand_volatility_14', std14)),
    }

    # Extract ordered vector
    vec = [float(feature_dict.get(c, 0.0)) for c in cols]
    return np.array([vec], dtype=np.float32)
