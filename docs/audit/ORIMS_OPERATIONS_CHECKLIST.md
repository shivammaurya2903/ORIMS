# ORIMS Operations Verification Checklist

**Document Version:** 2.0 (Post-Audit Remediation)  
**Verification Date:** October 26, 2026  
**Auditor / QA Lead:** Senior Full-Stack QA & Reliability Engineer  
**Reference Documents:**
- Audit Report: [`docs/audit/ORIMS_OPERATIONAL_COMPLETENESS_AUDIT.md`](file:///E:/Projects/ORIMS/docs/audit/ORIMS_OPERATIONAL_COMPLETENESS_AUDIT.md)  
- Remediation Report: [`docs/audit/ORIMS_OPERATIONAL_REMEDIATION_REPORT.md`](file:///E:/Projects/ORIMS/docs/audit/ORIMS_OPERATIONAL_REMEDIATION_REPORT.md)  
**System Under Test:** Optimised Retail Inventory Management System (ORIMS)  
**Stack Baseline:** React 19 + Vite (`:5173`), Node.js + Express (`:3001`), MySQL + Prisma (`:3306`), Python + FastAPI (`:8000`)

---

## 1. How to Use This Checklist

This operations checklist is structured for QA engineers, business analysts, release managers, and evaluators to systematically verify every business operation and workflow in ORIMS.

### Test Environment Prerequisites
1. **Frontend:** Running at `http://localhost:5173` via `npm run dev --workspace=frontend`.
2. **Backend API:** Running at `http://localhost:3001` via `npm run dev --workspace=backend`.
3. **Database:** MySQL 8.0 running at port `3306`, migrated (`npx prisma migrate deploy`), and seeded (`npm run seed --workspace=backend`).
4. **ML Service:** Running at `http://localhost:8000` via `python -m uvicorn app:app --port 8000` inside `ml-service/`.
5. **Standard Seed Test Accounts:**
   - **Admin:** `admin@orims.local` / `AdminPass123!` (Store: All / null)
   - **Manager:** `manager@orims.local` / `ManagerPass123!` (Store: Store 1)
   - **Sales Staff:** `sales@orims.local` / `SalesPass123!` (Store: Store 1)
   - **Inventory Staff:** `inventory@orims.local` / `InventoryPass123!` (Store: Store 1)

### Status Conventions
- `[X] PASS`: Feature functions end-to-end, adheres to specs, and verified via automated test or runtime checks.
- `[ ] PASS`: Ready for manual tester confirmation in staging/demo.
- `[ ] FAIL`: Feature fails to execute or violates business logic/security constraints.
- `[ ] BLOCKED`: Step cannot be tested due to an environmental block (e.g. host MySQL service offline).
- **Remediation Notes:** Annotated with Resolved Finding references (`F-UI-01`, `F-REP-01`, etc.) confirming the underlying bug has been fixed and regression tested.

---

## 2. Checklist Table of Contents

- [Module 1: Authentication, Session Management, and Role Access](#module-1-authentication-session-management-and-role-access)
- [Module 2: Product and Category Catalog Management](#module-2-product-and-category-catalog-management)
- [Module 3: Inventory Ledger, Balances, and Adjustments](#module-3-inventory-ledger-balances-and-adjustments)
- [Module 4: Point of Sale (POS) and Sales Order Processing](#module-4-point-of-sale-pos-and-sales-order-processing)
- [Module 5: Returns, Damage Triage, and Restocking](#module-5-returns-damage-triage-and-restocking)
- [Module 6: Supplier and Supplier-Product Catalog](#module-6-supplier-and-supplier-product-catalog)
- [Module 7: Purchase Orders (PO) and Goods Receiving](#module-7-purchase-orders-po-and-goods-receiving)
- [Module 8: ML Forecasting and Optimization Recommendations](#module-8-ml-forecasting-and-optimization-recommendations)
- [Module 9: Reports and Analytics](#module-9-reports-and-analytics)
- [Module 10: Store Settings, User Management, and Auditing](#module-10-store-settings-user-management-and-auditing)
- [Module 11: System Health, Metrics, and Operational Endpoints](#module-11-system-health-metrics-and-operational-endpoints)

---

## Module 1: Authentication, Session Management, and Role Access

### OP-AUTH-01: Public Landing Page Routing
- **Preconditions:** Clear browser cookies/localStorage or open incognito window.
- **Test Steps:**
  1. Navigate to `http://localhost:5173/`.
- **Expected Results:**
  - Displays public Landing Page with marketing hero, feature highlights, and navigation links.
  - Does NOT redirect unauthenticated users directly to `/login`.
- **Verification:** Verified via `backend/tests/frontendRouting.test.jsx`.
- **Status:** `[X] PASS`

### OP-AUTH-02: Public Self-Registration Policy Enforcement
- **Preconditions:** Unauthenticated browser.
- **Test Steps:**
  1. Attempt to navigate to `http://localhost:5173/register` or inspect Landing/Login pages for self-registration links.
  2. Send direct API POST to `http://localhost:3001/api/v1/auth/register`.
- **Expected Results:**
  - UI redirects `/register` to `/login` (admin-provisioned model).
- **Status:** `[X] PASS`

### OP-AUTH-03: User Login (Valid Credentials)
- **Preconditions:** Unauthenticated user on `/login`.
- **Test Steps:**
  1. Enter `admin@orims.local` and `AdminPass123!`.
  2. Click "Sign In".
- **Expected Results:**
  - Frontend stores access token in memory/state and refresh cookie in HTTP-only cookie.
  - Redirects user to `/dashboard`.
  - Header displays active user's name and role badge ("ADMIN").
- **Status:** `[ ] PASS` | `[ ] FAIL` | `[ ] BLOCKED`

### OP-AUTH-04: User Login (Invalid / Inactive Credentials)
- **Preconditions:** `/login` page open.
- **Test Steps:**
  1. Enter valid email with wrong password (`admin@orims.local` / `WrongPassword999!`).
  2. Attempt login with disabled/inactive user account.
- **Expected Results:**
  - Rejects with `401 Unauthorized` and user-friendly error toast ("Invalid credentials").
  - Inactive account rejected with specific inactive message.
  - Password field cleared; user remains on `/login`.
- **Status:** `[ ] PASS` | `[ ] FAIL` | `[ ] BLOCKED`

### OP-AUTH-05: Session Restoration & Token Refresh
- **Preconditions:** User logged in. Access token expired (or set short TTL in test env).
- **Test Steps:**
  1. Refresh the browser page (`F5`).
  2. Wait 15 minutes (or artificially expire access token) and perform a navigation action.
- **Expected Results:**
  - `GET /api/v1/auth/refresh` is called automatically using HTTP-only cookie.
  - User session seamlessly restored without redirecting to `/login` or losing state.
- **Status:** `[ ] PASS` | `[ ] FAIL` | `[ ] BLOCKED`

### OP-AUTH-06: Session Invalidation on Logout
- **Preconditions:** User logged in.
- **Test Steps:**
  1. Click User Menu -> "Logout".
  2. Inspect DevTools Network tab for `POST /api/v1/auth/logout`.
  3. Attempt to use previous access token or refresh cookie in Postman/curl.
- **Expected Results:**
  - Server increments `tokenVersion` on `User` record in DB, invalidating all issued tokens.
  - Refresh cookie cleared (`Max-Age=0`).
  - Browser redirects to `/login`.
  - Replay of old tokens returns `401 Unauthorized`.
- **Status:** `[ ] PASS` | `[ ] FAIL` | `[ ] BLOCKED`

### OP-AUTH-07: Role-Based Route Protection & Permissions
- **Preconditions:** Distinct browser profiles or test sessions for each role.
- **Test Steps:**
  1. Log in as `sales@orims.local` (Sales Staff).
  2. Attempt to navigate to `/settings`, `/users`, `/purchase-orders`, `/suppliers`.
  3. Log in as `inventory@orims.local` (Inventory Staff).
  4. Attempt to navigate to `/pos`, `/settings`, `/users`.
- **Expected Results:**
  - Unauthorized navigation links hidden from sidebar/navigation.
  - Direct URL access redirects to `/dashboard` or renders 403 Forbidden message.
- **Status:** `[ ] PASS` | `[ ] FAIL` | `[ ] BLOCKED`

---

## Module 2: Product and Category Catalog Management

### OP-CAT-01: Category Creation & Hierarchy
- **Preconditions:** Logged in as Admin or Manager. Navigate to `/categories` (or `/products` category tab).
- **Test Steps:**
  1. Click "Add Category".
  2. Enter Name: "Dairy & Eggs", Description: "Perishable dairy products".
  3. Submit.
- **Expected Results:**
  - `POST /api/v1/categories` responds `201 Created`.
  - New category appears immediately in categories list.
- **Status:** `[ ] PASS` | `[ ] FAIL` | `[ ] BLOCKED`

### OP-PROD-01: Product Creation with Pricing and Barcode
- **Preconditions:** Logged in as Admin or Manager. Navigate to `/products`.
- **Test Steps:**
  1. Click "Add Product".
  2. Fill in SKU ("SKU-CHK-001"), Barcode ("8901234567890"), Name ("Organic Milk 1L"), Category, Cost Price (`$2.50`), Selling Price (`$4.00`), Min/Max Stock (`10` / `100`).
  3. Click "Save Product".
- **Expected Results:**
  - `POST /api/v1/products` returns `201 Created`.
  - Product appears in table with active status badge.
- **Status:** `[ ] PASS` | `[ ] FAIL` | `[ ] BLOCKED`

### OP-PROD-02: Product Search, Filter, Sort, and Inactive Toggle
- **Preconditions:** Multiple active and deactivated products exist.
- **Test Steps:**
  1. Type "Organic" into search box.
  2. Filter by Category "Dairy & Eggs".
  3. Sort by Price (High to Low).
  4. Toggle "Include Inactive" filter checkbox.
- **Expected Results:**
  - Grid filters server-side via `GET /api/v1/products?search=...&categoryId=...&includeInactive=true`.
  - Deactivated products appear greyed out with "Inactive" badge.
- **Status:** `[ ] PASS` | `[ ] FAIL` | `[ ] BLOCKED`

### OP-PROD-03: Product Edit Navigation & Mutation (Remediated: F-UI-01)
- **Preconditions:** Logged in as Admin or Manager. Navigate to `/products` and click on any product row.
- **Test Steps:**
  1. Click "Edit" button on Product Detail screen (or navigate to `/products/:id/edit`).
  2. Verify edit form loads current SKU, Barcode, Name, Cost Price, Selling Price, and Category.
  3. Update Selling Price from `$4.00` to `$4.50` and Description.
  4. Click "Save Product".
- **Expected Results:**
  - Direct navigation to `/products/:id/edit` opens valid edit view (NO 404).
  - `PUT /api/v1/products/:id` responds `200 OK`.
  - Navigates back to Product Detail displaying the updated price (`$4.50`).
- **Remediation Note:** `F-UI-01` resolved. `ProductEdit.jsx` created and registered in `App.jsx`. Regression tested via Vitest.
- **Status:** `[X] PASS`

### OP-PROD-04: Product Detail Movements & Batches Display (Remediated: F-UI-02, F-UI-03)
- **Preconditions:** Product Detail page loaded for a product with existing stock movements and batches.
- **Test Steps:**
  1. Click "Stock Movements" tab.
  2. Verify table displays real movement records (Timestamp, Type badge, Quantity Delta, Reason, Reference).
  3. Click "Batches" tab.
  4. Verify table renders batch numbers, expiry dates, quantities, and store names.
- **Expected Results:**
  - Movements tab queries `GET /api/v1/inventory/:productId/movements` and renders real ledger data.
  - Batches tab queries `GET /api/v1/products/:id` with `productBatches` relation and displays real batch items.
- **Remediation Note:** `F-UI-02` (placeholder replaced with table) and `F-UI-03` (`productBatches` included in Prisma query) resolved.
- **Status:** `[X] PASS`

---

## Module 3: Inventory Ledger, Balances, and Adjustments

### OP-INV-01: Multi-Store Inventory Balances & Thresholds
- **Preconditions:** Logged in as Admin or Manager. Navigate to `/inventory`.
- **Test Steps:**
  1. View inventory list. Inspect columns: On-Hand, Reserved, Available, Low Stock Alert.
  2. Switch Store filter between "All Stores", "Store 1", "Store 2".
- **Expected Results:**
  - Calculations match formula: `Available = On-Hand - Reserved`.
  - Low stock warning triggered when `Available <= minStockLevel`.
  - Store filtering accurately scopes counts to selected store.
- **Status:** `[ ] PASS` | `[ ] FAIL` | `[ ] BLOCKED`

### OP-INV-02: Stock Adjustment (Damage / Write-Off / Audit)
- **Preconditions:** Product with `onHand: 50` at Store 1.
- **Test Steps:**
  1. Click "Adjust Stock" on inventory line.
  2. Select Type: `DAMAGE` (or `CORRECTION`), Quantity: `-5`, Reason: "Cracked bottle during shelf stocking".
  3. Submit adjustment.
- **Expected Results:**
  - `POST /api/v1/inventory/adjust` returns `200 OK`.
  - Store onHand decrements to `45`.
  - New record in `StockMovement` table with type `DAMAGE`, quantity `-5`, and user ID recorded.
- **Status:** `[ ] PASS` | `[ ] FAIL` | `[ ] BLOCKED`

### OP-INV-03: Negative Stock Prevention
- **Preconditions:** Product with `onHand: 3` at Store 1.
- **Test Steps:**
  1. Attempt stock adjustment with Quantity: `-10`.
- **Expected Results:**
  - Backend validation / Prisma version guard rejects with `400 Bad Request` ("Insufficient stock on hand").
  - On-hand stock remains `3`.
- **Status:** `[ ] PASS` | `[ ] FAIL` | `[ ] BLOCKED`

---

## Module 4: Point of Sale (POS) and Sales Order Processing

### OP-POS-01: Product Selection & Barcode Scanning
- **Preconditions:** Logged in as Sales Staff or Admin. Navigate to `/pos`.
- **Test Steps:**
  1. Search product by barcode or name in POS search input.
  2. Click item or press enter to add to cart.
  3. Increase item quantity from `1` to `3`.
- **Expected Results:**
  - Item added to active cart line. Subtotal calculated in real time.
- **Status:** `[ ] PASS` | `[ ] FAIL` | `[ ] BLOCKED`

### OP-POS-02: Stock Availability Check & Inactive Rejection
- **Preconditions:** Product A has `availableStock: 2`. Product B is deactivated (`isActive: false`).
- **Test Steps:**
  1. Attempt to add quantity `5` of Product A.
  2. Attempt to search or add Product B.
- **Expected Results:**
  - POS alerts: quantity exceeds available stock.
  - Inactive product cannot be selected or checked out.
- **Status:** `[ ] PASS` | `[ ] FAIL` | `[ ] BLOCKED`

### OP-POS-03: Complete Sale Checkout & Inventory Deduction
- **Preconditions:** POS cart loaded with 2 items. Customer details selected (optional).
- **Test Steps:**
  1. Select Payment Method: "CASH" (or "CARD").
  2. Enter Amount Tendered and click "Complete Sale".
- **Expected Results:**
  - `POST /api/v1/sales/checkout` returns `201 Created` with receipt number and finalized totals.
  - Sales screen renders receipt modal with option to print or new transaction.
  - Inventory for items decrements immediately in database.
  - Corresponding `SALE` entries created in `StockMovement`.
- **Status:** `[ ] PASS` | `[ ] FAIL` | `[ ] BLOCKED`

### OP-POS-04: Checkout Idempotency Verification
- **Preconditions:** Intercept network request or trigger rapid double-click on "Complete Sale".
- **Test Steps:**
  1. Submit checkout request with header `Idempotency-Key: test-key-101`.
  2. Re-send identical request with same key `test-key-101`.
  3. Re-send request with `test-key-101` but altered cart payload.
- **Expected Results:**
  - Step 1: `201 Created`, sale processed.
  - Step 2: `200 OK`, returns exact duplicate receipt without deducting stock again.
  - Step 3: `409 Conflict`, rejects altered payload for reused key.
- **Status:** `[ ] PASS` | `[ ] FAIL` | `[ ] BLOCKED`

---

## Module 5: Returns, Damage Triage, and Restocking

### OP-RET-01: Initiate Return Against Completed Sale
- **Preconditions:** Navigate to `/sales`, locate a completed sale, click "View Sale", click "Return Items".
- **Test Steps:**
  1. Select return quantity for item (e.g. 1 out of 2 sold).
  2. Select Reason: "Customer changed mind", Condition: "UNOPENED" (Restock: Yes).
  3. Submit return.
- **Expected Results:**
  - `POST /api/v1/returns` returns `201 Created`.
  - Item on-hand stock increases by `1`.
  - `StockMovement` logged as `RETURN_RESTOCK`.
- **Status:** `[ ] PASS` | `[ ] FAIL` | `[ ] BLOCKED`

### OP-RET-02: Damaged Return (No Restock)
- **Preconditions:** Completed sale with purchased item.
- **Test Steps:**
  1. Initiate return for 1 item with Reason: "Broken / Defective", Restock: No (Condition: DAMAGED).
  2. Submit return.
- **Expected Results:**
  - Return record created; refund amount issued.
  - On-hand stock is **NOT** increased.
  - Movement logged as damaged / quarantined write-off.
- **Status:** `[ ] PASS` | `[ ] FAIL` | `[ ] BLOCKED`

### OP-RET-03: Excessive Return Quantity Validation
- **Preconditions:** Sale with 1 unit sold.
- **Test Steps:**
  1. Submit return request for 2 units.
  2. Submit 1 unit return twice consecutively.
- **Expected Results:**
  - System rejects with `400 Bad Request` ("Cumulative returned quantity cannot exceed sold quantity").
- **Status:** `[ ] PASS` | `[ ] FAIL` | `[ ] BLOCKED`

---

## Module 6: Supplier and Supplier-Product Catalog

### OP-SUP-01: Create & Edit Supplier Profile
- **Preconditions:** Logged in as Admin or Manager. Navigate to `/suppliers`.
- **Test Steps:**
  1. Click "Add Supplier".
  2. Name: "Apex Dairy Supplies", Contact: "John Doe", Email: "contact@apexdairy.local", Phone: "+1-555-0199".
  3. Save, then edit phone number.
- **Expected Results:**
  - `POST /api/v1/suppliers` and `PUT /api/v1/suppliers/:id` succeed.
  - Details update in table and detail view.
- **Status:** `[ ] PASS` | `[ ] FAIL` | `[ ] BLOCKED`

### OP-SUP-02: Supplier-Product Linking & Lead Time
- **Preconditions:** On Supplier Detail page for "Apex Dairy Supplies".
- **Test Steps:**
  1. Click "Link Product".
  2. Select "Organic Milk 1L", Supplier SKU: "SUP-MILK-01", Unit Cost: `$2.20`, Lead Time Days: `3`, MOQ: `20`.
  3. Save link.
- **Expected Results:**
  - `POST /api/v1/suppliers/:id/products` creates link in `SupplierProduct` table.
  - Product displays under Supplier's catalog with defined lead time and MOQ.
- **Status:** `[ ] PASS` | `[ ] FAIL` | `[ ] BLOCKED`

---

## Module 7: Purchase Orders (PO) and Goods Receiving

### OP-PO-01: Create Draft Purchase Order
- **Preconditions:** Logged in as Admin or Manager. Navigate to `/purchase-orders`.
- **Test Steps:**
  1. Click "Create PO".
  2. Select Supplier: "Apex Dairy Supplies", Store: "Store 1", Expected Date: +7 days.
  3. Add Line: "Organic Milk 1L", Quantity: `50`, Unit Cost: `$2.20`.
  4. Save as Draft.
- **Expected Results:**
  - `POST /api/v1/purchase-orders` returns `201 Created` with status `DRAFT`.
  - PO appears in list with total `$110.00`.
- **Status:** `[ ] PASS` | `[ ] FAIL` | `[ ] BLOCKED`

### OP-PO-02: Submit & Approve Purchase Order
- **Preconditions:** PO in `DRAFT` status.
- **Test Steps:**
  1. Click "Submit" (transitions status to `SUBMITTED` / `ORDERED`).
  2. Inspect state change.
- **Expected Results:**
  - Status updates to `ORDERED`. "Receive Goods" button becomes active.
- **Status:** `[ ] PASS` | `[ ] FAIL` | `[ ] BLOCKED`

### OP-PO-03: Partial & Full Goods Receiving
- **Preconditions:** PO in `ORDERED` status with ordered quantity `50`.
- **Test Steps:**
  1. Click "Receive Items". Enter Received Quantity: `30`, Batch Number: `BATCH-2026-A`, Expiry: 30 days ahead.
  2. Submit partial receipt.
  3. Inspect PO Status (should be `PARTIALLY_RECEIVED`).
  4. Receive remaining `20` units.
- **Expected Results:**
  - Partial receipt increments stock by `30`; PO status becomes `PARTIALLY_RECEIVED`.
  - Final receipt increments stock by `20`; PO status transitions to `RECEIVED`.
  - `StockMovement` records created with type `RECEIPT`.
- **Status:** `[ ] PASS` | `[ ] FAIL` | `[ ] BLOCKED`

### OP-PO-04: Over-Receiving Prevention
- **Preconditions:** PO with `orderedQuantity: 50`, `receivedQuantity: 50`.
- **Test Steps:**
  1. Attempt to submit additional receipt of `5` units against this PO.
- **Expected Results:**
  - Backend rejects with `400 Bad Request` ("Received quantity cannot exceed ordered quantity").
- **Status:** `[ ] PASS` | `[ ] FAIL` | `[ ] BLOCKED`

---

## Module 8: ML Forecasting and Optimization Recommendations

### OP-ML-01: ML Service Health & Offline Test Harness (Remediated: F-ML-01)
- **Preconditions:** Offline sandbox or network disabled.
- **Test Steps:**
  1. Run `python -m pytest ml-service/tests/test_service.py -v`.
  2. Inspect execution time and network calls.
- **Expected Results:**
  - All 14 tests pass cleanly in under 10 seconds without attempting HTTPS requests or hanging on socket timeouts.
  - Provenance is explicitly labeled as `"M5_BENCHMARK_SAMPLE"` or `"FIXTURE"`.
- **Remediation Note:** `F-ML-01` resolved. Added bounded socket timeout and offline-safe dataset loader in `m5_data.py`.
- **Status:** `[X] PASS`

### OP-ML-02: 7-Day & 30-Day Demand Forecast View
- **Preconditions:** Navigate to `/forecasts` or `/optimization`.
- **Test Steps:**
  1. Select product and store.
  2. Request 7-day and 30-day demand forecast.
- **Expected Results:**
  - Backend proxies to ML service `/forecast`.
  - Renders Recharts time-series chart showing predicted daily demand and confidence intervals.
- **Status:** `[ ] PASS` | `[ ] FAIL` | `[ ] BLOCKED`

### OP-ML-03: Optimization Recommendation Approval to Draft PO (Remediated: F-UI-05)
- **Preconditions:** Navigate to `/optimization`. Low-stock recommendation visible with status `PENDING`.
- **Test Steps:**
  1. Click "Approve" button.
  2. In the modal, check the box: *"Create Draft Purchase Order (status: DRAFT)"*.
  3. Click "Approve".
- **Expected Results:**
  - Recommendation status transitions to `CONVERTED_TO_PO`.
  - Draft Purchase Order is automatically generated with linked active supplier.
  - User receives alert with draft PO ID.
- **Remediation Note:** `F-UI-05` resolved. Draft PO toggle implemented in `Optimization.jsx`.
- **Status:** `[X] PASS`

---

## Module 9: Reports and Analytics

### OP-REP-01: Inventory Valuation Method Calculation (Remediated: F-REP-01)
- **Preconditions:** Navigate to `/reports/inventory` (or tab in `/reports`).
- **Test Steps:**
  1. Select valuation method: "Current Cost (Catalog Replacement)" and click Generate.
  2. Note total value.
  3. Switch valuation method to: "Weighted Average (Acquisition History)" and click Generate.
- **Expected Results:**
  - `CURRENT_COST` calculates valuation from current replacement catalog prices.
  - `WEIGHTED_AVERAGE` calculates valuation from actual received purchase order unit costs.
  - UI displays valuation basis description and shows cost basis badge per product.
- **Remediation Note:** `F-REP-01` resolved in `backend/src/routes/reports.js` and `frontend/src/pages/Reports.jsx`.
- **Status:** `[X] PASS`

### OP-REP-02: Export Reports to CSV (Remediated: F-REP-02)
- **Preconditions:** Navigate to `/reports` and view any tab (Sales, Valuation, Turnover, Movements, Expiry).
- **Test Steps:**
  1. Click "Export CSV" on Sales Report.
  2. Click "Export CSV" on Valuation Report.
  3. Inspect downloaded `.csv` files.
- **Expected Results:**
  - File downloads as RFC 4180 CSV with matching filters.
  - Malicious characters (`=`, `+`, `-`, `@`) are neutralized with prepended apostrophes to prevent spreadsheet formula injection.
- **Remediation Note:** `F-REP-02` resolved. Created `csv.js` utility and wired exports across all 5 report endpoints.
- **Status:** `[X] PASS`

### OP-REP-03: Dashboard KPI Metrics Accuracy (Remediated: F-UI-04)
- **Preconditions:** Navigate to `/dashboard`.
- **Test Steps:**
  1. Inspect KPI tiles: "Today's Sales", "Active Products", "Low Stock Items", "Expiring Soon".
  2. Verify Today's Sales represents current calendar day revenue.
  3. Verify Active Products represents catalogue count.
  4. Verify Low Stock Items represents total low stock count across inventory.
  5. Verify no fake deltas (+12.5%, +3) appear.
- **Expected Results:**
  - All four KPI tiles reflect honest, real-time database numbers without hardcoded deltas.
- **Remediation Note:** `F-UI-04` resolved in `Dashboard.jsx`.
- **Status:** `[X] PASS`

---

## Module 10: Store Settings, User Management, and Auditing

### OP-SET-01: Update Store Settings & Persistence (Remediated: F-SET-01)
- **Preconditions:** Logged in as Admin. Navigate to `/settings`.
- **Test Steps:**
  1. Change Currency to `GBP` (or `EUR`), Tax Rate to `0.20`, Timezone to `Europe/London`.
  2. Click "Save Store Settings".
  3. Refresh the page (`F5`).
- **Expected Results:**
  - Form re-populates with saved values (`GBP`, `0.20`, `Europe/London`).
  - Saved values are NOT reverted to hardcoded `USD` / `0.10` defaults.
- **Remediation Note:** `F-SET-01` resolved in `frontend/src/pages/Settings.jsx`.
- **Status:** `[X] PASS`

### OP-USR-01: Admin User Provisioning & Store Assignment
- **Preconditions:** Logged in as Admin. Navigate to `/users`.
- **Test Steps:**
  1. Click "Add User".
  2. Enter Name, Email, Role (`INVENTORY_STAFF`), Assigned Store (`Store 2`), Initial Password.
  3. Submit.
- **Expected Results:**
  - User created with hashed password (`bcrypt`).
  - New user can log in and is restricted to Store 2 operations.
- **Status:** `[ ] PASS` | `[ ] FAIL` | `[ ] BLOCKED`

### OP-AUD-01: Audit Log Ledger Tracking
- **Preconditions:** Perform a stock adjustment, user role change, and price update.
- **Test Steps:**
  1. Query `AuditLog` table or navigate to `/audit-logs` (if UI present).
- **Expected Results:**
  - Record exists with timestamp, `userId`, `action`, `resource`, `detailsJson`, and client IP.
- **Status:** `[ ] PASS` | `[ ] FAIL` | `[ ] BLOCKED`

---

## Module 11: System Health, Metrics, and Operational Endpoints

### OP-OPS-01: Backend Health Check & Readiness
- **Preconditions:** Backend server running.
- **Test Steps:**
  1. Execute `curl http://localhost:3001/health`.
  2. Execute `curl http://localhost:3001/api/v1/health/ready`.
- **Expected Results:**
  - `/health` responds with `200 OK` and system uptime.
  - `/ready` verifies database connectivity before returning `200 OK`.
- **Status:** `[ ] PASS` | `[ ] FAIL` | `[ ] BLOCKED`

### OP-OPS-02: Prometheus Metrics Endpoint
- **Preconditions:** Backend server running.
- **Test Steps:**
  1. Execute `curl http://localhost:3001/metrics`.
- **Expected Results:**
  - Returns standard Prometheus text-format metrics (`http_request_duration_seconds`, process memory, etc.).
- **Status:** `[ ] PASS` | `[ ] FAIL` | `[ ] BLOCKED`

---

## 3. QA Sign-Off Summary

| Module | Total Operations | Pass (Verified) | Staging Verification | Defect Blocker Status |
|---|:---:|:---:|:---:|:---|
| **Module 1: Auth & Roles** | 7 | 2 | 5 | All green |
| **Module 2: Products & Catalog** | 4 | 2 | 2 | `F-UI-01`, `F-UI-02`, `F-UI-03` **REMEDIATED** |
| **Module 3: Inventory Ledger** | 3 | 0 | 3 | Unblocked |
| **Module 4: POS & Checkout** | 4 | 0 | 4 | Unblocked |
| **Module 5: Returns & Restock** | 3 | 0 | 3 | Unblocked |
| **Module 6: Suppliers & Links** | 2 | 0 | 2 | Unblocked |
| **Module 7: Purchase Orders** | 4 | 0 | 4 | Unblocked |
| **Module 8: ML & Optimization** | 3 | 2 | 1 | `F-ML-01`, `F-UI-05` **REMEDIATED** |
| **Module 9: Reports & KPIs** | 3 | 3 | 0 | `F-REP-01`, `F-REP-02`, `F-UI-04` **REMEDIATED** |
| **Module 10: Settings & Admin** | 3 | 1 | 2 | `F-SET-01` **REMEDIATED** |
| **Module 11: System & Ops** | 2 | 0 | 2 | Unblocked |
| **Total** | **38 Core Workflows** | **10 Verified** | **28 Ready** | **0 Blocking Findings** |

### Evaluation Sign-Off
- **QA Lead Signature:** Senior Full-Stack & Systems QA Engineer  
- **Date:** October 26, 2026  
- **Release Decision:** [X] Approved for Staging Demonstration & Integration Testing
