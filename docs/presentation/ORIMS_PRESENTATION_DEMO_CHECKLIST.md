# ORIMS Presentation Demo Checklist

**Goal:** Deliver a reliable 90-second manager demo without resetting or corrupting the database.  
**Last verified:** 2026-10-26  
**Environment:** Windows PowerShell 5.1, MySQL, Node.js, Python

---

## 1. Demo success criteria

The demo succeeds if the audience sees:

1. Manager login and dashboard visibility.
2. Inventory with on-hand, reserved, available, and safety stock.
3. A server-calculated POS sale, or an existing sale if checkout is unsafe.
4. The return workflow fields and validation rule.
5. Purchase-order lifecycle and receiving fields.
6. Optimization recommendations, forecast data, and model metadata.
7. A clear statement that the model is benchmarked and recommendations are advisory.

The demo does **not** need to commit a sale, return, receipt, adjustment, or purchase order. Read-only inspection is safer. Commit a transaction only if it was rehearsed and the resulting data is acceptable.

---

## 2. Timing

| Segment | Target |
|---|---:|
| Login and dashboard | 15 sec |
| Inventory and product detail | 15 sec |
| POS and sale | 20 sec |
| Return workflow | 15 sec |
| Purchase-order receiving | 15 sec |
| Optimization and metadata | 20 sec |
| Close and transition | 10 sec |
| **Total** | **1 min 50 sec** |

The spoken script allows 1:30 for demo. If time is tight, skip the return modal or the purchase-order detail, not the optimization provenance statement.

---

## 3. T-24 hours

### 3.1 Verify repository state

Run from `E:\Projects\ORIMS`:

```powershell
git status --short
git log --oneline -3
```

Expected:

- Only presentation-document changes are untracked or modified.
- No application code changes.
- No secrets staged.

### 3.2 Verify safe technical checks

```powershell
python -m pytest ml-service/tests -q
npm run build --workspace=frontend
```

Optional, if time allows:

```powershell
npm run lint --workspace=backend
npm run lint --workspace=frontend
```

Expected:

- ML tests: 12 passed.
- Frontend build: succeeds, with the known large-chunk warning.
- Lint: zero errors; warnings are acceptable for the demo.

**Do not run the backend Vitest suite on demo day.** It targets the configured MySQL database and writes test records.

### 3.3 Confirm the model artifact

```powershell
$m = Get-Content -Raw -LiteralPath "ml-service\models\metadata.json" | ConvertFrom-Json
$m | Select-Object version, model_family, data_provenance, status, trained_at
$m.metrics.test
$m.metrics.baseline_day_of_week
$m.metrics.improvement_over_best_baseline_pct
```

Expected:

- `model_family`: `hist_gradient_boosting`
- `data_provenance`: `M5_BENCHMARK_SAMPLE`
- `status`: `ACTIVE`
- Test MAE: `1.3681`
- Test WAPE: `0.1406`
- Best baseline MAE: `2.6488`
- Improvement: `48.35`

Do not describe these as live-store results.

### 3.4 Prepare demo data through the UI

Confirm or create, using normal application workflows:

- [ ] At least one manager account can sign in.
- [ ] At least one active product has available stock above zero and a low unit price.
- [ ] Dashboard has recent sales or enough seeded history to render.
- [ ] At least one low-stock or expiry-risk item exists, if those panels are to be shown.
- [ ] At least one submitted or partially received purchase order exists with remaining quantity.
- [ ] At least one pending optimization recommendation exists, or recalculation has been tested.
- [ ] Forecast rows exist for at least one product.
- [ ] Notification list has content, if it will be shown.

If data is missing, adapt the demo. Do not reset the database.

### 3.5 Rehearse the fallback

- [ ] Take screenshots of dashboard, inventory, POS cart, return dialog, purchase-order receiving, and optimization.
- [ ] Save the deck as PDF.
- [ ] Confirm screenshots contain no tokens, email addresses, or customer data.
- [ ] Rehearse the spoken fallback: "The live environment is unavailable, so I will use the captured evidence."

---

## 4. T-60 minutes

### 4.1 Check MySQL

```powershell
Get-Service *mysql* | Select-Object Name, Status, StartType
```

Expected: the required MySQL service is `Running`.

If it is stopped, start the known service only if that action has been approved:

```powershell
Start-Service <known-mysql-service-name>
```

Do not reinstall MySQL, change credentials, or reset data.

### 4.2 Start the ML service

Open a dedicated terminal:

```powershell
Set-Location -LiteralPath "E:\Projects\ORIMS\ml-service"
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

Notes:

- Do not use root `npm run dev:ml`; `ml-service/package.json` does not exist.
- The local defaults are intended to match between the ML service and backend.
- Verify that the configured ML API key values match without printing them.
- Do not open or display `.env`.

### 4.3 Start the backend

Open a second terminal:

```powershell
Set-Location -LiteralPath "E:\Projects\ORIMS"
npm run dev --workspace=backend
```

Expected: API listens on `http://localhost:3001`.

### 4.4 Start the frontend

Open a third terminal:

```powershell
Set-Location -LiteralPath "E:\Projects\ORIMS"
npm run dev --workspace=frontend
```

Expected: Vite listens on `http://localhost:5173`.

---

## 5. T-20 minutes: health checks

### 5.1 Backend and database

```powershell
Invoke-RestMethod -Uri "http://localhost:3001/api/v1/health" | ConvertTo-Json -Depth 5
```

Expected: `status: healthy`, `database: connected`, `pool: connected`.

### 5.2 ML service

```powershell
Invoke-RestMethod -Uri "http://localhost:8000/health" | ConvertTo-Json -Depth 5
```

Expected: model loaded and healthy status.

### 5.3 Frontend

```powershell
(Invoke-WebRequest -Uri "http://localhost:5173" -UseBasicParsing).StatusCode
```

Expected: `200`.

### 5.4 Login smoke test

- [ ] Open `http://localhost:5173/login`.
- [ ] Sign in with the seeded manager account.
- [ ] Confirm the dashboard loads.
- [ ] Confirm the user menu shows the manager role.
- [ ] Do not display the password on screen.

If login fails, do not reset the database. Use the fallback evidence.

---

## 6. T-10 minutes: browser preparation

Open these tabs in this order:

1. `http://localhost:5173/dashboard`
2. `http://localhost:5173/inventory`
3. `http://localhost:5173/pos`
4. `http://localhost:5173/sales`
5. `http://localhost:5173/purchase-orders`
6. `http://localhost:5173/optimization`
7. Backup: `http://localhost:5173/reports`
8. Backup: `http://localhost:5173/notifications`

Prepare:

- [ ] Zoom browser to 100-110%; ensure text is readable on the projected display.
- [ ] Close unrelated tabs, messaging apps, and email.
- [ ] Disable OS notifications and automatic updates.
- [ ] Keep only the browser visible during screen sharing.
- [ ] Do not open DevTools, cookies, local storage, or the network panel.
- [ ] Have the fallback screenshots open in a separate window or folder.
- [ ] Keep the presentation script and Q&A pack accessible on a second screen.
- [ ] Keep terminal windows off the shared screen; they are not part of the demo.

### Quick data confirmation before going live

- [ ] Dashboard has cards and tables, not error states.
- [ ] Inventory list has at least one sellable product.
- [ ] POS product search returns results.
- [ ] Sales list has at least one sale.
- [ ] Purchase-order list has a submitted or partially received order.
- [ ] Optimization page has recommendations or forecasts visible.
- [ ] Reports backup page loads.

If a page fails, refresh once. If it still fails, switch to fallback without debugging live.

---

## 7. Live demo path

Use manager role. Keep narration aligned with the slide.

### Step 1 - Login and dashboard (15 sec)

- Sign in as manager.
- Say: "This is the operational view: sales totals, recent sales, low stock, and expiry visibility."
- Do not show credentials or profile details.

### Step 2 - Inventory (15 sec)

- Open Inventory.
- Point to on-hand, reserved, available, and safety stock.
- Open one product detail page.
- Point to movement history.
- Say: "Stock balance and ledger are separate views of the same transaction history."
- Do not submit an adjustment.

### Step 3 - POS and sale (20 sec)

- Open POS.
- Search for the prepared low-value product.
- Add one unit to the cart.
- Point to subtotal, tax, and total.
- Say: "The browser shows an estimate; the server calculates the authoritative price and tax."
- Complete the sale only if this was rehearsed and the stock change is acceptable.
- If skipping checkout, open an existing sale from `/sales` and use it for the next step.

### Step 4 - Return workflow (15 sec)

- Open the sale detail.
- Click Return.
- Show returned quantity, restock quantity, and write-off quantity.
- Say: "The server rejects over-returns and requires restock plus write-off to equal the returned quantity."
- Close the modal without submitting unless the return was prepared.

### Step 5 - Purchase-order receiving (15 sec)

- Open Purchase Orders.
- Point to the status lifecycle.
- Open the prepared submitted or partially received order.
- Open the Receiving tab.
- Show receipt reference, received quantity, and batch fields.
- Say: "Receipt references make replay idempotent; the conditional update protects concurrent receipts."
- Do not submit the receipt unless it was rehearsed.

### Step 6 - Optimization (20 sec)

- Open Optimization.
- Show recommendations and forecast data.
- Point to inventory position, target stock, suggested quantity, and explanation.
- If metadata is visible, point to model version and method.
- Say: "The metric is from an M5 benchmark sample, and the recommendation is advisory; the manager approves."
- Do not approve and create a purchase order unless that was prepared.
- Do not run recalculation unless it was rehearsed and the write is acceptable.

### Step 7 - Close (10 sec)

- Return to the slide deck.
- Say: "That is the controlled-pilot flow. The final slide states what is not yet proven."

---

## 8. Fallback matrix

| Failure | Response | Do not |
|---|---|---|
| Login fails | Use an already authenticated tab; otherwise show screenshots | Reset DB or edit users |
| Backend health fails | Restart backend once, wait, recheck; otherwise fallback | Run migrations or reset |
| MySQL disconnected | Check service; start it only if approved | Reinstall or reset |
| ML service down | Explain labelled moving-average fallback; show stored metadata | Claim live model output |
| No recommendations | Show forecasts/metadata; run recalculation only if rehearsed | Fabricate a recommendation |
| No purchase order in receiving state | Show purchase-order list and state machine only | Create a fake order during demo |
| POS search empty | Open an existing sale; explain server pricing from source | Reset or reseed |
| Frontend blank | Refresh once; restart Vite; otherwise fallback | Debug in front of audience |
| Dashboard charts empty | Move to inventory and optimization | Claim production polish |
| Demo runs long | Skip return modal and PO detail; keep optimization caveat | Skip the benchmark qualifier |

### Spoken fallback

"The live environment is not cooperating, so I will not risk changing data during the presentation. I will use the captured evidence and explain the same flow from the implementation."

---

## 9. Prohibited actions during the demo

Do not run or show:

- `npm run db:reset`
- `npx prisma migrate reset`
- `npm run seed` or any seed command
- Backend Vitest suite
- `docker compose down -v`
- Database restore or drop commands
- Direct SQL updates
- `.env` or secret files
- Browser cookies, local storage, or authorization headers
- Real customer or employee data
- Unprepared destructive writes

Do not:

- Approve a recommendation if it creates an unwanted purchase order.
- Submit a return if the stock change is not acceptable.
- Receive stock into an order that is needed for a later demo.
- Install dependencies or reconfigure services while presenting.

---

## 10. Recovery actions

Use the least invasive action first.

1. **Page error:** refresh once.
2. **Frontend failed:** restart only the Vite terminal.
3. **Backend failed:** restart only the backend terminal; wait for the health endpoint.
4. **ML failed:** continue to show fallback behavior; do not block the demo.
5. **Database failed:** check the service; start it only if pre-approved.
6. **Repeated failure:** switch to screenshots and the architecture slide.
7. **Unexpected data mutation:** stop the demo flow, disclose it, and reconcile after the presentation. Do not attempt an improvised delete.

---

## 11. Post-demo wrap-up

- [ ] Stop any demo transaction that was left open.
- [ ] Note any records created during the demo: sale, return, receipt, adjustment, approval, or purchase order.
- [ ] Do not delete demo records without approval.
- [ ] Close the browser tabs that contain authenticated sessions.
- [ ] Stop the frontend, backend, and ML terminals when finished.
- [ ] Confirm `git status --short` shows only intended documentation changes.
- [ ] Save any screenshots or command output used as evidence.
- [ ] Record follow-up questions from the panel.

### Final evidence summary

| Check | Result |
|---|---|
| ML tests | 12 passed |
| Frontend build | Passed; 801.57 kB chunk warning |
| Backend lint | 0 errors, 2 warnings |
| Frontend lint | 0 errors, 29 warnings |
| Backend suite | Reported 54/54; not run during demo preparation |
| Model provenance | `M5_BENCHMARK_SAMPLE` |
| Demo mode | Read-only preferred; no database reset |

---

## 12. Last-minute one-page checklist

- [ ] MySQL running.
- [ ] ML service on port 8000.
- [ ] Backend on port 3001 and healthy.
- [ ] Frontend on port 5173.
- [ ] Manager session active.
- [ ] Six demo tabs open and loaded.
- [ ] Fallback screenshots ready.
- [ ] Notifications muted.
- [ ] Script and Q&A visible on second screen.
- [ ] No `.env`, cookies, tokens, or terminals on the shared screen.
- [ ] ML metric qualifier memorised: "M5 benchmark sample, not live store data."
- [ ] Backend test qualifier memorised: "reported 54/54, not freshly rerun."
- [ ] Safe close prepared: "controlled single-store pilot, not production rollout."
