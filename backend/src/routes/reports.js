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

// Sales report
router.get('/sales', requireRole('ADMIN', 'MANAGER'), validate(salesReportSchema), async (req, res) => {
  const { startDate, endDate, storeId, groupBy } = req.query;
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

  Object.values(grouped).forEach(g => {
    g.avgOrderValue = g.orders > 0 ? g.revenue / g.orders : 0;
    g.revenue = Number(g.revenue.toFixed(2));
    g.avgOrderValue = Number(g.avgOrderValue.toFixed(2));
  });

  const totals = {
    totalRevenue: sales.reduce((sum, s) => sum + Number(s.total), 0),
    totalOrders: sales.length,
    totalUnits: sales.reduce((sum, s) => sum + s.items.reduce((s2, i) => s2 + i.quantity, 0), 0),
  };

  res.json({
    period: { startDate, endDate, groupBy },
    totals,
    data: Object.values(grouped).sort((a, b) => a.period.localeCompare(b.period)),
  });
});

// Inventory valuation
router.get('/inventory-valuation', requireRole('ADMIN', 'MANAGER'), validate(inventoryValuationSchema), async (req, res) => {
  const { storeId, categoryId, valuationMethod } = req.query;
  const targetStoreId = storeId || 'default-store';

  const where = { storeId: targetStoreId };
  if (categoryId) {
    where.product = { categoryId };
  }

  const inventory = await prisma.inventory.findMany({
    where,
    include: { product: { include: { category: true } } },
  });

  const data = inventory.map(inv => {
    const value = Number(inv.quantityOnHand) * Number(inv.product.costPrice);
    return {
      productId: inv.product.id,
      sku: inv.product.sku,
      name: inv.product.name,
      category: inv.product.category?.name,
      onHand: inv.quantityOnHand,
      unitCost: Number(inv.product.costPrice),
      totalValue: value,
    };
  });

  const totalValue = data.reduce((sum, d) => sum + d.totalValue, 0);

  res.json({
    valuationMethod,
    storeId: targetStoreId,
    totalValue: Number(totalValue.toFixed(2)),
    itemCount: data.length,
    data,
  });
});

// Turnover report
router.get('/turnover', requireRole('ADMIN', 'MANAGER'), validate(turnoverReportSchema), async (req, res) => {
  const { startDate, endDate, storeId, categoryId } = req.query;
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

  res.json({
    period: { startDate, endDate },
    storeId: targetStoreId,
    cogs: Number(cogs.toFixed(2)),
    avgInventoryValue: Number(avgInventoryValue.toFixed(2)),
    turnoverRatio: Number(turnover.toFixed(2)),
    byProduct: productData,
  });
});

// Stock movement report
router.get('/stock-movements', requireRole('ADMIN', 'MANAGER', 'INVENTORY_STAFF'), validate(stockMovementReportSchema), async (req, res) => {
  const { startDate, endDate, storeId, productId, movementType } = req.query;
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
});

// Expiry risk report
router.get('/expiry-risk', requireRole('ADMIN', 'MANAGER', 'INVENTORY_STAFF'), validate(expiryRiskReportSchema), async (req, res) => {
  const { storeId, daysAhead } = req.query;
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
    valueAtRisk: Number(b.quantityOnHand) * Number(b.product.costPrice),
    status: b.expiryDate < new Date() ? 'EXPIRED' : 'EXPIRING',
  }));

  const totalValueAtRisk = data.reduce((sum, d) => sum + d.valueAtRisk, 0);

  res.json({
    storeId: targetStoreId,
    daysAhead: parseInt(daysAhead),
    totalBatches: data.length,
    totalValueAtRisk: Number(totalValueAtRisk.toFixed(2)),
    data,
  });
});

export default router;