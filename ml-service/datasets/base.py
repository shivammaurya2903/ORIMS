"""
Base canonical transformation utilities for ORIMS datasets.

Provides shared canonical schema normalization to avoid duplicate code across
dataset adapters (supermarket, pharmacy, etc.).
"""

from typing import Dict, Optional
import numpy as np
import pandas as pd


def standardize_canonical(
    df: pd.DataFrame,
    column_mapping: Optional[Dict[str, str]] = None,
    default_store_id: str = 'S001',
    default_product_id: str = 'P001',
    default_selling_price: float = 10.0,
    default_cost_price: float = 6.0,
    default_lead_time_days: int = 7,
) -> pd.DataFrame:
    """
    Normalizes any input dataframe into the standard ORIMS canonical schema:
    - Renames matching columns based on column_mapping
    - Ensures date format is pd.Timestamp
    - Provides consistent fallback defaults for all canonical inventory and demand fields
    """
    df = df.copy()

    # 1. Apply column mapping if provided
    if column_mapping:
        rename_dict = {}
        for col in df.columns:
            cl = str(col).strip().lower()
            if cl in column_mapping:
                rename_dict[col] = column_mapping[cl]
        df = df.rename(columns=rename_dict)

    # 2. Date parsing or generation
    if 'date' in df.columns:
        df['date'] = pd.to_datetime(df['date'])
    else:
        df['date'] = pd.date_range('2025-01-01', periods=len(df))

    # 3. Identifiers
    if 'store_id' not in df.columns:
        df['store_id'] = default_store_id
    if 'product_id' not in df.columns:
        df['product_id'] = default_product_id

    # 4. Demand and Units Sold cross-fill
    if 'demand' not in df.columns and 'units_sold' in df.columns:
        df['demand'] = df['units_sold']
    elif 'units_sold' not in df.columns and 'demand' in df.columns:
        df['units_sold'] = df['demand']
    elif 'demand' not in df.columns and 'units_sold' not in df.columns:
        df['demand'] = 0.0
        df['units_sold'] = 0.0

    df['demand'] = pd.to_numeric(df['demand'], errors='coerce').fillna(0.0).astype(float)
    df['units_sold'] = pd.to_numeric(df['units_sold'], errors='coerce').fillna(0.0).astype(float)

    # 5. Inventory and Supply
    if 'opening_inventory' not in df.columns:
        df['opening_inventory'] = df.get('available', 0.0)
    df['opening_inventory'] = pd.to_numeric(df['opening_inventory'], errors='coerce').fillna(0.0).astype(float)

    if 'available' not in df.columns:
        df['available'] = df['opening_inventory']
    df['available'] = pd.to_numeric(df['available'], errors='coerce').fillna(0.0).astype(float)

    if 'incoming_qty' not in df.columns:
        df['incoming_qty'] = 0.0
    df['incoming_qty'] = pd.to_numeric(df['incoming_qty'], errors='coerce').fillna(0.0).astype(float)

    if 'safety_stock' not in df.columns:
        df['safety_stock'] = 10.0
    df['safety_stock'] = pd.to_numeric(df['safety_stock'], errors='coerce').fillna(10.0).astype(float)

    if 'lead_time_days' not in df.columns:
        df['lead_time_days'] = default_lead_time_days
    df['lead_time_days'] = pd.to_numeric(df['lead_time_days'], errors='coerce').fillna(default_lead_time_days).astype(float)

    # 6. Pricing
    if 'selling_price' not in df.columns:
        df['selling_price'] = default_selling_price
    df['selling_price'] = pd.to_numeric(df['selling_price'], errors='coerce').fillna(default_selling_price).astype(float)

    if 'cost_price' not in df.columns:
        df['cost_price'] = default_cost_price
    df['cost_price'] = pd.to_numeric(df['cost_price'], errors='coerce').fillna(default_cost_price).astype(float)

    # 7. Promotions, Holidays & Stockouts
    if 'promo' not in df.columns:
        df['promo'] = 0
    df['promo'] = pd.to_numeric(df['promo'], errors='coerce').fillna(0).astype(int)

    if 'holiday' not in df.columns:
        df['holiday'] = 0
    df['holiday'] = pd.to_numeric(df['holiday'], errors='coerce').fillna(0).astype(int)

    if 'stockout_flag' not in df.columns:
        df['stockout_flag'] = (df['units_sold'] < df['demand']).astype(int)
    else:
        df['stockout_flag'] = pd.to_numeric(df['stockout_flag'], errors='coerce').fillna(0).astype(int)

    # 8. Batch / Expiry metadata
    if 'expiry_date' not in df.columns:
        df['expiry_date'] = None
    if 'batch_id' not in df.columns:
        df['batch_id'] = None

    return df
