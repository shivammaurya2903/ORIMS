import sys
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

# Add ml-service to sys.path
sys.path.insert(0, str(Path(__file__).parent.parent))

from main import app
from train import evaluate_model

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

def test_forecast_requires_auth(client):
    response = client.post("/internal/forecasts", json={"products": []})
    assert response.status_code == 401

def test_forecast_inference(client):
    payload = {
        "products": [
            {
                "product_id": "test-p1",
                "store_id": "default-store",
                "selling_price": 50.0,
                "cost_price": 25.0,
                "on_hand": 20,
                "available": 15,
                "safety_stock": 5,
                "incoming_qty": 10,
                "lead_time_days": 7,
                "lag_1": 4.0,
                "lag_7": 5.0,
                "lag_14": 3.0,
                "lag_28": 6.0,
                "rolling_mean_7": 4.5,
                "rolling_std_7": 1.2,
                "rolling_mean_14": 4.2,
                "rolling_std_14": 1.1,
                "recent_sales": [3, 4, 5, 2, 6, 4, 5]
            }
        ],
        "horizon_days": 7,
        "feature_schema_version": "1.0"
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
    pred = data["predictions"][0]
    assert pred["product_id"] == "test-p1"
    assert len(pred["predictions"]) == 7
    for item in pred["predictions"]:
        assert "target_date" in item
        assert "predicted_demand" in item
        assert item["predicted_demand"] >= 0

def test_evaluate_model_metrics():
    import numpy as np
    y_true = np.array([10.0, 20.0, 30.0])
    y_pred = np.array([12.0, 18.0, 33.0])
    metrics = evaluate_model(y_true, y_pred)
    assert round(metrics["mae"], 2) == 2.33
    assert metrics["wape"] is not None
    assert metrics["wape"] > 0
    assert metrics["n_samples"] == 3

def test_evaluate_model_zero_demand():
    import numpy as np
    y_true = np.array([0.0, 0.0, 0.0])
    y_pred = np.array([1.0, 2.0, 1.0])
    metrics = evaluate_model(y_true, y_pred)
    assert metrics["wape"] is None  # Undefined when actual demand is 0
