import os
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Dict, Any
from pathlib import Path

import numpy as np
import pandas as pd
import joblib
from fastapi import FastAPI, HTTPException, Depends, Security, status
from fastapi.security import APIKeyHeader
from pydantic import BaseModel, Field, validator
from contextlib import asynccontextmanager

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration
default_model_dir = Path("/app/models") if Path("/app/models").exists() else Path(__file__).parent / "models"
MODEL_DIR = Path(os.getenv("MODEL_PATH", str(default_model_dir)))
MODEL_DIR.mkdir(parents=True, exist_ok=True)

ML_API_KEY = os.getenv("ML_API_KEY", "dev-ml-api-key")
MODEL_VERSION = os.getenv("MODEL_VERSION", "v1.0.0")
MODEL_FAMILY = "gradient_boosting"

# Security
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

async def verify_api_key(api_key: str = Security(api_key_header)):
    if api_key != ML_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
        )
    return api_key

# Global model storage
model = None
model_metadata = {}

# Pydantic models
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
    training_start_date: Optional[str]
    training_end_date: Optional[str]
    feature_schema_version: str
    metrics: Dict[str, Any]
    status: str

# Model loading
def load_model():
    global model, model_metadata
    model_path = MODEL_DIR / "model.joblib"
    metadata_path = MODEL_DIR / "metadata.json"
    
    if model_path.exists():
        try:
            model = joblib.load(model_path)
            logger.info(f"Model loaded from {model_path}")
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            model = None
    
    if metadata_path.exists():
        try:
            with open(metadata_path, 'r') as f:
                model_metadata = json.load(f)
            logger.info(f"Model metadata loaded from {metadata_path}")
        except Exception as e:
            logger.error(f"Failed to load model metadata: {e}")
            model_metadata = {}
    else:
        model_metadata = {
            "version": MODEL_VERSION,
            "model_family": MODEL_FAMILY,
            "training_start_date": None,
            "training_end_date": None,
            "feature_schema_version": "1.0",
            "metrics": {},
            "status": "NO_MODEL"
        }

# Feature preparation
def prepare_features(product_data: Dict[str, Any], day_offset: int = 0) -> np.ndarray:
    """
    Prepare features for a single product.
    Expected features (in order):
    - lag_1, lag_7, lag_14, lag_28
    - rolling_mean_7, rolling_std_7
    - rolling_mean_14, rolling_std_14
    - day_of_week, month, is_weekend
    - selling_price, cost_price, price_ratio
    - on_hand, available, safety_stock
    - incoming_qty, lead_time_days
    """
    features = []
    
    # Lag features
    for lag in [1, 7, 14, 28]:
        features.append(product_data.get(f'lag_{lag}', 0))
    
    # Rolling statistics
    for window in [7, 14]:
        features.append(product_data.get(f'rolling_mean_{window}', 0))
        features.append(product_data.get(f'rolling_std_{window}', 0))
    
    # Calendar features adjusted for forecast day offset
    target_date = datetime.now().date() + timedelta(days=day_offset + 1)
    dow = product_data.get('day_of_week', target_date.weekday())
    month = product_data.get('month', target_date.month)
    features.append(dow)
    features.append(month)
    features.append(1 if dow >= 5 else 0)
    
    # Price features
    selling_price = float(product_data.get('selling_price', 1))
    cost_price = float(product_data.get('cost_price', 1))
    features.append(selling_price)
    features.append(cost_price)
    features.append(selling_price / max(cost_price, 0.01))
    
    # Inventory features
    features.append(float(product_data.get('on_hand', 0)))
    features.append(float(product_data.get('available', 0)))
    features.append(float(product_data.get('safety_stock', 0)))
    
    # Supply chain features
    features.append(float(product_data.get('incoming_qty', 0)))
    features.append(float(product_data.get('lead_time_days', 7)))
    
    return np.array(features, dtype=float).reshape(1, -1)

# Baseline forecast
def baseline_forecast(product_data: Dict[str, Any], horizon: int) -> List[float]:
    """Simple moving average baseline."""
    recent_sales = product_data.get('recent_sales', [])
    if not recent_sales or len(recent_sales) == 0:
        return [0.0] * horizon
    
    # Use last 7 days average
    window = min(7, len(recent_sales))
    avg = np.mean(recent_sales[-window:])
    return [max(0, avg)] * horizon

def day_of_week_baseline(product_data: Dict[str, Any], horizon: int) -> List[float]:
    """Day-of-week naive forecast."""
    dow_patterns = product_data.get('dow_patterns', {})
    if not dow_patterns:
        return baseline_forecast(product_data, horizon)
    
    predictions = []
    for i in range(horizon):
        target_dow = (datetime.now().weekday() + i + 1) % 7
        predictions.append(dow_patterns.get(str(target_dow), 0))
    return predictions

# Lifespan
@asynccontextmanager
async def lifespan(app: FastAPI):
    load_model()
    yield

# Create FastAPI app
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
        training_start_date=model_metadata.get("training_start_date"),
        training_end_date=model_metadata.get("training_end_date"),
        feature_schema_version=model_metadata.get("feature_schema_version", "1.0"),
        metrics=model_metadata.get("metrics", {}),
        status=model_metadata.get("status", "UNKNOWN"),
    )

@app.post("/internal/forecasts", response_model=ForecastResponse)
async def forecast(request: ForecastRequest, api_key: str = Depends(verify_api_key)):
    if model is None:
        logger.warning("Model not loaded, using baseline fallback")
    
    predictions = []
    for product in request.products:
        product_id = product.get('product_id')
        store_id = product.get('store_id', 'default-store')
        
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
                # Use trained model across horizon
                preds = []
                prod_copy = dict(product)
                for day_idx in range(request.horizon_days):
                    features = prepare_features(prod_copy, day_offset=day_idx)
                    step_pred = float(np.maximum(model.predict(features)[0], 0))
                    preds.append(step_pred)
                    # Update lag_1 autoregressively for next step
                    prod_copy['lag_1'] = step_pred
                method = "MODEL"
            else:
                # Fallback to baseline
                recent_sales = product.get('recent_sales', [])
                if len(recent_sales) >= 7:
                    preds = day_of_week_baseline(product, request.horizon_days)
                    method = "BASELINE_DAY_OF_WEEK"
                else:
                    preds = baseline_forecast(product, request.horizon_days)
                    method = "BASELINE_MOVING_AVERAGE"
            
            # Format predictions
            pred_list = []
            for i, pred in enumerate(preds[:request.horizon_days]):
                target_date = datetime.now(timezone.utc).date() + timedelta(days=i+1)
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
            logger.error(f"Prediction failed for product {product_id}: {e}")
            # Fallback to baseline
            preds = baseline_forecast(product, request.horizon_days)
            pred_list = []
            for i, pred in enumerate(preds[:request.horizon_days]):
                target_date = datetime.now(timezone.utc).date() + timedelta(days=i+1)
                pred_list.append({
                    "target_date": target_date.isoformat(),
                    "predicted_demand": round(float(pred), 2),
                })
            predictions.append({
                "product_id": product_id,
                "store_id": store_id,
                "predictions": pred_list,
                "status": "fallback",
                "method": "BASELINE_MOVING_AVERAGE",
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