import { Router } from 'express';
import { prisma } from '../index.js';
import { inventoryQuerySchema, adjustmentSchema, inventoryDetailQuerySchema, movementsQuerySchema } from '../validators/inventory.js';
import { validate } from '../utils/validation.js';
import { requireRole } from '../middleware/auth.js';
import { NotFoundError, ValidationError, ConflictError } from '../middleware/errorHandler.js';
import { Decimal } from '@prisma/client/runtime/library';

const router = Router();

router.get('/', validate(inventoryQuerySchema), async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const search = req.query.search;
  const categoryId = req.query.categoryId;
  const storeId = req.query.storeId;
  const stockStatus = req.query.stockStatus;
  const sort = req.query.sort || 'productName';
  const order = req.query.order || 'asc';
  const skip = (page - 1) * limit;

  const storeWhere = storeId ? { storeId } : {};

  const products = await prisma.product.findMany({
    where: {
      ...(search && {
        OR: [
          { name: { contains: search } },
          { sku: { contains: search } },
          { barcode: { contains: search } },
        ],
      }),
      ...(categoryId && { categoryId }),
      active: true,
    },
    include: {
      category: { select: { id: true, name: true } },
      inventory: {
        where: storeWhere,
        include: { store: { select: { id: true, name: true } } },
      },
      inventoryPolicies: {
        where: storeWhere,
      },
    },
    orderBy: { name: 'asc' },
  });

  let data = products.map(p => {
    const inv = p.inventory[0];
    const policy = p.inventoryPolicies[0];
    const onHand = inv?.quantityOnHand || 0;
    const reserved = inv?.reservedQuantity || 0;
    const available = onHand - reserved;
    const safetyStock = policy?.safetyStock || 0;
    
    let status = 'IN_STOCK';
    if (available <= 0) status = 'OUT_OF_STOCK';
    else if (available <= safetyStock) status = 'LOW_STOCK';

    return {
      productId: p.id,
      sku: p.sku,
      barcode: p.barcode,
      name: p.name,
      category: p.category,
      store: inv?.store,
      onHand,
      reserved,
      available,
      safetyStock,
      status,
      costPrice: p.costPrice,
      sellingPrice: p.sellingPrice,
      inventoryValue: new Decimal(p.costPrice).mul(onHand).toNumber(),
    };
  });

  if (stockStatus) {
    data = data.filter(d => d.status === stockStatus);
  }

  const sortMap = {
    productName: 'name',
    onHand: 'onHand',
    available: 'available',
    updatedAt: 'updatedAt',
  };
  const sortKey = sortMap[sort] || 'name';
  data.sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    if (av < bv) return order === 'asc' ? -1 : 1;
    if (av > bv) return order === 'asc' ? 1 : -1;
    return 0;
  });

  const total = data.length;
  const paginated = data.slice(skip, skip + limit);

  res.json({
    data: paginated,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

router.get('/:productId', validate(inventoryDetailQuerySchema), async (req, res) => {
  const { productId } = req.params;
  const storeId = req.query.storeId;

  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      category: { select: { id: true, name: true } },
      inventory: {
        where: storeId ? { storeId } : {},
        include: { store: { select: { id: true, name: true } } },
      },
      inventoryPolicies: {
        where: storeId ? { storeId } : {},
        include: { store: { select: { id: true, name: true } } },
      },
      productBatches: {
        where: storeId ? { storeId } : {},
        orderBy: { expiryDate: 'asc' },
        include: { store: { select: { id: true, name: true } } },
      },
    },
  });

  if (!product) {
    throw new NotFoundError('Product not found');
  }

  const inventory = product.inventory.map(inv => ({
    store: inv.store,
    onHand: inv.quantityOnHand,
    reserved: inv.reservedQuantity,
    available: inv.quantityOnHand - inv.reservedQuantity,
    safetyStock: product.inventoryPolicies.find(p => p.storeId === inv.storeId)?.safetyStock || 0,
  }));

  res.json({
    product: {
      id: product.id,
      sku: product.sku,
      barcode: product.barcode,
      name: product.name,
      category: product.category,
      costPrice: product.costPrice,
      sellingPrice: product.sellingPrice,
      unitOfMeasure: product.unitOfMeasure,
    },
    inventory,
    batches: product.productBatches.map(b => ({
      id: b.id,
      batchNumber: b.batchNumber,
      expiryDate: b.expiryDate,
      quantityOnHand: b.quantityOnHand,
      store: b.store,
    })),
  });
});

router.get('/:productId/movements', requireRole('ADMIN', 'MANAGER', 'INVENTORY_STAFF'), validate(movementsQuerySchema), async (req, res) => {
  const { productId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  const storeId = req.query.storeId;
  const movementType = req.query.movementType;
  const startDate = req.query.startDate ? new Date(req.query.startDate) : undefined;
  const endDate = req.query.endDate ? new Date(req.query.endDate) : undefined;
  const skip = (page - 1) * limit;

  const where = { productId };
  if (storeId) where.storeId = storeId;
  if (movementType) where.movementType = movementType;
  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt = { ...where.createdAt, gte: startDate };
    if (endDate) where.createdAt = { ...where.createdAt, lte: endDate };
  }

  const [movements, total] = await Promise.all([
    prisma.stockMovement.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        product: { select: { id: true, name: true, sku: true } },
      },
    }),
    prisma.stockMovement.count({ where }),
  ]);

  res.json({
    data: movements,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

router.post('/adjustments', requireRole('ADMIN', 'MANAGER', 'INVENTORY_STAFF'), validate(adjustmentSchema), async (req, res) => {
  const { productId, storeId, quantityDelta, reason, movementType } = req.body;
  const actorId = req.user.id;

  // Enforce consistent direction based on movement type
  const isDecrease = ['ADJUSTMENT_DECREASE', 'DAMAGE', 'WASTAGE'].includes(movementType);
  const effectiveDelta = isDecrease ? -Math.abs(quantityDelta) : Math.abs(quantityDelta);

  const result = await prisma.$transaction(async (tx) => {
    const inventory = await tx.inventory.findUnique({
      where: { storeId_productId: { storeId, productId } },
    });

    if (!inventory) {
      throw new NotFoundError('Inventory record not found for this product/store');
    }

    const reserved = inventory.reservedQuantity || 0;
    const currentOnHand = inventory.quantityOnHand;

    if (effectiveDelta < 0) {
      const decreaseAmount = Math.abs(effectiveDelta);
      if (currentOnHand - decreaseAmount < reserved) {
        throw new ValidationError(
          `Adjustment would result in negative stock: would drop stock (${currentOnHand - decreaseAmount}) below reserved level (${reserved})`
        );
      }

      // Guarded atomic conditional decrement checking both version and stock availability
      const updateResult = await tx.inventory.updateMany({
        where: {
          id: inventory.id,
          version: inventory.version,
          quantityOnHand: { gte: decreaseAmount + reserved },
        },
        data: {
          quantityOnHand: { decrement: decreaseAmount },
          version: { increment: 1 },
        },
      });

      if (updateResult.count === 0) {
        throw new ConflictError('Concurrent inventory modification detected; adjustment aborted');
      }
    } else {
      // Guarded atomic conditional increment checking version
      const updateResult = await tx.inventory.updateMany({
        where: {
          id: inventory.id,
          version: inventory.version,
        },
        data: {
          quantityOnHand: { increment: effectiveDelta },
          version: { increment: 1 },
        },
      });

      if (updateResult.count === 0) {
        throw new ConflictError('Concurrent inventory modification detected; adjustment aborted');
      }
    }

    const updatedInventory = await tx.inventory.findUnique({
      where: { id: inventory.id },
    });

    const movement = await tx.stockMovement.create({
      data: {
        storeId,
        productId,
        inventoryId: inventory.id,
        movementType,
        quantityDelta: effectiveDelta,
        reason,
        actorId,
        referenceType: 'ADJUSTMENT',
      },
    });

    await tx.auditLog.create({
      data: {
        actorId,
        action: 'STOCK_ADJUSTMENT',
        entityType: 'Inventory',
        entityId: inventory.id,
        details: {
          quantityDelta: effectiveDelta,
          reason,
          movementType,
          previousOnHand: currentOnHand,
          newOnHand: updatedInventory.quantityOnHand,
        },
      },
    });

    return { inventory: updatedInventory, movement };
  });

  res.json(result);
});

export default router;