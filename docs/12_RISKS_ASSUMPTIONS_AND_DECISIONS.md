# Risks, Assumptions, and Architecture Decisions

**Product:** ORIMS  
**Version:** 1.0

## 1. Assumptions

- The initial deployment models a single store in the user experience.
- Product SKUs are unique and stock is measured in a defined base unit for each product.
- Historical sales can be aggregated by product and business date.
- Suppliers can have product-specific lead times and minimum order constraints.
- Managers review purchase recommendations before the system creates/submits an order.
- Sample data may be needed for the college demonstration; it will be labelled and will not be presented as real business evidence.
- ML training and inference run as separate operations from the main Node.js application.

## 2. Risks and mitigation

| ID | Risk | Impact | Mitigation |
|---|---|---|---|
| R-01 | Insufficient sales history | Low-quality or unavailable forecasts | Build baseline fallback, show insufficient-history state, use sample data only for demonstrations, do not claim accuracy without evaluation |
| R-02 | Stockouts distort sales history | Model underestimates true demand | Record availability/stockout periods, flag constrained observations, document target interpretation |
| R-03 | Concurrent checkout causes overselling | Inventory and financial errors | Use transactional row locking or atomic conditional updates; test concurrent checkout |
| R-04 | Duplicate request after timeout | Duplicate sale or stock receipt | Use idempotency keys and unique request records |
| R-05 | Stock ledger and balance diverge | Untrustworthy reports | Update together transactionally and reconcile through controlled checks |
| R-06 | ML service is unavailable | Forecast views fail | Timeouts, health monitoring, baseline fallback, preserve core operations |
| R-07 | Model artifact/dependency mismatch | Inference failure or changed output | Pin dependencies, version artifacts and features, smoke-test deployment, retain rollback version |
| R-08 | Scope expands too far for team size | Unfinished or unreliable project | Prioritize P0 features; mark multi-store and advanced modeling as stretch goals |
| R-09 | Authentication misconfiguration | Unauthorized access | Server-side permission checks, secure session strategy, rate limits, negative authorization tests |
| R-10 | Expiry/batch quantity reconciliation fails | Waste or incorrect stock | Define batch-to-total-stock invariants and test sale, receipt, return, and write-off flows |
| R-11 | Synthetic data looks unrealistically clean | Misleading demo/model evaluation | Include stockouts, zero sales, seasonality, partial receipts, returns, and edge cases; label synthetic data |
| R-12 | Unclear tax/return rules | Incorrect totals and reports | Document business rules and jurisdiction-specific assumptions before checkout implementation |

## 3. Open decisions to finalize

1. **Authentication:** secure cookie-based sessions or a token strategy? Choose one and document expiry, revocation, and storage.
2. **Store support:** database designed for store IDs; first UI supports one store or basic multi-store operation?
3. **Tax behavior:** configurable tax rates and rounding rules for the project's demonstration jurisdiction.
4. **Payment scope:** record payment method/status only or integrate an actual payment provider? Initial release recommends recording only.
5. **Returns:** which roles can approve returns, and when returned items are eligible for restocking?
6. **Inventory valuation:** use current cost, moving weighted average, or another stated basis for reports? Avoid implying formal accounting accuracy without a defined method.
7. **Batch scope:** require batches for all products or only expiry-controlled products?
8. **Forecast cadence:** manual manager action initially or scheduled updates?
9. **Forecast training threshold:** define a minimum amount of valid history before selecting a product-specific model; otherwise use fallback.
10. **Deployment target:** choose a platform based on budget, private service networking, and access to managed MySQL.

## 4. Decision log

### ADR-001 — Main technology stack

**Decision:** React.js frontend, Node.js/Express main backend, MySQL database.  
**Reason:** consistent with the desired JavaScript full-stack development and relational retail data.

### ADR-002 — Separate ML service

**Decision:** Python/FastAPI service with scikit-learn for training and inference.  
**Reason:** use Python ML tooling while keeping Node.js responsible for main API and business logic.

### ADR-003 — Modular monolith

**Decision:** keep product, inventory, sales, purchasing, and reports in one Node.js application.  
**Reason:** lower operational complexity for a one- or two-person team and easier transaction boundaries.

### ADR-004 — Advisory ML recommendations

**Decision:** ML produces forecasts; Node.js applies inventory rules; a manager approves purchasing action.  
**Reason:** predictions are uncertain and should not cause automatic financial commitments in the initial release.

### ADR-005 — Baseline evaluation

**Decision:** compare every candidate forecasting approach with a simple baseline on chronological holdout data.  
**Reason:** establish evidence of value and prevent misleading claims about model accuracy.

## 5. Change management

When a decision changes, update this file and all affected requirements, architecture, API, database, test, and deployment documents. Record the date, reason, and impact. Prioritize consistency across docs over preserving old assumptions.
