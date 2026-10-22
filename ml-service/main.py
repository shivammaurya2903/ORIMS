"""
FastAPI Inference Service for ORIMS ML Demand Forecasting.

Endpoints:
- GET /health: Service health and model status
- GET /internal/model-info: Version, family, training dates, and metrics
- POST /internal/forecasts: Multi-horizon retail demand forecasts
"""

import os
os.environ.setdefault("LOKY_MAX_CPU_COUNT", str(os.cpu_count() or 4))
import json
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from contextlib import asynccontextmanager

import numpy as np
import joblib
from fastapi import FastAPI, HTTPException, Depends, Security, status
from fastapi.security import APIKeyHeader
from pydantic import BaseModel, Field

from features import FEATURE_COLUMNS, prepare_inference_features

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger(__name__)

# Configuration
if os.getenv("MODEL_PATH"):
    MODEL_DIR = Path(os.getenv("MODEL_PATH"))
elif os.name == "posix" and Path("/app/models").exists():
    MODEL_DIR = Path("/app/models")
else:
    MODEL_DIR = Path(__file__).resolve().parent / "models"

MODEL_DIR.mkdir(parents=True, exist_ok=True)

ML_API_KEY = os.getenv("ML_API_KEY", "dev-ml-api-key")
MODEL_VERSION = os.getenv("MODEL_VERSION", "v1.0.0")
MODEL_FAMILY = "hist_gradient_boosting"

# Security
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def verify_api_key(api_key: str = Security(api_key_header)):
    if not api_key or api_key != ML_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key",
        )
    return api_key


# Global model storage
model = None
model_metadata: Dict[str, Any] = {}


# Pydantic schemas
class ForecastRequest(BaseModel):
    model_config = {"protected_namespaces": ()}
    products: List[Dict[str, Any]] = Field(..., description="List of product feature sets")
    horizon_days: int = Field(default=7, ge=1, le=30, description="Forecast horizon in days")
    feature_schema_version: str = Field(default="1.0", description="Feature schema version")


class ForecastResponse(BaseModel):
    model_config = {"protected_namespaces": ()}
    predictions: List[Dict[str, Any]]
    model_version: str
    model_family: str
    generated_at: str
    feature_schema_version: str
    status: str = "success"


class HealthResponse(BaseModel):
    model_config = {"protected_namespaces": ()}
    status: str
    model_loaded: bool
    model_version: Optional[str]
    timestamp: str


class ModelInfoResponse(BaseModel):
    model_config = {"protected_namespaces": ()}
    version: str
    model_family: str
    data_provenance: Optional[str] = "SYNTHETIC"
    training_start_date: Optional[str]
    training_end_date: Optional[str]
    feature_schema_version: str
    metrics: Dict[str, Any]
    status: str


def load_model():
    """Load serialized model and metadata from disk."""
    global model, model_metadata
    model_path = MODEL_DIR / "model.joblib"
    metadata_path = MODEL_DIR / "metadata.json"

    if model_path.exists():
        try:
            model = joblib.load(model_path)
            logger.info(f"Model loaded successfully from {model_path}")
        except Exception as e:
            logger.error(f"Failed to load model artifact: {e}")
            model = None

    if metadata_path.exists():
        try:
            with open(metadata_path, "r", encoding="utf-8") as f:
                model_metadata = json.load(f)
            logger.info(f"Model metadata loaded from {metadata_path}")
        except Exception as e:
            logger.error(f"Failed to load metadata: {e}")
            model_metadata = {}
    else:
        model_metadata = {
            "version": MODEL_VERSION,
            "model_family": MODEL_FAMILY,
            "data_provenance": "SYNTHETIC",
            "training_start_date": None,
            "training_end_date": None,
            "feature_schema_version": "1.0",
            "metrics": {},
            "status": "NO_MODEL",
        }


def compute_baseline_forecast(product_data: Dict[str, Any], horizon: int) -> Tuple[List[float], str]:
    """Fallback moving average or day-of-week forecast when ML model is unavailable."""
    recent_sales = [float(x) for x in product_data.get('recent_sales', [])]
    if not recent_sales:
        return [0.0] * horizon, "BASELINE_MOVING_AVERAGE"

    dow_patterns = product_data.get('dow_patterns', {})
    if dow_patterns and len(recent_sales) >= 14:
        preds = []
        for i in range(horizon):
            target_dow = (datetime.now(timezone.utc).weekday() + i + 1) % 7
            preds.append(float(dow_patterns.get(str(target_dow), np.mean(recent_sales[-7:]))))
        return preds, "BASELINE_DAY_OF_WEEK"

    # Moving average of last 7 observations
    window = min(7, len(recent_sales))
    avg = float(np.mean(recent_sales[-window:]))
    return [max(0.0, avg)] * horizon, "BASELINE_MOVING_AVERAGE"


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_model()
    yield


app = FastAPI(
    title="ORIMS ML Forecasting Service",
    version="1.0.0",
    lifespan=lifespan,
)


@app.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(
        status="healthy" if model is not None else "degraded",
        model_loaded=model is not None,
        model_version=model_metadata.get("version") if model else None,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


@app.get("/internal/model-info", response_model=ModelInfoResponse)
async def model_info(api_key: str = Depends(verify_api_key)):
    return ModelInfoResponse(
        version=model_metadata.get("version", MODEL_VERSION),
        model_family=model_metadata.get("model_family", MODEL_FAMILY),
        data_provenance=model_metadata.get("data_provenance", "SYNTHETIC"),
        training_start_date=model_metadata.get("training_start_date"),
        training_end_date=model_metadata.get("training_end_date"),
        feature_schema_version=model_metadata.get("feature_schema_version", "1.0"),
        metrics=model_metadata.get("metrics", {}),
        status=model_metadata.get("status", "ACTIVE" if model is not None else "NO_MODEL"),
    )


@app.post("/internal/forecasts", response_model=ForecastResponse)
async def forecast(request: ForecastRequest, api_key: str = Depends(verify_api_key)):
    predictions = []

    for product in request.products:
        product_id = product.get("product_id")
        store_id = product.get("store_id", "default-store")

        if product_id is None:
            predictions.append({
                "product_id": product_id,
                "store_id": store_id,
                "predictions": [],
                "status": "error",
                "error": "Missing product_id",
            })
            continue

        try:
            if model is not None:
                # Multi-step autoregressive rollout
                preds = []
                prod_copy = dict(product)
                # Clone recent_sales to avoid mutating input
                prod_copy["recent_sales"] = list(prod_copy.get("recent_sales", []))

                for day_idx in range(request.horizon_days):
                    features = prepare_inference_features(prod_copy, day_offset=day_idx)
                    step_pred = float(np.maximum(model.predict(features)[0], 0.0))
                    preds.append(step_pred)

                    # Update autoregressive lags for subsequent horizon steps
                    prod_copy["lag_1"] = step_pred
                    prod_copy["recent_sales"].append(step_pred)

                method = "MODEL"
            else:
                preds, method = compute_baseline_forecast(product, request.horizon_days)

            # Format dated predictions
            pred_list = []
            for i, pred in enumerate(preds[:request.horizon_days]):
                target_date = datetime.now(timezone.utc).date() + timedelta(days=i + 1)
                pred_list.append({
                    "target_date": target_date.isoformat(),
                    "predicted_demand": round(float(pred), 2),
                })

            predictions.append({
                "product_id": product_id,
                "store_id": store_id,
                "predictions": pred_list,
                "status": "success",
                "method": method,
            })

        except Exception as e:
            logger.error(f"Inference failed for product {product_id}: {e}")
            preds, method = compute_baseline_forecast(product, request.horizon_days)
            pred_list = []
            for i, pred in enumerate(preds[:request.horizon_days]):
                target_date = datetime.now(timezone.utc).date() + timedelta(days=i + 1)
                pred_list.append({
                    "target_date": target_date.isoformat(),
                    "predicted_demand": round(float(pred), 2),
                })

            predictions.append({
                "product_id": product_id,
                "store_id": store_id,
                "predictions": pred_list,
                "status": "fallback",
                "method": method,
                "error": str(e),
            })

    return ForecastResponse(
        predictions=predictions,
        model_version=model_metadata.get("version", MODEL_VERSION),
        model_family=model_metadata.get("model_family", MODEL_FAMILY),
        generated_at=datetime.now(timezone.utc).isoformat(),
        feature_schema_version=request.feature_schema_version,
        status="success",
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
