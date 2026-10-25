# ORIMS — Complete Repository Audit, Gap Analysis, and Improvement Roadmap

**Document ID:** ORIMS-AUDIT-COMPLETE-2026-10-25
**Audit date:** 2026-10-25
**Repository:** `E:\Projects\ORIMS`
**Branch / commit:** `master` @ `b0c2f6b`
**Mode:** Read-only code inspection plus non-destructive verification commands. No application code, schema, migration, config, lockfile, or existing document was modified. This report is the only file created.
**Authoritative sources:** the Markdown pack in `docs/` (specifically `01`–`13`, `README.md`, `ORIMS_ARCHITECTURE_DIAGRAM.md`). Prior reports in `docs/audit/` are treated as **claims to verify**, not as evidence.

---

## 1. Executive summary, health assessment, and scope limitations

### 1.1 Overall assessment

ORIMS is a substantial, genuinely integrated implementation rather than a scaffold. The modular monolith, Prisma schema, Express domain routes, React application shell, and a working FastAPI/scikit-learn service all exist, build, and run. Automated suites execute and pass (**45 backend tests / 9 files; 12 ML tests**), checkout is transactionally protected against overselling, and ML integration from Node is real (not mocked).

However, the repository is **not release-ready** and several defects previously reported as "resolved" are present in the current code. The most serious cluster is **stock-integrity under concurrency and duplicate input**, which directly contradicts the PRD's success measures ("inventory balance remains consistent", "cannot partially deduct", "receiving updates stock once even if a client retries"):

- Inventory adjustments compute the new balance from a stale read and write an absolute value outside any guard (**P0**).
- Purchase receiving validates each requested line against the same stale `receivedQty`, so duplicate lines in one request both pass, and validation happens before the transaction (**P0**).
- Sale returns have the same duplicate-line and pre-transaction pattern (**P0**).
- The ML evaluation pipeline claims a chronological split but actually splits by *product*, and both baselines degenerate to a global mean, making the reported 65.65% improvement invalid (**P1**).

The frontend has multiple contract mismatches that break primary workflows: the returns UI sends fields Prisma rejects (returns from the UI fail), session restoration does not refresh an expired access cookie, dashboard KPIs are labelled with fabricated deltas, and most management routes have no route-level role guard.

**Health score (evidence-based, not a grading exercise):**

| Area | Status | Rationale |
|---|---|---|
| Build & static checks | **Amber** | Frontend build passes; lint 0 errors / 29 warnings; Prisma CLI cannot run |
| Authentication | **Amber** | Hashing, inactive-user checks, login rate limit good; no revocation, hybrid strategy, demo creds shipped |
| Authorization | **Red** | Multiple documented Manager/Admin endpoints are readable by any authenticated role |
| Transaction integrity | **Red** | Checkout is solid; adjustments, receiving, and returns are not |
| Data model | **Amber** | Strong schema; missing FKs, no CHECKs, cascade risks, settings drift |
| Sales / purchasing workflows | **Amber** | Happy paths work and are tested; edge/concurrency paths fail |
| Reporting | **Amber** | Functional, but valuation method ignored and turnover math is wrong |
| ML quality & honesty | **Red** | Non-chronological split, degenerate baselines, mislabeled fallbacks, synthetic metrics presented as accuracy |
| Frontend UX | **Amber** | Broad coverage; several dead ends, fabricated data, weak error/a11y states |
| Security | **Amber** | No plaintext passwords; secrets ignored; default service key, leaked DB version/error text, demo creds |
| Testing | **Amber** | Real integration tests, but shared mutable DB and no coverage of the P0 paths |
| Deployment / ops | **Red** | Docker unavailable/unverified, no backup or restore evidence, no OpenAPI, migrations not runnable from `.env` |

### 1.2 Scope limitations (explicit)

- **No browser/E2E execution.** UI findings come from source inspection; no Playwright/Cypress run.
- **Docker was not available** on the host (`docker` is not recognized), so `docker-compose.yml` and the Dockerfiles were **not executed** and `docker compose config` could not validate them.
- **`prisma validate` could not run** because `DATABASE_URL` is not present in `backend/.env` (see `DB-002`). This is itself a finding.
- **Backend tests were run against the developer's local MySQL** using the checked-in seed and did mutate local test rows. They are not hermetic. The ML service was **not running** during the backend run, which means the optimization test exercised the **fallback** path only.
- **Training was not executed.** ML findings are from reading `train.py`, `features.py`, `m5_data.py`, `main.py`, `models/metadata.json`, and reconciling the numbers. I did not load `model.joblib`.
- **No production data or production database was accessed.**
- Dependency vulnerability scanning (npm audit / pip-audit) was **not** run (network/registry access not required for this task and not approved as a mutation).
- Excluded from review: `node_modules/`, `frontend/dist/`, `__pycache__/`, `.pytest_cache/`, and the binary `model.joblib`. Generated/build output is not project-authored source.

---

## 2. Repository inventory and reviewed/excluded file groups

### 2.1 Counts

| Group | Files | Reviewed |
|---|---:|---|
| Root config (`package.json`, `package-lock.json`, `docker-compose.yml`, `mysql_init.sql`, `.gitignore`) | 5 | 4 (lockfile skimmed) |
| Docs — core spec (`docs/*.md`) | 15 | 15 |
| Docs — prior audits (`docs/audit/*.md`) | 4 | 4 (summarised; see §3.4) |
| Backend source (`backend/src`) | 30 | 30 |
| Backend Prisma (`schema.prisma`, `seed.js`, migration, lock) | 4 | 4 |
| Backend tests | 10 | 10 |
| Backend config (`.env.example`, `.eslintrc.cjs`, `Dockerfile.dev`, `package.json`) | 4 | 4 |
| Frontend source (`frontend/src`) | 26 | 26 |
| Frontend config (`package.json`, vite/tailwind/postcss/eslint, index.html) | 6 | 6 |
| ML service (`.py`, requirements, pyproject, Dockerfile, tests) | 9 | 9 |
| ML data/artifacts (`sample_m5_fixture.csv`, `metadata.json`, `model.joblib`) | 3 | 2 (CSV header + metadata; binary not deserialised) |
| **Total project-owned** | **~106** | **~105** |

`git ls-files` reports **112 tracked files**; the difference is the ignored/generated set below.

### 2.2 Tracked vs ignored (verified with `git check-ignore` and `git ls-files`)

| Path | State | Implication |
|---|---|---|
| `backend/.env` | ignored (`*.env`) | Good: no secrets in Git. |
| `backend/.env.example` | tracked | Good. |
| `ml-service/models/` (`model.joblib`, `metadata.json`) | **ignored** | A clean clone ships **no model**; the service silently serves baselines until training is run. Not documented in `docs/`. |
| `ml-service/data/` (`sample_m5_fixture.csv`) | ignored | ML tests still pass because `m5_data.py` regenerates a deterministic fixture. Acceptable, but the test name implies a real dataset. |
| `frontend/dist/` | ignored | Good. |
| `backend/prisma/migrations/migration_lock.toml` | tracked | Good — but `.gitignore:51` contains a rule intending to ignore it, which does not match the real path. Confusing, not harmful. |

### 2.3 Exclusions
`node_modules`, `dist`, Python caches, binary model artifact (not deserialised), `package-lock.json` (only inspected for workspace consistency).

---

## 3. Documents read, documentation conflicts, and open decisions

### 3.1 Read in full
`docs/README.md`, `01_PRODUCT_REQUIREMENTS_DOCUMENT.md`, `02_SOFTWARE_REQUIREMENTS_SPECIFICATION.md`, `03_SYSTEM_ARCHITECTURE.md`, `04_DATABASE_DESIGN.md`, `05_API_SPECIFICATION.md`, `06_ML_FORECASTING_DESIGN.md`, `07_UI_UX_SPECIFICATION.md`, `08_SECURITY_AND_PRIVACY.md`, `09_TEST_STRATEGY_AND_ACCEPTANCE.md`, `10_IMPLEMENTATION_ROADMAP.md`, `11_DEPLOYMENT_AND_OPERATIONS.md`, `12_RISKS_ASSUMPTIONS_AND_DECISIONS.md`, `13_GLOSSARY_AND_METRICS.md`, `ORIMS_ARCHITECTURE_DIAGRAM.md`; and prior audits `ORIMS_FULL_AUDIT_REPORT.md`, `ORIMS_CRITICAL_REMEDIATION_REPORT.md`, `ORIMS_FINAL_RELEASE_READINESS_AUDIT.md`, `ORIMS_ML_DATASET_INTEGRATION_AND_DEBUG_REPORT.md`.

### 3.2 Documentation conflicts (must be resolved before trusting any "done" claim)

| # | Conflict | Sources |
|---|---|---|
| C-1 | Backend test totals disagree: 31 / 41 / 44 tests across reports. Actual today: **45 tests, 9 files**. | FULL §7.1; FINAL §12; CRIT §7; ML §8 |
| C-2 | ML test totals: 7 vs 12. Actual: **12 passed**. | FULL/FINAL/CRIT; ML §8 |
| C-3 | ML metrics are mutually exclusive: FINAL reports MAE 0.9539 / WAPE 0.0893 / 84.7% improvement on 29,160 train; ML report and checked-in `metadata.json` report MAE 1.5196 / WAPE 0.1324 / 65.65% on 13,440 train. | FINAL §9; ML §6; `ml-service/models/metadata.json` |
| C-4 | Dataset provenance: FULL/FINAL call it `SYNTHETIC` (36,500 records); ML report calls it M5 Forecasting Accuracy. Current metadata says `M5_BENCHMARK_SAMPLE`. | FULL DEF-014; FINAL §14.3; ML §4; `metadata.json:4` |
| C-5 | Auth strategy: `05` §4 and `08` §2 require choosing cookie **or** token flow and forbid an undocumented hybrid; CRIT claims docs "mandate dual authentication". Implementation is hybrid. | `05` §4; `08` §2; CRIT §2.2; `auth.js` |
| C-6 | Release verdicts: CRIT = "PRODUCTION READY"; FINAL = "READY FOR CONTROLLED PILOT"; README = docs are a design baseline, not implementation evidence. | CRIT header/§9; FINAL §1; README §Status |
| C-7 | `FINAL` references an "ADR-006" that does not exist in `03` §7 or `12` §4 (only ADR-001–005). | FINAL §3; `03` §7; `12` §4 |
| C-8 | Bind address for ML: FINAL instructs `--host 0.0.0.0`; ML report uses `127.0.0.1`; architecture requires the service be private. | FINAL §15; ML §9; `03` §6; `11` §2 |
| C-9 | `.env.example` comments out `DATABASE_URL`, but `schema.prisma` requires it; this makes `prisma migrate/validate` fail on a clean machine. | `.env.example:7-8`; `schema.prisma:7` |
| C-10 | bcrypt cost: FINAL says 10, CRIT says 12. Actual: **12** (`users.js:40`). | FINAL §4; CRIT §1 |

### 3.3 Open decisions from `12` §3 (still open in the decision log)

`12` §3 lists ten unresolved decisions. None has been closed in the document. The code has effectively decided several of them, but without updating the decision log, so the audit records these as **open decisions with de-facto implementations**:

1. **Authentication** — cookie vs token: implemented as a hybrid (see `AUTH-002`).
2. **Store support** — single vs multi: schema is multi-store, checkout/returns hard-code `default-store`, UI accepts arbitrary `storeId`.
3. **Tax behavior** — fixed `TAX_RATE` env (10%) is used; no configurable/rounding policy. Store settings expose tax fields that do not exist (`DB-001`).
4. **Payment scope** — only a free-text `paymentMethod`; no enum or provider.
5. **Returns** — restock + write-off exist; role approval rule and eligibility are undocumented.
6. **Inventory valuation** — report accepts a `valuationMethod` but ignores it (`OPT-003`).
7. **Batch scope** — `ProductBatch` exists; sales/returns never decrement batches, so "batch tracking" is partial.
8. **Forecast cadence** — manual `POST /optimization/recalculate` only.
9. **Forecast training threshold** — not defined; insufficient history is silently replaced (see `ML-004`).
10. **Deployment target** — unspecified; Docker blocked on the audit host.

### 3.4 Prior-audit reconciliation (regression table)

Prior audits are point-in-time. The table records the **current** state after verifying the code.

| Prior claim | Source | Current status | Evidence |
|---|---|---|---|
| DEF-001 concurrent checkout / overselling resolved | FULL §4 | **Still resolved** | `sales.js:114-128`; passing concurrency test (`sales.test.js:141-170`); observed 409s in test run |
| DEF-002 write-off returns fixed | FULL §4 | **Partially regressed** | Restock works (`sales.js:390-408`), but returns UI is broken (`UI-001`) and over-return is possible (`SALE-001`) |
| DEF-003 `/auth/me` auth fixed | FULL §4 | **Resolved in backend; regressed in frontend** | `auth.js:100` has middleware; `api.js:16-20` still excludes `/auth/me` from refresh (`AUTH-001`) |
| DEF-008 unhandled async rejections | FULL §4 | **Resolved** | `index.js:3` `express-async-errors` |
| DEF-011 storeId `default-store` | FULL §4 | **Resolved for validation**, but hard-coded store remains | `sales.js:17,342`; `purchaseOrders.js:246` |
| CRIT P0 Axios hard redirect / duplicate `<Outlet />` | CRIT §1–3 | **Resolved** | `api.js:33-38`; `App.jsx`/`Layout.jsx` |
| FINAL "routing PASS" | FINAL §6 | **Partially regressed** | Only `/settings` and `/users` have `allowedRoles` (`App.jsx:81-96`); see `API-001` |
| "ML chronological split" | FULL DEF-006; ML §5 | **Not true** | `features.py:35` sorts by product; `train.py:106-111` slices by row index (`ML-001`) |
| "All core P0/P1 resolved, production ready" | CRIT §9 | **Not supported** | P0 findings INV-001, PUR-001, SALE-001; P1 findings throughout |

---

## 4. Architecture overview (as actually implemented)

```
Browser (React 18 + Vite + Tailwind + Recharts)
  │  axios, baseURL /api/v1, withCredentials:true,
  │  in-memory Bearer header + httpOnly cookies (hybrid)
  ▼
Node.js 20 / Express 4  (port 3001)
  ├─ global authMiddleware after /auth + /health
  ├─ per-route requireRole(...)  ← incomplete (API-001)
  ├─ Zod validators via utils/validation.js  ← parsed data discarded (API-003)
  ├─ Prisma Client ──────────────► MySQL 8.4 (port 3306, Prisma migrations)
  ├─ mysql2 pool (src/db.js) ────► same MySQL, used by /health/db and verifyDb.js
  └─ fetch POST /internal/forecasts (X-API-Key, 5 s timeout)
                                   ▼
                          Python 3.13 / FastAPI (port 8000)
                             ├─ main.py: /health, /internal/model-info, /internal/forecasts
                             ├─ features.py: shared feature engineering
                             ├─ train.py: M5/synthetic training + evaluation
                             ├─ m5_data.py: dataset loader + deterministic fixture
                             └─ models/model.joblib + metadata.json (git-ignored)
```

**Deviations from `03`/`DIAGRAM`:**

1. **Dual data-access paths.** `03` §2 describes Prisma as the data layer. The code adds a second `mysql2` pool used for health/verification (`src/db.js`), so two credential interpretations exist (`DB_*` vs `DATABASE_URL`). Not harmful at runtime, but it creates the `DB-002` migration failure and an unused `better-sqlite3` dependency.
2. **Business logic lives in route handlers.** `03` §2 says controllers are thin and rules live in services; there is no `services/` layer. Sale, receipt, return, and recommendation logic is 100–250-line route handlers. Proportionate for a 1–2 person project, but it is where the concurrency defects live.
3. **Store scoping is inconsistent.** Some routes accept arbitrary `storeId`; sales/returns hard-code `default-store`; `User` has no store relation.
4. **No OpenAPI artefact** despite `05` §10.
5. **ML private networking not enforced by app code** (only an API key with a hard-coded default).

---

## 5. Requirement traceability matrix

Legend: **I** implemented, **P** partial, **M** missing, **C** contradicted, **B** blocked/unverifiable.
Tests column: `B` backend Vitest, `M` ML pytest, `F` frontend/RTL (runs inside backend suite), `—` none.

### 5.1 Functional requirements

| ID | Requirement | Source | Evidence | Tests | Status | Gap |
|---|---|---|---|---|---|---|
| FR-AUTH-01 | Hash passwords | `02` §3 | `users.js:40` bcrypt 12; `seed.js:30`; `auth.js:59` | B | I | — |
| FR-AUTH-02 | Server-side permission on every protected op | `02` §3 | `middleware/auth.js:43-49`; only some routes use it | B (partial) | **P** | Reports, optimization reads, sales summary, inventory movements lack role guards (`API-001`) |
| FR-AUTH-03 | Four roles | `02` §3 | `schema.prisma` UserRole; `validators/auth.js` | B | I | — |
| FR-AUTH-04 | Logout invalidates session/refresh | `02` §3 | `auth.js:95-98` clears cookies only | B (asserts only 200) | **P** | No server-side revocation (`AUTH-002`) |
| FR-AUTH-05 | Block inactive users | `02` §3 | `middleware/auth.js:21`; `auth.js:55,136` | B | I | — |
| FR-PROD-01 | CRUD/search/filter/deactivate products | `02` §3 | `routes/products.js`; `pages/Products.jsx` | B/F | **P** | `active=false` filter returns active rows (`UI-005`); edit link dead (`UI-011`) |
| FR-PROD-02 | Unique SKU/barcode | `02` §3 | `schema.prisma` uniques; `products.js:61-65` | B | I | Barcode duplicate returns 400 not 409 |
| FR-PROD-03 | Decimal non-negative prices | `02` §3 | `schema.prisma` DECIMAL(12,4); validators | B | I | — |
| FR-PROD-04 | Category + multiple suppliers | `02` §3 | `SupplierProduct` model; supplier routes | B | I | — |
| FR-PROD-05 | Retain history; deactivate over delete | `02` §3 | No product delete endpoint | — | **P** | Cascade deletes can still erase movements (`DB-003`) |
| FR-INV-01 | On-hand/reserved/available | `02` §3 | `inventory.js:24-99`; `products.js:47-49` | B | **P** | Product detail page reads wrong fields (`UI-004`) |
| FR-INV-02 | Every change writes a movement | `02` §3 | sale/PO/adjustment write movements | B | **P** | Adjustment movement omits `inventoryId`; write-off uses delta 0 by design |
| FR-INV-03 | Authorized adjustments with reason | `02` §3 | `inventory.js:203`; `validators/inventory.js` | B | I | Sign/type not enforced |
| FR-INV-04 | No negative stock | `02` §3 | `sales.js:114-128`; `inventory.js:215-218` | B | **P** | Adjustment can go below reserved; race allows lost update (`INV-001`) |
| FR-INV-05 | Balance + movement atomic | `02` §3 | `sales.js` transaction; `inventory.js:220-245` | B | **P** | Adjustment guard computed outside transaction (`INV-001`) |
| FR-INV-06 | Filter inventory | `02` §3 | `inventory.js:24-99` | B | **P** | Filtering/sorting/pagination done in memory |
| FR-SALE-01 | Create sale with items | `02` §3 | `sales.js:14-...` | B | I | Duplicate product lines rejected (`API-005`) |
| FR-SALE-02 | Server-authoritative prices/tax/discount | `02` §3 | `sales.js:55-78` | B | **P** | Fixed env tax; discounts always 0; store tax setting ignored |
| FR-SALE-03 | Atomic checkout | `02` §3 | `sales.js:83-145` | B | I | — |
| FR-SALE-04 | Retry-safe idempotency | `02` §3 | `sales.js:20-23,147-155` | B | **P** | Key not bound to payload (`API-004`); POS regenerates key (`UI-002`) |
| FR-SALE-05 | Searchable history/receipt | `02` §3 | `sales.js:225-336`; `pages/Sales.jsx` | B/F | I | — |
| FR-SALE-06 | Returns/cancellations with transitions | `02` §3 | `sales.js:338-459` | B | **P** | No cancel; over-return (`SALE-001`); UI broken (`UI-001`); partial refunds not represented |
| FR-SALE-07 | Preserve unit cost at sale | `02` §3 | `sales.js:66`; `schema.prisma` SaleItem.unitCost | B | I | — |
| FR-PUR-01 | Supplier CRUD | `02` §3 | `routes/suppliers.js` | — | I | Empty optional email rejected (`UI-006`) |
| FR-PUR-02 | Create POs | `02` §3 | `purchaseOrders.js` | B | I | — |
| FR-PUR-03 | Controlled statuses | `02` §3 | `purchaseOrders.js:17-23` | B | I | — |
| FR-PUR-04 | Validate receipt qty, prevent duplicates | `02` §3 | `purchaseOrders.js:197-211` | B (happy path) | **P** | Duplicate lines/concurrency over-receipt (`PUR-001`) |
| FR-PUR-05 | Receipt updates inventory + movements atomically | `02` §3 | `purchaseOrders.js:213-267` | B | I | — |
| FR-PUR-06 | Incoming only for confirmed orders | `02` §3 | `optimization.js:200-224` | B | I | — |
| FR-REP-01 | Dashboard KPIs | `02` §3 | `pages/Dashboard.jsx` | F (render only) | **P** | Mislabeled/fabricated deltas, no inventory value, top products always empty (`UI-003`) |
| FR-REP-02 | Report filters | `02` §3 | `validators/reports.js`; `pages/Reports.jsx` | B | **P** | End date excludes final day (`API-006`); no export (`UI-009`) |
| FR-REP-03 | Valuation basis identified | `02` §3 | `reports.js:76-111` | B | **P** | `valuationMethod` ignored (`OPT-003`) |
| FR-ALERT-01 | Reorder thresholds | `02` §3 | `sales.js:187-235`; `optimization.js` | B | I | — |
| FR-ALERT-02 | Expiry alerts | `02` §3 | `reports.js` expiry; `optimization.js` expiry-risk | B | **P** | No expiry notification generation; batches never decremented |
| FR-ALERT-03 | Notification dedup | `02` §3 | `schema.prisma` deduplicationKey; `sales.js:219` | B | **P** | Upsert race logs unique-constraint errors (test output) |
| FR-ML-01 | Daily demand history | `02` §3 | `features.py` (training); `optimization.js:228-243` (serving) | M | **P** | Serving list is per sale line, unordered (`ML-003`) |
| FR-ML-02 | 7-day horizon | `02` §3 | `main.py:219-226`; `optimization.js:303` | M/B | I | Stale lags beyond day 1 (`ML-005`) |
| FR-ML-03 | Model version/metadata returned | `02` §3 | `main.py:269-276` | M | I | — |
| FR-ML-04 | Baseline on chronological evaluation | `02` §3 | `train.py:59-81,106-111` | M (arithmetic only) | **C** | Split is product-based; baselines identical (`ML-001/002`) |
| FR-ML-05 | Fallback/insufficient history | `02` §3 | `main.py:229-267`; `optimization.js:338-350` | M/B | **P** | Fabricated 0 or 1; status `success` (`ML-004`) |
| FR-ML-06 | Node computes recommendation inputs | `02` §3 | `optimization.js:323-467` | B | I | — |
| FR-ML-07 | Recommendation explanation/inputs/version | `02` §3 | `optimization.js:417-465` | B | I | UI hides some fields |
| FR-ML-08 | No automatic PO from ML | `02` §3 | `optimization.js:120-136` creates DRAFT only | B | I | — |
| FR-AUD-01 | Audit important actions | `02` §3 | `auditLog.create` in several routes | — | **P** | Audit writes are outside transactions; not all actions covered |
| FR-SET-01 | Configure store + policies | `02` §3 | `routes/settings.js` | — | **C** | Store fields advertised do not exist (`DB-001`) |
| FR-SET-02 | Record policy change actor/time | `02` §3 | `settings.js:31-39,72-80,96-104` | — | I | — |

### 5.2 Non-functional requirements

| ID | Requirement | Evidence | Status | Gap |
|---|---|---|---|---|
| NFR-SEC-01 | No plaintext passwords | `users.js:40`; `schema.prisma` passwordHash | I | — |
| NFR-SEC-02 | Secrets from env, not VCS | `.env` ignored; `.env.example` tracked | **P** | Code falls back to `dev-ml-api-key`; JWT secrets not validated at boot |
| NFR-SEC-03 | ML private/authenticated | `main.py:46-55` API key; `optimization.js:291` | **P** | Shared default key; no network boundary; docs conflict on bind host |
| NFR-SEC-04 | Validation, rate limits, least privilege, safe errors | `index.js:52-66`; `validation.js`; `errorHandler.js` | **P** | Parsed data discarded; partial rate limits; DB/error leakage (`SEC-003`, `API-008`) |
| NFR-DATA-01 | FKs, uniques, checks | `schema.prisma`; migration | **P** | Missing FKs on store/actor; no CHECK constraints (`DB-003`) |
| NFR-DATA-02 | Transactional consistency under concurrency | `sales.js` | **P** | Checkout yes; adjustment/receipt/return no (`INV-001`, `PUR-001`, `SALE-001`) |
| NFR-PERF-01 | Measured response times | none | B | Not measured |
| NFR-UX-01 | Desktop/tablet + states | pages; lint | **P** | Error states unrendered; a11y gaps (`UI-008`, `UI-016`) |
| NFR-OBS-01 | Structured logs + request IDs | `morgan`; `console`; `errorHandler` | **P** | No request ID generation; unstructured `console.error` (`API-009`) |
| NFR-REC-01 | Backup/restore documented and tested | none | **M** | `OPS-002` |
| NFR-ML-01 | Chronological splits vs baseline | `train.py` | **C** | `ML-001/002` |
| NFR-MAINT-01 | Versioned migrations + documented contracts | one migration; no OpenAPI | **P** | `DB-002`, `OPS-003` |

---

## 6. Findings by severity

Severity definitions follow the audit brief. Each P0/P1 uses the full 12-field format. P2/P3 use a complete tabular format with the same information.

### 6.1 P0 — Critical (data integrity / serious security)

---

#### INV-001 — Inventory adjustment loses concurrent updates and desynchronises the ledger
- **Severity:** P0
- **Title:** Read-then-absolute-write adjustment race
- **Area:** Inventory
- **Evidence:** `backend/src/routes/inventory.js:207-245` (read at `:207`, compute at `:215`, absolute write at `:223`, movement at `:225`).
- **Requirement:** FR-INV-04, FR-INV-05, NFR-DATA-02; `04` §4.3 (`02` §3).
- **Observed:** `newOnHand = inventory.quantityOnHand + quantityDelta` is computed from a read taken before `$transaction`; the transaction then writes `quantityOnHand: newOnHand` absolutely. Two concurrent adjustments both read 10 and write, say, 5 and 3; the balance ends at 3 or 5 while two movement rows record the deltas. The negative check is also based on the stale value.
- **Expected:** The balance change and ledger entry must commit together under a conditional/locked update, and must never go below zero (or reserved quantity).
- **Root cause:** Business rule in application memory rather than an atomic database expression; `inventory.version` exists but is not used as a guard.
- **Impact:** Inventory balance diverges from the movement ledger — the exact failure the PRD's success measure forbids. Reports, alerts, and replenishment recommendations become wrong. Concurrent legitimate decreases can be lost, masking shrinkage.
- **Recommended fix:** Inside an interactive transaction, either (a) `updateMany({ where: { id, quantityOnHand: expected, version }, data: { quantityOnHand: expected + delta, version: { increment: 1 } } })` and require `count === 1`, or (b) `SELECT ... FOR UPDATE` the row, re-check, then update; create the movement only after a successful conditional update. Also enforce `newOnHand >= reservedQuantity`.
- **Verification:** Add a test firing N concurrent ± adjustments and assert `final balance == initial + Σ deltas` and `Σ movement.quantityDelta == final − initial`.
- **Dependencies / risk:** Independent. Low schema impact. Estimated effort: **S–M**.

---

#### PUR-001 — Purchase receiving can over-receive via duplicate lines or concurrent requests
- **Severity:** P0
- **Title:** Over-receipt creates phantom stock
- **Area:** Purchasing / receiving
- **Evidence:** `backend/src/routes/purchaseOrders.js:202-211` (per-line check against stale `poItem.receivedQty`, outside the transaction) and `:237-243` (unconditional increment). Transaction begins at `:213`.
- **Requirement:** FR-PUR-04, FR-PUR-05, `04` §4.2, `05` §5; `08` §5.
- **Observed:** Two request lines referencing the same `purchaseOrderItemId` with `qtyReceived` 12 each are each compared with the same `remaining` (e.g. 20); both pass, then `receivedQty` is incremented twice to 24 for an order of 20. Two concurrent requests with different `receiptReference` values can likewise both pass the pre-transaction check.
- **Expected:** Cumulative received quantity must never exceed ordered quantity; duplicate/retried requests must not increase stock twice.
- **Root cause:** Validation is not aggregated per PO line and not performed under the same transaction/isolation as the increment.
- **Impact:** Free inventory appears, valuation and margin are corrupted, and the PO can exceed its ordered quantity. This directly violates PRD success measure "Receiving a purchase order updates stock once, even if a client retries".
- **Recommended fix:** Aggregate request quantities by `purchaseOrderItemId` before validation; perform validation and `receivedQty` update inside the interactive transaction with a conditional `updateMany({ where: { id, receivedQty: { lte: orderedQty - qty } } })` or `SELECT ... FOR UPDATE`; return 409 on conflict. Keep `receiptReference` unique as the retry guard and return the original receipt on replay.
- **Verification:** Tests for (a) duplicate lines in one receipt → 400/409 and no stock change; (b) two concurrent receipts for the same remaining quantity → exactly one succeeds; (c) retry with same reference → same receipt, no extra stock.
- **Dependencies / risk:** Should be fixed together with return logic; a shared "atomic quantity mutation" helper would reduce duplication. Estimated effort: **M**.

---

#### SALE-001 — Returns can exceed sold quantity via duplicate lines or concurrency
- **Severity:** P0
- **Title:** Over-return and over-restock
- **Area:** Sales / returns
- **Evidence:** `backend/src/routes/sales.js:358-375` validation loop, `:377-425` transaction (starts after validation); `:364-368` aggregates previously returned quantity per line but not other lines in the same request.
- **Requirement:** FR-SALE-06, `04` §4.4, `08` §5; `07` §4 (returns).
- **Observed:** Against a line with 3 sold and 0 returned, two request lines of 2 each both satisfy `2 > 3 - 0` being false, then both are created and restocked. Two concurrent return requests can both read the same remaining quantity. `writeOffQty` also bypasses stock because it writes a movement with delta 0.
- **Expected:** Sum returned quantities per sale item across the request and existing returns; enforce under a lock/transaction.
- **Root cause:** Same pattern as PUR-001: per-line in-memory validation outside the transaction.
- **Impact:** Stock can be inflated beyond what was sold, and refunds can exceed the original sale. Combined with the returns-UI defect (`UI-001`), this is both a correctness and a financial-control gap.
- **Recommended fix:** Group `items` by `saleItemId`, sum `qtyReturned`, validate once inside the transaction, and use a conditional/`FOR UPDATE` read of `saleItems` + previous returns. Reject returns for `CANCELLED` sales. Add an idempotency key to returns.
- **Verification:** Duplicate-line return test; concurrent return test; assert `Σ returned ≤ sold` and stock delta equals `Σ restockQty`.
- **Dependencies / risk:** Pairs with `UI-001`; do not fix UI alone. Estimated effort: **M**.

---

### 6.2 P1 — High

---

#### AUTH-001 — Session cannot be restored once the access token expires
- **Severity:** P1
- **Title:** `/auth/me` excluded from refresh interceptor
- **Area:** Frontend auth
- **Evidence:** `frontend/src/services/api.js:16-20` (`/auth/me` in `isAuthRoute`); `frontend/src/context/AuthContext.jsx:10-19` (bootstrap via `/auth/me`).
- **Requirement:** `05` §2 (GET `/auth/me`), `07` §2 (session), `08` §2.
- **Observed:** On mount the app calls `/auth/me`. When the 15-minute access cookie has expired but the 7-day refresh cookie is valid, the request returns 401 and the interceptor deliberately does not refresh, so `setUser(null)` and the user is logged out on every reload.
- **Expected:** Bootstrap should refresh, then retry `/auth/me`, or use a refresh-capable bootstrap endpoint.
- **Root cause:** The auth-route exclusion was introduced to stop an interceptor loop, but `/auth/me` is also the session bootstrap.
- **Impact:** Normal sessions appear to expire after a reload; users re-authenticate repeatedly. This contradicts prior DEF-003 "resolved" claims at the UX level.
- **Recommended fix:** Remove `/auth/me` from the exclusion, but guard against loops (only one refresh attempt, and skip refresh for login/refresh/logout). Alternatively expose `GET /auth/session` that refreshes first.
- **Verification:** Frontend test that simulates an expired access cookie and a valid refresh cookie and asserts the user is restored.
- **Dependencies / risk:** Requires stable refresh semantics; coordinate with `AUTH-002`. Estimated effort: **S**.

---

#### AUTH-002 — Logout and refresh do not revoke credentials
- **Severity:** P1
- **Title:** No server-side token revocation or refresh rotation
- **Area:** Authentication
- **Evidence:** `backend/src/routes/auth.js:95-98` (logout clears cookies only); `:117-157` (refresh issues new tokens, old refresh remains valid); `prisma/schema.prisma` has no session/refresh-token table.
- **Requirement:** FR-AUTH-04, `08` §2.
- **Observed:** A copied access token remains valid until its 15-minute expiry after logout; a copied refresh token remains valid until its 7-day expiry and can be replayed even after refresh. Logout is mounted before `authMiddleware`, so it is not authenticated or auditable.
- **Expected:** Deliberate expiry and revocation with a documented policy.
- **Root cause:** Stateless JWT-only design with no persistence of refresh-token state.
- **Impact:** Stolen tokens survive logout; refresh replay is possible. Also a hybrid cookie+bearer strategy (`05` §4 explicitly discourages undocumented hybrids).
- **Recommended fix:** Persist hashed refresh tokens (jti + family + expiry + revokedAt) or add a `tokenVersion` on `User`; verify on refresh; increment on logout/password change; mount logout behind auth and audit it. Choose cookie-first and stop returning `accessToken` in JSON if cookies are authoritative.
- **Verification:** Reuse access token after logout → 401; reuse refresh token after rotation → 401; logout creates an audit row.
- **Dependencies / risk:** Schema migration required; coordinate with `DB-002`. Estimated effort: **M**.

---

#### ML-001 — Training split is by product, not by time
- **Severity:** P1
- **Title:** "Chronological" train/validation/test split is product-major
- **Area:** ML training
- **Evidence:** `ml-service/features.py:35` sorts by `['product_id','store_id','date']`; `train.py:106-111` slices `X[:train_end]`, `[train_end:val_end]`, `[val_end:]` by row index. `metadata.json` reports train 13,440 / val 1,680 / test 1,680 = 40/5/5 products.
- **Requirement:** FR-ML-04, NFR-ML-01, `06` §6.
- **Observed:** Because rows are product-major, the last 20% of rows are the last 10 products, not later dates. The test set is unseen *products*, not future periods, and `FEATURE_COLUMNS` contains no product/store identifier, so the model cannot learn product scale.
- **Expected:** Split on unique dates so train < validation < test in time for every product.
- **Root cause:** Row-index slicing after a product-first sort.
- **Impact:** The headline metrics do not measure future-demand forecasting; the model comparison is structurally invalid. This is the root cause of `ML-002`.
- **Recommended fix:** Build the matrix sorted by date; choose cutoff timestamps (e.g. 80/10/10 by date); slice by date. Optionally add product/category encodings and per-product evaluation.
- **Verification:** Assert `max(train.date) < min(val.date) <= max(val.date) < min(test.date)`; assert every test product appears in train.
- **Dependencies / risk:** Retraining required; metrics will change. Estimated effort: **M**.

---

#### ML-002 — Baselines are degenerate and identical, invalidating the improvement claim
- **Severity:** P1
- **Title:** Both baselines collapse to the global mean on the test set
- **Area:** ML evaluation
- **Evidence:** `train.py:63-68` uses train-period product means; `:72-77` falls back to `product_means.get(pid, global_mean)` for day-of-week. Because test products are absent from train (`ML-001`), both resolve to `global_mean`. `models/metadata.json` reports identical baseline metrics: MAE 4.4235, WAPE 0.3855, bias −2.2833 for both, and `improvement_over_best_baseline_pct: 65.65`.
- **Requirement:** FR-ML-04, NFR-ML-01, `06` §6 ("compare on identical test windows"); `13` §2.
- **Observed:** A "7-day moving average" baseline is actually the full-training product mean, and the day-of-week baseline is numerically identical to it.
- **Expected:** Distinct naive and day-of-week baselines computed from observations available before each target date.
- **Root cause:** Interaction of the split bug with per-product lookup fallback; the "moving average" is also misnamed (`ML-017`).
- **Impact:** 65.65% is measured against a global-mean fallback, not a real naive forecast. Presenting it as model skill is misleading.
- **Recommended fix:** After fixing `ML-001`, compute a trailing 7-day mean and a same-weekday mean per product from data prior to each target, evaluate on the same chronological window, and report per-product and aggregate metrics.
- **Verification:** Assert baseline metrics differ; assert recomputation reproduces metadata.
- **Dependencies / risk:** Same retraining as `ML-001`. Estimated effort: **S–M**.

---

#### ML-003 — Node's serving features are not daily demand
- **Severity:** P1
- **Title:** Train/serve skew in lag and rolling features
- **Area:** ML integration
- **Evidence:** `backend/src/routes/optimization.js:228-243` selects sale items without `orderBy` and pushes raw `quantity` values into `salesMap`; `:259-286` treats that list as a daily series and derives `lag_7/14/28` and rolling statistics positionally.
- **Requirement:** FR-ML-01, `06` §4-§5, `03` §3.
- **Observed:** "Lag 7" is the 7th-to-last *sale line*, not demand seven days ago. Missing days are not zero-filled, multiple sales on one day are separate observations, and order is database-dependent. Training aggregates daily demand per product/store in `features.py:28-50`.
- **Expected:** Group completed sales by business date, reindex to a dense calendar, fill zero-sale days, sort, then compute lags.
- **Root cause:** Two independent feature pipelines (Python training, JS serving) with no parity test.
- **Impact:** Every online forecast is computed on a different distribution from training; model accuracy in production is unknown and likely poor, even if offline metrics improve.
- **Recommended fix:** Build the daily series in SQL or Node, send the last 28 daily values to the ML service, and add a parity test comparing Node-computed features with `features.py` for the same fixture.
- **Verification:** Feature parity test to tolerance; assert dense 28-day length and chronological order.
- **Dependencies / risk:** Touches both services; coordinate with `ML-004`. Estimated effort: **M**.

---

#### ML-004 — Fallbacks fabricate demand and are labelled as success
- **Severity:** P1
- **Title:** Insufficient history produces numeric forecasts of 0 or 1
- **Area:** ML service + Node
- **Evidence:** `ml-service/main.py:229-247` sets `status: "success"` whenever the baseline path runs (only the exception path sets `"fallback"` at `:264`); `main.py:138-140` returns zeros when `recent_sales` is empty; `backend/src/routes/optimization.js:341` uses `avg = ... : 1` when there is no history.
- **Requirement:** FR-ML-05, `06` §8 ("display insufficient data rather than fabricate a prediction").
- **Observed:** A product with no sales receives a full 7-day "success" forecast (zeros or 1/day). The global response status is hard-coded `"success"` even if every product failed (`main.py:275`).
- **Expected:** `INSUFFICIENT_DATA` with no numeric predictions, and a degraded aggregate status.
- **Root cause:** Baseline fallback conflated with model success; no minimum-history check.
- **Impact:** Fabricated demand feeds replenishment recommendations. Zero forecasts can suppress necessary purchasing; 1/day can create phantom orders.
- **Recommended fix:** Define a minimum history (e.g. 28 days); return `INSUFFICIENT_DATA` and skip recommendation generation; set per-product `fallback`/`degraded` status whenever the baseline is used; compute the aggregate status from per-product results.
- **Verification:** Unit test with empty and 3-day history expects `INSUFFICIENT_DATA` and no recommendation row.
- **Dependencies / risk:** Align with `ML-005` and the UI's fallback display. Estimated effort: **S**.

---

#### API-001 — Documented Manager/Admin endpoints are readable by any authenticated role
- **Severity:** P1
- **Title:** Missing route-level authorization
- **Area:** Backend authorization
- **Evidence:** `backend/src/routes/reports.js` has no `requireRole` on any of its five endpoints; `optimization.js:19,481,524,582` (recommendations/forecasts/slow-moving/expiry-risk GETs) have none; `sales.js:276` (summary) has none; `inventory.js:165` (movements) has none.
- **Requirement:** FR-AUTH-02, `05` §1/§4/§6 (`08` §3).
- **Observed:** A `SALES_STAFF` user can call valuation, turnover, all recommendations, all forecasts, all sales summaries, and any product's movement ledger directly with a valid token. Verified the routes are mounted under the global auth middleware only.
- **Expected:** Recommendations/forecasts/slow-moving = Manager/Admin; valuation/turnover = Manager/Admin; expiry-risk = Manager/Inventory/Admin; sales summary = Manager/Admin (staff scope as policy allows).
- **Root cause:** Role checks were added to mutation endpoints but not reads.
- **Impact:** Financial, forecast, and cross-store data exposure to lower-privilege staff; contradicts the SRS's "restricted actions are rejected by the API".
- **Recommended fix:** Add `requireRole(...)` per the API spec and add direct-API negative tests for each role. Also fix UI route guards (`UI-007`).
- **Verification:** Parametrised 403 tests per role for each documented endpoint.
- **Dependencies / risk:** None; but decide store scoping first (`API-002`). Estimated effort: **S**.

---

#### UI-001 — Returns submitted through the UI are rejected by Prisma
- **Severity:** P1
- **Title:** Return payload contains non-schema fields
- **Area:** Frontend / sales
- **Evidence:** `frontend/src/pages/SaleDetail.jsx:28-35` builds items with `productName` and `maxReturnable`; `:50,66` posts them; `backend/src/routes/sales.js:383` passes the array directly to `items: { create: items }`; `schema.prisma:412-425` has only `saleItemId/qtyReturned/restockQty/writeOffQty`.
- **Requirement:** FR-SALE-06, `05` §4.
- **Observed:** Prisma receives unknown arguments and returns a validation error (or the request fails server-side). The unit test passes because it posts only valid fields.
- **Expected:** Only schema fields are sent; the backend strips unknown fields anyway.
- **Root cause:** UI display metadata mixed into the API payload, plus `validate()` not applying the parsed result (`API-003`).
- **Impact:** Returns are unusable from the UI, which is a core documented journey.
- **Recommended fix:** Map only `{ saleItemId, qtyReturned, restockQty, writeOffQty }` before posting; fix `validate()` to replace `req.body` with parsed data as defence in depth.
- **Verification:** Add a frontend/service test that posts a return and asserts no unknown fields; backend test with an extra field expects it stripped.
- **Dependencies / risk:** None. Estimated effort: **S**.

---

#### UI-002 — POS regenerates the idempotency key on every submit
- **Severity:** P1
- **Title:** Retry after timeout can create a duplicate sale
- **Area:** Frontend POS
- **Evidence:** `frontend/src/pages/POS.jsx:80-97` creates `uuidv4()` inside `handleCheckout`; the cart and key are not retained across retries; `:104-111` leaves the completed cart in place.
- **Requirement:** FR-SALE-04, `07` §4 (POS "use retry-safe request handling"), `08` §5.
- **Observed:** A request that succeeds server-side but times out on the client is retried with a new key, creating a second sale.
- **Expected:** One idempotency key per checkout attempt/cart; retain it until success or cart change; disable repeat submission.
- **Root cause:** Key generated per click rather than per basket.
- **Impact:** Duplicate sales and duplicate stock deductions — the exact failure idempotency exists to prevent.
- **Recommended fix:** Generate the key when the cart is first populated (or on first submit) and keep it in state until success; reset the cart and show server-confirmed totals on success.
- **Verification:** Simulate a timeout then retry; assert `POST /sales` returns the same sale and only one exists.
- **Dependencies / risk:** Also fix `API-004` (payload binding). Estimated effort: **S**.

---

#### DB-001 — Store settings expose fields that do not exist
- **Severity:** P1
- **Title:** Settings API/schema drift; store configuration is non-functional
- **Area:** Database / settings
- **Evidence:** `frontend/src/pages/Settings.jsx:11,25,55` sends `taxRate`, `currency`, `timezone`; `validators/settings.js:3-10` accepts them; `prisma/schema.prisma:102-108` `Store` has none of them; `settings.js:26-29` passes `req.body` directly to `prisma.store.update`.
- **Requirement:** FR-SET-01, FR-SALE-02; `04` §2.
- **Observed:** Saving store settings with those fields triggers a Prisma unknown-argument error (500). `GET /settings/store` also creates a store as a side effect (`settings.js:11-17`), and `PUT` mass-assigns arbitrary fields.
- **Expected:** Persisted, allowlisted settings used by checkout; no mutation on GET.
- **Root cause:** UI/validator drift from the schema; missing migration.
- **Impact:** Configurable tax/currency/timezone cannot be used; checkout always uses the env `TAX_RATE`. Users see a failing "Save" on a core admin page.
- **Recommended fix:** Add the columns in a new migration and use them in checkout, or remove the fields from UI + validator; replace `data: req.body` with an explicit pick; remove the GET side effect.
- **Verification:** PUT then GET round-trip; checkout uses the configured tax; no 500.
- **Dependencies / risk:** Migration required; coordinate with `DB-002`. Estimated effort: **M**.

---

#### DB-002 — Migrations and schema validation cannot run from the provided environment
- **Severity:** P1
- **Title:** `DATABASE_URL` absent from `.env`; Prisma CLI broken
- **Area:** Database / reproducibility
- **Evidence:** Executed `npx prisma validate` → `P1012 error: Environment variable not found: DATABASE_URL` at `schema.prisma:7`. `backend/.env` contains `DB_*` only; `.env.example:7-8` comments out `DATABASE_URL`. Runtime works only because `index.js:29-34` constructs a URL in memory.
- **Requirement:** NFR-MAINT-01, `11` §2-§3, `09` §5.
- **Observed:** `npm run db:migrate` (`prisma migrate dev`) and `npm run db:studio` will fail on a clean setup. The seed works because it runs through the app's Prisma client, not the CLI.
- **Expected:** A documented, working migration path on a clean machine.
- **Root cause:** The earlier switch from a single `DATABASE_URL` to `DB_*` variables did not update the Prisma CLI input.
- **Impact:** A reviewer following setup instructions cannot create the schema; `09` §5 acceptance ("setup, environment variables, migrations ... documented") is not met.
- **Recommended fix:** Set `DATABASE_URL` in `.env`/`.env.example` (keep one source of truth) or add a documented pre-migrate script that derives it; verify `prisma migrate deploy` on a clean DB.
- **Verification:** Fresh clone → `.env` from example → `npm run db:migrate && npm run db:seed` succeeds.
- **Dependencies / risk:** Overlaps `SEC-002` secret handling. Estimated effort: **S**.

---

### 6.3 P2 / P3 findings (tabular)

Each row contains: ID, severity, title, evidence, requirement, observed → expected, root cause, impact, fix, verification, effort. **Note:** `SEC-001` is a P1 finding listed here for table compactness (it belongs in the P1 set counted in §21).

| ID | Sev | Title | Evidence | Req | Observed → Expected | Root cause | Impact | Fix | Verification | Effort |
|---|---|---|---|---|---|---|---|---|---|---|
| API-002 | P2 | No store scoping; client-supplied `storeId` trusted | `inventory.js:16,22`; `reports.js:17`; `optimization.js:22,188`; `purchaseOrders.js:29,70`; `User` has no store relation | FR-AUTH-02, `08` §3 | Any authenticated user can read/write any store; sales hard-code `default-store` → expected one enforced scope | Single-store assumption not enforced server-side | Cross-store access once a second store exists; inconsistent behavior | Add user-store membership or reject `storeId` != configured store for non-admin | Negative cross-store test | M |
| API-003 | P2 | `validate()` discards parsed data | `utils/validation.js:6-11`; handlers pass `req.body` (`categories.js:37,70`, `suppliers.js:39,79`, `settings.js:28`, `products.js:59-69`) | `05` §1, `08` §4 | Zod parses but result is thrown away → defaults/coercion/stripping never applied | Oversight in middleware | Mass assignment; `active: z.coerce.boolean()` treats `"false"` as true (`UI-005`); length limits bypassed | Assign `req.body = parsed.body` (etc.) or `req.validated` | Send extra field; assert rejected/stripped | S |
| API-004 | P2 | Idempotency key not bound to payload | `sales.js:20-23,96,147-155` | FR-SALE-04, `05` §8 | Same key with a different basket returns the old sale → expected 409 | Only key stored, not a request hash | A retried key with edited cart silently returns an unrelated sale | Store payload hash; compare on replay | Mismatched-payload test expects 409 | S |
| API-005 | P3 | Duplicate product lines reject a valid cart | `sales.js:26-36` | FR-SALE-01 | `productIds` keeps duplicates while `findMany` dedupes → expected aggregate | Array comparison without dedupe | Cart with the same product twice fails "not found" | Dedupe or aggregate quantities | Cart with duplicate lines succeeds | S |
| API-006 | P2 | End dates exclude the final day | `sales.js:240-253`; `reports.js:22`; `purchaseOrders.js:31-45` | `05` §1 | `new Date('2026-01-31')` = midnight → last day omitted | Date-only parsing | Reports under-count "today" | Normalise end dates to 23:59:59.999 or require full ISO | Boundary test | S |
| API-007 | P2 | Validator max lengths exceed column sizes | `validators/categories.js:6` (500 vs 191); `products.js:7-8`; `suppliers.js:5-9`; `sales.js:38`; `inventory.js:21` vs `migration.sql` | NFR-DATA-01 | Inputs pass validation then Prisma P2000 → generic 500 | Drift between Zod and DDL | Valid-looking requests fail as server errors | Align limits or widen columns; map P2000 → 400 | Long-string test expects 400 | S |
| API-008 | P2 | `model-info` leaks internal error text | `optimization.js:618-639` | `08` §6 | Returns `err.message` and proxies ML status → expected fixed degraded payload | Debug code left in | Reveals internal URLs/dependency details | Log details server-side, return correlation ID | Force ML failure; assert no `err.message` | S |
| API-009 | P3 | No JSON 404, no request IDs, unstructured logs | `index.js:84`; `errorHandler.js:5-12` | `05` §1, NFR-OBS-01 | Unknown route → HTML 404; `requestId='unknown'`; `console.error` with stack | Not implemented | Contract-breaking 404s; poor correlation | Catch-all 404 before error handler; UUID request ID middleware; structured logger | Unknown route returns JSON; header present | S |
| DB-003 | P2 | Missing FKs and unsafe cascades | `schema.prisma:172-190` (movement store/actor), `:352-377` (Sale.createdBy), `:531-547` (AuditLog.actorId); movement cascades from Product | NFR-DATA-01, `04` §6 | Orphan rows possible; deleting a product can delete its ledger | FKs omitted for convenience | Append-only ledger can be lost; no referential protection | Add FKs with `Restrict`/`SetNull`; add CHECKs for quantities | Migration + FK violation test | M |
| DB-004 | P3 | No product snapshot on transaction lines | `schema.prisma:379-397`; reports join current product | `04` §2 | Renaming a product rewrites historical report labels | Normalisation choice | Historical receipts change | Add `productName`/`sku` snapshots | Rename product; old report unchanged | M |
| INV-002 | P2 | Adjustment sign/type and reserved stock not enforced | `inventory.js:215-235`; `validators/inventory.js:16-24` | FR-INV-03/04 | `DAMAGE` with positive delta accepted; can drop below reserved | No per-type rule | Misleading ledger; negative available | Derive sign from type; enforce `>= reserved` | Type/sign matrix test | S |
| OPT-001 | P2 | Recommendation filters/pagination/sort broken | `optimization.js:37-73,534-539`; `validators/optimization.js:13` | `05` §9 | Category filter selects only `name`; filters after `skip/take`; `sort=urgency` → 500; slow-moving spread drops `active` | Query composition errors | Empty results, wrong pages, 500 | Include `category.id`; filter before pagination; remove/fix `urgency`; merge filters | Paging + filter tests | S |
| OPT-002 | P2 | Recommendation approval not atomic | `optimization.js:82-149` | FR-ML-08, `04` §4 | Concurrent approvals can create two POs; failed PO leaves `APPROVED`; missing supplier returns success/null | Check-then-act outside a transaction | Duplicate draft POs; silent no-op | Conditional status update + PO creation in one transaction; 409 if processed; error if no supplier | Concurrent approve test | M |
| OPT-003 | P2 | Valuation method ignored; turnover math wrong; unpaginated movements | `reports.js:76-172,176-209`; `validators/reports.js:18` | FR-REP-03, `13` §2 | `valuationMethod` ignored; per-product turnover divides by total store value; movements returns whole ledger | Simplified implementation | Misleading financial metrics | Implement methods or reject unsupported; per-product average inventory; paginate | Report reconciliation tests | M |
| NOTIF-001 | P2 | Notifications are global and incomplete | `notifications.js:16-20,42-62`; `sales.js:187-235` | FR-ALERT-02/03, `05` §6 | All notifications visible; `read-all` affects everyone; only low/out-of-stock generated | Placeholder scoping | Cross-store exposure; no expiry/PO alerts | Scope by store/role; add expiry/PO alerts | Scoping test | M |
| NOTIF-002 | P2 | Notification upsert races | `sales.js:219`; observed unique-constraint errors in test output | FR-ALERT-03 | Concurrent checkout triggers duplicate-key errors | Find-then-upsert race | Noisy logs; possible lost alert | Use `upsert` alone or `createMany({skipDuplicates})` | Concurrent checkout test asserts no error | S |
| UI-003 | P2 | Dashboard KPIs fabricated/mislabeled | `Dashboard.jsx:29-30,36,69-78,139-142` | FR-REP-01, `07` §4 | "Today's Sales" = 30-day revenue; `+12.5%`/`+3` hard-coded; "Active Products" = total units; `topProducts` never returned | Demo placeholder left in | Users make decisions on wrong numbers | Use real date-scoped values; remove deltas or compute; add inventory-value KPI | Component test with fixture data | M |
| UI-004 | P2 | Product detail inventory/batch shape mismatch | `ProductDetail.jsx:22,134-157` vs `products.js:91-101` (`quantityOnHand`, no `productBatches`) | FR-INV-01, `07` §4 | Stock cards blank; status can read "In Stock" with `undefined`; Batches tab never populates | Frontend assumed API fields | Detail page misleading | Use `quantityOnHand - reservedQuantity`; fetch batches via inventory/batch endpoint | Render test with realistic payload | S |
| UI-005 | P2 | `active=false` filter returns active rows | `Products.jsx:101-105`; `Suppliers.jsx:72-76`; `z.coerce.boolean()` | FR-PROD-01 | Any non-empty string ⇒ `true` | Coercion misuse | Cannot list inactive records | `z.enum(['true','false']).transform(v=>v==='true')` or omit param | API test | S |
| UI-006 | P2 | Supplier without email cannot be created | `Suppliers.jsx:35-36,147-149`; `validators/suppliers.js:6` | FR-PUR-01 | Empty string fails `.email()` | No empty→null normalisation | Contradicts "optional" UI | Omit/convert empty optional fields | Create supplier without email | S |
| UI-007 | P2 | Missing route guards and visible unauthorized actions | `App.jsx:65-80`; `Inventory.jsx:168`; `Products.jsx:73`; `PurchaseOrders.jsx:106`; `PurchaseOrderDetail.jsx:128-130` | FR-AUTH-02, `07` §2 | Only `/settings`,`/users` guarded; action buttons always rendered | Guards applied inconsistently | Dead ends; management UI exposed | Add `allowedRoles` per route and gate buttons via `hasRole` | Role-based render tests | M |
| UI-008 | P2 | Error states never rendered | `Dashboard.jsx:19`; `Products.jsx:9`; `Inventory.jsx:8`; `Sales.jsx:9`; `Suppliers.jsx:8`; `PurchaseOrders.jsx:9`; console-only in `Reports.jsx` etc. | NFR-UX-01, `07` §6 | Failures look like empty data | Missing JSX | Decisions on missing data | Inline error + retry panel | Failure-path test | S |
| UI-009 | P2 | No report export | `pages/Reports.jsx` (no export control) | `07` §4, `02` §5 (CSV) | On-screen only | Not implemented | Documented capability absent | Add CSV export using current filters | Export download test | S |
| UI-010 | P2 | Forecast chart omits historical series | `Optimization.jsx:409-465` | `07` §4 (actual vs predicted) | Only predictions plotted | Backend `historical` unused | Users cannot judge forecast | Merge actual + predicted with legend | Chart data test | S |
| UI-011 | P2 | Dead product edit link; no batches route; movements placeholder | `ProductDetail.jsx:60,148-157,195-197`; `App.jsx` | `07` §2 (`/batches`), FR-PROD-01 | `/products/:id/edit` → 404; batches absent; movements "to be implemented" | Incomplete features | Core inventory functionality missing | Add edit modal/route, batches page, movement view | Navigation test | M |
| UI-012 | P2 | Receiving form shown for invalid statuses | `PurchaseOrderDetail.jsx:227-231` vs `purchaseOrders.js:193` | `07` §4 | Form opens for DRAFT/RECEIVED/CANCELLED → 409 | UI ignores `canReceive` | Wasted entry and dead end | Gate on `canReceive` | Status matrix test | S |
| UI-013 | P2 | Adjustment allows wrong sign | `Inventory.jsx:203-213` | FR-INV-03 | User enters signed delta for DAMAGE etc. | No type-driven sign | Incorrect movements | Derive sign from type; show direction | Form test | S |
| UI-014 | P2 | Filter auto-fetch, double-fetch, races | `Products.jsx:16-19,81-110`; `Inventory.jsx:16-19`; `Sales.jsx:13-15`; `Optimization.jsx:24-31`; `Reports.jsx:86-102` | NFR-UX-01 | Request per keystroke; button refetches; stale responses overwrite | Effect on filter object + no cancellation | Load, flicker, stale pages | Draft vs applied filters; debounce; AbortController | Network-call count test | M |
| UI-015 | P3 | PO totals/user IDs/status history gaps | `PurchaseOrders.jsx:25,175-177`; `PurchaseOrderDetail.jsx:151,158` | `07` §4 | Totals ignore tax/discount; raw UUIDs; no timeline | UI-side computation | Financial display inaccuracy | Use server totals; resolve names; show history | Render test | M |
| UI-016 | P2 | Dialog/tab/label accessibility incomplete | `Products.jsx:190-192`; `Inventory.jsx:192-196`; `SaleDetail.jsx:208-212`; `Optimization.jsx:146-159,291-293`; `ProductDetail.jsx:113-126`; `Reports.jsx:116-129` | NFR-UX-01, `07` §5 | No `role="dialog"`, focus trap, `aria-selected`, `htmlFor` | Ad-hoc modals/tabs | Screen-reader/keyboard users blocked | Shared Modal/Tabs primitives | axe/manual keyboard check | M |
| UI-017 | P3 | Landing overclaims and invalid class | `Landing.jsx:349` (`badge-purple`), `:500-503` (batch tracking) | `07` §1, `06` §11 | Undefined class; advertises unbuilt features | Placeholder | Trust gap/visual defect | Fix class; scope claims | Visual check | S |
| UI-018 | P3 | Missing favicon; 29 lint warnings | `index.html:5`; lint output | N/A | `/vite.svg` 404; unused vars/effect deps | Housekeeping | Noise hides regressions | Add asset; clean warnings | `npm run lint` | S |
| ML-005 | P2 | Multi-step rollout freezes lag-7/14/28 and rolling stats | `main.py:219-226`; `features.py:86-107`; Node sends all features (`optimization.js:277-284`) | FR-ML-02 | Only `lag_1` updates; caller keys take precedence | Rollout mutates one field | Days 2-7 internally inconsistent | Recompute all features from augmented history or ignore caller lags during rollout | Horizon consistency test | M |
| ML-006 | P2 | No batch/payload bound on inference | `main.py:66,193-267` | `05` §7, `06` §7 | Arbitrary-length `products` list processed | Missing validation | DoS/resource exhaustion | `max_length`, request-size limit, 413/422 | Oversized request test | S |
| ML-007 | P2 | Schema version not enforced | `main.py:68,274` | `05` §7, `06` §7 | Client can send `9.9` and get success echoing 9.9 | Echo instead of compare | Incompatible features accepted | Compare with model metadata; reject mismatch | Version-mismatch test | S |
| ML-008 | P2 | No per-product type/NaN validation | `main.py:66,197-230`; `features.py:82-145` | `06` §7 | Missing/wrong types silently default or fall back | `Dict[str,Any]` | Errors masked as model failures | Strict Pydantic product model; `np.isfinite` checks | Invalid-vector test | M |
| ML-009 | P2 | Global status always `"success"` | `main.py:269-276` | `05` §8, `06` §8 | All-fallback still success | Hard-coded | Monitoring cannot detect degradation | Compute aggregate status; 503 when nothing served | All-fallback test | S |
| ML-010 | P2 | Rolling std `ddof` differs train vs serve | `features.py:48-50` (`ddof=1`) vs `features.py:110` and `optimization.js:261,265` (`ddof=0`) | `06` §7 | Same feature, different estimator | Duplicate implementations | Systematic feature shift | Standardise `ddof`; parity test | Parity test | S |
| ML-011 | P2 | Random early-stopping split | `train.py:124-135` (`validation_fraction=0.1`, shuffle default) | NFR-ML-01, `06` §6 | Random rows used for stopping | Default parameter | Mild selection leakage | `early_stopping=False` or chronological split | Inspect fit config | S |
| ML-012 | P2 | Artifact untrusted, metadata inconsistent | `main.py:101-122`; `metadata.json` no checksum/deps; `main.py:189` reports `ACTIVE` even if load failed | `06` §7, `11` §8 | Direct `joblib.load`; status from metadata only | No integrity check | Tampering/incompatible-artifact risk; stale model reported active | Record SHA-256 + library versions; verify; derive status from loaded object | Corrupt-artifact test | M |
| ML-013 | P2 | Node does not validate ML response | `optimization.js:309-350` | `05` §7 | Any `ok` JSON with non-empty predictions persisted | Missing contract validation | Corrupt/partial forecasts stored | Validate 7 dates, finite/non-negative values, schema | Malformed-response test | S |
| ML-014 | P2 | API-key variable names differ; default key | `main.py:41` (`ML_API_KEY`), `optimization.js:291` (`ML_SERVICE_API_KEY`); `docker-compose.yml:37,72` | NFR-SEC-03, `08` §6 | Two names, shared default | Drift | Auth failure or public dev key in prod | One variable; fail startup if unset outside dev | Config test | S |
| ML-015 | P2 | No promotion gate; always `ACTIVE` | `train.py:155-194`; `metadata.json:67` | `06` §6, `11` §8 | Worse-than-baseline model promoted | Missing gate | Unvalidated model serves | Emit `CANDIDATE`; gate on metrics; explicit promotion | Training-output test | M |
| ML-016 | P2 | Horizon allows 30 days | `main.py:67`; `06` line 4, FR-ML-02 | FR-ML-02 | 1..30 accepted; only 7 evaluated | Loose bound | Unvalidated extrapolation | `le=7` | Boundary test | S |
| ML-017 | P2 | Synthetic provenance presented as benchmark accuracy | `metadata.json:4`; `m5_data.py:157-176,222-250`; `06` §5 line 55 | `06` §5, `13` §3 | `M5_BENCHMARK_SAMPLE` with MAE/WAPE; inventory features randomised | Fixture fallback not labelled as synthetic | Accuracy mistaken for real performance | Label `SYNTHETIC_FIXTURE`; suppress metrics; load real prices/calendar | Metadata test | M |
| ML-018 | P3 | "Moving average" baseline is the full-period mean | `train.py:62-68`; `metadata.json` key `baseline_moving_average` | `06` §2/§6 | Not a recent-window average; differs from serving fallback (`main.py:150-153`) | Misnamed implementation | Baseline comparison unclear | Trailing 7-day mean in both | Baseline unit test | S |
| ML-019 | P3 | Lags are positional, not calendar days | `features.py:41-50` | `06` §5 (explicit zero-sale rows) | Date gaps compress windows | No daily reindex | Feature drift for sparse products | Reindex to daily calendar with zeros | Sparse-data test | M |
| SEC-001 | P1 | Working demo credentials shipped in the login UI | `Login.jsx:121-125`; `seed.js:30-78` | `08` §2/§7, `11` §2 | Four account emails + shared password displayed in the built bundle | Demo convenience | Immediate credential disclosure if deployed | Remove or env-gate; rotate seeded passwords per environment | Build grep + manual check | S |
| SEC-002 | P2 | JWT secrets not validated; ML default key | `auth.js:14,19`; `optimization.js:291`; `main.py:41` | NFR-SEC-02 | Missing secret fails at request time; default ML key | No startup validation | Accidental insecure deploy | Fail fast on missing/short secrets; require ML key | Boot test with missing env | S |
| SEC-003 | P2 | Public health endpoint exposes DB version/port | `routes/health.js:40-48` (verified by route inspection) | `08` §4, `11` §6 | Unauthenticated `/health/db` returns version/port | Debug endpoint | Information disclosure | Return only `connected: true` publicly; details internal | Curl check | S |
| SEC-004 | P3 | Unused dependencies / dual drivers | `package.json` (`better-sqlite3`, `express-validator` unused); `src/db.js` second pool | NFR-MAINT-01 | Bloat and confusion | Leftovers | Maintenance risk | Remove unused; document mysql2 role or drop it | Dependency audit | S |
| TEST-001 | P2 | No tests for the P0/P1 paths | `tests/*`; gaps listed in §14 | `09` §3 | No duplicate-line/concurrent return/receipt/adjustment, revocation, store-scope, mass-assignment, date-boundary tests | Happy-path focus | Regressions undetected | Add focused integration tests per finding | CI green with new tests | M |
| TEST-002 | P2 | Tests share a mutable DB and are order-dependent | `tests/helpers.js`; observed leftover users/sales; no vitest config for isolation | `09` §1 | Real DB, no per-test rollback/reset | Convenience | Flaky, accumulating fixtures | Dedicated test DB + truncate/rollback; deterministic seed | Repeated runs green | M |
| TEST-003 | P3 | Frontend redirect test is self-fulfilling | `tests/frontendRouting.test.jsx:105-120` | `09` §2 | Tests a locally redefined `sanitizeRedirect` | Copy of logic | Can pass while app is broken | Import the production helper | Test fails on introduced bug | S |
| TEST-004 | P3 | Environment-specific DB assertions | `tests/dbPool.test.js:17,18,39,40` | `09` §1 | Hard-codes MySQL 8.4 and port 3306 | Brittle assertion | False failures elsewhere | Assert connectivity, not exact version/port | Run on alternate version | S |
| OPS-001 | P2 | Docker orchestration unverified | `docker-compose.yml`; `docker` unavailable | `11` §2, `10` §9 | Cannot validate config/startup | Environment | Deployment path unproven | Validate in CI with Docker; document service health/order | `docker compose up` smoke test | M |
| OPS-002 | P2 | No backup/restore or monitoring evidence | no scripts/docs; `11` §5, §7 | NFR-REC-01, `09` §5 | No RPO/RTO, restore test, metrics | Out of scope so far | Data loss risk; release criterion unmet | Add backup/restore runbook + test; add health/metrics | Restore drill | M |
| OPS-003 | P2 | No OpenAPI contract | `05` §10 | NFR-MAINT-01 | No machine-readable API doc | Not implemented | Contract drift (already visible) | Generate/author OpenAPI; contract tests | Spec validates; CI check | M |
| MAINT-001 | P3 | Duplicated formatters/status maps/role arrays; oversized pages | `SupplierDetail.jsx:171`; `Optimization.jsx:359,397`; `PurchaseOrders.jsx:94-97` vs `PurchaseOrderDetail.jsx:110-113`; `Layout.jsx:9-16`; `Landing.jsx` 746 lines; `Reports.jsx` 569; `Optimization.jsx` 516 | NFR-MAINT-01 | Formatters/permissions redefined | Incremental growth | Drift risk (already visible) | Consolidate `utils/format.js`, permission helper, status badges; split pages | Refactor with tests | M |

---

## 7. Frontend routing, landing page, and usability

- **Landing page:** `/` renders `Landing` outside the protected shell (`App.jsx:51`); `/login` is independent (`:54`); `/register` redirects to login (`:55`). This meets the "public landing first" expectation. No redirect loop was found.
- **Protected routes:** all business routes are nested under `ProtectedRoute` + `Layout` (`App.jsx:58-97`). Only `/settings` and `/users` pass `allowedRoles`; the rest are reachable by URL for any signed-in role (`UI-007`, `API-001`).
- **Return path:** login sanitises the `from` value against protocol-relative URLs, but drops `search`/`hash` and silently discards the path when the role is insufficient (`P3`, part of `UI-007`).
- **404:** catch-all sits **outside** the shell (`App.jsx:100`), so authenticated users lose navigation on unknown URLs.
- **Missing documented routes:** `/batches` (`07` §2) does not exist; `/products/:id/edit` is linked but undefined (`UI-011`).
- **Charts:** Recharts is used. Dashboard charts depend on `summary.topProducts`, which the reports endpoint does not return (`UI-003`). Optimization plots predictions only (`UI-010`).
- **States:** loading is generally present; error state is frequently defined but never rendered; empty states lack next actions (`UI-008`). Filters auto-fetch on every change and can race (`UI-014`).
- **Accessibility:** forms mostly lack `htmlFor`/`id` pairs; modals lack dialog semantics/focus management; tabs lack ARIA (`UI-016`). Status is sometimes conveyed by colour alone.
- **Responsiveness:** sidebar/layout classes are responsive; wide tables are not adapted for small screens.
- **Text quality:** the landing page advertises batch tracking and other unbuilt capability (`UI-017`); dashboard hard-codes improvement deltas (`UI-003`).

**Verified build result:** `vite build` succeeded — 930 modules, `dist/assets/index-*.js` 801.33 kB (214.44 kB gzip), with a chunk-size warning. `eslint` reported **0 errors, 29 warnings** (unused vars and `react-hooks/exhaustive-deps`).

---

## 8. Authentication and account lifecycle

**Working:** bcrypt cost 12 (`users.js:40`); no plaintext storage; login uses a uniform invalid-credentials message; inactive users rejected on every request (`middleware/auth.js:21`), at login and refresh; admin-only user creation/listing; role values validated against an enum; login rate-limited to 10/15 min; access 15 min / refresh 7 days with distinct secrets.

**Gaps:** no revocation/rotation (`AUTH-002`); hybrid cookie + bearer with the access token returned in JSON and held in memory (`api.js`, `AuthContext.jsx:28-30`), contrary to `05` §4; `/auth/me` blocks session restore (`AUTH-001`); logout is unauthenticated; demo credentials shipped (`SEC-001`); no password change/reset; last-admin can be deactivated/demoted (P3, `users.js:73-90`); email normalisation is lowercase without trim.

**Trace of the login path:** `Login.jsx` → `AuthContext.login` → `POST /auth/login` → `validators/auth.js` → `auth.js:48-92` → Prisma `user.findUnique` → `bcrypt.compare` → `signAccess/signRefresh` → cookies (`httpOnly`, `SameSite=Lax`, `secure` in production) + JSON tokens → `AuthContext` stores user and in-memory bearer. Refresh: interceptor → `POST /auth/refresh` → verify refresh JWT → re-check user active → reissue. This path is coherent but vulnerable to the revocation and bootstrap issues above.

---

## 9. Backend/API correctness and integration

**Strengths:** consistent route-per-domain structure; Zod validation on most endpoints; central error handler mapping Zod/Prisma (`P2002 → 409`, `P2025 → 404`); `express-async-errors`; helmet; CORS restricted to a configured origin with credentials; global and login rate limits; checkout recalculates all totals server-side and snapshots unit cost.

**Confirmed defects:** `API-001` (RBAC), `API-002` (store scope), `API-003` (validate discards parsed data — enables mass assignment and breaks boolean coercion), `API-004` (idempotency), `API-006` (dates), `API-007` (length/500), `API-008` (error leak), `API-009` (404/logging), `OPT-001/002/003`, `NOTIF-001/002`.

**Endpoint inventory vs `05`:** all documented endpoints exist, plus `/auth/refresh`, `/health/ready`, `/health/db`, supplier-product linking, `/notifications/read-all`, `/settings/*`, and `/optimization/model-info`. Missing relative to specs: sale cancellation, CSV export, OpenAPI document, password change.

**Reliability:** checkout is the only multi-write path with a strong conditional-update guard. Adjustments, receiving, and returns rely on pre-transaction checks. Audit/notification writes are outside business transactions and best-effort (`sales.js:159-235`).

---

## 10. Database integrity, schema/migration, and data lifecycle

**Strengths:** 29 models with enums; `DECIMAL(12,4)` money and `DECIMAL(5,4)` tax; unique `(storeId, productId)` inventory; unique SKU/barcode/email/receipt/idempotency/deduplication keys; a `version` column on Inventory; sensible indexes; one coherent init migration that matches `schema.prisma` for core tables.

**Issues:** no FKs for `StockMovement.storeId/actorId`, `Sale.createdBy`, `SaleReturn.processedBy`, `AuditLog.actorId` (`DB-003`); cascades can erase ledger history; no CHECK constraints; `Store` lacks settings columns (`DB-001`); product identity not snapshotted on lines (`DB-004`); migration cannot run from `.env` (`DB-002`); one migration only, so any fix needs a new migration (must not edit the applied init).

**Reconciliation:** `tests/reports.test.js` and `tests/inventory.test.js` exercise balances and reports, but there is no test asserting `Σ movement.quantityDelta == balance` after concurrent mutations, which is where `INV-001` bites.

---

## 11. Sales, returns, inventory, purchasing, and reporting workflows

| Workflow | Verdict | Evidence |
|---|---|---|
| Checkout | **Working** | Conditional stock decrement inside transaction (`sales.js:114-128`); totals server-side; movement + item + sale atomic; concurrency test passes. Gaps: idempotency binding (`API-004`), POS key regeneration (`UI-002`), duplicate lines (`API-005`), fixed tax. |
| Returns | **Broken / unsafe** | UI sends invalid fields (`UI-001`); over-return possible (`SALE-001`); no idempotency; partial refunds not represented; cancelled sales not blocked; restock hard-codes `default-store`; batches untouched. |
| Receiving | **Working happy path, unsafe edges** | State machine correct; partial/full receipts, movements, and batch creation exist; over-receipt via duplicate/concurrency (`PUR-001`); client `unitCost` trusted (`API-002`/`SEC`); repeat batch number fails unique; expired dates accepted. |
| Adjustments | **Unsafe under concurrency** | `INV-001`; sign/type not enforced (`INV-002`); movement lacks `inventoryId`. |
| Batches/expiry | **Partial** | Created only when both number and expiry supplied; never decremented on sale/return; no `/batches` UI; expiry report exists. |
| Reports | **Functional but inaccurate** | Sales report sums completed sales; valuation/turnover simplified or wrong (`OPT-003`); end-date boundary (`API-006`); movements unpaginated. |
| Notifications | **Partial** | Low/out-of-stock on checkout with dedup key; expiry/PO/forecast alerts absent; global scoping (`NOTIF-001`); upsert race (`NOTIF-002`). |

**PRD success measures assessment:** inventory consistency — **at risk**; no negative/partial deduction on sale — **met**; receipt updates once on retry — **met by `receiptReference` unique, but over-receipt is possible**; forecast measured against baseline — **not met**; MAE/WAPE reporting — **met mechanically, invalid split**; recommendation transparency — **partial**; restricted actions rejected — **not met for reads**; core journeys E2E — **not demonstrated (no E2E)**.

---

## 12. ML dataset, features, model quality, evaluation, and integration

**Pipeline as built:** `m5_data.py` loads M5 if present, otherwise generates a deterministic synthetic fixture (`M5_BENCHMARK_SAMPLE`); `features.py` builds 19 features and a next-day target; `train.py` fits `HistGradientBoostingRegressor`; artifacts and metadata are written to `models/` (git-ignored); `main.py` serves 7-step autoregressive forecasts behind `X-API-Key`; Node calls it with a 5 s timeout and a moving-average fallback.

**Critical issues (see §6 for detail):**
1. Split is product-major, not chronological (`ML-001`).
2. Baselines degenerate to the global mean and are identical (`ML-002`).
3. Serving features are unordered sale-line quantities, not daily demand (`ML-003`).
4. Insufficient history yields fabricated 0/1 forecasts labelled `success` (`ML-004`).
5. Multi-step rollout freezes lag-7/14/28 and rolling stats (`ML-005`).
6. Synthetic data and randomised inventory features are presented with accuracy metrics (`ML-017`).
7. No batch/size bound, no schema-version enforcement, no finite checks, always-`success` global status (`ML-006`–`ML-009`).
8. `ddof` mismatch and random early-stopping split (`ML-010`, `ML-011`).
9. Artifact untrusted, no checksum/dependency versions; `model-info` can report `ACTIVE` with no model (`ML-012`).
10. Node persists ML responses without contract validation (`ML-013`).

**What is genuinely good:** the service is real and authenticated; features are shared between training and inference via `features.py`; the Node caller has a timeout and a labelled method field; recommendations record inputs, explanation, and model version; approval creates only a DRAFT PO (FR-ML-08 respected). The direction is right; the evaluation and feature plumbing are not trustworthy yet.

**Metadata truthfulness:** `metadata.json` claims `"data_provenance": "M5_BENCHMARK_SAMPLE"` and reports MAE 1.5196 / WAPE 0.1324 / 65.65% improvement, with both baselines identical. Per `06` §5, synthetic-only performance is not evidence of real-world accuracy. This must not be presented as measured forecasting quality.

---

## 13. Security, privacy, and dependency hygiene

| Control | State | Notes |
|---|---|---|
| Password storage | Good | bcrypt 12; no plaintext. |
| Secrets in VCS | Good | `.env` ignored; only `.env.example` tracked. |
| JWT secrets | Weak | No startup validation; fallback ML key `dev-ml-api-key` in code (`SEC-002`). |
| Session strategy | Weak | Hybrid cookie+bearer, no revocation (`AUTH-002`). |
| Demo credentials | **Exposed** | Login UI displays valid accounts + shared password (`SEC-001`). |
| RBAC | Incomplete | P1 `API-001`. |
| Store scoping | Missing | `API-002`. |
| Input validation | Partial | `validate()` discards parsed data (`API-003`); ID/date gaps. |
| Rate limiting | Partial | Global + login only; no refresh/report/forecast limits; no trusted-proxy config. |
| Error safety | Mixed | Generic 500 text; but `model-info` leaks `err.message` (`API-008`) and `/health/db` exposes DB version/port (`SEC-003`). |
| ML exposure | Partial | API key required, but shared default and no network restriction. |
| Model deserialisation | Weak | Direct `joblib.load` of a writable path; no checksum (`ML-012`). |
| Privacy | Good | No customer PII collected; audit details minimised. |
| Dependencies | Fair | Exact pins in `requirements.txt`; `pyproject.toml` uses `>=`; `better-sqlite3`/`express-validator` unused; no vulnerability scan run. |

---

## 14. Test coverage quality and actual command results

### 14.1 Commands actually executed (2026-10-25)

| Command | Result | Meaning |
|---|---|---|
| `npm run lint` (frontend) | **PASS** — 0 errors, **29 warnings** | Build-blocking lint clean; warning noise remains. |
| `npm run lint` (backend) | **PASS** — no output | Clean. |
| `npm run build` (frontend) | **PASS** — 930 modules, 801.33 kB JS / 214.44 kB gzip, 23.99 s; chunk-size warning | Production bundle builds. |
| `npx prisma validate` (backend) | **FAIL** — `P1012 Environment variable not found: DATABASE_URL` (`schema.prisma:7`) | `DB-002`. |
| `npm run test` (backend) | **PASS** — **9 files, 45 tests**, 26.24 s | Real Express + Prisma against local MySQL; ML service was down, so only the fallback path ran. Observed notification upsert unique-constraint errors during concurrent checkout (`NOTIF-002`). |
| `python -m pytest -q` (ML) | **PASS** — **12 passed**, 19.58 s, 3 warnings | Includes the checked-in artifact; passes even if the model fails to load because fallback is `success` (`ML-004`). |
| `docker compose config` | **BLOCKED** — `docker` not recognized | `OPS-001`; Docker path unverified. |
| `git status` | Clean | No uncommitted changes before the audit. |
| `git ls-files` / `check-ignore` | 112 tracked; `.env`, `models/`, `data/`, `dist/` ignored | See §2.2. |

### 14.2 Test quality assessment

- **Strengths:** real integration tests (no DB mocks); concurrency test for checkout; duplicate checkout replay; over-return rejection in the simple case; partial/full receipt; adjustment and report smoke tests; frontend render tests for landing/login/404.
- **Weaknesses:** `TEST-001` (no tests for the P0 paths), `TEST-002` (shared mutable DB, order dependence, leftover fixtures), `TEST-003` (self-fulfilling redirect test), `TEST-004` (environment-specific assertions). The ML "no leakage" test checks shapes, not temporal correctness, so it cannot catch `ML-001`.
- **Claim reconciliation:** prior reports' 31/41/44 test counts are outdated or inconsistent; actual is **45**. ML actual is **12**, not 7.

---

## 15. Duplication, dead code, and maintainability review

| Pattern | Type | Evidence | Recommendation |
|---|---|---|---|
| Currency/number formatters | Exact duplication | `SupplierDetail.jsx:171`; `Optimization.jsx:359,397` vs `utils/format.js` | Use the shared util. |
| Status badge maps | Near duplication | `PurchaseOrders.jsx:94-97` vs `PurchaseOrderDetail.jsx:110-113` | Shared `StatusBadge`. |
| Role arrays | Near duplication | `Layout.jsx:9-16`; `App.jsx:69-72`; `Users.jsx:42` | Single permission map. |
| Fetch/pagination boilerplate | Near duplication | 8+ pages | `usePagedResource` hook. |
| Feature engineering | Intentional split, inconsistent | `features.py` vs `optimization.js` | Share semantics + parity test. |
| Oversized components | Design debt | `Landing.jsx` 746, `Reports.jsx` 569, `Optimization.jsx` 516 lines | Split into sections/hooks. |
| Dead/placeholder | Dead code | `/products/:id/edit`; movements placeholder; settings delete controls; `/batches` absent | Implement or remove. |
| Unused dependencies | Dead code | `better-sqlite3`, `express-validator` | Remove. |
| Dual DB access | Intentional but undocumented | `src/db.js` pool | Document or consolidate on Prisma. |

Maintainability is acceptable for a 1–2 person team **if** the P0/P1 defects are fixed and one shared layer is introduced for quantity mutations and permissions. Without that, the duplication is where future integrity bugs will appear.

---

## 16. Deployment, operations, observability, and reproducibility

- **Local run:** frontend 5173, backend 3001, ML 8000, MySQL 3306 (confirmed from config/tests; `03`/`11` do not state numeric ports).
- **Docker:** `docker-compose.yml` defines mysql/backend/ml-service/frontend with health checks and volumes, but Docker is unavailable here and the config was not validated (`OPS-001`). `Dockerfile.dev` for ML uses a dev server with `--reload` and runs as root.
- **Migrations:** cannot run from `.env` (`DB-002`); no clean-install verification.
- **Model artifact:** git-ignored; a fresh clone has no model and no documented training step (`OPS-004`).
- **Backups/recovery:** no scripts, RPO/RTO, or restore evidence (`OPS-002`), which `09` §5 and `11` §7 require before release.
- **Observability:** morgan + `console.error`; no request IDs, structured fields, metrics, or ML latency tracking (`NFR-OBS-01`, `API-009`, `ML-006`).
- **Docs:** setup instructions are spread across docs and prior audits; `README.md` explicitly says the pack is a design baseline, not proof of implementation. There is no single verified runbook.

---

## 17. Strengths and functioning areas (evidence-based)

1. **Genuine end-to-end architecture.** All four services exist and integrate; Node→ML is a real authenticated HTTP call with timeout and fallback (`optimization.js:289-314`).
2. **Checkout integrity.** Conditional atomic stock decrement inside a transaction, server-authoritative prices/costs, and a passing concurrency test (`sales.js:83-145`; `sales.test.js:141-170`).
3. **Purchase-order state machine.** Explicit statuses and transitions; partial/full receiving; receipt history; unique receipt reference (`purchaseOrders.js:17-23,213-267`).
4. **Schema quality.** 29 models, decimal money, strong uniques, inventory version column, relevant indexes, a coherent init migration.
5. **Security fundamentals.** bcrypt, inactive-user enforcement, generic 500 text, helmet, restricted CORS, ignored `.env`, login rate limit.
6. **Shared ML feature module.** `features.py` is used by both training and inference, which is the right structure (even though serving bypasses it).
7. **Test existence and realism.** Integration tests hit real routes and a real DB, including concurrency and idempotency cases.
8. **Documentation depth.** The spec pack is unusually complete and internally useful; the audit trail is traceable.
9. **Frontend breadth.** 19 page components, a public landing page, role-filtered navigation, a POS with idempotency intent, and Recharts dashboards.
10. **Honest caveats exist in docs.** `06` §5, `12` R-01/R-11, and `13` §3 already warn against synthetic-only accuracy claims — the code should follow its own documentation.

---

## 18. Prioritized improvement roadmap

### Phase 0 — Immediate containment (before any deployment/demo)
1. **Rotate/remove demo credentials** from `Login.jsx`; change seeded passwords; gate demo hints behind a dev flag (`SEC-001`).
2. **Stop presenting ML metrics as real accuracy.** Relabel `metadata.json` provenance as synthetic fixture and mute the improvement claim in any UI/report (`ML-017`).
3. **Freeze stock-mutating paths** for multi-user use until `INV-001`, `PUR-001`, `SALE-001` are fixed, or restrict adjustments/receiving/returns to a single operator in the demo.
4. **Fix `.env` migration path** so a clean environment can reproduce the DB (`DB-002`).

### Phase 1 — P0 (data integrity)
5. `INV-001` atomic adjustment (conditional update or `FOR UPDATE`).
6. `PUR-001` aggregate + transactional receipt validation.
7. `SALE-001` aggregate + transactional return validation; add return idempotency.
8. Add the missing concurrency/duplicate-line regression tests (`TEST-001`).

### Phase 2 — P1 (core workflows, security, correctness)
9. `UI-001` return payload fix (+ `API-003` parsed-data application).
10. `AUTH-001` session restore; `AUTH-002` refresh rotation/revocation.
11. `API-001` and `UI-007` role guards on all documented endpoints/routes.
12. `UI-002` + `API-004` POS/idempotency correctness.
13. `ML-001`/`ML-002` chronological split and real baselines; retrain and update metadata.
14. `ML-003` daily serving series + feature parity test.
15. `ML-004` insufficient-data and fallback labelling.
16. `DB-001` store settings schema/route alignment.

### Phase 3 — P2 (incomplete functionality and accuracy)
17. `OPT-001`/`OPT-002` recommendation filtering and atomic approval.
18. `OPT-003` valuation/turnover correctness; pagination for movements.
19. `UI-003` dashboard KPIs; `UI-004` product detail; `UI-005` boolean filters; `UI-008` error states.
20. `NOTIF-001`/`NOTIF-002` scoping and upsert race.
21. `API-006`/`API-007` date and length handling; `DB-003` FKs/checks.
22. ML hardening: batch bounds, schema version, finite checks, `ddof` parity, artifact checksum, promotion gate (`ML-005`–`ML-016`).
23. `UI-009`/`UI-010`/`UI-011`/`UI-012` remaining documented UI gaps (export, forecast chart, edit/batches/movements, receiving states).
24. `OPS-001`/`OPS-002`/`OPS-003` Docker validation, backup/restore drill, OpenAPI.

### Phase 4 — P3 and maintainability
25. Shared formatters/status/permission primitives; split oversized pages; remove dead code and unused dependencies (`MAINT-001`, `SEC-004`).
26. Accessibility primitives (`UI-016`), lint cleanup (`UI-018`), test isolation (`TEST-002`–`TEST-004`).

**Sequencing rationale:** integrity first (P0), then the workflows that users will actually exercise in a demo (returns, session, RBAC, POS), then ML honesty, then financial/report accuracy, then polish. Do not add features from the "potential extensions" list until Phase 1–2 is complete.

---

## 19. Grounded project improvements (value, complexity, dependencies, doc status)

| # | Improvement | Motivated by | User/business problem | Benefit | Complexity | Dependencies | Doc status | Success measure |
|---|---|---|---|---|---|---|---|---|
| I-1 | Atomic quantity-mutation helper used by sale/receipt/return/adjustment | `INV-001`, `PUR-001`, `SALE-001` | Stock drift makes every report untrustworthy | One tested primitive instead of four ad-hoc paths | M | Prisma transaction patterns | Required by `04` §4, `08` §5 | Ledger invariant test passes under concurrency |
| I-2 | Daily-demand feature builder shared by Node and Python (or Node sends raw daily series) | `ML-003`, `ML-010` | Forecasts are computed on the wrong distribution | Model skill in production becomes measurable | M | ML retrain | Required by `06` §4-§5 | Parity test + stable offline/online metrics |
| I-3 | Honest evaluation harness: date-based splits, multiple baselines, per-product metrics | `ML-001`, `ML-002`, `ML-017` | Stakeholders cannot tell whether the model helps | Credible, reproducible evidence | M | Retrain | Required by FR-ML-04/NFR-ML-01 | Reproducible metadata with distinct baselines |
| I-4 | Permission map shared by backend guards and frontend nav/actions | `API-001`, `UI-007` | Unauthorized users see/read management data | Fewer 403 dead ends; real least privilege | M | None | Required by `08` §3 | Role matrix tests |
| I-5 | Server-side pagination/aggregation for inventory and reports | `API-006`, `OPT-003`, `INV-006` | Large datasets become unusable; cards mislead | Predictable performance and correct summaries | M | Indexes | Required by `05` §9 | Query plans + p95 |
| I-6 | Store-scope model (membership or explicit single-store enforcement) | `API-002` | Cross-store leakage / inconsistent behavior | Safe path to multi-store later | M–L | Schema migration | `04` §1, `08` §3; open decision #2 | Negative cross-store tests |
| I-7 | Shared UI primitives (Modal, Tabs, Table, ErrorState) | `UI-008`, `UI-016`, `MAINT-001` | Inconsistent states and accessibility | Faster, accessible, consistent UI | M | None | Required by `07` §3/§5 | axe/keyboard checks; fewer duplicated lines |
| I-8 | Report export (CSV) + metric definitions displayed | `UI-009`, `07` §4 | Operators cannot take data out or interpret it | Usable reporting | S | None | Required by `02` §5 | Download matches filtered data |
| I-9 | Deployment runbook + backup/restore drill + health metrics | `OPS-002`, `11` §5-§7 | No recovery story | Release acceptance can be met | M | Hosting decision | Required by `09` §5 | Successful restore into a clean env |
| I-10 | Batch-aware inventory (decrement on sale, increment/upsert on receipt/return, FEFO) | Batch gaps in §11, `12` R-10 | Expiry reports and stock do not reconcile | Real expiry/waste control | L | Schema/UX | Required only if batch scope is chosen (open decision #7) | Batch total equals inventory total |

**Explicitly not recommended now:** multi-store transfers, deep-learning models, budget optimisation, automated PO submission, chatbots, or any feature not in the initial release. The documented core is not yet trustworthy; adding scope would increase unfinished surface area.

---

## 20. Open decisions requiring human/product-owner input

1. **Auth strategy** — cookie-first (recommended for `08` §2) vs bearer; and whether refresh tokens are persisted for revocation.
2. **Store scope** — enforce single-store at the API, or introduce user–store membership now?
3. **Tax** — confirm jurisdiction/rounding; decide whether tax lives in `Store` settings (recommended) or stays a global env value.
4. **Returns policy** — who may approve returns; restock vs write-off defaults; whether partially refunded sales need a new status.
5. **Valuation method** — current cost vs moving weighted average; the report must state and honour it.
6. **Batch scope** — all products vs expiry-controlled only; this determines whether I-10 is in scope.
7. **Forecast cadence & minimum history** — manual vs scheduled; minimum days (e.g. 28) before a product-specific forecast.
8. **Deployment target** — hosting and whether Docker is the supported path (Docker is currently unverified).
9. **Demo credentials** — remove entirely, or keep dev-only and rotate for any shared environment.
10. **Release bar** — confirm that README's "design baseline" stance is replaced by a verified runbook and acceptance evidence.

Until these are closed, several "implemented" behaviors are de-facto choices rather than requirements; the audit treats them as risks, not as agreed rules.

---

## 21. Final audit summary and recommended next milestone

**Verdict:** ORIMS is a credible, well-structured college-scale system with a real ML service and a strong schema, but it is **not release-ready**. The blocking issues are concentrated and fixable:

- **3 P0 integrity defects** in adjustment, receiving, and returns that can corrupt stock.
- **12 P1 defects** spanning session restoration, token revocation, RBAC reads, returns UI, POS idempotency, settings/schema drift, migration reproducibility, demo credentials, and ML evaluation/serving correctness.
- A large but mostly cosmetic/functional P2 set (dashboard accuracy, reports, notifications, accessibility, ML hardening).

**What is already good should be preserved:** checkout transactionality, the PO state machine, the schema, the shared ML feature module, and the existing integration tests. The right move is to harden those patterns and reuse them, not rewrite the stack.

**Recommended next milestone:** *"Integrity and trustworthiness gate"* —
1. Fix `INV-001`, `PUR-001`, `SALE-001` with a shared atomic-mutation primitive and add concurrency/duplicate-line regression tests.
2. Fix `UI-001`, `DB-001`, `DB-002`, `AUTH-001`, `AUTH-002`, `API-001`, `SEC-001`.
3. Rebuild ML evaluation with date-based splits and real baselines (`ML-001`/`ML-002`), and align serving features (`ML-003`).
4. Re-run the suites and record results in a follow-up report. Treat release readiness as **gated** on the P0/P1 list, not on the count of passing tests.

**Audit artefacts:** this report is the authoritative record. No JSON index was created (per instruction). Existing reports in `docs/audit/` were preserved unchanged.

---

*End of report.*
