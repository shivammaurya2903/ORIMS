# Optimised Retail Inventory Management System (ORIMS)

**Documentation pack:** Version 1.0  
**Prepared:** 21 October 2026  
**Project type:** Advanced full-stack college project  
**Team size:** 1–2 members

## Project summary

ORIMS is a retail operations web application for managing products, inventory, sales, suppliers, purchasing, stock movements, expiry tracking, reports, and inventory optimization. It adds a machine-learning demand forecasting capability to help managers make better replenishment decisions.

## Agreed technology stack

- **Frontend:** React.js, JavaScript, React Router, Tailwind CSS, Axios, Recharts.
- **Main backend:** Node.js and Express.js.
- **Database:** MySQL.
- **Database access:** Prisma ORM, with database migrations managed consistently.
- **ML service:** Python and FastAPI.
- **ML framework:** scikit-learn; start with a baseline and evaluate a gradient-boosting regressor.
- **Testing:** Vitest or Jest for frontend logic; Supertest and Node test tooling for APIs; pytest for the Python service.
- **API documentation:** OpenAPI/Swagger.
- **Version control:** Git and GitHub.

The Node.js service remains the primary application backend and owner of business rules. The Python service is an internal service for model inference and model-health information. It does not independently update retail transactions or own the authoritative business database.

## Documents in this pack

| File | Purpose |
|---|---|
| `01_PRODUCT_REQUIREMENTS_DOCUMENT.md` | Product vision, scope, actors, features, and outcomes |
| `02_SOFTWARE_REQUIREMENTS_SPECIFICATION.md` | Functional and non-functional requirements |
| `03_SYSTEM_ARCHITECTURE.md` | Components, data flow, service boundaries, and key decisions |
| `04_DATABASE_DESIGN.md` | Tables, fields, relationships, constraints, and indexing guidance |
| `05_API_SPECIFICATION.md` | REST endpoints, request behavior, errors, and service integration |
| `06_ML_FORECASTING_DESIGN.md` | Forecasting approach, data preparation, evaluation, and recommendations |
| `07_UI_UX_SPECIFICATION.md` | Pages, navigation, interactions, and accessibility guidance |
| `08_SECURITY_AND_PRIVACY.md` | Authentication, authorization, data handling, and threat controls |
| `09_TEST_STRATEGY_AND_ACCEPTANCE.md` | Test levels, scenarios, and release acceptance criteria |
| `10_IMPLEMENTATION_ROADMAP.md` | Milestones, dependencies, priorities, and team allocation |
| `11_DEPLOYMENT_AND_OPERATIONS.md` | Environments, deployment, monitoring, backups, and recovery |
| `12_RISKS_ASSUMPTIONS_AND_DECISIONS.md` | Known risks, assumptions, decisions, and out-of-scope items |
| `13_GLOSSARY_AND_METRICS.md` | Domain terminology and agreed KPI definitions |

## Recommended reading order

1. Product requirements
2. Software requirements
3. System architecture
4. Database design and API specification
5. ML forecasting design
6. UI/UX, security, and test strategy
7. Roadmap, deployment, and risk register

## Scope rule

Build a reliable single-store workflow first: products → stock → sale or purchase receipt → movement ledger → reports. Add ML forecasting after historical sales data is being recorded consistently. Multi-store operations, automatic purchase submission, and sophisticated deep-learning models are future enhancements unless the team finishes the core milestones early.

## Status and change control

These documents are the initial design baseline, not evidence that implementation or testing has already been completed. Update the version and decision log when requirements change. Resolve changes that affect database structure, public APIs, or forecasting features before implementing dependent work.
