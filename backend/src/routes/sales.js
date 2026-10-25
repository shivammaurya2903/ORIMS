import { Router } from 'express';
import { prisma } from '../index.js';
import { checkoutSchema, salesQuerySchema, returnSchema, saleDetailSchema } from '../validators/sales.js';
import { validate } from '../utils/validation.js';
import { requireRole } from '../middleware/auth.js';
import { NotFoundError, ValidationError, ConflictError } from '../middleware/errorHandler.js';
import { Decimal } from '@prisma/client/runtime/library';
import { v4 as uuidv4 } from 'uuid';

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

const TAX_RATE = parseFloat(process.env.TAX_RATE || '0.10');

router.post('/', requireRole('ADMIN', 'MANAGER', 'SALES_STAFF'), validate(checkoutSchema), async (req, res) => {
  const { items, paymentMethod, idempotencyKey } = req.body;
  const actorId = req.user.id;
  const storeId = 'default-store';

  // Check idempotency
  // Check idempotency and payload matching
  const existingSale = await prisma.sale.findUnique({
    where: { idempotencyKey },
    include: { items: true },
  });
  if (existingSale) {
    // Check if items match existing sale
    const existingItemsMap = new Map();
    for (const item of existingSale.items) {
      existingItemsMap.set(item.productId, item.quantity);
    }
    const incomingItemsMap = new Map();
    for (const item of items) {
      incomingItemsMap.set(item.productId, (incomingItemsMap.get(item.productId) || 0) + item.quantity);
    }
    let isMatch = existingItemsMap.size === incomingItemsMap.size;
    if (isMatch) {
      for (const [pid, qty] of incomingItemsMap.entries()) {
        if (existingItemsMap.get(pid) !== qty) {
          isMatch = false;
          break;
        }
      }
    }
    if (!isMatch) {
      throw new ConflictError('Idempotency key reused with mismatched payload');
    }
    return res.json({ sale: existingSale, idempotent: true });
  }

  // Aggregate duplicate product lines in request if present
  const aggregatedItemsMap = new Map();
  for (const item of items) {
    aggregatedItemsMap.set(item.productId, (aggregatedItemsMap.get(item.productId) || 0) + item.quantity);
  }
  const aggregatedItems = Array.from(aggregatedItemsMap.entries()).map(([productId, quantity]) => ({
    productId,
    quantity,
  }));

  // Validate products and check stock
  const productIds = aggregatedItems.map(i => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, active: true },
    include: {
      inventory: { where: { storeId } },
    },
  });

  if (products.length !== productIds.length) {
    throw new ValidationError('One or more products not found or inactive');
  }

  // Load configured store tax rate or default to env
  const store = await prisma.store.findFirst({ where: { id: storeId } });
  const configuredTaxRate = store?.taxRate ? Number(store.taxRate) : TAX_RATE;

  // Check stock availability and calculate totals
  let subtotal = new Decimal(0);
  const saleItemsData = [];

  for (const item of aggregatedItems) {
    const product = products.find(p => p.id === item.productId);
    const inventory = product.inventory[0];
    
    if (!inventory) {
      throw new ValidationError(`Product ${product.name} has no inventory record`);
    }

    const available = inventory.quantityOnHand - inventory.reservedQuantity;
    if (item.quantity > available) {
      throw new ConflictError(`Insufficient stock for ${product.name}. Available: ${available}`);
    }

    const lineSubtotal = new Decimal(product.sellingPrice).mul(item.quantity);
    const lineDiscount = new Decimal(0);
    const lineTaxable = lineSubtotal.sub(lineDiscount);
    const lineTax = lineTaxable.mul(configuredTaxRate);
    const lineTotal = lineTaxable.add(lineTax);

    subtotal = subtotal.add(lineSubtotal);
    
    saleItemsData.push({
      productId: product.id,
      quantity: item.quantity,
      unitPrice: product.sellingPrice,
      unitCost: product.costPrice,
      lineDiscount: lineDiscount.toNumber(),
      taxRate: configuredTaxRate,
      lineTotal: lineTotal.toNumber(),
    });
  }

  const discountTotal = new Decimal(0);
  const taxTotal = subtotal.mul(configuredTaxRate);
  const total = subtotal.add(taxTotal);

  const receiptNumber = `RCP-${Date.now()}-${uuidv4().slice(0, 8).toUpperCase()}`;

  // Execute transaction
  let sale;
  try {
    sale = await prisma.$transaction(async (tx) => {
      // Create sale
      const newSale = await tx.sale.create({
        data: {
          storeId,
          receiptNumber,
          status: 'COMPLETED',
          subtotal: subtotal.toNumber(),
          discountTotal: discountTotal.toNumber(),
          taxTotal: taxTotal.toNumber(),
          total: total.toNumber(),
          paymentMethod,
          paymentStatus: 'PAID',
          idempotencyKey,
          createdBy: actorId,
          items: { create: saleItemsData },
        },
        include: { items: { include: { product: true } } },
      });

      // Update inventory atomically with concurrency check and create movements
      for (const item of aggregatedItems) {
        const inv = await tx.inventory.findUnique({
          where: { storeId_productId: { storeId, productId: item.productId } },
        });
        const reserved = inv?.reservedQuantity || 0;
        const available = inv ? inv.quantityOnHand - reserved : 0;
        if (!inv || available < item.quantity) {
          throw new ConflictError(`Insufficient stock for product. Available: ${available}`);
        }

        const updateResult = await tx.inventory.updateMany({
          where: {
            storeId,
            productId: item.productId,
            quantityOnHand: { gte: item.quantity + reserved },
          },
          data: {
            quantityOnHand: { decrement: item.quantity },
            version: { increment: 1 },
          },
        });

        if (updateResult.count === 0) {
          throw new ConflictError(`Concurrency conflict: insufficient stock for product ${item.productId}`);
        }

        await tx.stockMovement.create({
          data: {
            storeId,
            productId: item.productId,
            inventoryId: inv.id,
            movementType: 'SALE',
            quantityDelta: -item.quantity,
            reason: `Sale ${receiptNumber}`,
            actorId,
            referenceType: 'SALE',
            referenceId: newSale.id,
          },
        });
      }

      return newSale;
    });
  } catch (err) {
    if (err?.code === 'P2002' && idempotencyKey) {
      const duplicate = await prisma.sale.findUnique({
        where: { idempotencyKey },
        include: { items: { include: { product: true } } },
      });
      if (duplicate) {
        return res.json({ sale: duplicate, idempotent: true });
      }
    }
    throw err;
  }

  await prisma.auditLog.create({
    data: {
      actorId,
      action: 'CREATE_SALE',
      entityType: 'Sale',
      entityId: sale.id,
      details: { receiptNumber, total: total.toNumber(), itemCount: items.length },
    },
  });

  // Check for low stock alerts
  for (const item of items) {
    const inv = await prisma.inventory.findUnique({
      where: { storeId_productId: { storeId, productId: item.productId } },
    });
    if (inv) {
      const policy = await prisma.inventoryPolicy.findUnique({
        where: { storeId_productId: { storeId, productId: item.productId } },
      });
      const available = inv.quantityOnHand - inv.reservedQuantity;
      const safetyStock = policy?.safetyStock || 0;
      if (available <= safetyStock && available > 0) {
        await createLowStockNotification(storeId, item.productId, available, safetyStock);
      } else if (available <= 0) {
        await createOutOfStockNotification(storeId, item.productId);
      }
    }
  }

  res.status(201).json({ sale, idempotent: false });
});

async function createLowStockNotification(storeId, productId, available, safetyStock) {
  try {
    const dedupKey = `LOW_STOCK_${storeId}_${productId}`;
    const existing = await prisma.notification.findUnique({ where: { deduplicationKey: dedupKey } });
    if (!existing || existing.status === 'ARCHIVED') {
      await prisma.notification.upsert({
        where: { deduplicationKey: dedupKey },
        create: {
          storeId,
          productId,
          type: 'LOW_STOCK',
          message: `Product is at or below safety stock level (available: ${available}, safety: ${safetyStock})`,
          deduplicationKey: dedupKey,
          status: 'UNREAD',
        },
        update: { status: 'UNREAD', message: `Product is at or below safety stock level (available: ${available}, safety: ${safetyStock})` },
      });
    }
  } catch {
    // Non-blocking notification error
  }
}

async function createOutOfStockNotification(storeId, productId) {
  try {
    const dedupKey = `OUT_OF_STOCK_${storeId}_${productId}`;
    const existing = await prisma.notification.findUnique({ where: { deduplicationKey: dedupKey } });
    if (!existing || existing.status === 'ARCHIVED') {
      await prisma.notification.upsert({
        where: { deduplicationKey: dedupKey },
        create: {
          storeId,
          productId,
          type: 'OUT_OF_STOCK',
          message: 'Product is out of stock',
          deduplicationKey: dedupKey,
          status: 'UNREAD',
        },
        update: { status: 'UNREAD' },
      });
    }
  } catch {
    // Non-blocking notification error
  }
}

router.get('/', validate(salesQuerySchema), async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const startDate = req.query.startDate ? new Date(req.query.startDate) : undefined;
  const endDate = normalizeEndDate(req.query.endDate);
  const status = req.query.status;
  const receiptNumber = req.query.receiptNumber;
  const createdBy = req.query.createdBy;
  const sort = req.query.sort || 'createdAt';
  const order = req.query.order || 'desc';
  const skip = (page - 1) * limit;

  const where = {};
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt = { ...where.createdAt, gte: startDate };
    if (endDate) where.createdAt = { ...where.createdAt, lte: endDate };
  }
  if (status) where.status = status;
  if (receiptNumber) where.receiptNumber = { contains: receiptNumber };
  if (createdBy) where.createdBy = createdBy;

  const [sales, total] = await Promise.all([
    prisma.sale.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sort]: order },
      include: { items: { include: { product: { select: { id: true, name: true, sku: true } } } } },
    }),
    prisma.sale.count({ where }),
  ]);

  res.json({
    data: sales,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

router.get('/summary', requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  const startDate = req.query.startDate ? new Date(req.query.startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const endDate = normalizeEndDate(req.query.endDate) || new Date();
  const storeId = req.query.storeId || 'default-store';

  const where = {
    storeId,
    status: 'COMPLETED',
    createdAt: { gte: startDate, lte: endDate },
  };

  const [sales, items] = await Promise.all([
    prisma.sale.findMany({ where }),
    prisma.saleItem.findMany({
      where: { sale: where },
      include: { product: { select: { id: true, name: true, sku: true } } },
    }),
  ]);

  const totalRevenue = sales.reduce((sum, s) => sum + Number(s.total), 0);
  const totalOrders = sales.length;
  const totalUnits = items.reduce((sum, i) => sum + i.quantity, 0);
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const topProducts = items.reduce((acc, item) => {
    const key = item.productId;
    if (!acc[key]) acc[key] = { product: item.product, units: 0, revenue: 0 };
    acc[key].units += item.quantity;
    acc[key].revenue += Number(item.lineTotal);
    return acc;
  }, {});

  const topProductsArray = Object.values(topProducts)
    .sort((a, b) => b.units - a.units)
    .slice(0, 10);

  res.json({
    period: { startDate, endDate },
    totalRevenue,
    totalOrders,
    totalUnits,
    avgOrderValue,
    topProducts: topProductsArray,
  });
});

router.get('/:id', validate(saleDetailSchema), async (req, res) => {
  const sale = await prisma.sale.findUnique({
    where: { id: req.params.id },
    include: {
      items: { include: { product: { select: { id: true, name: true, sku: true, barcode: true } } } },
      returns: { include: { items: { include: { saleItem: { include: { product: true } } } } } },
    },
  });

  if (!sale) {
    throw new NotFoundError('Sale not found');
  }

  res.json({ sale });
});

router.post('/:id/returns', requireRole('ADMIN', 'MANAGER', 'SALES_STAFF'), validate(returnSchema), async (req, res) => {
  const { items, reason } = req.body;
  const saleId = req.params.id;
  const actorId = req.user.id;
  const storeId = 'default-store';

  // Aggregate requested return lines by saleItemId to prevent multi-line bypass
  const aggregatedReturnsMap = new Map();
  for (const item of items) {
    const existing = aggregatedReturnsMap.get(item.saleItemId) || {
      saleItemId: item.saleItemId,
      qtyReturned: 0,
      restockQty: 0,
      writeOffQty: 0,
    };
    existing.qtyReturned += item.qtyReturned;
    existing.restockQty += (item.restockQty || 0);
    existing.writeOffQty += (item.writeOffQty || 0);
    aggregatedReturnsMap.set(item.saleItemId, existing);
  }

  // Validate restock + write-off matches returned qty per line
  for (const item of items) {
    if ((item.restockQty || 0) + (item.writeOffQty || 0) !== item.qtyReturned) {
      throw new ValidationError('Restock + write-off must equal returned quantity');
    }
  }

  const returnRecord = await prisma.$transaction(async (tx) => {
    // Read and lock sale with its items and return history inside transaction
    const sale = await tx.sale.findUnique({
      where: { id: saleId },
      include: {
        items: {
          include: {
            returnItems: true,
          },
        },
      },
    });

    if (!sale) {
      throw new NotFoundError('Sale not found');
    }

    if (sale.status === 'REFUNDED') {
      throw new ConflictError('Sale already fully refunded');
    }

    if (sale.status === 'CANCELLED') {
      throw new ConflictError('Cannot return items from a cancelled sale');
    }

    // Validate aggregated return quantities against remaining returnable amounts inside transaction
    for (const [saleItemId, aggReturn] of aggregatedReturnsMap.entries()) {
      const saleItem = sale.items.find(si => si.id === saleItemId);
      if (!saleItem) {
        throw new ValidationError(`Sale item ${saleItemId} not found`);
      }

      const totalAlreadyReturned = saleItem.returnItems.reduce((sum, ri) => sum + ri.qtyReturned, 0);
      const remaining = saleItem.quantity - totalAlreadyReturned;

      if (aggReturn.qtyReturned > remaining) {
        throw new ValidationError(
          `Cannot return more than originally sold: requested ${aggReturn.qtyReturned}, only ${remaining} remaining for line ${saleItemId}`
        );
      }
    }

    // Create return record with strictly schema-compliant fields
    const newReturn = await tx.saleReturn.create({
      data: {
        saleId,
        reason,
        processedBy: actorId,
        items: {
          create: items.map(i => ({
            saleItemId: i.saleItemId,
            qtyReturned: i.qtyReturned,
            restockQty: i.restockQty || 0,
            writeOffQty: i.writeOffQty || 0,
          })),
        },
      },
      include: { items: true },
    });

    // Process inventory mutations and movements
    for (const returnItem of items) {
      const saleItem = sale.items.find(si => si.id === returnItem.saleItemId);

      if (returnItem.restockQty > 0) {
        const inv = await tx.inventory.update({
          where: { storeId_productId: { storeId, productId: saleItem.productId } },
          data: { quantityOnHand: { increment: returnItem.restockQty }, version: { increment: 1 } },
        });

        await tx.stockMovement.create({
          data: {
            storeId,
            productId: saleItem.productId,
            inventoryId: inv.id,
            movementType: 'RETURN_RESTOCK',
            quantityDelta: returnItem.restockQty,
            reason: `Return ${newReturn.id} - restocked`,
            actorId,
            referenceType: 'RETURN',
            referenceId: newReturn.id,
          },
        });
      }

      if (returnItem.writeOffQty > 0) {
        const inv = await tx.inventory.findUnique({
          where: { storeId_productId: { storeId, productId: saleItem.productId } },
        });

        await tx.stockMovement.create({
          data: {
            storeId,
            productId: saleItem.productId,
            inventoryId: inv?.id,
            movementType: 'RETURN_WRITE_OFF',
            quantityDelta: 0,
            reason: `Return ${newReturn.id} - written off (qty: ${returnItem.writeOffQty})`,
            actorId,
            referenceType: 'RETURN',
            referenceId: newReturn.id,
          },
        });
      }
    }

    // Check if entire sale is now fully returned
    const allSaleItems = await tx.saleItem.findMany({
      where: { saleId },
      include: { returnItems: true },
    });
    const isFullyReturned = allSaleItems.every(si => {
      const totalReturned = si.returnItems.reduce((sum, ri) => sum + ri.qtyReturned, 0);
      return totalReturned >= si.quantity;
    });

    if (isFullyReturned) {
      await tx.sale.update({
        where: { id: saleId },
        data: { status: 'REFUNDED' },
      });
    }

    await tx.auditLog.create({
      data: {
        actorId,
        action: 'SALE_RETURN',
        entityType: 'SaleReturn',
        entityId: newReturn.id,
        details: { saleId, reason, itemsCount: items.length, isFullyReturned },
      },
    });

    return newReturn;
  });

  res.status(201).json({ return: returnRecord });
});

export default router;