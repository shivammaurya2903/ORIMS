"""
Data loading and dataset retrieval utilities for ORIMS ML Service.
"""

import os
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Tuple
import numpy as np
import pandas as pd

from .config import DATA_DIR, DATASETS_DIR
from .schema import CANONICAL_COLS
from datasets.base import standardize_canonical
from datasets.supermarket import to_canonical as supermarket_to_canonical
from datasets.pharmacy import to_canonical as pharmacy_to_canonical

logger = logging.getLogger(__name__)


def ensure_dirs():
    """Ensure data and dataset directories exist."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    DATASETS_DIR.mkdir(parents=True, exist_ok=True)


def load_fixture() -> pd.DataFrame:
    """
    Loads or generates a high-fidelity synthetic ORIMS inventory & demand fixture.
    Deterministic seed for reproducibility.
    """
    ensure_dirs()
    fixture = DATA_DIR / 'sample_orims_fixture.csv'
    if fixture.exists():
        try:
            df = pd.read_csv(fixture)
            return standardize_canonical(df)
        except Exception:
            pass

    np.random.seed(123)
    dates = pd.date_range('2025-01-01', periods=90)
    rows = []
    for pid in ['P001', 'P002', 'P003']:
        for sid in ['S001']:
            inv = 100
            for d in dates:
                demand = int(max(0, np.random.poisson(5 + (d.dayofweek >= 5) * 2)))
                sold = min(demand, inv)
                inv = inv - sold + np.random.randint(0, 20)
                rows.append({
                    'store_id': sid,
                    'product_id': pid,
                    'date': d.strftime('%Y-%m-%d'),
                    'demand': demand,
                    'units_sold': sold,
                    'opening_inventory': max(0, inv + sold),
                    'available': inv,
                    'incoming_qty': 0,
                    'lead_time_days': 7,
                    'selling_price': 10.0,
                    'cost_price': 6.0,
                    'promo': int(np.random.random() < 0.1),
                    'holiday': int(d.dayofweek == 6),
                    'stockout_flag': int(sold < demand),
                    'expiry_date': None,
                    'batch_id': 'B1',
                })

    df = pd.DataFrame(rows)
    df.to_csv(fixture, index=False)
    return standardize_canonical(df)


def load_m5_sample(max_items: int = 15, max_days: int = 180) -> Optional[pd.DataFrame]:
    """Transform wide M5 fixture into long canonical format if present."""
    m5_path = DATA_DIR / 'sample_m5_fixture.csv'
    if not m5_path.exists():
        return None

    try:
        df_wide = pd.read_csv(m5_path, nrows=max_items)
        day_cols = [c for c in df_wide.columns if c.startswith('d_')][:max_days]
        id_vars = [c for c in ['id', 'item_id', 'store_id'] if c in df_wide.columns]

        df_long = pd.melt(
            df_wide,
            id_vars=id_vars,
            value_vars=day_cols,
            var_name='d',
            value_name='demand'
        )

        base_date = datetime(2025, 1, 1).date()
        df_long['day_num'] = df_long['d'].apply(lambda x: int(x.split('_')[1]))
        df_long['date'] = df_long['day_num'].apply(lambda n: base_date + timedelta(days=n - 1))
        df_long['product_id'] = df_long.get('item_id', df_long.get('id', 'P001'))
        df_long['store_id'] = df_long.get('store_id', 'S001')
        df_long.drop(columns=['d', 'day_num'], inplace=True, errors='ignore')

        return standardize_canonical(df_long)
    except Exception as e:
        logger.warning(f"Failed to load M5 fixture: {e}")
        return None


def load_dataset(name: str = 'supermarket') -> Tuple[pd.DataFrame, str]:
    """
    Loads dataset by domain name ('supermarket', 'pharmacy', 'm5', or 'fixture').
    Applies domain canonical adapters and returns (DataFrame, provenance_string).
    """
    name = (name or 'supermarket').lower().strip()
    ensure_dirs()

    if name == 'fixture':
        return load_fixture(), 'FIXTURE'

    if name == 'm5':
        m5_df = load_m5_sample()
        if m5_df is not None:
            return m5_df, 'M5_BENCHMARK_SAMPLE'

    candidates = {
        'supermarket': ['supermarket_inventory_demand.csv', 'supermarket.csv'],
        'pharmacy': ['indian_pharmacy.csv', 'pharmacy.csv', 'dispensing.csv'],
        'm5': ['sales_train_validation.csv', 'sales_train_evaluation.csv'],
    }

    for filename in candidates.get(name, []):
        p = DATA_DIR / filename
        if p.exists():
            try:
                raw_df = pd.read_csv(p)
                if name == 'pharmacy':
                    return pharmacy_to_canonical(raw_df), f'LOCAL_{name.upper()}'
                else:
                    return supermarket_to_canonical(raw_df), f'LOCAL_{name.upper()}'
            except Exception as e:
                logger.warning(f"Error loading {p}: {e}")

    # If m5 sample is available and supermarket was requested, m5 sample is also suitable
    if name == 'm5':
        m5_df = load_m5_sample()
        if m5_df is not None:
            return m5_df, 'M5_BENCHMARK_SAMPLE'

    return load_fixture(), f'FIXTURE_FALLBACK_{name.upper()}'
