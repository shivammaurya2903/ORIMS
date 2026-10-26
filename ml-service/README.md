# ORIMS ML Forecasting & Stockout Service

ORIMS Machine Learning service providing:
1. **Multi-Quantile Demand Forecasting**: P50 (median), P90 (high demand), and P95 (peak demand) quantile regressions for resilient inventory buffer sizing.
2. **Stockout Risk Classification**: Calibrated probabilities estimating out-of-stock risk within supplier lead time.
3. **Canonical Data Adapters**: Deduplicated schema normalization for retail supermarkets and pharmacy supply chains.
4. **Leakage-Free Autoregressive Rollouts**: Dynamic rolling feature updates and calendar progressions across multi-day forecast horizons.

---

## Directory Structure

```
ml-service/
├── api.py                    # FastAPI application & REST endpoints
├── main.py                   # Compatibility entrypoint
├── train.py                  # End-to-end model training pipeline
├── Dockerfile.dev            # Docker container definition
├── requirements.txt          # Python dependencies
├── pyproject.toml            # Project configuration & pytest settings
├── README.md                 # Service documentation
├── data/
│   ├── sample_m5_fixture.csv # M5 benchmark sample dataset
│   └── sample_orims_fixture.csv # Deterministic ORIMS synthetic fixture
├── datasets/
│   ├── base.py               # Shared canonical schema transformer (deduplicated)
│   ├── supermarket.py        # Supermarket dataset adapter
│   └── pharmacy.py           # Pharmacy dataset adapter
├── models/
│   ├── metadata.json         # Model version, parameters, and metrics
│   ├── demand_q50.joblib     # Quantile 0.50 demand regressor
│   ├── demand_q90.joblib     # Quantile 0.90 demand regressor
│   ├── demand_q95.joblib     # Quantile 0.95 demand regressor
│   ├── stockout_classifier.joblib # Calibrated stockout classifier
│   └── model.joblib          # Mean baseline regressor
├── utils/
│   ├── config.py             # Environment configuration & directory paths
│   ├── data.py               # Data loaders with fallback chains
│   ├── features.py           # Feature engineering & online inference transformations
│   ├── metrics.py            # WAPE, MAE, RMSE, pinball loss, AUC, and classification metrics
│   └── schema.py             # Canonical & feature column definitions
└── tests/
    └── test_service.py       # Automated test suite
```

---

## Setup & Running

### 1. Installation
```bash
pip install -r requirements.txt
```

### 2. Train Models
Train quantile models, stockout classifier, and generate serialized metadata:
```bash
python train.py
```

### 3. Run Inference Service
```bash
uvicorn api:app --reload --host 0.0.0.0 --port 8000
```

### 4. Run Test Suite
```bash
pytest tests/
```

---

## API Endpoints

### `GET /health`
Verifies service status and loaded model status.
- **Response**: `200 OK`
```json
{
  "status": "healthy",
  "model_loaded": true,
  "model_version": "v20261026_153552",
  "timestamp": "2026-10-26T15:37:28.037052+00:00"
}
```

### `GET /internal/model-info`
Provides detailed architecture provenance, feature schema version, and validation metrics. Requires `X-API-Key` header.

### `POST /internal/forecasts`
Generates multi-horizon quantile predictions and stockout risk estimates for a list of products. Requires `X-API-Key` header.
- **Sample Request**:
```json
{
  "products": [
    {
      "product_id": "P001",
      "store_id": "S001",
      "selling_price": 50.0,
      "cost_price": 25.0,
      "available": 15.0,
      "lead_time_days": 7,
      "recent_sales": [3, 4, 5, 2, 6, 4, 5, 6, 7, 4, 5, 6, 5, 4]
    }
  ],
  "horizon_days": 7,
  "feature_schema_version": "2.0"
}
```
- **Sample Response**:
```json
{
  "predictions": [
    {
      "product_id": "P001",
      "store_id": "S001",
      "status": "success",
      "method": "MODEL_QUANTILE",
      "predictions": [
        {
          "target_date": "2026-10-27",
          "demand_p50": 4.12,
          "demand_p90": 6.85,
          "demand_p95": 8.10,
          "predicted_demand": 4.12
        }
      ],
      "stockout": {
        "probability_within_lead_time": 0.12,
        "days_of_supply": 3.64,
        "risk_level": "HIGH"
      }
    }
  ],
  "model_version": "v20261026_153552",
  "model_family": "hgb_quantile_plus_classifier",
  "generated_at": "2026-10-26T15:37:28.037052+00:00",
  "feature_schema_version": "2.0",
  "status": "success"
}
```
