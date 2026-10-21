# Machine Learning Forecasting Design

**Service:** ORIMS internal ML forecasting service  
**Initial horizon:** 7 days per product  
**Version:** 1.0

## 1. Purpose and boundaries

The ML capability estimates product demand using historical retail observations. Node.js remains responsible for business logic, inventory calculations, role checks, purchase-order workflows, and storage of authoritative retail transactions. Python returns predictions and model metadata only.

Forecasts are estimates. They must not be presented as guaranteed sales or treated as orders without a manager's review.

## 2. Initial model strategy

Start with a baseline and one supervised model:

1. **Baseline:** a recent moving average or day-of-week naive forecast appropriate to the product's data.
2. **Candidate model:** gradient-boosting regression using lagged sales, rolling statistics, calendar features, and other genuinely available features.
3. **Optional next step:** compare an alternative model only when a measurable reason exists, such as consistent baseline failure or enough suitable data for seasonal patterns.

Do not begin with an LSTM or a large model merely to make the project appear advanced. A simpler model with sound evaluation and clear fallback behavior is preferable to an unvalidated complex model.

## 3. Prediction target and horizon

Initial target: non-negative daily units demanded for a product on each target date, for the next seven days. Define whether the training target represents observed sales or estimated unconstrained demand. Recorded sales can understate demand during stockouts, so stock availability must be captured and considered in training and evaluation.

Predictions should be stored per product, store, target date, run, and model version. Round or transform fractional outputs only according to the chosen demand and replenishment policy; preserve raw predictions where useful for evaluation.

## 4. Input data and features

Potential features, subject to data availability:

- Product/store identifier as a grouping key or encoded feature with safeguards for unseen products.
- Quantity sold for the previous 1, 7, 14, and 28 days.
- Rolling mean and variability for recent periods.
- Day of week, month, and selected known calendar events.
- Selling price, recorded discounts, and promotion flags if historically maintained.
- Stock-on-hand or availability flags to identify constrained observations.
- Category-level demand features when enough data exists.

Avoid leakage: a feature for a prediction date must only use information available by the forecast issue time. Do not use future inventory receipts, realized future promotions that would not have been known, or target-date sales to predict that target.

## 5. Data preparation

1. Extract authorized historical sales and product/store context.
2. Aggregate sale items into daily product/store quantities using a consistent business date and timezone.
3. Create explicit date rows for periods without recorded sales.
4. Distinguish confirmed zero sales from missing data and product unavailability.
5. Treat returns, cancellations, and corrections according to documented net-demand rules.
6. Remove or flag invalid quantities and duplicate events without silently hiding data-quality problems.
7. Generate lag and rolling features strictly from prior dates.
8. Keep train, validation, and test periods chronological.
9. Track data snapshot dates and feature schema version for reproducibility.

Synthetic sample data is useful for demonstrating the workflow, but performance measured only on synthetic data is not evidence of real-world forecasting accuracy.

## 6. Model training and evaluation

- Use chronological backtesting: train on earlier time periods and evaluate on later periods.
- Compare candidate models against the baseline on identical test windows.
- Report MAE and WAPE. Define the WAPE numerator and denominator and state when total actual demand is zero or too small to make the metric informative.
- Optionally report bias (over- versus under-forecasting) and segment metrics by product category or demand volume.
- Avoid random row splitting for time-series evaluation because it can leak future patterns into training.
- Record model family, dependency versions, training window, feature schema version, metrics, and artifact checksum/reference.
- Promote a model only after it meets agreed review criteria and has been compared fairly with the baseline.

## 7. Service design

The FastAPI service should:

- Load only trusted, versioned model artifacts.
- Validate requests against the model's expected feature schema.
- Bound request size and number of products per inference call.
- Return predictions, target dates, model version, service status, and per-product status.
- Provide health and safe model metadata endpoints.
- Emit structured logs and latency/error metrics without exposing sensitive input data unnecessarily.
- Use explicit dependency versions compatible with the trained artifact.

Model training should be separate from online inference. A controlled script or job should produce a candidate artifact, evaluation report, and metadata. Deploying a new model should be reversible.

## 8. Node.js integration and fallback

Node.js prepares or retrieves features and calls the internal service with a bounded timeout. It validates the response and persists forecast results. If the service fails, the main system remains available. For forecast display or recommendations, the system may use an explicitly labelled baseline fallback if there is enough usable history; otherwise it should display “insufficient data” or “forecast unavailable” rather than fabricate a prediction.

Never calculate final stock balances from a forecast response. Recommendations are calculated separately using current inventory and purchase-order data.

## 9. Replenishment recommendation policy

Define inventory position consistently, for example on-hand plus confirmed incoming orders minus applicable outstanding commitments. Ensure reserved quantities or backorders are not counted twice.

A basic reorder point can be based on average demand during supplier lead time plus safety stock. A more advanced safety-stock calculation can use demand variability and a selected service-level factor when its assumptions are reasonable. For a periodic review policy, target stock may cover the supplier lead time plus the review interval. The proposed order quantity is the positive difference between target stock and inventory position, then adjusted for minimum order quantity, pack size, budget, capacity, and expiry risk.

The UI should explain:
- Forecast demand and horizon.
- Current on-hand quantity.
- Confirmed incoming quantity.
- Committed/reserved quantity policy.
- Safety stock or service-level policy.
- Raw quantity and final quantity after constraints.
- Model version, forecast generation date, and fallback status.

## 10. Model drift and monitoring

Track forecast error after actual sales become available. Review changes by product category, demand volume, and time. Alert the team if data completeness degrades, forecast requests fail, a model's performance materially deteriorates against its baseline, or a model artifact cannot load. Retraining cadence should be chosen based on data volume and observed drift, not assumed to be necessary every day.

## 11. Limitations

- New products may lack sufficient history (cold start).
- Promotions, holidays, and supplier lead times may be absent or recorded inconsistently.
- Sales history under stock constraints may underestimate true demand.
- Product substitutions, bundles, seasonality, and local events may not be represented.
- Forecast quality cannot be asserted until evaluated with suitable held-out observations.
- Model output should support, not replace, managerial judgment.
