"""
Backward compatibility bridge for features module.
Redirects to utils.features, utils.schema, and utils.metrics.
"""

from utils.features import build_features, build_features as build_time_series_features, prepare_inference_features
from utils.schema import FEATURE_COLUMNS, FEATURE_COLUMNS_V1, FEATURE_COLUMNS_V2, TARGET_DEMAND, TARGET_STOCKOUT
from utils.metrics import evaluate_forecast as evaluate_model, mae, rmse, wape, bias

__all__ = [
    'build_features',
    'build_time_series_features',
    'prepare_inference_features',
    'FEATURE_COLUMNS',
    'FEATURE_COLUMNS_V1',
    'FEATURE_COLUMNS_V2',
    'TARGET_DEMAND',
    'TARGET_STOCKOUT',
    'evaluate_model',
    'mae',
    'rmse',
    'wape',
    'bias',
]
