"""
Backward compatibility bridge for m5_data module.
Redirects to utils.data and datasets.base.
"""

from utils.data import load_dataset, load_m5_sample, load_fixture
from datasets.base import standardize_canonical

def load_m5_dataset(max_items: int = 15, max_days: int = 180, allow_download: bool = False):
    """Loads M5 dataset in canonical format."""
    return load_dataset('m5')

__all__ = [
    'load_dataset',
    'load_m5_sample',
    'load_m5_dataset',
    'load_fixture',
    'standardize_canonical',
]
