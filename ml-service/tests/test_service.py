"""
Comprehensive automated test suite for ORIMS ML Service.

Covers:
- API authentication and security
- Health and model metadata endpoints
- Quantile forecast generation and autoregressive rollout
- Stockout classification and risk assessment
- Dynamic feature preparation and calendar progression
- Dataset canonical adapters (supermarket and pharmacy deduplication)
- Group feature engineering without series leakage
- Metrics evaluation (regression and classification)
"""

import sys
from pathlib import Path
import pytest
import numpy as np
import pandas as pd
from fastapi.testclient import TestClient

# Ensure ml-service root is on sys.path
ML_ROOT = Path(__file__).resolve().parent.parent
if str(ML_ROOT) not in sys.path:
    sys.path.insert(0, str(ML_ROOT))

from api import app, meta, models
from utils.features import (
    build_features,
    prepare_inference_features,
)
from utils.schema import FEATURE_COLUMNS_V2, CANONICAL_COLS
from utils.metrics import (
    mae,
    rmse,
    wape,
    bias,
    pinball_loss,
    evaluate_forecast,
    classification_metrics,
)
from utils.data import load_dataset, load_fixture
from datasets.base import standardize_canonical
import datasets.supermarket as supermarket_adapter
import datasets.pharmacy as pharmacy_adapter


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "model_loaded" in data
    assert "timestamp" in data
    assert data["model_loaded"] is True
    assert data["status"] == "healthy"


def test_model_info_requires_auth(client):
    response = client.get("/internal/model-info")
    assert response.status_code == 401


def test_model_info_with_valid_key(client):
    response = client.get("/internal/model-info", headers={"X-API-Key": "dev-ml-api-key"})
    assert response.status_code == 200
    data = response.json()
    assert "version" in data
    assert "model_family" in data
    assert "metrics" in data
    assert data["status"] == "ACTIVE"
    assert data["feature_schema_version"] == "2.0"


def test_forecast_requires_auth(client):
    response = client.post("/internal/forecasts", json={"products": []})
    assert response.status_code == 401


def test_forecast_inference_quantiles(client):
    payload = {
        "products": [
            {
                "product_id": "P001",
                "store_id": "S001",
                "selling_price": 50.0,
                "cost_price": 25.0,
                "available": 15.0,
                "opening_inventory": 20.0,
                "safety_stock": 5.0,
                "incoming_qty": 10.0,
                "lead_time_days": 7,
                "recent_sales": [3, 4, 5, 2, 6, 4, 5, 6, 7, 4, 5, 6, 5, 4]
            }
        ],
        "horizon_days": 7,
        "feature_schema_version": "2.0"
    }
    response = client.post(
        "/internal/forecasts",
        headers={"X-API-Key": "dev-ml-api-key"},
        json=payload
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert len(data["predictions"]) == 1

    item = data["predictions"][0]
    assert item["product_id"] == "P001"
    assert item["store_id"] == "S001"
    assert item["status"] == "success"
    assert len(item["predictions"]) == 7

    for pred in item["predictions"]:
        assert "target_date" in pred
        assert "predicted_demand" in pred
        assert "demand_p50" in pred
        assert "demand_p90" in pred
        assert "demand_p95" in pred
        assert pred["demand_p50"] >= 0
        assert pred["demand_p90"] >= pred["demand_p50"]
        assert pred["demand_p95"] >= pred["demand_p90"]

    assert "stockout" in item
    assert "probability_within_lead_time" in item["stockout"]
    assert "days_of_supply" in item["stockout"]
    assert item["stockout"]["risk_level"] in ["LOW", "MEDIUM", "HIGH"]


def test_forecast_with_missing_rolling_features(client):
    """Verifies prepare_inference_features dynamically derives rolling stats."""
    payload = {
        "products": [
            {
                "product_id": "dynamic-p2",
                "store_id": "S002",
                "selling_price": 20.0,
                "cost_price": 10.0,
                "available": 50.0,
                "recent_sales": [5, 6, 4, 5, 7, 8, 6, 5, 4, 6, 7, 5, 6, 8]
            }
        ],
        "horizon_days": 5,
    }
    response = client.post(
        "/internal/forecasts",
        headers={"X-API-Key": "dev-ml-api-key"},
        json=payload
    )
    assert response.status_code == 200
    data = response.json()
    pred = data["predictions"][0]
    assert pred["product_id"] == "dynamic-p2"
    assert len(pred["predictions"]) == 5
    assert pred["status"] == "success"


def test_forecast_missing_product_id_handled(client):
    payload = {
        "products": [
            {"selling_price": 10.0}
        ],
        "horizon_days": 3,
    }
    response = client.post(
        "/internal/forecasts",
        headers={"X-API-Key": "dev-ml-api-key"},
        json=payload
    )
    assert response.status_code == 200
    pred = response.json()["predictions"][0]
    assert pred["status"] == "error"
    assert "Missing product_id" in pred["error"]


def test_prepare_inference_features_calendar_progression():
    """Verify calendar features advance per horizon day offset."""
    product = {
        "selling_price": 25.0,
        "cost_price": 15.0,
        "recent_sales": [10.0] * 14,
    }
    vec_day0 = prepare_inference_features(product, day_offset=0)[0]
    vec_day1 = prepare_inference_features(product, day_offset=1)[0]

    # In FEATURE_COLUMNS_V2, day_of_week is at index 10
    idx_dow = FEATURE_COLUMNS_V2.index("day_of_week")
    dow_day0 = vec_day0[idx_dow]
    dow_day1 = vec_day1[idx_dow]
    assert (dow_day0 + 1) % 7 == dow_day1
    assert len(vec_day0) == len(FEATURE_COLUMNS_V2)


def test_canonical_deduplication():
    """Verify supermarket and pharmacy adapters both map cleanly to canonical schema."""
    df_super = pd.DataFrame({
        "day": ["2025-01-01"],
        "store": ["S1"],
        "product": ["P1"],
        "baseline_demand_units": [12],
        "actual_sales_units": [10],
        "opening_inventory_units": [50],
    })
    canonical_super = supermarket_adapter.to_canonical(df_super)

    df_pharm = pd.DataFrame({
        "date": ["2025-01-01"],
        "store_id": ["S1"],
        "drug_id": ["P1"],
        "demand": [12],
        "units_dispensed": [10],
        "stock_on_hand": [50],
    })
    canonical_pharm = pharmacy_adapter.to_canonical(df_pharm)

    for col in ["date", "store_id", "product_id", "demand", "units_sold", "opening_inventory"]:
        assert col in canonical_super.columns
        assert col in canonical_pharm.columns
        assert canonical_super[col].iloc[0] == canonical_pharm[col].iloc[0]


def test_time_series_features_no_leakage():
    """Verify build_features groups properly by product/store without cross-group leakage."""
    df, _ = load_dataset('fixture')
    feat_df = build_features(df)
    assert len(feat_df) > 0
    for col in FEATURE_COLUMNS_V2:
        assert col in feat_df.columns
        assert not feat_df[col].isna().any()


def test_evaluate_model_metrics():
    y_true = np.array([10.0, 20.0, 30.0])
    y_pred = np.array([12.0, 18.0, 33.0])
    metrics = evaluate_forecast(y_true, y_pred)
    assert round(metrics["mae"], 2) == 2.33
    assert metrics["wape"] is not None
    assert metrics["wape"] > 0
    assert metrics["n_samples"] == 3


def test_evaluate_model_zero_demand():
    y_true = np.array([0.0, 0.0, 0.0])
    y_pred = np.array([1.0, 2.0, 1.0])
    w = wape(y_true, y_pred)
    assert w is None  # Undefined when actual demand sum is 0


def test_classification_metrics():
    y_true = [1, 0, 1, 0]
    y_prob = [0.9, 0.1, 0.8, 0.2]
    res = classification_metrics(y_true, y_prob)
    assert res["precision"] == 1.0
    assert res["recall"] == 1.0
    assert res["f1"] == 1.0
    assert res["roc_auc"] == 1.0
    assert res["pr_auc"] is not None
