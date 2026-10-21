# UI/UX Specification

**Product:** ORIMS  
**Version:** 1.0

## 1. Experience goals

The interface should feel like a modern retail operations dashboard: clear, responsive, consistent, fast to navigate, and focused on completing store tasks. Prioritize operational clarity over decorative effects. Use one shared layout with an accessible sidebar, top bar, notification access, and account menu.

## 2. Navigation map

- `/login` — login.
- `/dashboard` — operational summary.
- `/products` and `/products/:id` — catalogue and details.
- `/inventory` — stock levels, movements, and authorized adjustments.
- `/pos` — checkout.
- `/sales` and `/sales/:id` — history and receipt detail.
- `/suppliers` and `/suppliers/:id` — supplier management.
- `/purchases` and `/purchases/:id` — purchase-order list, details, and receiving.
- `/optimization` — forecasts, stockout risk, and reorder recommendations.
- `/batches` — batch and expiry tracking.
- `/reports` — sales and inventory reports.
- `/notifications` — system alerts.
- `/users` — account management, admin only.
- `/settings` — store and replenishment settings.

Protect routes for usability, but enforce every permission again in the backend.

## 3. Global layout

- Responsive sidebar with clear active navigation state.
- Header with page title, search where appropriate, notification indicator, and profile menu.
- Breadcrumbs on detail pages.
- Consistent spacing, typography, color tokens, form controls, modal dialogs, tables, status labels, and confirmation patterns.
- Tables should include loading skeletons or indicators, empty-state explanations, error recovery, pagination, and useful filters.
- Keep destructive actions visually distinct and require confirmation where appropriate.

## 4. Page requirements

### Dashboard

- KPI cards for today's sales, active products, inventory value, and low/out-of-stock count.
- Sales trend chart with selectable date range.
- Low-stock and expiry panels.
- Top-selling products and recent transactions.
- Clear definitions or tooltips for computed metrics.

### Products

- Search by name, SKU, or barcode.
- Filter by category and status.
- Table columns for SKU, name, category, selling price, active state, and stock summary where available.
- Create/edit form with validation and duplicate-SKU feedback.
- Prefer deactivation over permanent deletion when history exists.

### Inventory

- Search/filter by product, category, store, and stock status.
- Clearly distinguish on-hand, reserved, available, and incoming quantities.
- Movement history with date, type, quantity change, reference, and actor where permitted.
- Adjustment form requires a reason and an explicit permission check.

### POS

- Fast product search and selection.
- Cart line editing with quantity validation.
- Show stock availability without promising that it cannot change before checkout.
- Display calculated server totals after the server confirms checkout.
- Disable repeat submission while a checkout is in flight and use retry-safe request handling.
- Show a success receipt or actionable validation/conflict error.

### Purchasing

- Supplier selection and item lines.
- Purchase order status history.
- Separate ordered, received, and remaining quantities.
- Partial receipt interface with line-level validation.
- Confirmation for submission, cancellation, and receipt.

### Optimization centre

- Forecast chart showing historical demand and predicted values in visually distinct styles.
- Display forecast horizon, generated timestamp, model version, and status such as model forecast, fallback, or insufficient data.
- Recommendation table showing current stock, confirmed incoming stock, forecast demand, safety stock, proposed quantity, urgency, and explanation.
- Filters for category, risk level, and recommendation status.
- Manager can review, edit, approve, or reject a recommendation with an optional reason.

### Reports

- Date filters and export controls.
- Sales, inventory valuation, stock movement, turnover, and expiry-risk reports.
- Display definition and date range of each metric.
- Avoid suggesting that correlation proves that the ML model caused an improvement.

## 5. Visual and interaction guidance

- Use a restrained, consistent palette and reserve strong colors for meaningful states such as warning, error, or success.
- Never use color alone to communicate status; pair it with text or icons.
- Keep primary actions consistent and labels explicit.
- Use accessible focus states and keyboard-friendly navigation.
- Use semantic labels and validation messages associated with inputs.
- Confirm irreversible or financially meaningful actions.
- Avoid overly wide tables on smaller screens; provide responsive columns or a detail view.

## 6. Required interface states

Each data-driven page should handle:
- Initial loading.
- Successful content.
- Empty result with suggested next action.
- Input validation failure.
- Permission denial.
- Network or server error with retry guidance.
- Stale data if relevant.
- ML forecast unavailable or fallback state in optimization views.

## 7. Accessibility and usability validation

Test full keyboard navigation, visible focus, readable contrast, useful form labels, table semantics, responsive layouts, zoom behavior, and error messages. Test core flows with realistic data and at least one small-screen viewport.
