# ORIMS Slide-by-Slide Speaker Notes

**Deck:** 8 slides  
**Target delivery:** 9-10 minutes  
**Last verified:** 2026-10-26

> These notes are designed to work with `ORIMS_PROJECT_PRESENTATION_SCRIPT.md`. Keep the slide text sparse and use these notes for the spoken explanation. Every numerical claim must retain its qualifier: benchmark, reported, or independently verified.

---

## Global delivery rules

- Open with the problem, not the technology.
- Explain transaction integrity before the model. It is the stronger engineering contribution.
- Say "advisory" and "human-in-the-loop" whenever recommendations are discussed.
- Use "benchmark sample" for every ML metric.
- Separate fresh checks from reported evidence.
- Finish with limitations before the panel asks for them.

### Deck-level timing

| Slide | Name | Time |
|---|---|---:|
| 1 | Title and framing | 0:45 |
| 2 | Problem, goals, scope | 1:00 |
| 3 | Architecture | 1:15 |
| 4 | Transactional core | 1:30 |
| 5 | ML forecasting and replenishment | 1:45 |
| 6 | Security and evidence | 1:15 |
| 7 | Demo | 1:30 |
| 8 | Limitations and close | 1:00 |

---

## Slide 1 - Title and framing

**Slide title:** ORIMS  
**Subtitle:** Optimised Retail Inventory Management System  
**On-slide bullets:**

- One store, four roles, one consistent stock record
- Transaction-safe selling, receiving, returns, and adjustments
- Advisory demand forecasting with manager approval
- React, Express, MySQL, Prisma, Python, FastAPI
- Controlled pilot, not a production ERP claim

**Visual suggestion:** Clean title slide with a simple system silhouette: browser, API, database, model service. Avoid a busy screenshot.

**Full spoken notes:**

"Good morning. ORIMS is a full-stack inventory management system for a single retail store. The project combines the operational side of inventory, where stock must remain consistent through sales, receiving, returns, and corrections, with demand forecasting and replenishment recommendations.

I want to frame the claim correctly from the start. This is a working controlled-pilot system. The core workflows are implemented and tested, and the forecasting pipeline is real, but I am not claiming production readiness or measured financial savings. The recommendations remain advisory.

I will cover the problem, architecture, transactional logic, the model and replenishment workflow, security and evidence, a short demo, and the limitations."

**Timing:** 0:45  
**Transition:** "The problem is not just forecasting. It is record integrity."

**If interrupted:** "The one-sentence version is that ORIMS makes stock changes auditable and makes forecasting explainable."

---

## Slide 2 - Problem, goals, and scope

**Slide title:** The problem: stock, cash, expiry, and trust  
**On-slide bullets:**

- Stockouts lose sales; excess stock traps cash
- Expiry turns inventory into waste
- Manual reordering is inconsistent and undocumented
- Broken stock records invalidate reports and forecasts
- Goal: consistent records, auditable workflows, explainable recommendations

**Visual suggestion:** Four-quadrant problem slide with one icon per pain point. Add a small scope ribbon: "Single store | Four roles | Human approval | No payments."

**Full spoken notes:**

"The operational problem appears in four forms: stockouts, excess inventory, expiry, and manual reordering. But the deeper issue is trust in the stock record. If a sale can deduct the wrong quantity, a delivery can be received twice, or a return can quietly restore damaged goods, then every downstream report and forecast is unreliable.

That is why the project goals are broader than prediction. The system has to keep product and stock records consistent, make sales and receiving atomic and auditable, control access by role, provide operational reporting, and only then add demand forecasting and replenishment recommendations.

The scope is intentionally narrow: one store, four roles, no payment processing, no payroll, no multi-store transfers, and no autonomous purchasing. The schema includes store identifiers, but the current application flow is single-store. That distinction matters for an honest readiness assessment."

**Timing:** 1:00  
**Transition:** "That scope led to a modular monolith plus a separate inference service."

**If interrupted:** "The scope boundary is deliberate. The critical path is stock correctness, not feature count."

---

## Slide 3 - Architecture

**Slide title:** Architecture: one source of truth  
**On-slide bullets:**

- React and Vite for the interface
- Express API owns auth, validation, pricing, stock, and audit
- MySQL through Prisma is the source of truth
- FastAPI is a private inference boundary, not a business writer
- Modular monolith chosen for shared transactional boundaries

**Visual suggestion:** Left-to-right architecture diagram. Show the browser calling Express only; Express calling MySQL and FastAPI; FastAPI loading a versioned model artifact. Put "source of truth" under MySQL.

**Full spoken notes:**

"ORIMS uses a modular monolith for the main application and a separate Python service for inference.

The React front end never talks directly to MySQL and never talks directly to the model service. It calls the Express API. That API owns identity, permissions, validation, pricing, transaction handling, reporting, and audit logging.

MySQL is the authoritative store for products, stock, movements, sales, purchases, batches, forecasts, recommendations, and audit events. Prisma manages the schema and transactional access. A separate mysql2 pool supports database health checks.

The Python FastAPI service is deliberately narrow. It loads a versioned model artifact and returns forecasts and metadata. It does not write sales or stock changes. The API calls it with an API key and a five-second timeout.

A modular monolith avoids distributed transactions across sales, stock, and purchasing. Those domains share consistency requirements. The model service is separate because it has different dependencies and a separate retraining and deployment lifecycle."

**Timing:** 1:15  
**Transition:** "The architecture protects the boundary, but correctness depends on what happens inside the transaction."

**If interrupted:** "The short version: the browser proposes; the server calculates, authorises, and commits."

---

## Slide 4 - Transactional core

**Slide title:** Integrity is enforced in the database transaction  
**On-slide bullets:**

- Server-authoritative prices and stock checks
- Guarded conditional updates prevent overselling
- Checkout and receiving are idempotent
- Returns require restock or write-off classification
- Every sensitive change writes an audit record

**Visual suggestion:** A transaction timeline: validate -> lock/guard -> sale or receipt -> movement -> audit -> commit. Place "rollback on any failure" underneath. Use a second small panel for the purchase-order state machine.

**Full spoken notes:**

"The transactional core is the strongest part of the project.

For checkout, the server first checks the idempotency key. A replay with the same payload returns the original sale. Reuse with a different payload is a conflict. Duplicate product lines are merged. The server loads trusted product prices, computes subtotal, tax, and total, and opens a transaction.

Inside that transaction, it creates the sale, decrements stock using a conditional update that checks availability and reserved quantity, and writes the stock movement. If any transaction write fails, the transaction rolls back. The sale audit row is written immediately after the commit. The browser does not control price or stock.

Returns aggregate duplicate lines, validate the remaining returnable quantity, and classify each unit as restocked or written off. The rule is enforced: returned quantity must equal restock plus write-off, and a return cannot exceed the original sale.

Purchase orders follow a defined lifecycle. Receiving uses a unique receipt reference. If the same receipt is submitted again, the API returns the original result instead of increasing stock again. Duplicate receipt lines are aggregated, and the order-line update is conditional so concurrent receipts cannot both consume the same remaining quantity. Batch and expiry records are created when supplied.

Inventory adjustments require a reason, prevent on-hand from falling below reserved stock, and use optimistic version checks to detect concurrent edits. Each adjustment writes both a movement and an audit event."

**Timing:** 1:30  
**Transition:** "Trustworthy transaction history is the foundation for forecasting."

**If interrupted:** "The key invariant is that stock and the movement ledger commit together; audit history is recorded around that transaction."

---

## Slide 5 - ML forecasting and replenishment

**Slide title:** Forecasting is real, bounded, and advisory  
**On-slide bullets:**

- HistGradientBoosting with 19 leakage-safe features
- Chronological evaluation and 7-day autoregressive rollout
- Test MAE 1.3681; WAPE 14.06%
- 48.35% improvement over best baseline on M5 benchmark sample
- Explainable recommendation; manager approves; labelled fallback

**Visual suggestion:** Pipeline diagram with four stages: history -> features -> model -> forecast -> recommendation. Put the metrics in a box labelled "Benchmark sample only" and colour the fallback path differently from the model path.

**Full spoken notes:**

"The forecasting pipeline is implemented with scikit-learn's histogram-based gradient boosting.

It uses 19 features: four lags, rolling means and standard deviations, calendar features, price fields, inventory fields, and supplier lead time. The same feature preparation code is used in training and inference. Both lag and rolling features are built exclusively from prior observations, and the evaluation split is chronological by date.

At inference, the model predicts a seven-day rollout one day at a time. Each prediction is appended to recent history so later lag and rolling features can be recomputed. The response includes the target dates, model version, method, and status.

On the benchmark test split, the model reports an MAE of 1.3681 units and a WAPE of 14.06 percent. The best baseline has an MAE of 2.6488, so the improvement over that baseline is 48.35 percent.

The important qualifier is provenance: this is the repository's deterministic M5-shaped benchmark sample, not live ORIMS sales. The result demonstrates that the pipeline learns the benchmark patterns and beats the baselines on a chronological holdout. It does not prove a 48 percent improvement in a real store.

Replenishment is a separate, explainable calculation. Inventory position is on-hand plus incoming minus committed. Target stock is forecast daily demand over lead time plus review period, plus safety stock. The raw gap is adjusted for minimum order quantity and pack multiple. The manager can approve, edit, or reject. If ML is unavailable, the API uses a labelled moving-average fallback."

**Timing:** 1:45  
**Transition:** "The model is only useful if access and operations are trustworthy."

**If interrupted:** "The metric is a benchmark result, not a business outcome."

---

## Slide 6 - Security, integrity, and evidence

**Slide title:** Access control and evidence, with gaps stated  
**On-slide bullets:**

- JWT access and refresh, HttpOnly cookies or Bearer
- Server-side role checks and token revocation
- Zod validation, Helmet, CORS, and rate limits
- 54 backend test cases; current report records 54/54 passing
- 12 ML tests re-run; build passes; lint has warnings only

**Visual suggestion:** Four columns: Authentication, Authorization, API protection, Evidence. Add a small amber "Known gaps" strip: non-hermetic tests, Docker unvalidated, UI aggregates need polish.

**Full spoken notes:**

"Security is enforced at the API. ORIMS has four roles: admin, manager, sales staff, and inventory staff. Route middleware checks permissions server-side, so hiding a button is not the control.

Authentication uses signed JWT access and refresh tokens delivered as HttpOnly cookies or a Bearer header. Passwords are bcrypt-hashed with a cost of 12. Refresh tokens can be revoked. Logout increments a token version, so previously issued access tokens are rejected. Inactive users are blocked on authenticated requests.

Requests are validated with Zod. Helmet sets security headers, CORS is restricted to the configured front end, and rate limits protect the API and login. Sensitive actions write audit records with actor, action, entity, and timestamp.

The evidence is mixed and I want to state it precisely. The repository contains 54 backend test cases across 10 suites, and the current remediation report records 54/54 passing. I did not re-run that suite during presentation preparation because it targets the configured MySQL database and writes test records. I did independently re-run the 12 ML tests, which passed, the frontend production build, which passed with a large-chunk warning, and lint, which returned zero errors with two backend warnings and 29 frontend warnings.

The remaining gaps are part of the story: the backend suite is not yet hermetic, Docker Compose is not validated on this host, and some dashboard and report aggregates need reconciliation."

**Timing:** 1:15  
**Transition:** "I will show the manager journey now, without resetting any data."

**If interrupted:** "Yes, the backend pass is reported rather than freshly rerun; the ML tests, build, and lint are fresh."

---

## Slide 7 - Demo walkthrough

**Slide title:** Demo: manager journey  
**On-slide bullets:**

- Sign in as manager; dashboard and low-stock view
- Inventory list, product detail, movement history
- POS sale with server-calculated total
- Return with restock and write-off quantities
- Purchase-order receiving, then optimization and forecast metadata

**Visual suggestion:** A six-step numbered ribbon across the bottom with route labels. Reserve a side panel for fallback screenshots in case the live environment fails.

**Full spoken notes:**

"I will keep the demo to the manager journey and avoid destructive operations.

First, I sign in as the manager and show the dashboard: sales totals, recent sales, low stock, and expiry visibility.

Second, I open Inventory. The table shows on-hand, reserved, available, and safety stock. I open one product to show movement history and the relationship between stock balance and the ledger.

Third, I open Point of Sale. I search for a low-value product, add it to the cart, and complete a sale. I will point out that the backend calculates the authoritative total from product prices and store tax, not the browser.

Fourth, I open the sale detail and show the return dialog: returned quantity, restock quantity, write-off quantity, and the validation rule.

Fifth, I open Purchase Orders and show the state machine and the receiving tab. If a suitable draft or submitted order exists, I show the receipt reference and partial-receive fields.

Finally, I open the Optimization Centre. I show the recommendation list, forecast data, and model metadata. I explain the inventory position, target stock, minimum order quantity, pack multiple, and the approval action.

If a live step fails, I will switch to the recorded evidence rather than reset or reconfigure the database during the presentation."

**Timing:** 1:30  
**Transition:** "That is what works. The final slide is what is not yet proven."

**If interrupted:** "I can skip to optimization or show the return flow first, depending on what the panel wants to inspect."

---

## Slide 8 - Limitations, next steps, and close

**Slide title:** Controlled pilot today; production work is explicit  
**On-slide bullets:**

- Proven: transactions, RBAC, audit, benchmark ML, build and lint
- Not proven: live-store accuracy, financial ROI, multi-store
- Limits: non-hermetic tests, single-store paths, UI reconciliation
- Next: isolated test DB, live-data retraining, monitoring, CI/containers
- Decision: forecasts advise; managers authorise

**Visual suggestion:** Three-column "Proven / Not proven / Next" layout. Use a single green check, a single amber question mark, and a single blue arrow. End with the phrase "Human-in-the-loop optimisation."

**Full spoken notes:**

"ORIMS demonstrates a consistent, auditable inventory core and a real, bounded forecasting pipeline.

What is proven is that sales, returns, receiving, adjustments, role checks, and audit history can be implemented with transaction-safe behaviour, and that the ML pipeline can be evaluated chronologically against baselines.

What is not proven is live-store forecast accuracy or a financial return. The model uses a benchmark sample. The reports are operational, not audited financial statements. The application is single-store in practice. The backend test suite is not yet hermetic, and container deployment needs validation.

The next work is concrete: isolate the backend test database, retrain and evaluate on live ORIMS history with stockout-aware demand, add monitoring and a retraining policy, validate containers and CI, and reconcile the remaining UI aggregates such as the tax preview and top-product reporting.

The central decision is to keep purchasing human-approved. With the current evidence, that is the appropriate automation boundary.

Thank you. I will take questions on the architecture, transactions, model evaluation, or the evidence."

**Timing:** 1:00  
**Transition:** Open the Q&A document if needed.

**If interrupted:** "The shortest honest summary is: controlled single-store pilot, not production rollout."

---

## Rehearsal checklist

- [ ] Entire deck runs in 8:30-9:30 without notes.
- [ ] Every ML metric is immediately followed by "benchmark sample".
- [ ] The 54/54 backend result is described as reported, not freshly rerun.
- [ ] The 12 ML tests, build, and lint are described as independently re-run.
- [ ] The recommendation formula is explained without looking at the screen.
- [ ] The demo can be completed in 90 seconds or abandoned cleanly.
- [ ] No slide claims measured waste reduction or stockout reduction.
- [ ] No secrets, cookies, or environment files are shown.
