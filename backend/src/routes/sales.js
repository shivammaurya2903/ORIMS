import { Router } from 'express';
import { prisma } from '../index.js';
import { checkoutSchema, salesQuerySchema, returnSchema, saleDetailSchema } from '../validators/sales.js';
import { validate } from '../utils/validation.js';
import { requireRole } from '../middleware/auth.js';
import { NotFoundError, ValidationError, ConflictError } from '../middleware/errorHandler.js';
import { Decimal } from '@prisma/client/runtime/library';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

const TAX_RATE = parseFloat(process.env.TAX_RATE || '0.10');

router.post('/', requireRole('ADMIN', 'MANAGER', 'SALES_STAFF'), validate(checkoutSchema), async (req, res) => {
  const { items, paymentMethod, idempotencyKey } = req.body;
  const actorId = req.user.id;
  const storeId = 'default-store';

  // Check idempotency
  const existingSale = await prisma.sale.findUnique({ where: { idempotencyKey } });
  if (existingSale) {
    return res.json({ sale: existingSale, idempotent: true });
  }

  // Validate products and check stock
  const productIds = items.map(i => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, active: true },
    include: {
      inventory: { where: { storeId } },
    },
  });

  if (products.length !== productIds.length) {
    throw new ValidationError('One or more products not found or inactive');
  }

  // Check stock availability and calculate totals
  let subtotal = new Decimal(0);
  const saleItemsData = [];

  for (const item of items) {
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
    const lineTax = lineTaxable.mul(TAX_RATE);
    const lineTotal = lineTaxable.add(lineTax);

    subtotal = subtotal.add(lineSubtotal);
    
    saleItemsData.push({
      productId: product.id,
      quantity: item.quantity,
      unitPrice: product.sellingPrice,
      unitCost: product.costPrice,
      lineDiscount: lineDiscount.toNumber(),
      taxRate: TAX_RATE,
      lineTotal: lineTotal.toNumber(),
    });
  }

  const discountTotal = new Decimal(0);
  const taxTotal = subtotal.mul(TAX_RATE);
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
      for (const item of items) {
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
  const endDate = req.query.endDate ? new Date(req.query.endDate) : undefined;
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

router.get('/summary', async (req, res) => {
  const startDate = req.query.startDate ? new Date(req.query.startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();
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

  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: { items: true },
  });

  if (!sale) {
    throw new NotFoundError('Sale not found');
  }

  if (sale.status === 'REFUNDED') {
    throw new ValidationError('Sale already fully refunded');
  }

  // Validate return items
  for (const returnItem of items) {
    const saleItem = sale.items.find(si => si.id === returnItem.saleItemId);
    if (!saleItem) {
      throw new ValidationError(`Sale item ${returnItem.saleItemId} not found`);
    }
    
    const alreadyReturned = await prisma.saleReturnItem.aggregate({
      where: { saleItemId: returnItem.saleItemId },
      _sum: { qtyReturned: true },
    });
    const totalReturned = alreadyReturned._sum.qtyReturned || 0;
    if (returnItem.qtyReturned > saleItem.quantity - totalReturned) {
      throw new ValidationError(`Cannot return more than originally sold (${saleItem.quantity - totalReturned} remaining)`);
    }
    if (returnItem.restockQty + returnItem.writeOffQty !== returnItem.qtyReturned) {
      throw new ValidationError('Restock + write-off must equal returned quantity');
    }
  }

  const returnRecord = await prisma.$transaction(async (tx) => {
    const newReturn = await tx.saleReturn.create({
      data: {
        saleId,
        reason,
        processedBy: actorId,
        items: { create: items },
      },
      include: { items: true },
    });

    // Process inventory for restocked items
    for (const returnItem of items) {
      if (returnItem.restockQty > 0) {
        const saleItem = sale.items.find(si => si.id === returnItem.saleItemId);
        await tx.inventory.update({
          where: { storeId_productId: { storeId, productId: saleItem.productId } },
          data: { quantityOnHand: { increment: returnItem.restockQty }, version: { increment: 1 } },
        });

        await tx.stockMovement.create({
          data: {
            storeId,
            productId: saleItem.productId,
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
        const saleItem = sale.items.find(si => si.id === returnItem.saleItemId);
        await tx.stockMovement.create({
          data: {
            storeId,
            productId: saleItem.productId,
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

    return newReturn;
  });

  await prisma.auditLog.create({
    data: {
      actorId,
      action: 'CREATE_RETURN',
      entityType: 'SaleReturn',
      entityId: returnRecord.id,
      details: { saleId, reason, items: items.length },
    },
  });

  res.status(201).json({ return: returnRecord });
});

export default router;