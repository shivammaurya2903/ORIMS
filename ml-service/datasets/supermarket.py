"""
Supermarket Inventory & Demand Dataset Adapter for ORIMS.

Normalizes supermarket retail transactions and store inventory into the ORIMS canonical format.
"""

import pandas as pd
from .base import standardize_canonical

SUPERMARKET_COLUMN_MAPPING = {
    'date': 'date',
    'day': 'date',
    'store': 'store_id',
    'store_id': 'store_id',
    'product': 'product_id',
    'product_id': 'product_id',
    'item_id': 'product_id',
    'demand': 'demand',
    'baseline_demand_units': 'demand',
    'effective_demand_units': 'demand',
    'units_sold': 'units_sold',
    'actual_sales_units': 'units_sold',
    'opening_inventory': 'opening_inventory',
    'opening_inventory_units': 'opening_inventory',
    'stock_level': 'opening_inventory',
    'lead_time': 'lead_time_days',
    'lead_time_days': 'lead_time_days',
    'promo': 'promo',
    'promotion': 'promo',
    'holiday': 'holiday',
    'out_of_stock_flag': 'stockout_flag',
    'stockout_flag': 'stockout_flag',
    'stockout': 'stockout_flag',
    'selling_price': 'selling_price',
    'cost_price': 'cost_price',
    'incoming_qty': 'incoming_qty',
    'safety_stock': 'safety_stock',
    'available': 'available',
    'expiry_date': 'expiry_date',
    'batch_id': 'batch_id',
}


def to_canonical(df: pd.DataFrame) -> pd.DataFrame:
    """Transform Supermarket dataset into canonical schema."""
    return standardize_canonical(df, column_mapping=SUPERMARKET_COLUMN_MAPPING)
