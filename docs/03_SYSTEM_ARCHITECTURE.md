# System Architecture

**Product:** ORIMS  
**Version:** 1.0

## 1. Architecture style

Use a **modular monolith for the main application**, plus one private ML service. The React frontend communicates with the Node.js/Express API. The Node.js application owns identity, permissions, transactional workflows, and the authoritative business rules. MySQL stores the durable business records. Python/FastAPI loads a trained forecasting model and returns demand predictions.

Avoid microservices for the sales, product, purchasing, and inventory domains at this stage: they share transactional boundaries and a small team benefits from a simpler deployment.

## 2. Logical components

### Frontend

- React page and layout components.
- Feature areas: authentication, dashboard, products, inventory, point of sale, sales history, suppliers, purchases, optimization, batches, reports, notifications, users, and settings.
- React Router for navigation, Axios or an equivalent client for API communication, and Recharts for charting.
- Form validation and user-friendly handling of errors and empty states.

### Node.js application API

Organize Express routes by domain. Keep HTTP concerns in routes/controllers and place business rules in service modules. Use a data-access layer through Prisma and controlled transactions for important workflows.

Responsibilities:

- Authenticate and authorize users.
- Validate requests and normalize errors.
- Manage product, inventory, sales, purchase, supplier, batch, report, alert, and audit operations.
- Calculate authoritative sale totals and inventory positions.
- Invoke the ML service when forecast data is needed.
- Apply fallback behavior if prediction is unavailable.
- Store forecasts, recommendations, and operational data in MySQL.

### MySQL

MySQL is the source of truth for products, users, inventory balances, movement ledger, sales, purchases, batches, policies, forecasts, and recommendation records. Transactional operations should use a consistent database transaction strategy. Apply schema migrations through a versioned migration workflow.

### Python ML service

FastAPI exposes a small internal interface. It validates forecast inputs, loads a trusted versioned model artifact, transforms features with the same preprocessing rules used during training, performs inference, and returns predictions with model metadata. It does not authorize retail users, calculate final purchase orders, or modify authoritative inventory.

### Model training process

Training is a separate controlled operation. It extracts an approved historical data snapshot, prepares date-based product features, trains the candidate model, evaluates it on later dates, compares it with a baseline, records metrics, and promotes the model only when review criteria are met. Do not retrain on every prediction request.

## 3. Main data flows

### Sale flow

1. User adds products and quantities in the React POS.
2. Node validates user permissions, product status, input quantities, and the request idempotency key.
3. Within a database transaction, Node obtains safe access to relevant inventory rows, rechecks available stock, obtains trusted prices, calculates totals, writes sales and sale items, reduces stock, appends movements, and records the idempotency result.
4. The transaction commits only if every required write succeeds.
5. The response contains a receipt identifier and authoritative totals.

### Purchase receipt flow

1. Authorized user selects a submitted purchase order and enters received quantities.
2. Node verifies order status, quantity limits, and duplicate receipt protection.
3. Within a transaction, Node records receipt details, increments stock, writes stock movements, and updates the order state.
4. The system recalculates incoming quantities used for inventory position.

### Demand forecast flow

1. Node obtains a cleaned, dated feature set for the product and horizon.
2. Node calls the private ML endpoint with bounded request size and a timeout.
3. Python validates input and returns predicted demand for each target date with model version and inference status.
4. Node validates the response, persists forecast results, and calculates recommendations using current inventory and purchase policy.
5. React displays prediction values and explains recommendation inputs.

## 4. Service boundaries

| Concern | Owner |
|---|---|
| Login, sessions/tokens, application roles | Node.js |
| Product and user CRUD | Node.js + MySQL |
| Sale calculations and transaction integrity | Node.js + MySQL |
| Purchase order and stock receiving | Node.js + MySQL |
| Stock position and reorder business rules | Node.js |
| Forecast model training and inference | Python ML service |
| Forecast/recommendation persistence | Node.js + MySQL |
| Charts and interactive displays | React |

## 5. Resilience and failure behavior

- If Python is unavailable, the main application remains usable for sales, inventory, purchases, and non-ML reports.
- A forecast request shall time out rather than hang indefinitely.
- The service may use a baseline fallback, but the UI must disclose that the result is a fallback and identify its method.
- Stale predictions must be marked with their generation time and model version.
- Repeated operations such as checkout or receiving shall be protected from duplicate execution.
- Database failure during a critical transaction must produce rollback and a safe error response.

## 6. Deployment topology

For development, run frontend, Node.js, MySQL, and Python service locally or via a small container setup. For deployment, place the frontend behind HTTPS, expose only the Node.js API publicly, keep MySQL and the ML service on private networking, and inject service credentials through environment or secret-management configuration.

## 7. Architecture decision records

- **ADR-001: React + Node.js + MySQL.** Selected for the full-stack retail application and shared JavaScript skillset.
- **ADR-002: Separate Python ML service.** Selected to use Python forecasting tools while preserving Node.js as the primary backend.
- **ADR-003: Modular monolith.** Selected because the team is small and retail transactions require clear consistency boundaries.
- **ADR-004: Advisory recommendations.** Selected to keep a human in control of purchase decisions while the ML model is evaluated.
- **ADR-005: Baseline before advanced ML.** Selected to establish measurable model value and prevent unsupported accuracy claims.
