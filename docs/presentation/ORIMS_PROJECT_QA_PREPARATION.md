# ORIMS Project Q&A Preparation

**Purpose:** Prepare concise answers and deeper follow-ups for a project defence or stakeholder review.  
**Questions:** 38  
**Last verified:** 2026-10-26

---

## How to answer

1. Give the short answer first, in one or two sentences.
2. Add the mechanism only if the panel probes.
3. State the evidence source or limitation.
4. Never upgrade a benchmark result into a business result.
5. When evidence is reported rather than freshly verified, say so.

### Confidence labels used below

- **Verified:** confirmed directly in source or by a fresh command.
- **Reported:** recorded in a project report but not independently re-run.
- **Benchmark:** measured on the repository's M5-shaped sample, not live store data.
- **Limitation:** known gap or unproven area.

No answer in this pack relies on an unresolved placeholder. If a claim cannot be supported, the answer says so.

---

## A. Product, scope, and claims

### Q1. What is ORIMS in one sentence?

**Short:** ORIMS is a single-store retail inventory system that keeps stock changes transaction-safe and adds explainable, human-approved demand forecasting.

**Deeper:** It combines inventory operations, sales, returns, purchasing, reporting, notifications, and optimization in one application. Express and MySQL own the authoritative business rules; FastAPI provides private demand forecasts. The system is a controlled pilot, not a production ERP.

**Evidence:** `docs/01_PRODUCT_REQUIREMENTS_DOCUMENT.md`, `docs/03_SYSTEM_ARCHITECTURE.md`

### Q2. What problem does it solve?

**Short:** It prevents the stock record from drifting while stock is sold, received, returned, or adjusted, and then uses that trustworthy history for forecasting and replenishment.

**Deeper:** The design treats forecasting as a downstream consumer of reliable transactions. If overselling, duplicate receiving, or invalid returns are possible, reports and model inputs are unreliable. ORIMS therefore prioritises atomic stock changes, movement history, audit logs, and server-side permissions before optimization.

**Evidence:** `backend/src/routes/sales.js`, `purchaseOrders.js`, `inventory.js`

### Q3. Who uses it, and what are the roles?

**Short:** Admin, manager, sales staff, and inventory staff.

**Deeper:** Admin handles users and system settings. Manager has broad operational visibility, can approve or reject recommendations, and can create purchase orders. Sales staff can process sales and returns. Inventory staff can receive stock and adjust inventory. Permissions are enforced on the API, not only in the UI.

**Evidence:** `backend/prisma/schema.prisma`, `backend/src/middleware/auth.js`, `frontend/src/App.jsx`

### Q4. Is ORIMS production-ready?

**Short:** No. It is defensible as a controlled single-store pilot or demonstration, not as a production rollout.

**Deeper:** The core workflows are implemented, and the current remediation report records the backend suite passing. However, the backend tests are not hermetic, the ML model is evaluated on benchmark data, multi-store behavior is not fully enforced, Docker Compose is unvalidated on this host, and production hardening items such as explicit CSRF protection, secret management, monitoring, and backup operations remain incomplete.

**Evidence:** `docs/audit/ORIMS_FINAL_RELEASE_READINESS_AUDIT.md`, `docs/audit/ORIMS_COMPLETE_AUDIT_GAP_ANALYSIS.md`

### Q5. What is actually implemented versus merely designed?

**Short:** Implemented: authentication and RBAC, inventory, POS sales and returns, purchase-order lifecycle and receiving, adjustments, audit logs, reports, notifications, settings, optimization, and the ML inference service.

**Deeper:** Designed or partially enforced: multi-store scoping, deployment automation, backup and restore, CI, monitoring, and production secret management. The schema includes store identifiers, but several routes still use the default store. Some dashboard and report aggregates also need final reconciliation.

**Evidence:** `backend/src/routes/`, `frontend/src/pages/`, `docs/10_DEPLOYMENT_OPERATIONS.md`

### Q6. What business impact can you prove?

**Short:** None numerically. I can explain the expected mechanism, but I cannot claim measured reductions in waste, stockouts, or inventory cost.

**Deeper:** The benchmark shows a 48.35% MAE improvement over the best baseline on a chronological benchmark split. That is a model-quality result. Proving business impact would require a live pilot with a control period, baseline operating metrics, stockout-aware demand, and measured holding, waste, and service-level outcomes.

**Evidence:** `ml-service/models/metadata.json`, `docs/09_TEST_STRATEGY_AND_ACCEPTANCE.md`

### Q7. Why single-store, and how ready is multi-store?

**Short:** The initial scope is one store. The schema is store-aware, but the current application flow is not fully multi-tenant.

**Deeper:** Several routes resolve `default-store` directly rather than deriving a permitted store from the authenticated user. There is no complete user-to-store membership model or cross-store authorization policy. Multi-store would require route-level store scoping, membership checks, reporting changes, and isolation tests before it could be claimed.

**Evidence:** `backend/src/routes/sales.js`, `optimization.js`, `backend/prisma/schema.prisma`

### Q8. Why a modular monolith instead of microservices?

**Short:** Sales, stock, and purchasing share transactional boundaries, so a monolith is simpler and safer at this scale.

**Deeper:** Splitting those domains would introduce distributed transactions, retries, and partial-failure handling without a scaling need. The Express API is organised by domain and uses shared database transactions. The ML service is the one justified separate runtime because it has different dependencies and a separate model lifecycle.

**Evidence:** `docs/03_SYSTEM_ARCHITECTURE.md`, ADR-003

### Q9. Why separate the ML service from the Node API?

**Short:** Python has the model and feature tooling, and the model needs an independent retraining and deployment lifecycle.

**Deeper:** The service exposes a narrow inference contract and cannot write business data. Express remains the authority for stock and purchasing. This separation also limits model failures: a timeout or unavailable model falls back to a labelled baseline rather than blocking inventory operations.

**Evidence:** `ml-service/main.py`, `backend/src/routes/optimization.js`

### Q10. Why MySQL, Prisma, and a separate mysql2 pool?

**Short:** MySQL is the relational source of truth; Prisma provides typed schema and transactional access; mysql2 is used only for low-level health diagnostics.

**Deeper:** The business model has strong relationships and transactional invariants: stores, products, inventory, sales, sale items, purchase orders, receipts, movements, and audit logs. Prisma handles those relationships and migrations. The mysql2 pool lets the health route run a direct `SELECT 1` and database version check alongside Prisma.

**Evidence:** `backend/prisma/schema.prisma`, `backend/src/db.js`, `backend/src/routes/health.js`

### Q11. Walk through the sale flow.

**Short:** Validate the request, check idempotency, aggregate duplicate lines, load trusted prices, open a transaction, write the sale, conditionally decrement stock, write movements, commit, and then write the sale audit record.

**Deeper:** If any transaction write fails, the transaction rolls back. The stock update checks sellable stock and reserved quantity. Sale audit is written immediately after the commit; low-stock and out-of-stock notifications are generated afterward. The client receives the authoritative totals from the server.

**Evidence:** `backend/src/routes/sales.js`

### Q12. How do reports and notifications get their data?

**Short:** Reports query sales, inventory, supplies, and expiry records; notifications are persisted with deduplication keys.

**Deeper:** Sales reports support day, week, and month grouping with inclusive end-date normalization. Inventory valuation uses current stock and cost. Low-stock and out-of-stock notifications use keys such as `LOW_STOCK_{storeId}_{productId}` and `OUT_OF_STOCK_{storeId}_{productId}` so repeated events do not create duplicate alerts. Notification creation is non-blocking for the sale path.

**Evidence:** `backend/src/routes/reports.js`, `notifications.js`, `sales.js`

### Q13. How would this scale?

**Short:** It is designed for a small retail catalog and single store. It has not been load-tested or tuned for large multi-store volume.

**Deeper:** There is pagination and database indexing, but recommendation recalculation loops over products and calls the ML service once for the batch. Report grouping loads relevant sales into application memory. For larger datasets, the next steps would be materialized aggregates, background jobs, query profiling, and store-partitioned workloads.

**Evidence:** `backend/src/routes/optimization.js`, `reports.js`

---

## B. Transaction integrity

### Q14. How do you prevent overselling?

**Short:** The server checks stock inside the same transaction and uses a conditional update that requires sufficient available quantity.

**Deeper:** The condition accounts for reserved stock, not only on-hand quantity. If the update matches zero rows, the transaction fails and rolls back. The integrity suite includes concurrent checkout cases intended to prove that two competing sales cannot both succeed beyond available stock.

**Evidence:** `backend/src/routes/sales.js`, `backend/tests/integrity.test.js`

### Q15. What is idempotency, and why does checkout need it?

**Short:** An idempotency key makes a retried request return the original result instead of creating a second sale.

**Deeper:** The request includes a key. The server stores it with the sale result and a request fingerprint. Replaying the same key and payload returns the existing sale; reusing the key with a different payload is rejected as a conflict. This protects against double-clicks, network retries, and client reconnects.

**Evidence:** `backend/src/routes/sales.js`, `backend/tests/integrity.test.js`

### Q16. How are duplicate product lines handled?

**Short:** Sale, return, and receipt lines are aggregated by product before validation and mutation.

**Deeper:** Without aggregation, two lines for the same product could bypass a per-line stock check or create inconsistent receipt quantities. Aggregation makes the requested total explicit before the conditional update and movement records are written.

**Evidence:** `backend/src/routes/sales.js`, `purchaseOrders.js`, `backend/tests/integrity.test.js`

### Q17. How do returns prevent invalid stock restoration?

**Short:** Returned quantity must be within the remaining returnable amount and must equal restock plus write-off.

**Deeper:** The server calculates how much of each sale line has already been returned, rejects over-returns, and requires a valid classification for every returned unit. Restocked units increase sellable stock; write-offs do not. Movements and audit records capture the result.

**Evidence:** `backend/src/routes/sales.js`, `backend/tests/integrity.test.js`

### Q18. How do you prevent duplicate or concurrent purchase receipts?

**Short:** Receipt references are unique, duplicate receipt lines are aggregated, order-line updates are guarded, and replaying the same receipt returns the original result.

**Deeper:** A new receipt reference is processed inside a transaction. The same reference with the same order returns the existing receipt without another stock increase. A reference reused for a different order is a conflict. Concurrent receipts compete on a conditional remaining-quantity update, so the same ordered unit cannot be received twice.

**Evidence:** `backend/src/routes/purchaseOrders.js`, `backend/tests/integrity.test.js`

### Q19. How are inventory adjustments protected?

**Short:** Adjustments require a reason, enforce the reserved-stock floor, and use an optimistic version check.

**Deeper:** The server derives the movement sign from the adjustment type rather than trusting a client-provided delta. It prevents on-hand from going below reserved stock and rejects a stale version. A successful adjustment writes the new balance, a stock movement, and an audit record in one transaction.

**Evidence:** `backend/src/routes/inventory.js`

### Q20. How is the audit trail implemented?

**Short:** Sensitive operations write an audit row with actor, action, entity, timestamp, and relevant details.

**Deeper:** Examples include approvals, rejections, inventory adjustments, receiving, and sale-related state changes. The audit log is separate from ordinary application logs so operational history remains queryable. It does not replace the movement ledger; the two answer different questions.

**Evidence:** `backend/prisma/schema.prisma`, `backend/src/routes/`, `docs/08_SECURITY_AND_PRIVACY.md`

### Q21. Is tax calculated by the browser or the server?

**Short:** The server is authoritative and uses the configured store tax rate, falling back to an environment default.

**Deeper:** The sale API loads the store's `taxRate` and applies it to each taxable line and to the sale total. The current POS screen hardcodes a 10% preview, so the displayed preview can differ if the configured rate changes. The completed sale still uses the server-calculated amount. Aligning the preview is a known UI reconciliation item.

**Evidence:** `backend/src/routes/sales.js:84-126`, `frontend/src/pages/POS.jsx:79-81`

---

## C. ML and optimization

### Q22. What model is used, and why?

**Short:** A histogram-based gradient boosting regressor, chosen for strong tabular performance with modest tuning and CPU-only inference.

**Deeper:** Retail demand features are tabular and nonlinear, with interactions between day of week, price, and recent demand. Gradient boosting handles that well at this data size, trains quickly, and is easier to operate than a deep sequence model. The repository pins the model metadata and feature schema version.

**Evidence:** `ml-service/train.py`, `ml-service/models/metadata.json`

### Q23. What features does it use, and how is leakage prevented?

**Short:** Nineteen features covering lags, rolling statistics, calendar, price, inventory, and lead time; all history features use only prior observations.

**Deeper:** Lags are 1, 7, 14, and 28 days. Rolling means and standard deviations cover 7 and 14 days. Calendar features are day of week, month, and weekend. Price features include selling, cost, and their ratio. Inventory features include on-hand, available, safety stock, incoming quantity, and lead time. The same feature preparation module is used in training and inference.

**Evidence:** `ml-service/features.py`, `models/metadata.json`

### Q24. How was the model evaluated?

**Short:** Chronologically by unique date, with separate train, validation, and test periods and comparison against two baselines.

**Deeper:** The current metadata records 13,400 training samples, 1,700 validation samples, and 1,700 test samples. The test MAE is 1.3681 and WAPE is 14.06%. Validation MAE is 1.3101 and WAPE 14.84%. The split is temporal, not a random row split, which is appropriate for forecasting.

**Evidence:** `ml-service/models/metadata.json`, `ml-service/train.py`

### Q25. You claim 48.35% improvement. What exactly does that mean?

**Short:** The model's MAE is 48.35% lower than the best baseline MAE on the benchmark test split. It is not a 48.35% reduction in waste or cost.

**Deeper:** The model MAE is 1.3681 versus 2.6488 for the day-of-week baseline. The data provenance is `M5_BENCHMARK_SAMPLE`, generated by the repository's deterministic fixture rather than live store sales. The result supports model quality on that benchmark; it does not establish live-store accuracy or business ROI.

**Evidence:** `ml-service/models/metadata.json`, `ml-service/m5_data.py`

### Q26. What are the baselines, and what happens if the model fails?

**Short:** The baselines are moving average and day-of-week naive forecasts. If the ML service fails, the Node API uses a labelled moving-average fallback.

**Deeper:** The current benchmark records MAE 2.9826 for moving average and 2.6488 for day-of-week. On an ML timeout or invalid response, the API computes an average from recent sales, labels the method `BASELINE_MOVING_AVERAGE`, and stores that method with the forecast. The UI can therefore distinguish a model result from a fallback.

**Evidence:** `ml-service/models/metadata.json`, `backend/src/routes/optimization.js:319-382`

### Q27. How does a seven-day forecast work?

**Short:** It predicts one day, appends that prediction to recent history, recomputes lag and rolling features, and repeats for seven days.

**Deeper:** This is a recursive or autoregressive rollout. The model is not refit during inference. Target dates advance from tomorrow. The response includes each target date, predicted demand, model version, method, and status. The same 19-feature schema is used throughout.

**Evidence:** `ml-service/features.py`, `ml-service/main.py`

### Q28. How is the replenishment quantity calculated?

**Short:** Inventory position is on-hand plus incoming minus committed; target stock is forecast demand over lead time plus review period, plus safety stock; the gap is adjusted for minimum order quantity and pack multiple.

**Deeper:** Daily demand is the seven-day forecast total divided by seven. Protection demand is daily demand multiplied by lead time plus review period. Target stock is the ceiling of protection demand plus safety stock. The raw suggestion is the positive gap between target and inventory position. It is raised to the minimum order quantity and rounded up to the pack multiple. The stored explanation exposes the inputs.

**Evidence:** `backend/src/routes/optimization.js:417-446`

### Q29. What happens when a manager approves a recommendation?

**Short:** The recommendation is marked approved, and a draft purchase order can be created if an active supplier-product mapping exists.

**Deeper:** Approval runs in a transaction. If purchase-order creation is requested and the approved quantity is positive, the server looks up an active supplier product. If found, it creates a draft purchase order and marks the recommendation `CONVERTED_TO_PO`; otherwise the recommendation remains `APPROVED`. An audit record captures the actor, quantity, and resulting purchase-order ID. Rejection records a reason.

**Evidence:** `backend/src/routes/optimization.js:84-190`

---

## D. Security and access control

### Q30. How does authentication and authorization work?

**Short:** JWT access and refresh tokens, HttpOnly cookies or Bearer headers, bcrypt password hashes, server-side role middleware, and token-version revocation.

**Deeper:** Access tokens are short-lived and refresh tokens longer-lived. Logout increments `tokenVersion`, so old access tokens are rejected even before natural expiry. Inactive users are blocked on authenticated requests. Role checks are applied to routes such as approval, receiving, settings, and reports. UI guards improve the experience but are not the security boundary.

**Evidence:** `backend/src/routes/auth.js`, `backend/src/middleware/auth.js`, `backend/src/index.js`

### Q31. How are secrets and CSRF handled?

**Short:** Secrets are environment-based and `.env` files are ignored by Git; cookies use HttpOnly and SameSite=Lax. There is no separate CSRF token scheme.

**Deeper:** The application supports cookie-based auth for the same-origin SPA and Bearer headers for API clients. SameSite=Lax reduces cross-site request risk but is not a complete CSRF strategy for every deployment. Production hardening should add an explicit CSRF token or a strict same-site architecture, secret rotation, and a managed secret store. No real secret is included in this pack.

**Evidence:** `backend/src/index.js`, `backend/src/routes/auth.js`, `.gitignore`

### Q32. What protects against injection and unsafe input?

**Short:** Zod validation, parameterized database access through Prisma, React rendering, Helmet, restricted CORS, and rate limits.

**Deeper:** Prisma avoids string-built SQL for business queries. The separate mysql2 usage is limited to fixed diagnostic statements. Request shapes and enums are validated before route logic. Helmet sets security headers, CORS is restricted to the configured front end, and rate limits cover the API and login. This is not a claim of exhaustive penetration testing.

**Evidence:** `backend/src/middleware/validate.js`, `backend/src/index.js`, route schemas

---

## E. Testing, build, and operations

### Q33. What testing evidence exists?

**Short:** 54 backend test cases across 10 Vitest suites, 12 ML tests, a passing frontend production build, and lint with zero errors.

**Deeper:** The current remediation report records 54/54 backend tests and 12/12 ML tests passing. I statically counted 54 backend cases and 12 ML cases. On 2026-10-26 I independently re-ran the 12 ML tests, which passed, and the frontend production build, which passed. Lint returned zero errors with two backend warnings and 29 frontend warnings. The backend suite was not freshly run because it targets the configured MySQL database and writes records.

**Evidence:** `backend/tests/`, `ml-service/tests/`, `docs/audit/ORIMS_INTEGRITY_AND_TRUSTWORTHINESS_REMEDIATION_REPORT.md`

### Q34. Are the backend tests hermetic?

**Short:** No. They are integration tests against a configured MySQL database, and the repository does not enforce a disposable test database.

**Deeper:** The application can use `TEST_DATABASE_URL` in test mode, but the environment example does not require it and there is no complete test bootstrap that guarantees isolation. Prior audits observed the suite using the developer database. That is why I did not run it before the demo. The next improvement is a dedicated test database, deterministic fixtures, and guaranteed cleanup.

**Evidence:** `backend/src/index.js`, `backend/tests/dbPool.test.js`, `docs/audit/ORIMS_COMPLETE_AUDIT_GAP_ANALYSIS.md`

### Q35. What were the build, lint, and deployment results?

**Short:** The frontend build passed with a large-chunk warning. Lint passed with warnings but no errors. Docker Compose is scaffolded but was not validated on this host.

**Deeper:** Vite built 930 modules in 18.37 seconds and warned about an 801.57 kB JavaScript chunk. Backend lint reported two unused-variable warnings in `purchaseOrders.js`; frontend lint reported 29 hook-dependency and unused-variable warnings. Docker files exist, but the native local workflow is the verified path.

**Evidence:** fresh commands run 2026-10-26; `docker-compose.yml`, `README.md`

---

## F. Limitations and closing questions

### Q36. What is the biggest weakness?

**Short:** The evidence gap between a benchmark model and real store performance, combined with a non-hermetic backend test suite.

**Deeper:** The transactional core is the stronger part of the project. The model is real and evaluated correctly for a benchmark, but it has not learned from live ORIMS sales or stockout-censored demand. The test suite also needs isolation before it can be trusted as a repeatable release gate. Multi-store enforcement and UI/report reconciliation follow.

**Evidence:** `docs/audit/ORIMS_COMPLETE_AUDIT_GAP_ANALYSIS.md`, `ml-service/models/metadata.json`

### Q37. What would you do with two more weeks?

**Short:** Isolate the backend tests, retrain and evaluate on live data, and fix the operational UI gaps.

**Deeper:** Week one: dedicated test database, deterministic fixtures, cleanup, CI, and a clean test run. Week two: live-data validation with stockout-aware demand, model monitoring and retraining criteria, plus tax-preview and report-aggregate reconciliation. Container validation and backup/restore testing would follow.

**Evidence:** `docs/11_ROADMAP_AND_FUTURE_ENHANCEMENTS.md`, `docs/12_RISKS_ASSUMPTIONS_AND_DECISIONS.md`

### Q38. Why should the panel trust your claims?

**Short:** Because the claims are separated into verified, reported, benchmark, and limitation, and each has a source.

**Deeper:** Transaction behavior is verified in route source and regression tests. The 54/54 backend result is labelled as reported, while the 12 ML tests, build, and lint were freshly re-run. Model metrics are labelled as benchmark results with provenance and baseline comparisons. Business impact is explicitly not claimed. That discipline is more defensible than presenting every item as equally proven.

**Evidence:** `docs/presentation/ORIMS_PROJECT_PRESENTATION_SCRIPT.md`, evidence notes in this folder

---

## Quick reference: numbers to remember

| Item | Value | Qualifier |
|---|---:|---|
| Backend test cases | 54 across 10 suites | Statically counted |
| Backend pass result | 54/54 | Reported, not freshly rerun |
| ML tests | 12/12 | Freshly re-run 2026-10-26 |
| Model family | HistGradientBoosting | `metadata.json` |
| Features | 19 | `metadata.json` |
| Test MAE | 1.3681 units | M5 benchmark sample |
| Test WAPE | 14.06% | M5 benchmark sample |
| Best baseline MAE | 2.6488 units | Day-of-week naive |
| Improvement over baseline | 48.35% | Benchmark, not business impact |
| Frontend build | Passed; 930 modules; 18.37s | Large-chunk warning |
| JS chunk warning | 801.57 kB | Vite build |
| Backend lint | 0 errors, 2 warnings | Unused variables |
| Frontend lint | 0 errors, 29 warnings | Hooks and unused variables |
| Forecast horizon | 7 days | Recursive rollout |
| ML timeout | 5 seconds | Then labelled fallback |
| Demo roles | 4 | Admin, manager, sales, inventory |
| Stores | 1 in practice | Multi-store not enforced |
