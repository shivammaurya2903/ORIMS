# Implementation Roadmap and Work Allocation

**Team:** 1–2 members  
**Planning estimate:** 8–10 weeks  
**Version:** 1.0

## 1. Delivery approach

Deliver the project in working vertical slices. Establish database conventions, shared API contracts, and a reliable inventory ledger early. Add the forecasting service after the system produces consistent daily sales records. The timeline is an estimate; feature scope should be reduced before critical transaction integrity is compromised.

## 2. Milestones

### Week 1 — Requirements and design

Deliverables:
- Agree on initial scope, user roles, and workflows.
- Finalize the PRD, SRS, architecture, initial database design, and API contracts.
- Sketch dashboard, inventory, POS, purchasing, and optimization pages.
- Create Git repository, issue board, branching conventions, and environment documentation.

Exit check: team agrees on the data model and sale/receipt transaction rules.

### Week 2 — Foundation and security

Deliverables:
- Set up React and Express applications.
- Configure MySQL and versioned migrations.
- Implement authentication, authorization middleware, request validation, structured error handling, and shared UI layout.
- Create seed data for development.

Exit check: a user can sign in and only see/use permitted capabilities.

### Week 3 — Catalogue and inventory

Deliverables:
- Product and category management.
- Inventory balance screen and stock movement history.
- Controlled adjustment workflow.
- Dashboard shell and low-stock rule.

Exit check: authorized stock adjustment updates balance and ledger atomically.

### Weeks 4–5 — Sales and purchasing

Deliverables:
- POS search, cart, server-calculated totals, checkout, and receipt history.
- Suppliers and purchase orders.
- Full and partial receipt workflow.
- Returns or cancellations with compensating records according to documented rules.
- Idempotency and concurrent-stock tests.

Exit check: end-to-end purchase receipt and sale workflows reconcile with stock movements.

### Week 6 — First forecasting service

Deliverables:
- Daily product/store demand dataset and data-quality checks.
- Moving-average baseline.
- Candidate scikit-learn model and chronological evaluation.
- Python/FastAPI inference service and internal request validation.
- Node-to-ML integration and graceful fallback.

Exit check: forecasts are reproducible, labelled by model version, and evaluated against baseline.

### Week 7 — Optimization and reports

Deliverables:
- Reorder points, stock target, and suggested purchase quantities.
- Forecast display and recommendation explanations.
- Sales, inventory valuation, and slow-moving reports.
- Batch/expiry alerts if required for the chosen retail domain.

Exit check: manager can explain and act on a recommendation without manual database edits.

### Week 8 — Integration and hardening

Deliverables:
- End-to-end tests, role and security testing, error states, loading states, and responsive UI review.
- Verify concurrency and retry behavior.
- Improve logs, health checks, and data quality handling.

Exit check: all critical workflows pass in a clean environment.

### Weeks 9–10 — Deployment and presentation

Deliverables:
- Deploy frontend and Node API; host MySQL privately and ML service internally.
- Configure HTTPS, environment variables, backups, and monitoring.
- Complete README and project report materials.
- Prepare realistic demo scenarios and rehearse the end-to-end demonstration.

Exit check: a reviewer can access the deployed application and reproduce the main demo workflow.

## 3. Team allocation

### If there are two members

**Member A — Frontend and integration lead**
- React layouts, routing, forms, tables, charting, responsive behavior, and UI tests.
- API integration and user-facing error handling.
- Dashboard, POS interface, optimization screens, and project demo flow.

**Member B — Backend, database, and ML integration lead**
- Express API, MySQL schema/migrations, Prisma data access, validation, authentication, and permissions.
- Transactional sales/receiving workflows and automated API tests.
- Python/FastAPI forecasting service, evaluation, and recommendation integration.

Both members review contracts and test full workflows. Swap or share ownership based on individual strengths, but assign one accountable owner per module.

### If there is one member

Work sequentially in this order: requirements and database → auth and catalogue → inventory ledger → sales and purchases → ML dataset and service → optimization → reports → security and deployment. Keep multi-store transfers and advanced model experimentation as optional scope.

## 4. Priority labels

- **P0 — Must have:** authentication, products, inventory ledger, sales, purchasing/receiving, MySQL consistency, core dashboard, basic reorder rules.
- **P1 — Target for advanced release:** ML forecast service, model evaluation, advisory recommendations, reports, expiry tracking, audit log.
- **P2 — Stretch:** multi-store transfers, advanced forecasting comparisons, budget-aware optimization, automated notifications, more complex role configuration.

## 5. Definition of done

A feature is done when requirements are clarified, UI/API/database changes are integrated, authorization is checked, validation and error states are implemented, relevant automated tests pass, documentation is updated, and a reviewer can demonstrate the workflow without manual database edits.

## 6. Project board suggestions

Use task states such as Backlog, Ready, In Progress, Review, Testing, and Done. Each task should name one owner, have a verifiable acceptance statement, and identify database/API dependencies. Avoid starting forecasting UI before the feature contract and prediction output shape are agreed.
