# Glossary and KPI Definitions

**Product:** ORIMS  
**Version:** 1.0

## 1. Glossary

- **SKU:** Stock Keeping Unit; a unique identifier assigned to a product variant.
- **On-hand quantity:** Quantity physically recorded as present in inventory.
- **Reserved quantity:** Stock committed to a defined business need and not available for ordinary allocation.
- **Available quantity:** Quantity on hand minus reservations, using the project's chosen reservation rule.
- **Incoming quantity:** Expected quantity on confirmed, not-yet-received purchase orders. Cancelled or draft orders should not normally count.
- **Inventory position:** A planning quantity that combines on-hand stock, eligible incoming supply, and applicable commitments/backorders. Define signs and commitment rules consistently.
- **Stock movement:** An auditable record of a quantity increase or decrease.
- **Lead time:** Time between placing an order and receiving stock, measured in the units used by the replenishment model.
- **Safety stock:** Buffer inventory intended to reduce the risk of running out during demand or lead-time variation.
- **Reorder point (ROP):** Inventory threshold that triggers replenishment review.
- **Demand forecast:** Model estimate of future demand for a product over specified dates.
- **Stockout:** A condition where demand cannot be fulfilled because usable stock is unavailable.
- **FEFO:** First-Expiry-First-Out; a stock rotation method for batch-controlled goods.
- **ABC analysis:** Classification of products by contribution to annual consumption value or another explicitly selected value metric.
- **MAE:** Mean Absolute Error, the average absolute difference between predicted and actual demand.
- **WAPE:** Weighted Absolute Percentage Error, the sum of absolute errors divided by total absolute actual demand for the evaluation period. If the denominator is zero, report WAPE as undefined rather than manufacturing a value.
- **Idempotency:** Property where repeating the same request with the same request identifier does not create additional side effects.

## 2. KPI definitions

Definitions must be consistent between dashboard, reports, and tests.

### Sales revenue

Sum of completed sale totals over the selected business date range, adjusted for returns/cancellations according to the documented reporting rule. State whether taxes and discounts are included. Do not mix gross sales and net sales labels.

### Units sold

Net units sold over a selected period, with the treatment of returned units defined explicitly.

### Inventory cost value

Sum of quantity included in the valuation basis multiplied by the defined unit cost. The report must state whether it uses current product cost, cost snapshots, or another costing method. Do not imply audited accounting valuation without implementing a formal costing policy.

### Low-stock count

Count of active products whose configured stock or inventory position is at or below the agreed reorder rule. State whether the count is based on physical on-hand quantity or inventory position.

### Inventory turnover

A common management measure is cost of goods sold divided by average inventory value for the same period. The implementation must define its cost and average-inventory methods; use caution when the period or history is too short.

### Forecast MAE

For the evaluated observations, average the absolute value of predicted demand minus actual demand. Calculate on a chronological holdout period and compare against the baseline using the same observations.

### Forecast WAPE

Divide the sum of absolute prediction errors by the sum of absolute actual demand over the evaluation observations. Report undefined when total actual demand is zero; document whether the report aggregates across products or reports product-level figures.

### Recommendation quantity

The proposed replenishment quantity calculated from target stock and inventory position, adjusted for applicable minimum-order quantity, pack size, budget, capacity, and expiry constraints. Display both the raw and final adjusted quantities where possible.

## 3. Interpretation rules

- A model prediction is not the same as actual demand.
- Low sales do not necessarily mean low demand when the item was out of stock.
- An alert threshold is a policy setting, not a prediction of certainty.
- A dashboard KPI must disclose its date range and calculation definition.
- A demonstrated system should not claim that it reduced stockouts, improved profit, or reduced waste unless those results were actually measured using a suitable evaluation design.
