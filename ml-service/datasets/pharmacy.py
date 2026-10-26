"""
Indian Pharmacy Dataset Adapter for ORIMS.

Normalizes pharmacy dispensing and stockout schemas into the ORIMS canonical format.
"""

import pandas as pd
from .base import standardize_canonical

PHARMACY_COLUMN_MAPPING = {
    'date': 'date',
    'store_id': 'store_id',
    'store': 'store_id',
    'drug_id': 'product_id',
    'product_id': 'product_id',
    'item_id': 'product_id',
    'demand': 'demand',
    'units_dispensed': 'units_sold',
    'units_sold': 'units_sold',
    'stock_on_hand': 'opening_inventory',
    'opening_inventory': 'opening_inventory',
    'units_ordered': 'incoming_qty',
    'incoming_qty': 'incoming_qty',
    'stockout': 'stockout_flag',
    'stockout_flag': 'stockout_flag',
    'expiry_date': 'expiry_date',
    'batch_id': 'batch_id',
    'lead_time': 'lead_time_days',
    'lead_time_days': 'lead_time_days',
    'selling_price': 'selling_price',
    'cost_price': 'cost_price',
    'promo': 'promo',
    'holiday': 'holiday',
}


def to_canonical(df: pd.DataFrame) -> pd.DataFrame:
    """Transform Indian pharmacy dataset into canonical schema."""
    return standardize_canonical(df, column_mapping=PHARMACY_COLUMN_MAPPING)
