# Software Requirements Specification (SRS)

**Product:** ORIMS  
**Version:** 1.0

## 1. Purpose

This specification defines the functional behavior, quality requirements, external interfaces, and major constraints for ORIMS. Requirements use identifiers so they can be traced into implementation and tests.

## 2. System context

The system consists of a React web application, a Node.js/Express application API, a MySQL database, and a private Python/FastAPI forecasting service. The main API owns authorization and business transactions. The ML service returns predictions and does not directly mutate authoritative inventory or sales records.

## 3. Functional requirements

### Identity and access

- **FR-AUTH-01:** The system shall authenticate users using securely stored password hashes or a configured secure identity mechanism.
- **FR-AUTH-02:** The system shall enforce permissions on the server for every protected operation.
- **FR-AUTH-03:** The system shall support administrator, manager, sales staff, and inventory staff permissions; role names may be combined for a small demonstration deployment.
- **FR-AUTH-04:** The system shall provide logout and invalidate the applicable session or refresh capability.
- **FR-AUTH-05:** The system shall prevent inactive users from accessing protected operations.

### Product catalogue

- **FR-PROD-01:** Authorized users shall create, view, update, search, filter, and deactivate products.
- **FR-PROD-02:** Each product shall have a unique SKU. A barcode, when supplied, shall be unique.
- **FR-PROD-03:** Product cost and selling prices shall use decimal currency types and be validated as non-negative.
- **FR-PROD-04:** Products may be associated with a category and one or more suppliers.
- **FR-PROD-05:** The system shall retain referenced historical products and transactions; deactivation should be preferred to destructive deletion.

### Inventory

- **FR-INV-01:** The system shall show on-hand, reserved, and available quantity using a documented calculation.
- **FR-INV-02:** Every approved stock increase or decrease shall create a movement record containing quantity delta, reason or movement type, user/system actor, timestamp, and business reference when applicable.
- **FR-INV-03:** Users with permission shall record stock adjustments with a reason.
- **FR-INV-04:** Stock balances shall not become negative through ordinary checkout or receiving workflows.
- **FR-INV-05:** Inventory changes and the associated movement record shall commit or roll back together.
- **FR-INV-06:** The system shall support filtering inventory by stock status and product attributes.

### Sales

- **FR-SALE-01:** Authorized staff shall create a sale containing one or more sale items.
- **FR-SALE-02:** The server shall determine product prices, discounts, applicable tax, and final totals using trusted product and configuration data.
- **FR-SALE-03:** Checkout shall check stock and write sale records and stock movements as one transaction.
- **FR-SALE-04:** The system shall support a retry-safe request identifier or equivalent idempotency mechanism for checkout.
- **FR-SALE-05:** The system shall provide searchable sales history and receipt details.
- **FR-SALE-06:** Returns and cancellations shall follow explicit state transitions and compensating stock movements; historical transactions shall not be silently erased.
- **FR-SALE-07:** Unit cost at the time of sale shall be preserved for historical margin analysis.

### Suppliers and purchasing

- **FR-PUR-01:** Authorized users shall create and maintain supplier records.
- **FR-PUR-02:** The system shall create purchase orders with supplier, store, line items, quantity, and cost.
- **FR-PUR-03:** Purchase orders shall have controlled statuses, such as draft, submitted, partially received, received, and cancelled.
- **FR-PUR-04:** Receiving shall validate received quantities and prevent accidental duplicate receipt processing.
- **FR-PUR-05:** Each accepted receipt shall update inventory and append stock movements transactionally.
- **FR-PUR-06:** Outstanding order quantities shall be included in replenishment calculations only when the order status confirms that the stock is expected.

### Alerts and reports

- **FR-REP-01:** The dashboard shall display sales summary, active product count, inventory value, and stock alerts.
- **FR-REP-02:** Reports shall provide filters for date range and applicable product/store dimensions.
- **FR-REP-03:** Inventory valuation shall identify its valuation basis, such as current unit cost or a specified cost method.
- **FR-ALERT-01:** The system shall identify products at or below configured reorder thresholds.
- **FR-ALERT-02:** The system shall alert users to tracked batches nearing or past expiry.
- **FR-ALERT-03:** Notifications shall have a readable status and should not be recreated repeatedly without an appropriate deduplication policy.

### Optimization and ML

- **FR-ML-01:** The system shall store daily product demand history or generate a consistent daily demand series from transaction data.
- **FR-ML-02:** The forecasting service shall predict product demand for a documented horizon, initially seven days.
- **FR-ML-03:** The ML service shall return model version and forecast metadata alongside predictions.
- **FR-ML-04:** The system shall compare ML forecasts with a baseline using chronological evaluation.
- **FR-ML-05:** The system shall provide a fallback when a product has insufficient history or the ML service is unavailable.
- **FR-ML-06:** The Node.js backend shall combine predicted demand with stock, incoming orders, commitments, safety stock, and supplier constraints to produce advisory recommendations.
- **FR-ML-07:** Each recommendation shall contain an explanation, calculation inputs, generation time, and model version where a forecast was used.
- **FR-ML-08:** No purchase order shall be submitted automatically solely because of an ML prediction in the initial release.

### Audit and settings

- **FR-AUD-01:** Important actions such as adjustments, returns, role changes, and purchase approvals shall produce audit events.
- **FR-SET-01:** Authorized users shall configure store details and replenishment policies.
- **FR-SET-02:** Changes to forecast or inventory policies shall record who changed them and when.

## 4. Non-functional requirements

- **NFR-SEC-01:** Password credentials shall never be stored in plaintext.
- **NFR-SEC-02:** Secrets shall be supplied through environment or secret-management configuration and excluded from version control.
- **NFR-SEC-03:** The ML API shall not be exposed publicly; requests to it shall be authenticated or otherwise restricted to trusted service callers.
- **NFR-SEC-04:** Input validation, rate limits on sensitive endpoints, least-privilege database access, and safe error handling shall be applied.
- **NFR-DATA-01:** MySQL shall enforce appropriate foreign keys, unique constraints, and checks where supported.
- **NFR-DATA-02:** Sales and receiving workflows shall preserve transactional consistency under expected concurrency.
- **NFR-PERF-01:** Common paginated list and dashboard requests should meet a target response time agreed during testing on the selected deployment size; record actual measurements instead of assuming a universal limit.
- **NFR-UX-01:** The application shall work on modern desktop and tablet-sized screens and provide clear loading, empty, success, and error states.
- **NFR-OBS-01:** Services shall emit useful structured logs with request identifiers while avoiding passwords, tokens, and unnecessary personal data.
- **NFR-REC-01:** Database backup and restoration procedures shall be documented and tested before release.
- **NFR-ML-01:** Forecast evaluation shall use chronological splits and report performance against a naive baseline.
- **NFR-MAINT-01:** Database changes shall be versioned through migrations; API contracts and key business rules shall be documented.

## 5. External interfaces

- Browser-to-Node API over HTTPS outside local development.
- Node-to-MySQL connection over a private network where deployed.
- Node-to-Python internal HTTP API with connection and response timeouts.
- Human-readable CSV export for supported reports.
- OpenAPI specification for public application API documentation; internal ML API documentation should remain access-controlled.

## 6. Constraints

- A team of one or two members must implement and maintain the project.
- The first release prioritizes one store while retaining store identifiers in the model where reasonable.
- The forecasting service depends on the quality and quantity of historical sales data.
- The initial ML output is advisory, not a guarantee or autonomous purchase decision.

## 7. Traceability

Use the requirement identifiers in issue titles, test plans, and review checklists. A requirement is complete only when implementation, testing evidence, and relevant documentation are available.
