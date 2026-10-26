"""
FastAPI Inference Service for ORIMS ML Demand Forecasting and Stockout Prediction.

Features:
- Multi-quantile demand forecasting (P50, P90, P95)
- Calibrated stockout risk classification and days-of-supply calculation
- Autoregressive multi-horizon rollouts without calendar or series leakage
- Baseline moving average fallbacks for resilience
- Full compatibility with ORIMS Node.js backend
"""

import os
import warnings

# On modern Windows (Windows 11+), wmic.exe is deprecated/uninstalled by default.
# Pre-populating loky's physical_cores_cache and setting LOKY_MAX_CPU_COUNT completely prevents WinError 2.
os.environ.setdefault("LOKY_MAX_CPU_COUNT", str(os.cpu_count() or 4))
try:
    import joblib.externals.loky.backend.context as _loky_context
    _loky_context.physical_cores_cache = os.cpu_count() or 4
except Exception:
    pass

warnings.filterwarnings("ignore", message=r".*Could not find the number of physical cores.*", category=UserWarning)

import json
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import joblib
import secrets
from fastapi import FastAPI, HTTPException, Depends, Security, status
from fastapi.security import APIKeyHeader
from pydantic import BaseModel, Field

from utils.config import MODELS_DIR, ML_API_KEY, FEATURE_SCHEMA_VERSION
from utils.features import prepare_inference_features
from utils.schema import FEATURE_COLUMNS_V2, FEATURE_COLUMNS_V1

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger(__name__)

# Security
api_key_header = APIKeyHeader(name='X-API-Key', auto_error=False)


async def verify_api_key(api_key: str = Security(api_key_header)):
    if not api_key or not secrets.compare_digest(api_key, ML_API_KEY):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='Invalid or missing API key',
        )
    return api_key


# Global model registry
models: Dict[str, Any] = {}
meta: Dict[str, Any] = {
    'status': 'STARTING',
    'version': 'v2.0.0',
    'model_family': 'hgb_quantile_plus_classifier',
    'data_provenance': 'SYNTHETIC',
    'feature_schema_version': FEATURE_SCHEMA_VERSION,
    'metrics': {},
}


def load_artifacts():
    """Load serialized models and metadata from disk with safe fallback."""
    global models, meta
    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    loaded_any = False

    # 1. Load metadata if available
    metadata_path = MODELS_DIR / 'metadata.json'
    if metadata_path.exists():
        try:
            with open(metadata_path, 'r', encoding='utf-8') as f:
                loaded_meta = json.load(f)
                meta.update(loaded_meta)
                logger.info(f"Loaded model metadata from {metadata_path}")
        except Exception as e:
            logger.warning(f"Could not load metadata: {e}")

    # 2. Load Quantile models
    for key, filename in [
        ('p50', 'demand_q50.joblib'),
        ('p90', 'demand_q90.joblib'),
        ('p95', 'demand_q95.joblib'),
        ('clf', 'stockout_classifier.joblib'),
        ('base', 'model.joblib'),
    ]:
        p = MODELS_DIR / filename
        if p.exists():
            try:
                models[key] = joblib.load(p)
                loaded_any = True
                logger.info(f"Loaded artifact '{key}' from {p}")
            except Exception as e:
                logger.warning(f"Failed to load {filename}: {e}")

    if 'p50' in models or 'base' in models:
        meta['status'] = 'ACTIVE'
    else:
        meta['status'] = 'DEGRADED'
        logger.warning("No demand forecasting model artifacts found. Service running in degraded fallback mode.")


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_artifacts()
    yield

# Initial eager load for synchronous test harnesses and server imports
load_artifacts()

app = FastAPI(
    title='ORIMS ML Forecasting Service (Quantiles+Classifier)',
    version='2.0.0',
    lifespan=lifespan,
)


# Request and Response schemas
class ForecastRequest(BaseModel):
    model_config = {'protected_namespaces': ()}
    products: List[Dict[str, Any]] = Field(..., max_length=200, description="List of product feature payloads")
    horizon_days: int = Field(default=7, ge=1, le=14, description="Forecast horizon in days (1-14)")
    feature_schema_version: str = Field(default=FEATURE_SCHEMA_VERSION, description="Feature schema version")


class ForecastResponse(BaseModel):
    model_config = {'protected_namespaces': ()}
    predictions: List[Dict[str, Any]]
    model_version: str
    model_family: str
    generated_at: str
    feature_schema_version: str
    status: str = 'success'


class HealthResponse(BaseModel):
    model_config = {'protected_namespaces': ()}
    status: str
    model_loaded: bool
    model_version: Optional[str]
    timestamp: str


def compute_baseline_moving_average(product: Dict[str, Any], horizon_days: int) -> List[Dict[str, Any]]:
    """Generates baseline moving average predictions when models are unavailable."""
    recent = [float(x) for x in product.get('recent_sales', [])]
    if len(recent) > 0:
        window = min(7, len(recent))
        avg = float(np.mean(recent[-window:]))
    else:
        avg = float(product.get('selling_price', 10.0) * 0.5)

    avg = max(0.0, avg)
    out = []
    for i in range(horizon_days):
        td = (datetime.now(timezone.utc).date() + timedelta(days=i + 1)).isoformat()
        out.append({
            'target_date': td,
            'predicted_demand': round(avg, 2),
            'demand_p50': round(avg, 2),
            'demand_p90': round(avg * 1.5, 2),
            'demand_p95': round(avg * 1.8, 2),
        })
    return out


@app.get('/health', response_model=HealthResponse)
async def health():
    return HealthResponse(
        status='healthy' if len(models) > 0 else 'degraded',
        model_loaded=len(models) > 0,
        model_version=meta.get('version'),
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


@app.get('/internal/model-info')
async def model_info(api_key: str = Depends(verify_api_key)):
    return {
        'version': meta.get('version', 'v2.0.0'),
        'model_family': meta.get('model_family', 'hgb_quantile_plus_classifier'),
        'data_provenance': meta.get('data_provenance', 'M5_BENCHMARK_SAMPLE'),
        'training_start_date': meta.get('training_start_date'),
        'training_end_date': meta.get('training_end_date'),
        'feature_schema_version': meta.get('feature_schema_version', FEATURE_SCHEMA_VERSION),
        'metrics': meta.get('metrics', {}),
        'status': meta.get('status', 'ACTIVE' if len(models) > 0 else 'DEGRADED'),
    }


@app.post('/internal/forecasts', response_model=ForecastResponse)
async def forecast(req: ForecastRequest, api_key: str = Depends(verify_api_key)):
    preds = []

    for p in req.products:
        pid = p.get('product_id')
        sid = p.get('store_id', 'default-store')

        if pid is None:
            preds.append({
                'product_id': None,
                'store_id': sid,
                'predictions': [],
                'status': 'error',
                'error': 'Missing product_id',
            })
            continue

        try:
            # Check model availability
            has_quantiles = 'p50' in models and 'p90' in models and 'p95' in models
            has_base = 'base' in models

            if not (has_quantiles or has_base):
                # Fallback moving average
                out_list = compute_baseline_moving_average(p, req.horizon_days)
                avail = float(p.get('available', p.get('opening_inventory', p.get('on_hand', 0.0))))
                p50 = out_list[0]['demand_p50']
                dos = avail / max(p50, 1e-6)
                lt = int(p.get('lead_time_days', 7))
                preds.append({
                    'product_id': pid,
                    'store_id': sid,
                    'predictions': out_list,
                    'status': 'success',
                    'method': 'BASELINE_MOVING_AVERAGE',
                    'stockout': {
                        'probability_within_lead_time': 0.0,
                        'days_of_supply': round(dos, 2),
                        'risk_level': 'HIGH' if dos < lt else ('MEDIUM' if dos < lt * 1.5 else 'LOW'),
                    },
                })
                continue

            # Multi-step autoregressive rollout
            prod_working = dict(p)
            recent_sales = list(prod_working.get('recent_sales', []))
            prod_working['recent_sales'] = recent_sales

            out_list = []
            max_sp = 0.0

            for day_idx in range(req.horizon_days):
                # Target feature vector for current horizon day offset
                X = prepare_inference_features(prod_working, day_offset=day_idx, feature_columns=FEATURE_COLUMNS_V2)

                if has_quantiles:
                    p50 = float(max(0.0, models['p50'].predict(X)[0]))
                    p90 = float(max(0.0, models['p90'].predict(X)[0]))
                    p95 = float(max(0.0, models['p95'].predict(X)[0]))
                    # Ensure quantile monotonicity
                    p90 = max(p90, p50)
                    p95 = max(p95, p90)
                else:
                    # Model.joblib fallback
                    p50 = float(max(0.0, models['base'].predict(X)[0]))
                    p90 = p50 * 1.5
                    p95 = p50 * 1.8

                if 'clf' in models:
                    try:
                        sp = float(models['clf'].predict_proba(X)[:, 1][0])
                    except Exception:
                        sp = 0.0
                else:
                    sp = 0.0

                max_sp = max(max_sp, sp)

                td = (datetime.now(timezone.utc).date() + timedelta(days=day_idx + 1)).isoformat()
                out_list.append({
                    'target_date': td,
                    'demand_p50': round(p50, 2),
                    'demand_p90': round(p90, 2),
                    'demand_p95': round(p95, 2),
                    'predicted_demand': round(p50, 2),
                })

                # Autoregressive update for subsequent steps
                prod_working['recent_sales'].append(p50)
                for key in ['lag_1', 'lag_7', 'lag_14', 'lag_28', 'rolling_mean_7', 'rolling_std_7', 'rolling_mean_14', 'rolling_std_14']:
                    prod_working.pop(key, None)

            # Stockout risk metrics
            avail = float(p.get('available', p.get('opening_inventory', p.get('on_hand', 0.0))))
            avg_p50 = float(np.mean([x['demand_p50'] for x in out_list])) if out_list else 1.0
            dos = avail / max(avg_p50, 1e-6)
            lt = int(p.get('lead_time_days', 7))

            if max_sp > 0.7 or dos < lt:
                rl = 'HIGH'
            elif max_sp > 0.4 or dos < lt * 1.5:
                rl = 'MEDIUM'
            else:
                rl = 'LOW'

            preds.append({
                'product_id': pid,
                'store_id': sid,
                'predictions': out_list,
                'status': 'success',
                'method': 'MODEL_QUANTILE' if has_quantiles else 'MODEL',
                'stockout': {
                    'probability_within_lead_time': round(max_sp, 4),
                    'days_of_supply': round(dos, 2),
                    'risk_level': rl,
                },
            })

        except Exception as e:
            logger.error(f"Inference error for product {pid}: {e}")
            out_list = compute_baseline_moving_average(p, req.horizon_days)
            preds.append({
                'product_id': pid,
                'store_id': sid,
                'predictions': out_list,
                'status': 'fallback',
                'method': 'FALLBACK',
                'error': str(e),
            })

    return ForecastResponse(
        predictions=preds,
        model_version=meta.get('version', 'v2.0.0'),
        model_family=meta.get('model_family', 'hgb_quantile_plus_classifier'),
        generated_at=datetime.now(timezone.utc).isoformat(),
        feature_schema_version=req.feature_schema_version,
        status='success',
    )


if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=8000)
