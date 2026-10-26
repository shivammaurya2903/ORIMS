import { Router } from 'express';
import { prisma } from '../index.js';
import { 
  salesReportSchema, 
  inventoryValuationSchema, 
  turnoverReportSchema,
  stockMovementReportSchema,
  expiryRiskReportSchema
} from '../validators/reports.js';
import { validate } from '../utils/validation.js';
import { requireRole } from '../middleware/auth.js';
import { formatToCsv, sendCsvResponse } from '../utils/csv.js';

const router = Router();

function normalizeEndDate(dateInput) {
  if (!dateInput) return undefined;
  const d = new Date(dateInput);
  if (typeof dateInput === 'string' && dateInput.length <= 10) {
    d.setUTCHours(23, 59, 59, 999);
  } else if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0) {
    d.setUTCHours(23, 59, 59, 999);
  }
  return d;
}

// -----------------------------------------------------------------------------
// Sales Report & CSV Export
// -----------------------------------------------------------------------------
async function handleSalesReport(req, res, isExport = false) {
  const { startDate, endDate, storeId, groupBy, format } = req.query;
  const targetStoreId = storeId || 'default-store';

  const where = {
    storeId: targetStoreId,
    status: 'COMPLETED',
    createdAt: { gte: new Date(startDate), lte: normalizeEndDate(endDate) },
  };

  const sales = await prisma.sale.findMany({
    where,
    include: { items: { include: { product: { select: { id: true, name: true, sku: true, categoryId: true } } } } },
    orderBy: { createdAt: 'asc' },
  });

  // Group by period
  const grouped = sales.reduce((acc, sale) => {
    let key;
    const date = new Date(sale.createdAt);
    if (groupBy === 'day') {
      key = date.toISOString().split('T')[0];
    } else if (groupBy === 'week') {
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      key = weekStart.toISOString().split('T')[0];
    } else {
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }

    if (!acc[key]) {
      acc[key] = { period: key, revenue: 0, orders: 0, units: 0, avgOrderValue: 0 };
    }
    acc[key].revenue += Number(sale.total);
    acc[key].orders += 1;
    sale.items.forEach(item => {
      acc[key].units += item.quantity;
    });
    return acc;
  }, {});

  const data = Object.values(grouped).sort((a, b) => a.period.localeCompare(b.period));
  data.forEach(g => {
    g.avgOrderValue = g.orders > 0 ? g.revenue / g.orders : 0;
    g.revenue = Number(g.revenue.toFixed(2));
    g.avgOrderValue = Number(g.avgOrderValue.toFixed(2));
  });

  if (isExport || format === 'csv') {
    const columns = [
      { key: 'period', label: 'Period' },
      { key: 'revenue', label: 'Revenue ($)' },
      { key: 'orders', label: 'Orders' },
      { key: 'units', label: 'Units Sold' },
      { key: 'avgOrderValue', label: 'Avg Order Value ($)' },
    ];
    const csv = formatToCsv(columns, data);
    return sendCsvResponse(res, `sales-report-${startDate}-to-${endDate}.csv`, csv);
  }

  const productSalesMap = {};
  sales.forEach(sale => {
    sale.items.forEach(item => {
      const pName = item.product?.name || item.product?.sku || 'Unknown';
      if (!productSalesMap[pName]) productSalesMap[pName] = 0;
      productSalesMap[pName] += item.quantity;
    });
  });
  const topProducts = Object.entries(productSalesMap)
    .map(([product, units]) => ({ product, units }))
    .sort((a, b) => b.units - a.units)
    .slice(0, 5);

  const totals = {
    totalRevenue: sales.reduce((sum, s) => sum + Number(s.total), 0),
    totalOrders: sales.length,
    totalUnits: sales.reduce((sum, s) => sum + s.items.reduce((s2, i) => s2 + i.quantity, 0), 0),
    topProducts,
  };

  res.json({
    period: { startDate, endDate, groupBy },
    totals,
    data,
  });
}

router.get('/sales', requireRole('ADMIN', 'MANAGER'), validate(salesReportSchema), (req, res) => handleSalesReport(req, res, false));
router.get('/sales/export', requireRole('ADMIN', 'MANAGER'), validate(salesReportSchema), (req, res) => handleSalesReport(req, res, true));

// -----------------------------------------------------------------------------
// Inventory Valuation Report & CSV Export (FR-REP-03, F-REP-01, F-REP-02)
// -----------------------------------------------------------------------------
async function handleInventoryValuation(req, res, isExport = false) {
  const { storeId, categoryId, valuationMethod = 'CURRENT_COST', format } = req.query;
  const targetStoreId = storeId || 'default-store';

  const where = { storeId: targetStoreId };
  if (categoryId) {
    where.product = { categoryId };
  }

  const inventory = await prisma.inventory.findMany({
    where,
    include: { product: { include: { category: true } } },
  });

  const poCostMap = new Map();
  if (valuationMethod === 'WEIGHTED_AVERAGE') {
    const productIds = inventory.map(inv => inv.productId);
    if (productIds.length > 0) {
      const poItems = await prisma.purchaseOrderItem.findMany({
        where: {
          productId: { in: productIds },
          receivedQty: { gt: 0 },
        },
        select: {
          productId: true,
          receivedQty: true,
          unitCost: true,
        },
      });

      const groupedByProduct = {};
      for (const item of poItems) {
        if (!groupedByProduct[item.productId]) {
          groupedByProduct[item.productId] = { totalCost: 0, totalQty: 0 };
        }
        groupedByProduct[item.productId].totalCost += Number(item.unitCost) * item.receivedQty;
        groupedByProduct[item.productId].totalQty += item.receivedQty;
      }
      for (const [pId, stats] of Object.entries(groupedByProduct)) {
        if (stats.totalQty > 0) {
          poCostMap.set(pId, {
            avgCost: stats.totalCost / stats.totalQty,
            sampleSize: stats.totalQty,
          });
        }
      }
    }
  }

  const data = inventory.map(inv => {
    let unitCost = Number(inv.product.costPrice);
    let costBasis = 'CURRENT_CATALOG_COST';

    if (valuationMethod === 'WEIGHTED_AVERAGE') {
      const hist = poCostMap.get(inv.productId);
      if (hist) {
        unitCost = Number(hist.avgCost.toFixed(4));
        costBasis = 'WEIGHTED_AVERAGE_PURCHASE';
      } else {
        costBasis = 'CATALOG_COST_FALLBACK';
      }
    }

    const value = Number((Number(inv.quantityOnHand) * unitCost).toFixed(2));
    return {
      productId: inv.product.id,
      sku: inv.product.sku,
      name: inv.product.name,
      category: inv.product.category?.name || 'Uncategorized',
      onHand: inv.quantityOnHand,
      unitCost: Number(unitCost.toFixed(2)),
      costBasis,
      totalValue: value,
    };
  });

  if (isExport || format === 'csv') {
    const columns = [
      { key: 'sku', label: 'SKU' },
      { key: 'name', label: 'Product Name' },
      { key: 'category', label: 'Category' },
      { key: 'onHand', label: 'On Hand' },
      { key: 'unitCost', label: 'Unit Cost ($)' },
      { key: 'costBasis', label: 'Costing Basis' },
      { key: 'totalValue', label: 'Total Value ($)' },
    ];
    const csv = formatToCsv(columns, data);
    return sendCsvResponse(res, `inventory-valuation-${valuationMethod.toLowerCase()}-${new Date().toISOString().split('T')[0]}.csv`, csv);
  }

  const totalValue = data.reduce((sum, d) => sum + d.totalValue, 0);

  res.json({
    valuationMethod,
    valuationBasisDescription: valuationMethod === 'WEIGHTED_AVERAGE'
      ? 'Weighted average acquisition cost based on received purchase orders'
      : 'Current catalog replacement cost',
    storeId: targetStoreId,
    totalValue: Number(totalValue.toFixed(2)),
    itemCount: data.length,
    data,
  });
}

router.get('/inventory-valuation', requireRole('ADMIN', 'MANAGER'), validate(inventoryValuationSchema), (req, res) => handleInventoryValuation(req, res, false));
router.get('/inventory-valuation/export', requireRole('ADMIN', 'MANAGER'), validate(inventoryValuationSchema), (req, res) => handleInventoryValuation(req, res, true));

// -----------------------------------------------------------------------------
// Turnover Report & CSV Export
// -----------------------------------------------------------------------------
async function handleTurnoverReport(req, res, isExport = false) {
  const { startDate, endDate, storeId, categoryId, format } = req.query;
  const targetStoreId = storeId || 'default-store';

  const where = {
    storeId: targetStoreId,
    status: 'COMPLETED',
    createdAt: { gte: new Date(startDate), lte: normalizeEndDate(endDate) },
  };

  const saleItems = await prisma.saleItem.findMany({
    where: { sale: where },
    include: { product: { include: { category: true } } },
  });

  // Calculate COGS
  const cogs = saleItems.reduce((sum, item) => sum + Number(item.unitCost) * item.quantity, 0);

  // Average inventory value (simplified - using current inventory)
  const inventoryWhere = { storeId: targetStoreId };
  if (categoryId) inventoryWhere.product = { categoryId };
  
  const inventory = await prisma.inventory.findMany({
    where: inventoryWhere,
    include: { product: true },
  });
  
  const avgInventoryValue = inventory.reduce((sum, inv) => 
    sum + Number(inv.quantityOnHand) * Number(inv.product.costPrice), 0);

  const turnover = avgInventoryValue > 0 ? cogs / avgInventoryValue : 0;

  // By product
  const byProduct = saleItems.reduce((acc, item) => {
    const key = item.productId;
    if (!acc[key]) {
      acc[key] = { product: item.product, unitsSold: 0, revenue: 0, cogs: 0 };
    }
    acc[key].unitsSold += item.quantity;
    acc[key].revenue += Number(item.lineTotal);
    acc[key].cogs += Number(item.unitCost) * item.quantity;
    return acc;
  }, {});

  const productData = Object.values(byProduct).map(p => ({
    ...p,
    turnover: p.cogs > 0 && avgInventoryValue > 0 ? p.cogs / avgInventoryValue : 0,
    grossMargin: p.revenue > 0 ? (p.revenue - p.cogs) / p.revenue : 0,
  }));

  if (isExport || format === 'csv') {
    const columns = [
      { key: r => r.product?.sku || '', label: 'SKU' },
      { key: r => r.product?.name || '', label: 'Product Name' },
      { key: 'unitsSold', label: 'Units Sold' },
      { key: r => Number(r.revenue.toFixed(2)), label: 'Revenue ($)' },
      { key: r => Number(r.cogs.toFixed(2)), label: 'COGS ($)' },
      { key: r => Number(r.turnover.toFixed(2)), label: 'Turnover Ratio' },
      { key: r => `${(r.grossMargin * 100).toFixed(1)}%`, label: 'Gross Margin' },
    ];
    const csv = formatToCsv(columns, productData);
    return sendCsvResponse(res, `turnover-report-${startDate}-to-${endDate}.csv`, csv);
  }

  res.json({
    period: { startDate, endDate },
    storeId: targetStoreId,
    cogs: Number(cogs.toFixed(2)),
    avgInventoryValue: Number(avgInventoryValue.toFixed(2)),
    turnoverRatio: Number(turnover.toFixed(2)),
    byProduct: productData,
  });
}

router.get('/turnover', requireRole('ADMIN', 'MANAGER'), validate(turnoverReportSchema), (req, res) => handleTurnoverReport(req, res, false));
router.get('/turnover/export', requireRole('ADMIN', 'MANAGER'), validate(turnoverReportSchema), (req, res) => handleTurnoverReport(req, res, true));

// -----------------------------------------------------------------------------
// Stock Movement Report & CSV Export
// -----------------------------------------------------------------------------
async function handleStockMovementsReport(req, res, isExport = false) {
  const { startDate, endDate, storeId, productId, movementType, format } = req.query;
  const targetStoreId = storeId || 'default-store';

  const where = {
    storeId: targetStoreId,
    createdAt: { gte: new Date(startDate), lte: normalizeEndDate(endDate) },
  };
  if (productId) where.productId = productId;
  if (movementType) where.movementType = movementType;

  const movements = await prisma.stockMovement.findMany({
    where,
    include: { 
      product: { select: { id: true, name: true, sku: true } },
      store: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (isExport || format === 'csv') {
    const columns = [
      { key: r => new Date(r.createdAt).toISOString(), label: 'Date/Time (UTC)' },
      { key: r => r.product?.sku || '', label: 'SKU' },
      { key: r => r.product?.name || '', label: 'Product Name' },
      { key: 'movementType', label: 'Movement Type' },
      { key: 'quantityDelta', label: 'Quantity Delta' },
      { key: r => r.reason || '', label: 'Reason' },
      { key: r => r.referenceType || '', label: 'Ref Type' },
      { key: r => r.referenceId || '', label: 'Ref ID' },
    ];
    const csv = formatToCsv(columns, movements);
    return sendCsvResponse(res, `stock-movements-${startDate}-to-${endDate}.csv`, csv);
  }

  const summary = movements.reduce((acc, m) => {
    if (!acc[m.movementType]) acc[m.movementType] = { count: 0, totalQty: 0 };
    acc[m.movementType].count++;
    acc[m.movementType].totalQty += Math.abs(m.quantityDelta);
    return acc;
  }, {});

  res.json({
    period: { startDate, endDate },
    storeId: targetStoreId,
    summary,
    data: movements,
  });
}

router.get('/stock-movements', requireRole('ADMIN', 'MANAGER', 'INVENTORY_STAFF'), validate(stockMovementReportSchema), (req, res) => handleStockMovementsReport(req, res, false));
router.get('/stock-movements/export', requireRole('ADMIN', 'MANAGER', 'INVENTORY_STAFF'), validate(stockMovementReportSchema), (req, res) => handleStockMovementsReport(req, res, true));

// -----------------------------------------------------------------------------
// Expiry Risk Report & CSV Export
// -----------------------------------------------------------------------------
async function handleExpiryRiskReport(req, res, isExport = false) {
  const { storeId, daysAhead, format } = req.query;
  const targetStoreId = storeId || 'default-store';
  const cutoff = new Date(Date.now() + parseInt(daysAhead) * 24 * 60 * 60 * 1000);

  const batches = await prisma.productBatch.findMany({
    where: {
      storeId: targetStoreId,
      expiryDate: { lte: cutoff },
      quantityOnHand: { gt: 0 },
    },
    include: { product: { include: { category: true } } },
    orderBy: { expiryDate: 'asc' },
  });

  const data = batches.map(b => ({
    batchNumber: b.batchNumber,
    product: b.product,
    expiryDate: b.expiryDate,
    quantityOnHand: b.quantityOnHand,
    daysUntilExpiry: Math.ceil((b.expiryDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
    valueAtRisk: Number((Number(b.quantityOnHand) * Number(b.product.costPrice)).toFixed(2)),
    status: b.expiryDate < new Date() ? 'EXPIRED' : 'EXPIRING',
  }));

  if (isExport || format === 'csv') {
    const columns = [
      { key: 'batchNumber', label: 'Batch Number' },
      { key: r => r.product?.sku || '', label: 'SKU' },
      { key: r => r.product?.name || '', label: 'Product Name' },
      { key: 'quantityOnHand', label: 'Quantity On Hand' },
      { key: r => new Date(r.expiryDate).toISOString().split('T')[0], label: 'Expiry Date' },
      { key: 'daysUntilExpiry', label: 'Days Until Expiry' },
      { key: 'valueAtRisk', label: 'Value At Risk ($)' },
      { key: 'status', label: 'Status' },
    ];
    const csv = formatToCsv(columns, data);
    return sendCsvResponse(res, `expiry-risk-${new Date().toISOString().split('T')[0]}.csv`, csv);
  }

  const totalValueAtRisk = data.reduce((sum, d) => sum + d.valueAtRisk, 0);

  res.json({
    storeId: targetStoreId,
    daysAhead: parseInt(daysAhead),
    totalBatches: data.length,
    totalValueAtRisk: Number(totalValueAtRisk.toFixed(2)),
    data,
  });
}

router.get('/expiry-risk', requireRole('ADMIN', 'MANAGER', 'INVENTORY_STAFF'), validate(expiryRiskReportSchema), (req, res) => handleExpiryRiskReport(req, res, false));
router.get('/expiry-risk/export', requireRole('ADMIN', 'MANAGER', 'INVENTORY_STAFF'), validate(expiryRiskReportSchema), (req, res) => handleExpiryRiskReport(req, res, true));

export default router;
