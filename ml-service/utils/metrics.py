"""
Evaluation metrics for ORIMS ML forecasting and stockout classification.
"""

from typing import Any, Dict, Optional, Sequence
import numpy as np
from sklearn.metrics import (
    mean_absolute_error,
    mean_squared_error,
    precision_recall_curve,
    roc_auc_score,
    brier_score_loss,
    auc as sklearn_auc,
)


def mae(y_true: Sequence[float], y_pred: Sequence[float]) -> float:
    """Mean Absolute Error."""
    return float(mean_absolute_error(y_true, y_pred))


def rmse(y_true: Sequence[float], y_pred: Sequence[float]) -> float:
    """Root Mean Squared Error."""
    return float(np.sqrt(mean_squared_error(y_true, y_pred)))


def wape(y_true: Sequence[float], y_pred: Sequence[float]) -> Optional[float]:
    """Weighted Absolute Percentage Error (WAPE). Returns None when sum(y_true) is zero."""
    y_t = np.asarray(y_true, dtype=np.float64)
    y_p = np.asarray(y_pred, dtype=np.float64)
    denom = float(np.sum(np.abs(y_t)))
    if denom == 0.0:
        return None
    return float(np.sum(np.abs(y_t - y_p)) / denom)


def bias(y_true: Sequence[float], y_pred: Sequence[float]) -> float:
    """Forecast Bias (mean error)."""
    y_t = np.asarray(y_true, dtype=np.float64)
    y_p = np.asarray(y_pred, dtype=np.float64)
    return float(np.mean(y_p - y_t))


def pinball_loss(y_true: Sequence[float], y_pred: Sequence[float], quantile: float) -> float:
    """Pinball loss for quantile regression."""
    y_t = np.asarray(y_true, dtype=np.float64)
    y_p = np.asarray(y_pred, dtype=np.float64)
    diff = y_t - y_p
    loss = np.maximum(quantile * diff, (quantile - 1.0) * diff)
    return float(np.mean(loss))


def evaluate_forecast(y_true: Sequence[float], y_pred: Sequence[float]) -> Dict[str, Any]:
    """Comprehensive regression evaluation dictionary."""
    y_t = np.asarray(y_true, dtype=np.float64)
    y_p = np.asarray(y_pred, dtype=np.float64)
    w = wape(y_t, y_p)
    return {
        'mae': round(mae(y_t, y_p), 4),
        'rmse': round(rmse(y_t, y_p), 4),
        'wape': round(w, 4) if w is not None else None,
        'bias': round(bias(y_t, y_p), 4),
        'n_samples': int(len(y_t)),
    }


def classification_metrics(
    y_true: Sequence[int],
    y_prob: Sequence[float],
    threshold: float = 0.5
) -> Dict[str, Any]:
    """
    Classification metrics for binary stockout classification.
    Safe against single-class arrays and compatible with NumPy 2.x.
    """
    y_t = np.asarray(y_true, dtype=int)
    y_p = np.asarray(y_prob, dtype=np.float64)
    y_pred = (y_p >= threshold).astype(int)

    tp = int(np.sum((y_pred == 1) & (y_t == 1)))
    fp = int(np.sum((y_pred == 1) & (y_t == 0)))
    tn = int(np.sum((y_pred == 0) & (y_t == 0)))
    fn = int(np.sum((y_pred == 0) & (y_t == 1)))

    precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0.0

    roc_auc = None
    if len(np.unique(y_t)) > 1:
        try:
            roc_auc = round(float(roc_auc_score(y_t, y_p)), 4)
        except Exception:
            roc_auc = None

    brier = None
    try:
        brier = round(float(brier_score_loss(y_t, y_p)), 4)
    except Exception:
        brier = None

    pr_auc = None
    if len(np.unique(y_t)) > 1:
        try:
            prec, rec, _ = precision_recall_curve(y_t, y_p)
            pr_auc = round(float(sklearn_auc(rec, prec)), 4)
        except Exception:
            # Fallback for trapezoidal integration
            try:
                trapz_fn = getattr(np, 'trapezoid', getattr(np, 'trapz', None))
                if trapz_fn:
                    pr_auc = round(float(trapz_fn(rec, prec)), 4)
            except Exception:
                pr_auc = None

    return {
        'threshold': threshold,
        'tp': tp,
        'fp': fp,
        'tn': tn,
        'fn': fn,
        'precision': round(precision, 4),
        'recall': round(recall, 4),
        'f1': round(f1, 4),
        'roc_auc': roc_auc,
        'pr_auc': pr_auc,
        'brier': brier,
    }
