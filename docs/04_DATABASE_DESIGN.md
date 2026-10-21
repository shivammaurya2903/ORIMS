# Database Design

**Database:** MySQL  
**Version:** 1.0

## 1. Design principles

- Use relational tables with clear primary and foreign keys.
- Use decimal types for money; do not use binary floating-point values for currency.
- Separate current inventory balance from the movement ledger.
- Preserve historical prices and costs on transaction lines.
- Do not destructively delete records that are referenced by completed transactions.
- Use migrations so database evolution is repeatable.
- Store timestamps consistently and define a single UTC/local-time convention.
- Include store identifiers in inventory-related records even if the first user interface operates one store.

## 2. Table catalogue

### Identity and catalogue

**users**
- `id`: primary key.
- `name`, `email`: required identity fields; email unique after a consistent normalization rule.
- `password_hash`: password hash only, never plaintext.
- `role`: allowed role or role mapping.
- `active`, `created_at`, `updated_at`.

**categories**
- `id`, `name` (unique), optional `description`, timestamps.

**products**
- `id`, `sku` (unique), optional unique `barcode`, `name`, optional category reference.
- `cost_price`, `selling_price` as decimal values.
- Optional unit of measure, description, active flag, timestamps.
- For reporting, preserve the product name/SKU or other snapshot information on transaction lines if historical report labels must not change when product details change.

**stores**
- `id`, `name`, optional location label, active flag, timestamps.

### Inventory

**inventory**
- `id`, `store_id`, `product_id`.
- `quantity_on_hand`, `reserved_quantity`, optional version/concurrency field.
- Unique constraint on `(store_id, product_id)`.
- Define available quantity as on-hand minus reservations unless the application adopts another explicitly documented rule.

**stock_movements**
- `id`, `store_id`, `product_id`, movement type, signed quantity delta, reference type and identifier, reason, actor identifier, timestamp.
- Index by product/store/date and by reference.
- Movement rows should be append-only for ordinary application behavior. Correct errors with a compensating movement rather than rewriting history.

**inventory_policies**
- `id`, `store_id`, `product_id`, safety-stock setting, service-level setting, review period, optional min/max level, policy source, timestamps.
- Unique constraint on `(store_id, product_id)`.
- Clearly distinguish manually configured values from calculated values.

**product_batches**
- `id`, `store_id`, `product_id`, batch/lot number, expiry date, quantity on hand, supplier or receipt reference where applicable.
- Define how batch quantity reconciles to total inventory. Batch updates and inventory updates must be part of the same receiving, selling, or adjustment transaction when batch tracking is active.

### Suppliers and purchasing

**suppliers**
- `id`, name, optional email, phone, address and notes, active flag, timestamps.

**supplier_products**
- Supplier ID, product ID, lead time in days, minimum order quantity, pack multiple, current/quoted unit cost, active flag.
- Unique constraint on supplier/product pair when one preferred record per pair is required.

**purchase_orders**
- `id`, supplier ID, store ID, status, order date, expected date, creator, approver, timestamps.
- Define an explicit list of allowed statuses and legal transitions.

**purchase_order_items**
- `id`, purchase order ID, product ID, ordered quantity, received quantity, unit-cost snapshot, optional tax/discount values.
- Validate that quantities are valid and received quantity does not exceed ordered quantity unless an approved exception process exists.

**purchase_receipts** (recommended when recording partial delivery)
- `id`, purchase order ID, receipt reference, received-by user, receipt timestamp, optional supplier delivery reference.

**purchase_receipt_items** (recommended)
- `id`, receipt ID, purchase-order-item ID, product ID, quantity received, unit cost snapshot, optional batch reference.
- This structure makes each partial delivery auditable and protects against repeated receipt processing.

### Sales

**sales**
- `id`, store ID, unique receipt number, status, subtotal, discount, tax, total, payment method/status as appropriate, creator, sale timestamp.
- Add an idempotency key or a separate idempotency-request record with a unique constraint for checkout retries.

**sale_items**
- `id`, sale ID, product ID, quantity, unit-price snapshot, unit-cost snapshot, line discount, tax, line total.
- The sale's final totals must be calculated by the backend. Define rounding and tax rules consistently.

**sale_returns** and **sale_return_items** (recommended for returns)
- Record original sale reference, return reason, actor, return quantities, financial adjustment and restock disposition.
- A return does not always mean stock is saleable; damaged or expired returns may be written off rather than returned to available inventory.

### ML and operations

**forecasts**
- `id`, store ID, product ID, target date, forecast horizon/run ID, predicted demand, model version, generated timestamp, forecast method/status.
- Add an idempotent run identifier and indexes for product/store/target date/model version.

**model_versions**
- Version identifier, model family, artifact version or secure artifact reference, training date range, feature definition version, metric summary, status, created timestamp.
- Do not expose server filesystem paths, secrets, or artifact internals through public APIs.

**forecast_evaluations**
- Forecast reference, actual quantity, evaluated timestamp, error value and evaluation period. Preserve enough context to reproduce model comparisons.

**optimization_recommendations**
- Store/product, calculation timestamp, forecast run, on-hand/incoming/committed quantities used, target stock, proposed quantity, constraints applied, explanation, status, and reviewer.

**notifications**
- Store/product reference when applicable, type, message or structured payload, status, deduplication key, creation and read timestamps.

**audit_logs**
- Actor, action, entity type and ID, timestamp, request/correlation ID, and minimized details needed for review. Avoid recording secrets or unnecessary sensitive content.

## 3. Key relationships

- One category has many products.
- A product and store have one inventory balance row and many movement records.
- A product can be linked to multiple suppliers through the supplier-product relationship.
- A purchase order belongs to a supplier and store, and has many line items and receipts.
- A sale belongs to a store and has many sale items.
- A product may have multiple batches when batch/expiry tracking applies.
- A product/store pair may have one inventory policy and many forecast records.
- Forecasts may support recommendations, but recommendations must retain the inputs used for the calculation.

## 4. Data integrity and transaction rules

1. **Sale:** validate inputs; lock or atomically verify the inventory rows; calculate authoritative amounts; write sale and lines; deduct quantities; append movements; save idempotency result; commit all or none.
2. **Receipt:** validate receipt and status; record received quantities; update batch and inventory quantities as applicable; append movements; update order status; commit all or none.
3. **Adjustment:** require reason and permission; write signed movement and adjust balance in one transaction.
4. **Return:** create a return record and compensating movement only for the restockable quantity.
5. **Forecast:** save a forecast run and its model version. A forecast run must not mutate inventory by itself.

Use database locking or atomic conditional updates appropriate to the selected isolation strategy. An in-memory Node.js check by itself is not sufficient to prevent concurrent overselling.

## 5. Indexing and performance

Consider indexes for:
- Product SKU and barcode unique lookups.
- Inventory `(store_id, product_id)`.
- Movements `(store_id, product_id, created_at)`.
- Sales by `(store_id, sold_at)` and receipt number.
- Sale items by sale and product.
- Purchase orders by store, status, and date.
- Product/store forecast queries by target date and generation run.

Add indexes based on actual query plans and data volumes. Avoid adding redundant indexes without measurement.

## 6. Retention and deletion

Use deactivation for products, suppliers, and users referenced by history. Establish a retention policy for audit events and old forecast runs that satisfies the project needs. Never cascade-delete completed sales, movement history, or receipt records through ordinary catalogue deletion.

## 7. Data dictionary follow-up

Before implementation, finalize exact enum values, decimal precision, tax behavior, units of measure, status transitions, and whether batches are required for every category or only perishable products. Keep those decisions consistent across UI, API, and database validation.
