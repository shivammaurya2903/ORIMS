# Product Requirements Document (PRD)

**Product:** Optimised Retail Inventory Management System (ORIMS)  
**Version:** 1.0  
**Status:** Proposed baseline

## 1. Product vision

Provide small and medium-sized retail businesses with a reliable, easy-to-use system that connects inventory, checkout, purchasing, and reporting. Use historical sales to forecast product demand and produce explainable replenishment recommendations, helping managers reduce avoidable stockouts and excess stock.

## 2. Problem statement

Retail inventory is often tracked across manual registers, spreadsheets, and disconnected sales records. These methods make it difficult to know current stock, recognize sales patterns, account for stock already on order, detect expiry risk, and purchase the right quantities at the right time. Poor records can result in lost sales, excess inventory, waste, and avoidable staff effort.

## 3. Target users

- **Administrator:** manages user accounts, permissions, store settings, and system-level configuration.
- **Store manager:** reviews performance, manages products and suppliers, approves purchasing actions, and uses optimization recommendations.
- **Sales staff:** searches products, completes sales, issues receipts, and submits permitted returns.
- **Inventory staff:** receives deliveries, records authorized adjustments, and reviews batches or expiry warnings.

For a small initial deployment, one person may hold more than one role. Permissions must still be enforced by the backend.

## 4. Goals

1. Maintain consistent product and inventory records.
2. Record sales and receiving activities with transaction-safe stock updates.
3. Provide visibility into stock, sales, purchasing, expiry risk, and inventory value.
4. Estimate future demand from historical sales and clearly label estimates as predictions.
5. Recommend replenishment quantities using forecast demand plus business rules.
6. Explain recommendations sufficiently for a manager to review, override, or reject them.
7. Provide auditable records for stock changes and important administrative actions.

## 5. Success measures

The product should be assessed with measurable, verifiable indicators:

- Inventory balance remains consistent with recorded stock movements for tested workflows.
- A completed sale cannot reduce available stock below the allowed minimum or produce a partial stock deduction.
- Receiving a purchase order updates stock once, even if a client retries a request.
- Forecast quality is measured against a simple baseline on a chronological holdout period.
- Forecast accuracy is reported with MAE and WAPE where WAPE is mathematically meaningful; low or zero total actual demand is reported separately.
- Recommendations display the assumptions and inventory figures used to calculate them.
- Restricted actions are rejected by the API when a user lacks permission.
- Core user journeys pass end-to-end tests.

No numerical improvement in waste, stockouts, profit, or forecast accuracy should be claimed until measured using suitable data.

## 6. Product scope

### Included in the initial project

- Authentication and role-based authorization.
- Product catalogue and categories.
- Current stock by product and store, with the first release configured for one store.
- Stock movement ledger and controlled stock adjustments.
- Point-of-sale workflow and sales history.
- Supplier directory and purchase-order lifecycle.
- Receiving of full and partial purchase orders.
- Dashboard and business reports.
- Low-stock, out-of-stock, and batch-expiry alerts.
- Reorder-point calculations and advisory purchase recommendations.
- Python-based demand forecasting service.
- Forecast evaluation against a baseline.
- Audit events for significant operations.

### Potential extensions after the core release

- Multiple stores and inter-store transfers.
- Barcode scanner or camera-based barcode support.
- More sophisticated forecasting models and per-category model selection.
- Budget-aware optimization and supplier comparisons.
- Email notifications, integrations, and automated scheduling.
- Automated purchase-order submission (requires separate approval, safeguards, and explicit scope).

### Out of scope for the initial release

- Full accounting or ERP functionality.
- Payroll, HR, or customer relationship management.
- Payment-card processing infrastructure; initial checkout may record a payment method rather than process card payments.
- Autonomous purchasing without manager approval.
- Guaranteeing ML predictions or claiming business improvement before evaluation.

## 7. Main user journeys

### Journey A: Add inventory

1. Authorized user creates a product and assigns a unique SKU.
2. User creates a purchase order for a supplier.
3. Goods arrive and the user records actual received quantities.
4. The system updates on-hand stock and writes stock movement records in one transaction.
5. The purchase order reflects full, partial, or completed receipt status.

### Journey B: Complete a sale

1. Sales staff searches for products and adds quantities to the cart.
2. The server validates product status, prices, permissions, and availability.
3. The server calculates the authoritative totals.
4. The system saves the sale, sale items, stock changes, and movement records transactionally.
5. The UI shows a receipt and refreshed stock information.

### Journey C: Review a reorder recommendation

1. The manager opens the optimization centre.
2. The application shows predicted demand, current stock, incoming confirmed orders, safety stock, and the calculated inventory position.
3. The system explains why an item has been flagged and suggests a quantity.
4. The manager edits or approves the suggestion.
5. The application creates a draft or submitted purchase order according to permissions and workflow rules.

## 8. Product principles

- Business-critical updates are transaction-safe and auditable.
- The backend, not the browser, is authoritative for prices and stock changes.
- Predictions are distinguishable from actual observations.
- ML recommendations are advisory in the initial release.
- Errors are communicated in understandable terms without exposing secrets or internal stack traces.
- A working, tested end-to-end flow takes priority over decorative or unfinished features.

## 9. Release definition

The first complete release must support the essential journeys above, role-based permissions, reliable stock updates, meaningful reports, and a demonstrable demand-forecast-to-recommendation flow using real or clearly labelled sample data.
