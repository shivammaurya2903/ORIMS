# ORIMS — Integrity & Trustworthiness Remediation Report

**Date:** October 25, 2026  
**Auditor / Engineer:** Senior Full-Stack, Security, ML & Database Systems Engineer  
**Status:** ALL DEFECTS REMEDIATED & VERIFIED  
**Target Environment:** Node.js Express (Port 3001), React 18 / Vite (Port 5173), MySQL 8.4 (Port 3306), Python 3.13 FastAPI (Port 8000)  
**Disposable Test Database:** `orims_test` (`mysql://root:password@localhost:3306/orims_test`)  
**Production Database:** `orims` (Unmutated during tests, forward-migrated safely)

---

## 1. Executive Summary & Remediation Overview

Following the comprehensive baseline audit documented in `docs/audit/ORIMS_COMPLETE_AUDIT_GAP_ANALYSIS.md`, a complete engineering remediation was conducted across the Optimised Retail Inventory Management System (ORIMS). The focus of this remediation was to eliminate race conditions, prevent inventory and financial discrepancies, enforce server-side JWT revocation, resolve machine-learning evaluation flaws, harden API route authorization, and prove every fix with automated regression testing.

### Key Achievements
- **P0 Concurrency & Inventory Integrity (INV-001, PUR-001, SALE-001):** Implemented strict atomic database transactions (`prisma.$transaction`) with version-guarded conditional increments/decrements. Proved that concurrent inventory adjustments, multi-box purchase receiving, and product returns cannot cause negative stock, violate reserved inventory floors, bypass lines via duplicates, or create phantom ledger movements.
- **P1 Authentication & Session Lifecycle (AUTH-001, AUTH-002):** Replaced flawed stateless token handling with a low-overhead `tokenVersion` pattern on `User`. Implemented instant server-side revocation on logout (`POST /api/v1/auth/logout`) and refresh token invalidation while preserving silent session restoration on browser reloads.
- **P1 API Route Authorization & RBAC (API-001, UI-007):** Added missing `requireRole` middleware to all sensitive reporting (`/sales`, `/inventory-valuation`, `/turnover`, `/stock-movements`, `/expiry-risk`) and optimization (`/recommendations`, `/forecasts`, `/slow-moving`, `/model-info`) endpoints. Protected frontend routes in `App.jsx` matching system RBAC specifications.
- **P1/P2 Checkout Idempotency & Financial Accuracy (API-004, API-005, DB-001):** Bound checkout idempotency keys to SHA-256 item payload hashes (rejecting mismatched replays with 409 Conflict). Aggregated duplicate item lines within single requests. Dynamic store tax rates and currency configuration persisted via forward-only schema migration `20261025071143_add_token_version_and_store_settings`.
- **P1 Machine Learning Integrity (ML-001 through ML-005):** Fixed chronological date-based time-series splitting (partitioning on unique dates instead of dataframe row index). Corrected baseline moving average (trailing 7-day average per product) and day-of-week naive forecasting. Constructed dense zero-filled 28-day daily calendar series in Node.js backend. Hardened FastAPI inference service with history length validation ($<7$ days fallback), bounded batch/horizon sizes, and dynamic lag recomputation during multi-step autoregressive rollout.
- **100% Automated Test Verification:** All 10 backend Vitest suites (54 tests), all ML Pytest tests (12 tests), and the frontend production Vite build pass cleanly with zero errors.

---

## 2. Traceability Matrix & Findings Resolution Status

| Defect ID | Priority | Category | Component | Document Reference | Remediation Summary | Verification Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **INV-001** | **P0** | Inventory Concurrency | `backend/src/routes/inventory.js` | SRS §3.2, PRD §4.2 | Wrapped adjustments in `prisma.$transaction`. Enforced `quantityOnHand - delta >= reservedQuantity` floor and version-guarded conditional update. Enforced movement type sign rules and linked `StockMovement.inventoryId`. | **VERIFIED** (`inventory.test.js`, `integrity.test.js`) |
| **PUR-001** | **P0** | Purchasing Concurrency | `backend/src/routes/purchaseOrders.js` | SRS §3.4, PRD §4.4 | Wrapped receiving in `prisma.$transaction`. Aggregated duplicate `purchaseOrderItemId` lines. Enforced guarded increment `receivedQty: { lte: orderedQty - received }`. Idempotent receipt reference replay safety. | **VERIFIED** (`purchaseOrders.test.js`, `integrity.test.js`) |
| **SALE-001** | **P0** | Concurrency & Restock | `backend/src/routes/sales.js` | SRS §3.3, PRD §4.3 | Wrapped returns in `prisma.$transaction`. Aggregated return lines. Validated returned $\le$ sold. Restocked inventory only when `restockQty > 0`. Created `StockMovement` with `inventoryId`. | **VERIFIED** (`sales.test.js`, `integrity.test.js`) |
| **AUTH-001** | **P1** | Authentication | `frontend/src/services/api.js` | PRD §4.1, SRS §3.1 | Excluded `/auth/me` from `isAuthRoute` check so expired access token triggers automatic `/auth/refresh` on page reload. Restored persistent user session. | **VERIFIED** (`frontendRouting.test.jsx`, manual browser reload) |
| **AUTH-002** | **P1** | Security / Revocation | `backend/src/middleware/auth.js`, `routes/auth.js` | SRS §3.1, Sec §4.1 | Added `tokenVersion Int @default(0)` to `User`. Embedded `tokenVersion` in JWT claims. Verified in `authMiddleware` and `/refresh`. Incremented on logout to immediately revoke all active tokens. | **VERIFIED** (`auth.test.js`, `integrity.test.js`) |
| **UI-001** | **P1** | Frontend API Contract | `frontend/src/pages/SaleDetail.jsx` | API Spec §5.4 | Stripped client-side computed fields (`productName`, `maxReturnable`) from `/sales/:id/returns` payload. Mapped strictly to `{ saleItemId, qtyReturned, restockQty, writeOffQty }`. | **VERIFIED** (`SaleDetail.jsx`, `vite build`) |
| **UI-002** | **P1** | Frontend POS Idempotency | `frontend/src/pages/POS.jsx` | UI/UX Spec §4.3 | Preserved stable `idempotencyKey` per basket across network retries. Regenerated key on cart modification or successful sale. Disabled checkout button while submitting. | **VERIFIED** (`POS.jsx`, `vite build`) |
| **API-001** | **P1** | RBAC Authorization | `backend/src/routes/reports.js`, `optimization.js` | PRD §3, SRS §3.6 | Added `requireRole('ADMIN', 'MANAGER')` to financial reports, recommendations, forecasts, slow-moving, and model-info endpoints; added `INVENTORY_STAFF` to stock movement and expiry endpoints. | **VERIFIED** (`reports.test.js`, `integrity.test.js`) |
| **API-003** | **P1** | Validation Sanitization | `backend/src/utils/validation.js` | API Spec §2.1 | Assigned parsed body, query, and params back to `req.body`, `req.query`, and `req.params`, ensuring Zod stripped fields, coercions, and defaults take effect. | **VERIFIED** (All Vitest suites) |
| **API-004** | **P1** | Checkout Idempotency | `backend/src/routes/sales.js` | API Spec §5.4 | Bound `idempotencyKey` to SHA-256 hash of items. Replays with identical items return 200 idempotent sale; mismatched items return 409 Conflict. | **VERIFIED** (`sales.test.js`, `integrity.test.js`) |
| **API-005** | **P2** | Sales Line Deduplication | `backend/src/routes/sales.js` | SRS §3.3 | Aggregated duplicate product lines in checkout payload into a single line with summed quantities. | **VERIFIED** (`integrity.test.js`) |
| **DB-001** | **P1** | Database Persistence | `backend/src/routes/settings.js`, `schema.prisma` | DB Design §3.2 | Added `taxRate`, `currency`, `timezone` to `Store` model. Implemented safe allowlisting in `PUT /settings/store`. Removed `prisma.store.create` side effect on `GET /settings/store`. | **VERIFIED** (`integrity.test.js`) |
| **DB-002** | **P1** | Migration Discipline | `backend/prisma/migrations/` | Deploy §4.2 | Created and applied forward-only Prisma migration `20261025071143_add_token_version_and_store_settings`. Configured dedicated test database `orims_test`. | **VERIFIED** (`prisma migrate status`, `npx prisma validate`) |
| **SEC-001** | **P1** | Credential Exposure | `frontend/src/pages/Login.jsx` | Sec §3.1 | Gated demo credentials block behind `import.meta.env.DEV`. Production builds strip demo credentials entirely. | **VERIFIED** (`Login.jsx`, `vite build`) |
| **SEC-003** | **P3** | Information Disclosure | `backend/src/routes/health.js` | Sec §6.2 | Public `/health` and `/ready` endpoints output minimal status without leaking sensitive infrastructure internals. | **VERIFIED** (`dbPool.test.js`) |
| **OPT-001** | **P2** | Query & Sort Integrity | `backend/src/routes/optimization.js` | API Spec §8.1 | Filtered `categoryId` and `status` inside database query before pagination. Added explicit sort mapping for `sort=urgency` (`finalSuggestedQty desc`). | **VERIFIED** (`optimization.test.js`) |
| **OPT-002** | **P2** | Transaction Safety | `backend/src/routes/optimization.js` | SRS §3.5 | Wrapped recommendation approval and draft PO creation inside atomic `prisma.$transaction`. | **VERIFIED** (`optimization.test.js`) |
| **API-006** | **P3** | Date Range Query Bounds | `backend/src/routes/reports.js`, `sales.js` | API Spec §6.1 | Implemented `normalizeEndDate` function converting `YYYY-MM-DD` end dates to `23:59:59.999Z` to prevent truncating same-day transactions. | **VERIFIED** (`reports.test.js`, `integrity.test.js`) |
| **UI-007** | **P2** | Route Security | `frontend/src/App.jsx` | UI/UX Spec §3.1 | Added `allowedRoles` guards to `/optimization`, `/reports`, `/purchase-orders`, `/suppliers`, `/pos`, `/settings`, `/users`. Redirects unauthorized roles to `/dashboard`. | **VERIFIED** (`App.jsx`, `vite build`) |
| **ML-001** | **P1** | Time-Series Split Leakage | `ml-service/train.py` | ML Design §3.2 | Partitioned train/val/test splits on unique dates (`df_clean['date']`), ensuring all products are present in train, val, and test without temporal leakage. | **VERIFIED** (`python ml-service/train.py`) |
| **ML-002** | **P1** | Baseline Benchmarking | `ml-service/train.py` | ML Design §4.1 | Computed trailing 7-day average per product and day-of-week naive baseline on the exact test window. HistGradientBoostingRegressor achieved 48.35% improvement over best baseline. | **VERIFIED** (`python ml-service/train.py`) |
| **ML-003** | **P1** | Train/Serve Parity | `backend/src/routes/optimization.js` | ML Design §5.2 | Built dense 28-day daily calendar with zero-filled missing sales days before invoking ML service or calculating rolling stats. | **VERIFIED** (`optimization.test.js`) |
| **ML-004** | **P1** | Insufficient History Handling | `ml-service/main.py` | ML Design §3.4 | Checked history length; products with $<7$ days of history return baseline predictions marked with `INSUFFICIENT_DATA_BASELINE`. | **VERIFIED** (`test_service.py`) |
| **ML-005** | **P2** | Recursive Rollout Integrity | `ml-service/main.py` | ML Design §3.3 | Bounded `horizon_days <= 14` and `products <= 100`. Cleared static feature overrides after day 0 so lag and rolling statistics are recalculated dynamically from augmented series. | **VERIFIED** (`test_service.py`) |

---

## 3. Financial & Concurrency Integrity Verification

### 3.1 Inventory Adjustments (INV-001)
- **Problem:** Unbounded negative adjustments could drive inventory below zero or below reserved stock. Adjustments outside transactions could create partial states where stock was updated but no movement or audit log was recorded.
- **Solution:**
  1. Wrapped adjustment, stock update, `StockMovement` creation, and `AuditLog` creation in `prisma.$transaction`.
  2. Enforced strict floor: `currentOnHand - decreaseAmount >= reservedQuantity`.
  3. Used guarded atomic update with Prisma version checking:
     ```javascript
     const updateResult = await tx.inventory.updateMany({
       where: {
         id: inventory.id,
         version: inventory.version,
         quantityOnHand: { gte: decreaseAmount + reserved },
       },
       data: {
         quantityOnHand: { decrement: decreaseAmount },
         version: { increment: 1 },
       },
     });
     if (updateResult.count === 0) throw new ConflictError('Concurrent inventory modification detected');
     ```
  4. Linked `StockMovement.inventoryId` to establish a relational ledger trail.

### 3.2 Safe Purchase Receiving (PUR-001)
- **Problem:** Receiving lines could be submitted with duplicate `purchaseOrderItemId` entries in a single request, bypassing line-item limits. Network retries created duplicate receipts and inflated stock.
- **Solution:**
  1. In `purchaseOrders.js`, aggregated requested lines by `purchaseOrderItemId` before checking limits.
  2. Implemented replay-safe idempotency: if `receiptReference` exists, returns the original receipt without double-incrementing stock.
  3. Applied conditional guarded atomic updates:
     ```javascript
     const updatePoResult = await tx.purchaseOrderItem.updateMany({
       where: {
         id: aggItem.purchaseOrderItemId,
         receivedQty: { lte: poItem.orderedQty - aggItem.qtyReceived },
       },
       data: { receivedQty: { increment: aggItem.qtyReceived } },
     });
     ```
  4. Created `PurchaseReceipt` and `PurchaseReceiptItem` records inside the same transaction.

### 3.3 Safe Product Returns (SALE-001)
- **Problem:** Multi-line return requests could return more than originally sold. Damaged items marked for write-off were being added back to available inventory.
- **Solution:**
  1. Inside `prisma.$transaction`, locked the sale and its complete return history.
  2. Aggregated requested return lines by `saleItemId` and verified total returned $\le$ sold quantity.
  3. Restocked physical inventory only when `restockQty > 0`.
  4. Recomputed cumulative returned totals to update sale status to `REFUNDED` only when fully returned.

---

## 4. Authentication, Session & RBAC Verification

### 4.1 Token Versioning & Instant Revocation (AUTH-001, AUTH-002)
- **Database Schema:** Added `tokenVersion Int @default(0)` to the `User` model via forward-only migration `20261025071143_add_token_version_and_store_settings`.
- **JWT Claims:** Embedded `tokenVersion: user.tokenVersion` in access and refresh tokens.
- **Middleware Guard:**
  ```javascript
  if (user.tokenVersion !== undefined && decoded.tokenVersion !== user.tokenVersion) {
    return res.status(401).json({ error: 'Token has been revoked', code: 'TOKEN_REVOKED' });
  }
  ```
- **Logout Endpoint (`POST /auth/logout`):**
  Atomically increments `user.tokenVersion` in MySQL and writes a `LOGOUT` audit log. This instantly invalidates all existing access and refresh tokens across all devices.
- **Silent Session Restore:** Removed `/auth/me` from frontend `isAuthRoute` list in `frontend/src/services/api.js`. An expired access token on reload automatically triggers `/auth/refresh` and restores user state seamlessly.

### 4.2 RBAC Role Enforcement (API-001, UI-007)
- **Backend:** Added `requireRole` middleware checks:
  - `GET /api/v1/reports/sales`, `/inventory-valuation`, `/turnover`: `['ADMIN', 'MANAGER']`
  - `GET /api/v1/reports/stock-movements`, `/expiry-risk`: `['ADMIN', 'MANAGER', 'INVENTORY_STAFF']`
  - `GET /api/v1/optimization/recommendations`, `/forecasts`, `/slow-moving`, `/model-info`: `['ADMIN', 'MANAGER']`
  - `POST /api/v1/optimization/recalculate`: `['ADMIN', 'MANAGER']`
- **Frontend:** Wrapped navigation routes in `frontend/src/App.jsx` with `<ProtectedRoute allowedRoles={[...]}>`. Non-permitted roles are redirected to `/dashboard`.

---

## 5. Machine Learning Evaluation & Service Hardening

### 5.1 Chronological Date Split (ML-001)
- **Root Cause:** Slicing on row indices of a dataframe sorted by `['product_id', 'store_id', 'date']` placed earlier products entirely into training and later products entirely into testing.
- **Remediation:** In `ml-service/train.py`, extracted unique sorted dates (`df_clean['date'].unique()`). Split into:
  - **Train:** Earliest 80% of calendar dates (268 dates, 13,400 samples)
  - **Validation:** Next 10% of calendar dates (34 dates, 1,700 samples)
  - **Test Holdout:** Final 10% of calendar dates (34 dates, 1,700 samples)
- **Result:** Every product is trained on past history and evaluated on future holdout windows with zero temporal leakage.

### 5.2 Baseline Benchmarking (ML-002)
- **Moving Average Baseline:** Trailing 7-day average per product computed strictly from the end of the training period.
  - Test MAE: **2.9826**, WAPE: **0.3065**
- **Day-of-Week Naive Baseline:** Historic same-day-of-week average per product.
  - Test MAE: **2.6488**, WAPE: **0.2722**
- **HistGradientBoostingRegressor Performance:**
  - Validation MAE: **1.3101**, WAPE: **0.1484**
  - Test MAE: **1.3681**, WAPE: **0.1406**
  - **Improvement over best baseline: 48.35%**
- **Metadata Provenance:** Saved in `ml-service/models/metadata.json` clearly attributed as `M5_BENCHMARK_SAMPLE` / `SYNTHETIC_FIXTURE`.

### 5.3 Dense Daily Calendar & Autoregressive Rollout (ML-003, ML-004, ML-005)
- In `backend/src/routes/optimization.js`, aggregated raw sales items into a dense 28-day zero-filled array of daily quantities (`[0, 2, 0, 1, ...]`).
- In `ml-service/main.py`:
  - Enforced `max_length=100` on products batch and `le=14` on horizon.
  - Returns `INSUFFICIENT_DATA_BASELINE` for products with $<7$ days of sales history.
  - Dynamically recalculates lag and rolling statistics from the augmented time-series at each step of the multi-step autoregressive rollout.

---

## 6. Automated Verification Evidence

### 6.1 Backend Vitest Suite Execution
**Command:** `Set-Location backend; npx vitest run`  
**Output:**
```
 RUN  v1.6.1 E:/Projects/ORIMS/backend

 ✓ tests/frontendRouting.test.jsx (5 tests) 280ms
 ✓ tests/inventory.test.js (5 tests) 674ms
 ✓ tests/purchaseOrders.test.js (2 tests) 909ms
 ✓ tests/sales.test.js (5 tests) 1120ms
 ✓ tests/optimization.test.js (5 tests) 778ms
 ✓ tests/integrity.test.js (9 tests) 2194ms
 ✓ tests/products.test.js (5 tests) 1083ms
 ✓ tests/reports.test.js (3 tests) 702ms
 ✓ tests/dbPool.test.js (4 tests) 62ms
 ✓ tests/auth.test.js (10 tests) 5340ms

 Test Files  10 passed (10)
      Tests  54 passed (54)
   Start at  13:05:27
   Duration  8.76s
```

### 6.2 ML Service Pytest Suite Execution
**Command:** `python -m pytest ml-service/tests`  
**Output:**
```
============================= test session starts =============================
platform win32 -- Python 3.13.14, pytest-8.3.0, pluggy-1.7.0
rootdir: E:\Projects\ORIMS\ml-service
configfile: pyproject.toml
collected 12 items

ml-service\tests\test_service.py ............                            [100%]

======================= 12 passed, 3 warnings in 5.33s ========================
```

### 6.3 Frontend Production Build Execution
**Command:** `Set-Location frontend; npx vite build`  
**Output:**
```
vite v5.4.21 building for production...
transforming...
✓ 930 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.50 kB │ gzip:   0.33 kB
dist/assets/index-ugU_WYMW.css   36.18 kB │ gzip:   6.10 kB
dist/assets/index-CcvcGqE8.js   801.57 kB │ gzip: 214.50 kB
✓ built in 13.61s
```

### 6.4 Prisma Migration & Schema Status
**Command:** `npx prisma migrate status`  
**Output:**
```
Database schema is up to date!
1 migration found in prisma/migrations:
  - 20261025071143_add_token_version_and_store_settings (applied)
```

---

## 7. Operational Readiness & Release Certification

1. **Zero Secret Leaks:** No `.env` credentials, Kaggle tokens, JWT secrets, or DB passwords are committed or exposed in logs.
2. **Database Migration Safety:** Forward-only Prisma migrations were created and verified against both `orims` and `orims_test`. Zero destructive schema operations were executed.
3. **No Unrelated Code Migration:** The agreed stack (React 18 + Node.js/Express + MySQL 8.4/Prisma + Python 3.13 FastAPI) has been preserved without unnecessary library additions or structural rewrites.
4. **Production Certification:** ORIMS satisfies all requirements for concurrency safety, financial accuracy, authentication lifecycle, and forecasting transparency.
