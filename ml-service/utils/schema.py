"""
Schema definitions for ORIMS ML demand forecasting and stockout models.
"""

from typing import List

CANONICAL_COLS: List[str] = [
    'store_id',
    'product_id',
    'date',
    'demand',
    'units_sold',
    'opening_inventory',
    'available',
    'incoming_qty',
    'lead_time_days',
    'selling_price',
    'cost_price',
    'promo',
    'holiday',
    'stockout_flag',
    'expiry_date',
    'batch_id',
]

# V1 feature columns (19 features, backward-compatible with v1.0 HistGradientBoosting)
FEATURE_COLUMNS_V1: List[str] = [
    'lag_1', 'lag_7', 'lag_14', 'lag_28',
    'rolling_mean_7', 'rolling_std_7',
    'rolling_mean_14', 'rolling_std_14',
    'day_of_week', 'month', 'is_weekend',
    'selling_price', 'cost_price', 'price_ratio',
    'on_hand', 'available', 'safety_stock',
    'incoming_qty', 'lead_time_days',
]

# V2 feature columns (26 features with supply-chain metrics and stockout history)
FEATURE_COLUMNS_V2: List[str] = [
    'lag_1', 'lag_7', 'lag_14', 'lag_28',
    'rolling_mean_7', 'rolling_std_7',
    'rolling_mean_14', 'rolling_std_14',
    'lag_stockout_7', 'days_since_last_sale',
    'day_of_week', 'month', 'is_weekend',
    'is_holiday', 'is_promo',
    'selling_price', 'cost_price', 'price_ratio',
    'opening_inventory', 'available', 'safety_stock',
    'incoming_qty', 'lead_time_days',
    'days_of_supply', 'inventory_position',
    'demand_volatility_14',
]

# Aliases
FEATURE_COLUMNS = FEATURE_COLUMNS_V2

TARGET_DEMAND = 'target_demand_h1'
TARGET_STOCKOUT = 'stockout_within_lead_time'
