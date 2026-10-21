# Test Strategy and Acceptance Criteria

**Product:** ORIMS  
**Version:** 1.0

## 1. Testing objectives

Verify that business operations are correct, inventory cannot silently diverge, access control is enforced, APIs and screens integrate, and forecasts are evaluated honestly. Tests should be repeatable with a disposable test database and deterministic sample data.

## 2. Test levels

### Unit tests

- Product and quantity validation.
- Reorder point and inventory-position calculations.
- Purchase quantity adjustments for pack-size and minimum-order rules.
- Sales totals, discounts, rounding, and tax policy.
- Purchase-order state transitions.
- Forecast feature transformations and metric calculations.

### API/integration tests

- Authentication and permission enforcement.
- Product CRUD and duplicate SKU handling.
- Checkout writes sale, sale items, inventory changes, and movements consistently.
- Failed checkout rolls back all related writes.
- Duplicate checkout requests do not duplicate sales.
- Purchase receipts update balances and receipt history exactly once.
- Partial receipts leave remaining quantities and order status correct.
- Unauthorized roles cannot adjust stock or approve purchases.
- ML timeout or unavailable service does not prevent unrelated inventory/sales flows.

### Frontend tests

- Page and route navigation.
- Form validation and error display.
- Search, filtering, pagination, and empty states.
- Checkout submission, success receipt, and conflict handling.
- Forecast visual distinction between actual and predicted data.
- Fallback and insufficient-history states.

### End-to-end tests

1. Admin signs in and adds a product.
2. Manager creates a supplier and purchase order.
3. Inventory staff receives stock and sees the balance and movement ledger updated.
4. Sales staff sells part of the stock and receives a receipt.
5. Dashboard sales and inventory figures update correctly.
6. Forecasting runs and produces a saved forecast when valid history exists.
7. Manager reviews a recommendation and creates a draft or approved purchase order.
8. A user without permission attempts a restricted operation and is denied.

### ML evaluation tests

- Compare the candidate model with a defined baseline.
- Use chronological train/validation/test windows.
- Check for future-data leakage.
- Test missing dates, zero sales, stockouts, returns, new products, and insufficient history.
- Measure MAE and WAPE and report when the metric denominator makes WAPE uninformative.
- Verify that saved model version and feature schema match the inference service.
- Verify fallback behavior when the model cannot load or the service times out.

## 3. Critical test scenarios

### Concurrency and consistency

- Two checkout requests compete for the last units of a product.
- A duplicate checkout is sent after a network timeout.
- A purchase receipt is retried by the user.
- Two receiving operations attempt to update the same order line.
- A transaction fails after writing one record and must roll back all related records.

Expected result: no overselling, no duplicate completed transaction, no orphan movement record, and no balance/ledger inconsistency.

### Money and quantities

- Zero or negative quantities.
- Quantities exceeding available stock.
- Invalid negative prices.
- Large values, rounding edges, discounts, tax calculations, and returns.
- Product deactivation while historical references exist.

### ML behavior

- Forecast service returns valid predictions and metadata.
- Service returns an invalid schema and Node rejects it safely.
- Service is unavailable and baseline fallback is clearly labelled.
- Product history is insufficient and no fabricated forecast is displayed.
- An incoming order changes the inventory position and recommendation as expected.
- The user can see the reason for the proposed order quantity.

## 4. Suggested tools

- Frontend: Vitest or Jest and React Testing Library.
- Node API: Node test runner or Jest/Vitest, Supertest, and a test database.
- Python service: pytest and FastAPI test client.
- API contract: OpenAPI validation and integration tests.
- Manual UI checks: current browsers and desktop/tablet widths.

Choose the smallest tool set the team can maintain; do not add multiple overlapping test frameworks without a reason.

## 5. Acceptance criteria

A release is acceptable when:

- Required routes are accessible to the intended roles and protected from unauthorized access.
- Product, supplier, sales, purchasing, and inventory workflows complete without manual database intervention.
- Sale and receipt records are transactionally consistent with inventory and movements.
- Checkout and receipt retries do not duplicate effects.
- Low-stock and expiry warnings follow documented rules.
- Forecast output includes model version, horizon, generation time, and a fallback/insufficient-data state where relevant.
- ML candidate results are evaluated against a baseline on a chronological holdout set.
- Recommendation quantities can be reproduced from the recorded inputs and policy.
- Key tests pass in a clean environment.
- Setup, environment variables, migrations, deployment, backup, and recovery instructions are documented.

## 6. Test data principles

Use clearly labelled sample data or anonymized authorized data. Include fast- and slow-moving products, no-sale dates, stockouts, variable lead times, partial receipts, returns, expiry batches, and permission variations. Do not represent fabricated test metrics as measured business performance.
