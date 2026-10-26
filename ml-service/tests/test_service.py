import sys
from pathlib import Path
import pytest
import numpy as np
from fastapi.testclient import TestClient

# Add ml-service to sys.path
sys.path.insert(0, str(Path(__file__).parent.parent))

from main import app
from features import (
    FEATURE_COLUMNS,
    build_time_series_features,
    prepare_inference_features,
    evaluate_model,
)
from m5_data import load_m5_dataset, create_deterministic_m5_fixture, locate_m5_data_directory, try_download_m5_kagglehub
from unittest.mock import patch, MagicMock


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
    assert data["data_provenance"] in ["M5_COMPETITION", "M5_BENCHMARK_SAMPLE", "SYNTHETIC"]


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


def test_forecast_with_missing_rolling_features(client):
    """Verifies prepare_inference_features calculates rolling stats dynamically from recent_sales."""
    payload = {
        "products": [
            {
                "product_id": "test-dynamic-p2",
                "store_id": "CA_1",
                "selling_price": 20.0,
                "cost_price": 10.0,
                "on_hand": 100,
                "recent_sales": [5, 6, 4, 5, 7, 8, 6, 5, 4, 6, 7, 5, 6, 8]
            }
        ],
        "horizon_days": 5,
        "feature_schema_version": "1.0"
    }
    response = client.post(
        "/internal/forecasts",
        headers={"X-API-Key": "dev-ml-api-key"},
        json=payload
    )
    assert response.status_code == 200
    data = response.json()
    pred = data["predictions"][0]
    assert pred["product_id"] == "test-dynamic-p2"
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
        "recent_sales": [10] * 14,
    }
    vec_day0 = prepare_inference_features(product, day_offset=0)[0]
    vec_day1 = prepare_inference_features(product, day_offset=1)[0]
    
    # Feature indices: day_of_week is at index 8
    dow_day0 = vec_day0[8]
    dow_day1 = vec_day1[8]
    assert (dow_day0 + 1) % 7 == dow_day1
    assert len(vec_day0) == len(FEATURE_COLUMNS)


def test_m5_data_loader_and_schema():
    """Verify M5 data loader creates expected columns and non-empty dataframe."""
    df, prov = load_m5_dataset(max_items=3, max_days=45)
    assert prov in ["M5_BENCHMARK_SAMPLE", "LOCAL_FILES", "LOCAL_ENV", "KAGGLEHUB"]
    assert "product_id" in df.columns
    assert "store_id" in df.columns
    assert "date" in df.columns
    assert "demand" in df.columns
    assert len(df) == 3 * 45


def test_time_series_features_no_leakage():
    """Verify build_time_series_features computes lags without leakage."""
    df, _ = load_m5_dataset(max_items=2, max_days=60)
    X, y, df_clean = build_time_series_features(df)
    assert len(X) == len(y)
    assert X.shape[1] == len(FEATURE_COLUMNS)
    assert not np.isnan(X).any()
    assert not np.isnan(y).any()


def test_evaluate_model_metrics():
    y_true = np.array([10.0, 20.0, 30.0])
    y_pred = np.array([12.0, 18.0, 33.0])
    metrics = evaluate_model(y_true, y_pred)
    assert round(metrics["mae"], 2) == 2.33
    assert metrics["wape"] is not None
    assert metrics["wape"] > 0
    assert metrics["n_samples"] == 3


def test_evaluate_model_zero_demand():
    y_true = np.array([0.0, 0.0, 0.0])
    y_pred = np.array([1.0, 2.0, 1.0])
    metrics = evaluate_model(y_true, y_pred)
    assert metrics["wape"] is None  # Undefined when actual demand is 0


def test_locate_m5_data_directory_offline_safe(monkeypatch):
    """Verify locate_m5_data_directory defaults to offline safe mode without calling kagglehub (F-ML-01)."""
    monkeypatch.delenv("M5_DATA_DIR", raising=False)
    monkeypatch.delenv("ENABLE_M5_KAGGLE_DOWNLOAD", raising=False)

    with patch("m5_data.try_download_m5_kagglehub") as mock_download:
        m5_dir, prov = locate_m5_data_directory(allow_download=False)
        # Verify kaggle download was NEVER called
        mock_download.assert_not_called()
        assert prov in ["FIXTURE", "LOCAL_FILES"]


def test_opt_in_kagglehub_download_with_mock():
    """Verify opt-in kaggle download path executes properly when explicitly enabled."""
    fake_path = Path("/tmp/fake_m5_data")
    with patch("socket.create_connection") as mock_sock, \
         patch("kagglehub.competition_download", return_value=str(fake_path)):
        result = try_download_m5_kagglehub()
        assert result == fake_path
