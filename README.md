# ORIMS — Optimised Retail Inventory Management System

A full-stack retail operations platform for products, inventory, sales, purchasing, reporting, and ML-assisted demand forecasting.

![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-339933?logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![Express](https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-8-4479A1?logo=mysql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-5-2D3748?logo=prisma&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)
![scikit-learn](https://img.shields.io/badge/scikit--learn-1.5-F7931E?logo=scikit-learn&logoColor=white)
![Backend tests](https://img.shields.io/badge/backend%20tests-41%20passing-brightgreen)
![ML tests](https://img.shields.io/badge/ML%20tests-7%20passing-brightgreen)

## Overview

ORIMS is a single-store retail management system with a separate machine-learning service for demand forecasting and replenishment recommendations. It is designed around a reliable transactional core:

**products → stock → sale or purchase receipt → movement ledger → reports → advisory forecast**

The Node.js API owns authentication, business rules, inventory changes, pricing, and transaction integrity. The Python service is a private inference service only; it does not write business transactions or own the authoritative database.

The project is currently verified for a **controlled pilot / single-store demo** environment. See the [release-readiness audit](docs/audit/ORIMS_FINAL_RELEASE_READINESS_AUDIT.md) for the latest verification evidence.

## Key capabilities

| Area | Capabilities |
| :--- | :--- |
| **Authentication & access** | JWT access and refresh tokens, httpOnly cookies or Bearer headers, bcrypt password hashing, inactive-user blocking, server-side RBAC for `ADMIN`, `MANAGER`, `SALES_STAFF`, and `INVENTORY_STAFF` |
| **Catalogue** | Product and category CRUD, SKU and barcode uniqueness, pricing, activation/deactivation, search, filtering, and pagination |
| **Inventory** | On-hand, reserved, and available stock, append-only movement ledger, controlled adjustments with required reasons, negative-stock prevention, batch and expiry tracking |
| **Sales & POS** | Fast product search, multi-item checkout, server-calculated totals and tax, idempotent transactions, concurrency-safe stock deduction, receipt history, returns with restock or write-off |
| **Purchasing** | Supplier directory, supplier-product terms, purchase orders, approval lifecycle, partial/full receiving, batch creation, duplicate-receipt prevention |
| **ML optimization** | Demand forecasts, inventory position and reorder calculations, safety stock and service-level policies, slower-moving and expiry-risk analysis, manager-reviewed recommendations that can be converted into purchase orders |
| **Reporting** | Sales KPIs and trends, inventory valuation, turnover, stock movements, expiry risk, dashboard summaries, and Recharts visualizations |
| **Operations** | Notification centre with deduplication, store settings, audit logging, health checks, rate limiting, Helmet, and request validation |
| **Resilience** | ML service failure falls back to a clearly labelled moving-average or day-of-week baseline; recommendations are advisory, never automatic |

## Architecture

```mermaid
flowchart LR
    USER[Admin / Manager / Staff] --> FE[React 18 + Vite<br/>Tailwind CSS + Recharts]
    FE -->|REST / JSON / JWT| API[Node.js + Express<br/>Auth, RBAC, Validation, Business Rules]
    API --> DB[(MySQL 8<br/>Prisma ORM)]
    API --> OPT[Optimization Engine<br/>Forecasts + Reorder Logic]
    OPT -->|Private request / X-API-Key| ML[Python + FastAPI<br/>scikit-learn Inference]
    ML --> ART[model.joblib<br/>metadata.json]
    OPT --> DB
```

**Boundaries**

- React is the presentation layer and never connects directly to MySQL or the ML service.
- Node.js/Express remains the source of truth for all retail transactions and business rules.
- MySQL stores products, stock, sales, purchasing, forecasts, recommendations, notifications, and audit events.
- FastAPI runs on a private boundary and returns predictions plus model metadata.
- Stock balances and movement records are written atomically in the same transaction.
- Forecasting is separated from training; models are versioned artifacts, not trained per request.

## Technology stack

| Layer | Technology |
| :--- | :--- |
| Frontend | React 18, Vite 5, React Router 6, Tailwind CSS 3, Axios, Recharts |
| Backend | Node.js 20+, Express 4, Prisma 5, mysql2, Zod, JWT, bcryptjs |
| Database | MySQL 8 (24 Prisma models, versioned migrations) |
| ML service | Python 3.10+ (tested on 3.13), FastAPI, scikit-learn, pandas, NumPy, joblib |
| Testing | Vitest + Supertest-style integration tests, pytest |
| Tooling | ESLint, Docker Compose scaffold, Git |

## Repository structure

```text
ORIMS/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma        # 24 models and enums
│   │   ├── migrations/          # Versioned SQL migrations
│   │   └── seed.js              # Idempotent development seed
│   ├── src/
│   │   ├── routes/              # Auth, products, inventory, sales, purchasing, reports, optimization, settings
│   │   ├── validators/          # Request validation schemas
│   │   ├── middleware/          # Authentication, RBAC, error handling
│   │   └── scripts/             # Database verification
│   └── tests/                   # 41 integration and routing tests
├── frontend/
│   └── src/
│       ├── pages/               # Dashboard, POS, inventory, products, purchases, reports, optimization, settings
│       ├── components/          # Shared application layout
│       ├── context/             # Authentication state
│       └── services/            # Axios client with token refresh
├── ml-service/
│   ├── main.py                  # FastAPI inference service
│   ├── train.py                 # Chronological training and baseline benchmarking
│   ├── features.py              # Leakage-safe feature engineering
│   ├── m5_data.py               # M5 dataset loader and deterministic fallback fixture
│   ├── models/                  # Generated model artifact and metadata
│   └── tests/                   # 7 pytest service tests
├── docs/                        # Requirements, architecture, API, security, test, deployment, audit documents
├── docker-compose.yml           # Optional container orchestration scaffold
├── mysql_init.sql               # Development MySQL user bootstrap
└── package.json                 # Workspace scripts
```

## Getting started

### Prerequisites

- **Node.js** 20 or newer and **npm** 9+
- **MySQL** 8.0 or newer, running locally
- **Python** 3.10 or newer
- **Git**

Docker is optional. The current verified path is native local execution.

### 1. Install dependencies

From the repository root:

```bash
npm install
```

### 2. Configure environment variables

Create local environment files from the provided examples.

Windows PowerShell:

```powershell
Copy-Item backend\.env.example backend\.env
Copy-Item frontend\.env.example frontend\.env
```

macOS/Linux:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Edit `backend/.env` and set your MySQL credentials, JWT secrets, and ML service key. Keep `ML_SERVICE_API_KEY` and the ML service's `ML_API_KEY` identical.

### 3. Create the database and run migrations

Create the schema in MySQL if it does not already exist:

```sql
CREATE DATABASE IF NOT EXISTS orims
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

Then apply migrations and seed development data:

```bash
npm run db:migrate
npm run db:seed
```

Verify connectivity:

```bash
npm run db:verify --workspace=backend
```

> `npm run db:reset` resets the schema and reseeds it. This deletes existing data.

### 4. Set up and start the ML service

In a separate terminal:

```bash
cd ml-service
python -m venv .venv
```

Activate the virtual environment:

```powershell
# Windows PowerShell
.\.venv\Scripts\Activate.ps1
```

```bash
# macOS/Linux
source .venv/bin/activate
```

Install dependencies and start the service:

```bash
pip install -r requirements.txt
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The repository includes a trained model artifact. To regenerate it from the bundled M5 benchmark sample:

```bash
python train.py
```

For a full dataset, place the M5 files in `ml-service/data/` or configure Kaggle access; otherwise the loader uses a deterministic benchmark fixture.

### 5. Start the backend and frontend

From the repository root, in separate terminals:

```bash
npm run dev:backend
```

```bash
npm run dev:frontend
```

Open **http://localhost:5173**. The public landing page is served at `/`; sign in at `/login`.

| Service | Default URL |
| :--- | :--- |
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:3001/api/v1 |
| ML service | http://localhost:8000 |
| ML OpenAPI docs | http://localhost:8000/docs |
| MySQL | 127.0.0.1:3306 |

### Optional: Docker Compose

`docker-compose.yml` is included as an orchestration scaffold for MySQL, the backend, frontend, and ML service. It has not been validated in this environment and currently expects container build files that are not all present in the repository. Use the native setup above for the verified workflow.

## Environment configuration

### Backend (`backend/.env`)

| Variable | Purpose | Default / example |
| :--- | :--- | :--- |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | MySQL connection and diagnostics pool | `127.0.0.1`, `3306`, `root`, secret, `orims` |
| `DATABASE_URL` | Prisma MySQL connection string | `mysql://root:password@127.0.0.1:3306/orims` |
| `NODE_ENV` | Runtime mode | `development` |
| `PORT` | API port | `3001` |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Token signing secrets | Change in every non-local environment |
| `JWT_ACCESS_EXPIRY`, `JWT_REFRESH_EXPIRY` | Token lifetimes | `15m`, `7d` |
| `CORS_ORIGIN` | Allowed browser origin | `http://localhost:5173` |
| `ML_SERVICE_URL` | FastAPI base URL | `http://localhost:8000` |
| `ML_SERVICE_API_KEY` | Shared ML service API key | Must match `ML_API_KEY` |
| `TAX_RATE` | Default sales tax rate | `0.10` |
| `LOG_LEVEL` | Application log level | `debug` |

### Frontend (`frontend/.env`)

| Variable | Purpose | Default |
| :--- | :--- | :--- |
| `VITE_API_URL` | API base URL; Vite proxies `/api` to the backend in development | `/api/v1` |
| `VITE_SHOW_DEMO_CREDENTIALS` | Shows seeded demo accounts on the login screen | `true` |

### ML service

| Variable | Purpose | Default |
| :--- | :--- | :--- |
| `ML_API_KEY` | Required `X-API-Key` for internal endpoints | `dev-ml-api-key` |
| `MODEL_PATH` | Directory containing `model.joblib` and `metadata.json` | `ml-service/models` |
| `MODEL_VERSION` | Override model version label | value in metadata |
| `PYTHON_ENV` | Runtime environment label | `development` |
| `PORT` | Uvicorn port | `8000` |

## Demo accounts

The seed script creates four development users. All use the password **`password123`**.

| Role | Email |
| :--- | :--- |
| Admin | `admin@orims.local` |
| Manager | `manager@orims.local` |
| Sales staff | `sales@orims.local` |
| Inventory staff | `inventory@orims.local` |

**Security warning:** these accounts are for local development only. Change or remove them, set strong JWT secrets, disable `VITE_SHOW_DEMO_CREDENTIALS`, and rotate the ML API key before exposing ORIMS to any shared or production environment.

## Available scripts

Run these from the repository root.

| Command | Description |
| :--- | :--- |
| `npm run dev:backend` | Start the Express API with Node watch mode |
| `npm run dev:frontend` | Start the Vite development server |
| `npm run build` | Build the frontend production bundle |
| `npm run lint` | Lint backend and frontend workspaces |
| `npm test` | Run backend workspace tests |
| `npm run db:migrate` | Apply Prisma development migrations |
| `npm run db:seed` | Seed development data |
| `npm run db:reset` | Reset the database and reseed |
| `npm run db:verify --workspace=backend` | Verify MySQL connectivity |
| `npm run db:generate --workspace=backend` | Regenerate the Prisma client |
| `npm run db:studio --workspace=backend` | Open Prisma Studio |
| `npm run test --workspace=backend` | Run backend Vitest suites |
| `npm run test:watch --workspace=backend` | Run backend tests in watch mode |
| `npm run lint --workspace=backend` | Lint backend source |
| `npm run lint --workspace=frontend` | Lint frontend source |
| `npm run build --workspace=frontend` | Build the frontend only |

ML service commands:

```bash
python ml-service/train.py
python -m pytest ml-service/tests -q
```

## API overview

Base URL: **`/api/v1`**

Authentication is accepted as an `Authorization: Bearer <token>` header or an httpOnly cookie. Protected endpoints require a valid access token. Role restrictions are enforced server-side.

| Resource | Main endpoints |
| :--- | :--- |
| Health | `GET /health`, `GET /health/ready`, `GET /health/db` |
| Auth | `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me` |
| Users | `GET/POST /users`, `GET/PATCH /users/:id` (admin only) |
| Categories | `GET/POST /categories`, `GET/PUT /categories/:id` |
| Products | `GET/POST /products`, `GET/PUT /products/:id`, `PATCH /products/:id/status` |
| Inventory | `GET /inventory`, `GET /inventory/:productId`, `GET /inventory/:productId/movements`, `POST /inventory/adjustments` |
| Sales | `POST /sales`, `GET /sales`, `GET /sales/summary`, `GET /sales/:id`, `POST /sales/:id/returns` |
| Suppliers | `GET/POST /suppliers`, `GET/PUT /suppliers/:id`, supplier-product mapping endpoints |
| Purchase orders | `GET/POST /purchase-orders`, `GET /purchase-orders/:id`, submit, receive, and cancel actions |
| Optimization | Recommendations, approve/reject actions, recalculate, forecasts, slow-moving, expiry-risk, model info |
| Reports | Sales, inventory valuation, turnover, stock movements, expiry risk |
| Notifications | `GET /notifications`, mark one or all as read |
| Settings | Store settings and inventory policies |

See [`docs/05_API_SPECIFICATION.md`](docs/05_API_SPECIFICATION.md) for request and response detail.

## ML forecasting service

The ML service exposes three endpoints:

| Endpoint | Auth | Purpose |
| :--- | :--- | :--- |
| `GET /health` | Public | Service and model status |
| `GET /internal/model-info` | `X-API-Key` | Model version, provenance, training dates, feature schema, and metrics |
| `POST /internal/forecasts` | `X-API-Key` | Multi-product, multi-horizon demand forecasts (1–14 days) |

**Model approach**

- `HistGradientBoostingRegressor` with 19 leakage-safe features: lags (1, 7, 14, 28), rolling statistics, calendar signals, prices, stock, safety stock, incoming quantity, and supplier lead time.
- Chronological train/validation/test splits by date, with comparisons against moving-average and day-of-week naive baselines.
- Multi-step autoregressive rollout for horizons beyond one day.
- Baseline fallback when the model is unavailable or history is insufficient.

**Latest bundled model metrics** (`M5_BENCHMARK_SAMPLE` provenance, 1,700 test samples):

| Metric | Model | Best baseline |
| :--- | ---: | ---: |
| MAE | 1.37 | 2.65 |
| WAPE | 14.06% | 27.22% |
| Improvement over best baseline | **48.35%** | — |

The bundled artifact is trained on an M5 benchmark sample, not on live store transactions. Retrain with at least 90 days of real sales history before making production forecasting claims.

## Testing and quality

The verified local baseline includes:

```bash
npm run lint
npm test
npm run build
python -m pytest ml-service/tests -q
npm run db:verify --workspace=backend
```

Current evidence from the release audit:

- Backend: **41/41 Vitest tests passing** across 9 suites, including concurrency, idempotency, returns, receiving, RBAC, reports, and ML fallback.
- ML service: **7/7 pytest tests passing**.
- Frontend: production Vite build succeeds.
- Lint: backend clean; frontend has warnings but no errors.
- Database: MySQL 8 connectivity and idempotent seeding verified.
- Security: no tracked secrets; `.env` files are ignored.

## Documentation

| Document | Purpose |
| :--- | :--- |
| [`01_PRODUCT_REQUIREMENTS_DOCUMENT.md`](docs/01_PRODUCT_REQUIREMENTS_DOCUMENT.md) | Product vision, scope, actors, and outcomes |
| [`02_SOFTWARE_REQUIREMENTS_SPECIFICATION.md`](docs/02_SOFTWARE_REQUIREMENTS_SPECIFICATION.md) | Functional and non-functional requirements |
| [`03_SYSTEM_ARCHITECTURE.md`](docs/03_SYSTEM_ARCHITECTURE.md) | Components, data flow, and service boundaries |
| [`04_DATABASE_DESIGN.md`](docs/04_DATABASE_DESIGN.md) | Tables, relationships, constraints, and indexes |
| [`05_API_SPECIFICATION.md`](docs/05_API_SPECIFICATION.md) | REST endpoints, errors, and integration behavior |
| [`06_ML_FORECASTING_DESIGN.md`](docs/06_ML_FORECASTING_DESIGN.md) | Forecasting approach, evaluation, and recommendations |
| [`07_UI_UX_SPECIFICATION.md`](docs/07_UI_UX_SPECIFICATION.md) | Pages, navigation, and accessibility guidance |
| [`08_SECURITY_AND_PRIVACY.md`](docs/08_SECURITY_AND_PRIVACY.md) | Authentication, authorization, and threat controls |
| [`09_TEST_STRATEGY_AND_ACCEPTANCE.md`](docs/09_TEST_STRATEGY_AND_ACCEPTANCE.md) | Test levels, scenarios, and release criteria |
| [`10_IMPLEMENTATION_ROADMAP.md`](docs/10_IMPLEMENTATION_ROADMAP.md) | Milestones and dependencies |
| [`11_DEPLOYMENT_AND_OPERATIONS.md`](docs/11_DEPLOYMENT_AND_OPERATIONS.md) | Environments, deployment, monitoring, and recovery |
| [`12_RISKS_ASSUMPTIONS_AND_DECISIONS.md`](docs/12_RISKS_ASSUMPTIONS_AND_DECISIONS.md) | Risks, assumptions, decisions, and out-of-scope items |
| [`13_GLOSSARY_AND_METRICS.md`](docs/13_GLOSSARY_AND_METRICS.md) | Domain terminology and KPI definitions |
| [`ORIMS_ARCHITECTURE_DIAGRAM.md`](docs/ORIMS_ARCHITECTURE_DIAGRAM.md) | Detailed architecture and sequence diagrams |
| [`docs/audit/`](docs/audit/) | Release-readiness and remediation reports |

## Security notes

- Passwords are stored with bcrypt; plaintext passwords are never persisted.
- JWTs are short-lived and refreshable; logout increments a token version to invalidate sessions.
- Role checks are enforced on the server, not only hidden in the UI.
- Sales totals, discounts, and tax are calculated server-side.
- Checkout uses idempotency keys and database transactions to prevent duplicate sales and overselling.
- Inventory balances and stock movements are updated atomically.
- Helmet, CORS restrictions, rate limiting, request validation, and centralized error handling are enabled.
- The ML service is protected by a shared API key and is intended to remain on a private network.
- `.env` files, model artifacts, and local databases are excluded from Git.
- Audit logging records business-critical actions.

## Status and limitations

- The system is validated for a **single-store pilot/demo**, not multi-tenant production use.
- The database schema supports multiple stores, but the current workflow is single-store focused.
- ML recommendations are advisory; a manager must approve them before an order is created.
- The bundled model is trained on M5 benchmark data, not empirical ORIMS transaction history.
- Docker Compose is scaffolded but not part of the verified local setup.
- No open-source license file is currently included; treat the repository as an academic project unless a license is added.

## Roadmap

1. Retrain the forecasting model with real sales history and add automated retraining/monitoring.
2. Complete and validate a production-ready container and deployment pipeline.
3. Strengthen the API contract with generated OpenAPI documentation for the Express service.
4. Add deeper end-to-end browser tests for POS and purchasing workflows.
5. Add multi-store views, transfers, and store-scoped reporting.
6. Improve forecasting evaluation tracking and drift detection in the Optimization Centre.

## Contributing

1. Create a feature branch.
2. Keep changes scoped and follow the existing service boundaries.
3. Update the relevant document in `docs/` when behavior or requirements change.
4. Run linting, backend tests, ML tests, and the frontend build before opening a pull request.
5. Never commit `.env` files, credentials, or generated model artifacts that contain sensitive data.

---

**Project:** Optimised Retail Inventory Management System (ORIMS)  
**Version:** 1.0  
**Documentation baseline:** October 2026  
**Release target:** Controlled pilot / single-store demo
