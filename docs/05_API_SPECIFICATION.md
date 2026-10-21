# REST API Specification

**API prefix:** `/api/v1`  
**Version:** 1.0

## 1. General conventions

- Use JSON request and response bodies except file downloads.
- Require authentication for all business endpoints except explicitly public health or login routes.
- Enforce authorization in Node.js for every route; hiding a button in React is not authorization.
- Use pagination and sorting on collection endpoints.
- Use consistent error payloads with a stable error code, user-safe message, and request/correlation ID.
- Use ISO 8601 timestamps and document the time-zone convention.
- Use decimal-safe money representation and document whether API amounts are decimal strings or JSON numbers. Avoid lossy currency conversions.
- Treat all data submitted by the browser as untrusted, especially prices, taxes, discounts, stock levels, user roles, and totals.

## 2. Authentication and users

| Method | Endpoint | Purpose | Access |
|---|---|---|---|
| POST | `/auth/login` | Authenticate and establish a session/token | Public with rate limit |
| POST | `/auth/logout` | End the current session or refresh capability | Authenticated |
| GET | `/auth/me` | Return current user's safe profile and roles | Authenticated |
| GET | `/users` | List accounts | Admin |
| POST | `/users` | Create account | Admin |
| GET | `/users/:id` | Get account details | Admin/authorized self where appropriate |
| PATCH | `/users/:id` | Change permitted account fields or status | Admin |

Choose either a secure cookie-based session or a carefully implemented token strategy. Do not create a hybrid that lacks a clear expiry, revocation, and storage policy.

## 3. Catalogue and inventory

| Method | Endpoint | Purpose | Access |
|---|---|---|---|
| GET | `/categories` | List categories | Authenticated |
| POST | `/categories` | Create category | Manager/Admin |
| GET | `/products` | Search and paginate products | Authenticated |
| POST | `/products` | Create product | Manager/Admin |
| GET | `/products/:id` | Product details | Authenticated |
| PUT | `/products/:id` | Update editable product fields | Manager/Admin |
| PATCH | `/products/:id/status` | Activate/deactivate product | Manager/Admin |
| GET | `/inventory` | Filter inventory balances | Authenticated |
| GET | `/inventory/:productId` | Product stock details | Authenticated |
| GET | `/inventory/:productId/movements` | Stock ledger history | Authorized |
| POST | `/inventory/adjustments` | Add controlled stock adjustment | Manager/authorized inventory role |

Suggested query filters include search term, category, store, stock status, page, page size, and sort. The server should enforce maximum page sizes.

## 4. Sales and returns

| Method | Endpoint | Purpose | Access |
|---|---|---|---|
| POST | `/sales` | Complete checkout | Sales/Manager/Admin |
| GET | `/sales` | Search sales by date, receipt, or status | Authorized |
| GET | `/sales/:id` | Sale and receipt details | Authorized |
| POST | `/sales/:id/returns` | Record a return | Manager/authorized sales role |
| GET | `/sales/summary` | Sales summary for a date range | Manager/Admin; staff scope as policy allows |

Checkout should accept product identifiers and quantities, not authoritative line prices or final totals. The API calculates those values from trusted product/policy data. Use an idempotency key and return the same result for a valid retry of the same checkout request.

## 5. Suppliers and purchasing

| Method | Endpoint | Purpose | Access |
|---|---|---|---|
| GET | `/suppliers` | List suppliers | Authorized |
| POST | `/suppliers` | Create supplier | Manager/Admin |
| GET | `/suppliers/:id` | Supplier detail | Authorized |
| PUT | `/suppliers/:id` | Update supplier | Manager/Admin |
| POST | `/purchase-orders` | Create draft order | Manager/Admin |
| GET | `/purchase-orders` | Search orders | Authorized |
| GET | `/purchase-orders/:id` | Order details and receipt status | Authorized |
| POST | `/purchase-orders/:id/submit` | Submit/approve according to policy | Manager/Admin |
| POST | `/purchase-orders/:id/receive` | Record received quantities | Authorized inventory/manager role |
| POST | `/purchase-orders/:id/cancel` | Cancel an eligible order | Manager/Admin |

Receiving requests should identify each order line and the quantity received in this delivery. The backend should calculate cumulative received quantities and reject invalid state transitions or over-receipt unless an explicitly approved exception exists.

## 6. Optimization and reports

| Method | Endpoint | Purpose | Access |
|---|---|---|---|
| GET | `/optimization/recommendations` | List current advisory recommendations | Manager/Admin |
| POST | `/optimization/recalculate` | Trigger a controlled calculation run | Manager/Admin/system job |
| GET | `/optimization/forecasts` | Retrieve saved forecasts by product/store/date | Manager/Admin |
| GET | `/optimization/slow-moving` | List products matching configured rule | Manager/Admin |
| GET | `/optimization/expiry-risk` | List at-risk batches | Manager/Inventory/Admin |
| POST | `/optimization/recommendations/:id/approve` | Approve a recommendation or initiate draft order | Manager/Admin |
| POST | `/optimization/recommendations/:id/reject` | Reject recommendation with optional reason | Manager/Admin |
| GET | `/reports/sales` | Sales report | Authorized |
| GET | `/reports/inventory-valuation` | Inventory valuation report | Manager/Admin |
| GET | `/reports/turnover` | Inventory turnover report | Manager/Admin |
| GET | `/notifications` | List current user's or store's alerts | Authenticated |
| PATCH | `/notifications/:id/read` | Mark notification read | Authorized |

## 7. Internal ML service contract

The Python service is not part of the public browser API. Node.js is its trusted caller.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | Liveness/readiness signal with no sensitive model details |
| POST | `/internal/forecasts` | Return predictions for validated product feature series |
| GET | `/internal/model-info` | Return active model version and safe metadata to an authorized caller |

The request must identify the model-expected feature schema version, products, dates, and relevant feature values. The response must identify every target date, predicted demand, model version, inference status, and any product that required fallback or could not be forecast. Bound batch size and payload size. Authenticate service-to-service calls or restrict them through private networking plus suitable credentials.

## 8. Standard response and error semantics

Use conventional HTTP status codes where applicable:

- `200`: successful read or update.
- `201`: resource created.
- `204`: successful operation with no response body where appropriate.
- `400`: malformed request or invalid field values.
- `401`: authentication required or invalid credentials.
- `403`: authenticated but not permitted.
- `404`: resource not found or not visible to the caller.
- `409`: conflicting state, duplicate idempotency key with mismatched payload, or inventory conflict.
- `422`: semantically invalid business operation if adopted consistently.
- `429`: rate limit exceeded.
- `500`: unexpected server error, without stack traces in client response.
- `503` or a documented degraded status: unavailable required dependency. ML outage should degrade forecasting only, not make checkout unavailable.

## 9. Pagination and filtering

Collection responses should expose the result list and pagination metadata such as page, size, total count where affordable, and next/previous indicators. Define default and maximum page sizes. Validate sort fields against an allowlist rather than passing arbitrary user-controlled column names into queries.

## 10. Contract governance

Maintain an OpenAPI specification for the Node.js API. Treat request/response schemas and status behavior as shared contracts between frontend and backend. Version incompatible changes intentionally and update contract tests when an endpoint changes.
