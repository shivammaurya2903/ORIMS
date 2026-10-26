# ORIMS Project Presentation Script

**Project:** Optimised Retail Inventory Management System (ORIMS)  
**Presentation length:** 9-10 minutes, with 8 slides  
**Audience:** Academic panel, technical reviewers, or project stakeholders  
**Last verified:** 2026-10-26  
**Companion documents:** Slide notes, Q&A preparation, and demo checklist in this folder

---

## 1. How to use this script

- Read the spoken text almost verbatim if you need a reliable 9-10 minute delivery.
- Keep the slide content minimal; the script carries the detail.
- Do not claim measured business savings. The ML improvement is a benchmark result, not proof of reduced waste or stockouts in a real store.
- Do not describe ORIMS as a production ERP. The defensible position is: **a working controlled-pilot system for a single store, with a verified transactional core and an advisory forecasting service**.
- If the demo is unavailable, use the fallback narrative in Slide 7 instead of improvising technical claims.
- Pause after the architecture and transactional-core sections. Those are the strongest parts of the project.

### Claim discipline

Use these formulations:

- "The repository contains 54 backend test cases across 10 Vitest suites, and 12 ML tests."
- "The current remediation report records 54/54 backend tests and 12/12 ML tests passing."
- "I independently re-ran the 12 ML tests, the frontend production build, and lint on 2026-10-26."
- "The backend integration suite was not re-run during this presentation preparation because it targets the configured MySQL database and writes test records. Its pass result is reported evidence, not a fresh run."
- "The model was trained and evaluated on a deterministic M5-shaped benchmark sample, not on live ORIMS transactions."
- "The benchmark test MAE is 1.3681 units and WAPE is 14.06%, a 48.35% MAE improvement over the best baseline."
- "No numerical business impact is claimed yet."

---

## 2. Timing plan

| Slide | Topic | Target time | Cumulative |
|---|---|---:|---:|
| 1 | Title and framing | 0:45 | 0:45 |
| 2 | Problem, goals, and scope | 1:00 | 1:45 |
| 3 | Architecture | 1:15 | 3:00 |
| 4 | Transactional core | 1:30 | 4:30 |
| 5 | ML forecasting and replenishment | 1:45 | 6:15 |
| 6 | Security, integrity, and evidence | 1:15 | 7:30 |
| 7 | Demo walkthrough | 1:30 | 9:00 |
| 8 | Limitations, next steps, close | 1:00 | 10:00 |

If you are running late, shorten Slide 2 and the implementation details in Slide 6. Do not shorten Slide 4 or the ML provenance statement in Slide 5.

---

## 3. Full spoken script

### Slide 1 - Title and framing

**On screen:** ORIMS title, subtitle "A transactional inventory core with advisory demand forecasting", your name, course or organisation, date.

**Spoken script:**

"Good morning. ORIMS is a full-stack inventory system for a single retail store. It brings sales, receiving, returns, stock corrections, reporting, and reordering into one place.

The stack is React, Node and Express, MySQL with Prisma, and a separate Python service for forecasting.

I want to frame the claim precisely. This is a working controlled-pilot system, not a production ERP. The core transactions are implemented and tested, and the forecasting pipeline is real, but the recommendations are advisory and the model is evaluated on benchmark data, not live store sales.

I will cover the problem and scope, architecture, transaction logic, forecasting, security and evidence, a short demo, and the limitations."

**Transition:** "Let me start with why this system needs to exist."

---

### Slide 2 - Problem, goals, and scope

**On screen:** Four pain points: stockouts, excess stock, expiry, manual reordering. Then three goals: consistent stock, auditable transactions, explainable recommendations. Include a small scope box: "one store, four roles, human-approved purchasing."

**Spoken script:**

"Retail inventory fails in four ways: stockouts, excess stock, expiry, and manual reordering. Capital is trapped in products that do not sell. Capital is trapped in products that do not sell. Perishable stock expires before it can be sold. Or staff reorder from memory and spreadsheets, so the same product is over-ordered in one week and under-ordered the next.

Those are not only forecasting problems. They are record-integrity problems. If a sale can partially deduct stock, if a delivery can be received twice, or if a return silently restores damaged goods, then no report or forecast can be trusted.

So the goals were: keep product and stock records consistent; make sales and receiving transaction-safe and auditable; give managers visibility into stock, sales, purchasing, and expiry; estimate future demand and label it clearly as an estimate; recommend replenishment while keeping a human in control; and record who changed what.

The initial scope is deliberately one store and four roles: admin, manager, sales staff, and inventory staff. Payment processing, payroll, multi-store transfers, and autonomous purchasing are out of scope. That focus is what made it possible to build the integrity-critical paths properly."

**Transition:** "The scope drove the architecture, so let me show the boundaries."

---

### Slide 3 - Architecture

**On screen:** The architecture diagram: React/Vite/Tailwind/Recharts -> Express API -> MySQL/Prisma; Express -> FastAPI inference service; model artifact and metadata beside FastAPI.

**Spoken script:**

"ORIMS uses a modular monolith for the main application, plus one private ML service.

The React front end is the presentation layer. It never connects directly to MySQL and never calls the ML service. All requests go through the Express API.

The Express API owns authentication, role checks, validation, pricing, stock changes, sales, purchasing, reporting, and audit events. That is important: the browser is not trusted to decide the price, the available stock, or whether a user is allowed to approve a purchase.

MySQL is the source of truth. Prisma manages the schema, migrations, and relationships. A separate mysql2 pool is used for database health diagnostics. Stock balances, sale records, purchase receipts, movement history, forecasts, recommendations, and audit logs all live in MySQL.

The Python and FastAPI service is deliberately narrow. It loads a versioned model artifact and returns predictions plus model metadata. It does not write business transactions and it does not own the database. The API calls it over a private boundary with an API key.

I chose a modular monolith rather than microservices because sales, stock, and purchasing share transactional boundaries. Splitting them too early would add distributed consistency problems without helping a small team. The ML service is separate because it has a different runtime, different dependencies, and a separate deployment and retraining lifecycle."

**Transition:** "The architecture only matters if the transaction boundaries are correct. That is the next slide."

---

### Slide 4 - The transactional core

**On screen:** A simple chain: product -> stock -> sale or receipt -> movement ledger -> reports. On the right, four integrity controls: server-authoritative pricing, atomic stock updates, idempotency, audit trail.

**Spoken script:**

"This is the most important part of the project.

For a sale, the server first checks the idempotency key. If the same request is replayed, it returns the original sale instead of charging or deducting twice. If the same key is reused with a different basket, it rejects the request as a conflict. Duplicate product lines in one request are aggregated before stock is checked.

The server then loads trusted product prices, calculates the subtotal, tax, and total, and starts a database transaction. Inside that transaction it creates the sale, decrements inventory with a guarded conditional update that checks both available stock and the reserved quantity, writes a stock movement, and rolls everything back if any step fails. The browser never supplies the final price or the stock delta.

Returns use the same discipline. Return lines are aggregated, checked against the quantity that remains returnable, and each returned unit is classified as restocked or written off. A return cannot exceed what was sold, and a damaged item cannot silently re-enter sellable stock.

Purchasing has a controlled lifecycle: draft, submitted, partially received, received, or cancelled. Receiving uses a unique receipt reference. Replaying the same receipt returns the original record instead of increasing stock again. Duplicate lines in one receipt are aggregated, and the order line update is conditional so two concurrent receipts cannot both consume the same remaining quantity. Successful receiving creates the movement record, updates the order status, and can create batch and expiry records.

Inventory adjustments enforce a reason, derive the sign from the movement type, and prevent on-hand stock from dropping below the reserved quantity. They also use an optimistic version check to detect a concurrent change.

Every sensitive operation writes audit history. For a sale, the sale, stock change, and movement commit atomically, and the sale audit row is written immediately after that commit. Returns, receiving, adjustments, and approvals write their audit rows inside their transactions. That history is what makes the reports and the forecasting input defensible."

**Transition:** "With a trustworthy transaction history in place, the forecasting layer has something real to work from."

---

### Slide 5 - ML forecasting and replenishment

**On screen:** Pipeline: daily sales history -> leakage-safe features -> HistGradientBoosting -> 7-day forecast -> inventory position -> reorder recommendation -> manager approval. Include the metric box: MAE 1.3681, WAPE 14.06%, 48.35% improvement over best baseline. Label it clearly: "M5 benchmark sample, not live store data."

**Spoken script:**

"The forecasting service is a real scikit-learn pipeline, not a mock.

The model is a histogram-based gradient boosting regressor. It uses 19 features: lags at 1, 7, 14, and 28 days; rolling means and standard deviations over 7 and 14 days; day of week, month, and weekend flags; selling and cost price plus a price ratio; on-hand, available, safety stock, incoming quantity, and supplier lead time.

The feature pipeline is shared between training and inference to avoid training-serving skew. Lag and rolling features are built only from prior observations. The training split is chronological by unique date, not a random row split, so the test period comes after the training period.

For inference, the service produces a seven-day rollout. It predicts one day, appends that prediction to the recent history, recomputes the lag and rolling features, and predicts the next day. The response includes the target dates, model version, method, and status.

The current metadata reports a test MAE of 1.3681 units and a WAPE of 14.06 percent. The best baseline is the day-of-week naive model at an MAE of 2.6488, so the measured improvement on that benchmark test split is 48.35 percent.

I need to qualify that carefully. The data provenance is M5 benchmark sample. The repository's fallback fixture is a deterministic M5-shaped benchmark, not ORIMS's live sales. So the metric proves that the pipeline learns the benchmark patterns and beats the baselines on a chronological holdout. It does not prove a 48 percent improvement in a real shop.

The recommendation logic is separate from the model and is explainable. Inventory position equals on-hand plus incoming minus committed. Target stock is forecast daily demand multiplied by lead time plus review period, plus safety stock. The raw suggestion is the positive gap between target and inventory position. It is then adjusted for minimum order quantity and pack multiple. The manager sees the inputs and the explanation, and can approve, edit, or reject the recommendation. The system does not place orders automatically.

If the ML service is down or returns bad data, the Node API falls back to a labelled moving-average baseline and still produces a recommendation. The UI shows the method, so a fallback is not disguised as a model prediction."

**Transition:** "A correct transaction and a real model still need access control and evidence. That is Slide 6."

---

### Slide 6 - Security, integrity, and evidence

**On screen:** Four columns: access control, input and API protection, auditability, verification. Under verification: 54 backend tests / 10 suites, 12 ML tests, build passed, lint 0 errors.

**Spoken script:**

"Security is enforced at the API, not just hidden in the UI.

ORIMS has four roles: admin, manager, sales staff, and inventory staff. The server checks permissions on protected routes, so hiding a button is not the security control. Authentication uses signed JWT access and refresh tokens, delivered as HttpOnly cookies or a Bearer header. Passwords are hashed with bcrypt. Logout increments a token version, so the old token is rejected even if it has not expired. Inactive users are blocked on every authenticated request.

Inputs are validated with Zod schemas. Errors are returned in a controlled format. Helmet sets security headers, CORS is restricted to the configured frontend origin, and rate limits apply to the API and more tightly to login. Sensitive actions write audit records with actor, action, entity, and timestamp. The ML service is protected by a shared API key and is not exposed to the browser.

The evidence is deliberately mixed, because that is more honest than a single pass badge. The repository contains 54 backend test cases across 10 suites and 12 ML tests. The current remediation report records all 54 backend tests and all 12 ML tests passing. On 2026-10-26 I independently re-ran the 12 ML tests, the frontend production build, and lint. The ML tests passed, the build completed, and lint returned zero errors, with warnings. The backend suite was not re-run in this preparation because it targets the configured MySQL database and writes records; I did not want to mutate the demo environment.

The limitations are also part of the evidence. The backend tests are integration tests, not a fully hermetic suite. The repository supports an isolated test database URL, but it is not mandatory in the current setup. Docker Compose is scaffolded but not validated on this host. Some dashboard and report aggregates are simplified and need final reconciliation. Those are the next engineering tasks, not hidden claims."

**Transition:** "Let me show the working flow rather than just describe it."

---

### Slide 7 - Demo walkthrough

**On screen:** Six numbered steps with the route names. A compact "fallback evidence" box with screenshots or test output in case the live demo fails.

**Spoken script:**

"I will demonstrate the manager journey in about ninety seconds. I will not reset the database or change any configuration.

First, I sign in as the manager. The dashboard gives the operational view: sales totals, recent sales, low stock, and expiry risk.

Second, I open Inventory. The list shows on-hand, reserved, available, and safety stock. I can open a product and see its movement history. For the demo I will not make a destructive adjustment unless a suitable test product exists.

Third, I open the Point of Sale. I search for a product, add it to the cart, and show that the server calculates the total. If I complete the sale, the receipt appears and stock is reduced in the same transaction. I will choose a low-value item.

Fourth, I open the sale detail and show the return workflow: returned quantity, restock quantity, write-off quantity, and the rule that restock plus write-off must equal the returned amount.

Fifth, I open Purchase Orders and show the lifecycle and the receiving tab. A submitted order can be received fully or partially, with a unique receipt reference and optional batch details.

Finally, I open the Optimization Centre. I recalculate recommendations, show the forecast table and model metadata, then show a recommendation with its inventory position, target stock, suggested quantity, and explanation.

If the live flow is unavailable, I will show the recorded build and test evidence, the stored forecast metadata, and the architecture diagram. I will not attempt a database reset during the presentation."

**Transition:** "That is the working system. Let me close with what it does not yet prove."

---

### Slide 8 - Limitations, next steps, and close

**On screen:** Three columns: "Proven now", "Not yet proven", "Next". Under "Proven now": transactional workflows, RBAC, audit, benchmark ML pipeline, build/lint. Under "Not yet proven": live-store accuracy, business ROI, multi-store, production operations. Under "Next": isolated test DB, live data validation, monitoring, Docker/CI, UI reconciliation.

**Spoken script:**

"ORIMS proves that the core retail workflows can be implemented with consistent stock, server-authoritative pricing, idempotent receiving, auditable adjustments, and human-approved recommendations. It also proves that the forecasting pipeline is real, leakage-aware, versioned, and measurable against baselines.

It does not yet prove live-store forecast accuracy or a financial return. The model is trained on a benchmark sample, and the reports are operational rather than audited financial statements.

The immediate next steps are clear. First, make the backend test suite hermetic with a dedicated test database and enforce it in configuration. Second, retrain and evaluate on real ORIMS sales history, with stockout-aware demand. Third, add model monitoring and a retraining policy. Fourth, validate container deployment and CI. Fifth, finish the UI and report reconciliation, especially the tax preview and the top-product aggregates. Longer term, the schema can support multiple stores, but store scoping and user-store membership must be enforced before that is real.

The central design decision is human-in-the-loop optimisation. The system can forecast and recommend, but a manager decides. That is the right level of automation for the evidence we currently have.

Thank you. I am happy to take questions on the architecture, the transaction logic, the ML evaluation, or the evidence."

---

## 4. Short closing lines for time pressure

Use one of these if you need to finish in under 30 seconds:

- "In summary: ORIMS makes stock changes transaction-safe, makes access control server-side, and makes forecasting advisory and measurable. It is ready for a controlled single-store pilot, not a production rollout."
- "The strongest claim I can defend is this: the transactional core is implemented and tested, the ML pipeline is real and benchmarked, and the remaining gaps are explicit."

---

## 5. Speaker reminders

### Do

- Say "benchmark" whenever you give the ML metrics.
- Say "reported" when referring to the 54/54 backend pass.
- Say "independently re-ran" for the 12 ML tests, build, and lint.
- Point to the audit trail when discussing trust.
- Explain the recommendation formula before showing the screen.
- Keep the demo to six actions.

### Do not

- Do not say "production ready".
- Do not say the model reduces waste by 48 percent.
- Do not claim the ML service uses live store data.
- Do not claim the backend suite was freshly run if it was not.
- Do not claim multi-store support; the current flow is single-store and hard-codes the default store in key paths.
- Do not open `backend/.env`, browser cookies, or the network panel with tokens visible.
- Do not run `npm run db:reset` or any destructive database command during the presentation.

---

## 6. Evidence notes for follow-up questions

| Claim | Evidence |
|---|---|
| 8-slide structure | This document and the speaker-notes document |
| 54 backend test cases | Static count across 10 Vitest suites in `backend/tests/` |
| 54/54 backend pass reported | `docs/audit/ORIMS_INTEGRITY_AND_TRUSTWORTHINESS_REMEDIATION_REPORT.md` |
| 12 ML tests passed | `python -m pytest ml-service/tests -q` on 2026-10-26 |
| Frontend production build passed | `npm run build --workspace=frontend` on 2026-10-26; Vite warning about an 801.57 kB chunk |
| Lint result | `npm run lint --workspace=backend` and `--workspace=frontend`; 0 errors, 2 backend warnings, 29 frontend warnings |
| Current model metrics | `ml-service/models/metadata.json` |
| Model provenance | `data_provenance: M5_BENCHMARK_SAMPLE`; fixture logic in `ml-service/m5_data.py` |
| Transaction behavior | `backend/src/routes/sales.js`, `inventory.js`, `purchaseOrders.js` |
| Auth and RBAC | `backend/src/routes/auth.js`, `backend/src/middleware/auth.js` |
| Recommendation formula | `backend/src/routes/optimization.js` |
| Feature schema | `ml-service/features.py` |
| Deployment caveat | `README.md` and `docs/audit/ORIMS_FINAL_RELEASE_READINESS_AUDIT.md` |
