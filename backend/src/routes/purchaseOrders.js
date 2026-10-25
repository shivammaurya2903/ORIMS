import { Router } from 'express';
import { prisma } from '../index.js';
import { 
  createPurchaseOrderSchema, 
  purchaseOrderQuerySchema, 
  submitPurchaseOrderSchema,
  receivePurchaseOrderSchema,
  cancelPurchaseOrderSchema,
  purchaseOrderDetailSchema
} from '../validators/purchaseOrders.js';
import { validate } from '../utils/validation.js';
import { requireRole } from '../middleware/auth.js';
import { NotFoundError, ValidationError, ConflictError } from '../middleware/errorHandler.js';

const router = Router();

const VALID_TRANSITIONS = {
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'],
  PARTIALLY_RECEIVED: ['PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'],
  RECEIVED: [],
  CANCELLED: [],
};

router.get('/', validate(purchaseOrderQuerySchema), async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const supplierId = req.query.supplierId;
  const storeId = req.query.storeId;
  const status = req.query.status;
  const startDate = req.query.startDate ? new Date(req.query.startDate) : undefined;
  const endDate = req.query.endDate ? new Date(req.query.endDate) : undefined;
  const sort = req.query.sort || 'createdAt';
  const order = req.query.order || 'desc';
  const skip = (page - 1) * limit;

  const where = {};
  if (supplierId) where.supplierId = supplierId;
  if (storeId) where.storeId = storeId;
  if (status) where.status = status;
  if (startDate || endDate) {
    where.orderDate = {};
    if (startDate) where.orderDate = { ...where.orderDate, gte: startDate };
    if (endDate) where.orderDate = { ...where.orderDate, lte: endDate };
  }

  const [orders, total] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sort]: order },
      include: {
        supplier: { select: { id: true, name: true } },
        store: { select: { id: true, name: true } },
        items: { include: { product: { select: { id: true, name: true, sku: true } } } },
        _count: { select: { receipts: true } },
      },
    }),
    prisma.purchaseOrder.count({ where }),
  ]);

  res.json({
    data: orders,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

router.post('/', requireRole('ADMIN', 'MANAGER'), validate(createPurchaseOrderSchema), async (req, res) => {
  const { supplierId, storeId, expectedDate, items } = req.body;
  const actorId = req.user.id;

  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
  if (!supplier || !supplier.active) throw new NotFoundError('Supplier not found or inactive');

  const productIds = items.map(i => i.productId);
  const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
  if (products.length !== productIds.length) {
    throw new ValidationError('One or more products not found');
  }

  const order = await prisma.$transaction(async (tx) => {
    const newOrder = await tx.purchaseOrder.create({
      data: {
        supplierId,
        storeId,
        status: 'DRAFT',
        expectedDate: expectedDate ? new Date(expectedDate) : null,
        createdBy: actorId,
        items: { create: items },
      },
      include: {
        supplier: { select: { id: true, name: true } },
        store: { select: { id: true, name: true } },
        items: { include: { product: { select: { id: true, name: true, sku: true } } } },
      },
    });

    await tx.auditLog.create({
      data: {
        actorId,
        action: 'CREATE_PURCHASE_ORDER',
        entityType: 'PurchaseOrder',
        entityId: newOrder.id,
        details: { supplierId, itemCount: items.length },
      },
    });

    return newOrder;
  });

  res.status(201).json({ purchaseOrder: order });
});

router.get('/:id', validate(purchaseOrderDetailSchema), async (req, res) => {
  const order = await prisma.purchaseOrder.findUnique({
    where: { id: req.params.id },
    include: {
      supplier: { select: { id: true, name: true, email: true, phone: true, address: true } },
      store: { select: { id: true, name: true } },
      items: {
        include: { 
          product: { select: { id: true, name: true, sku: true, barcode: true } },
          receiptItems: true,
        },
      },
      receipts: {
        include: { items: { include: { purchaseOrderItem: true } } },
        orderBy: { receivedAt: 'desc' },
      },
    },
  });

  if (!order) throw new NotFoundError('Purchase order not found');

  const itemsWithReceipts = order.items.map(item => ({
    ...item,
    totalReceived: item.receiptItems.reduce((sum, ri) => sum + ri.qtyReceived, 0),
    remaining: item.orderedQty - item.receiptItems.reduce((sum, ri) => sum + ri.qtyReceived, 0),
  }));

  res.json({ purchaseOrder: { ...order, items: itemsWithReceipts } });
});

router.post('/:id/submit', requireRole('ADMIN', 'MANAGER'), validate(submitPurchaseOrderSchema), async (req, res) => {
  const { id } = req.params;
  const actorId = req.user.id;

  const order = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!order) throw new NotFoundError('Purchase order not found');

  const allowed = VALID_TRANSITIONS[order.status] || [];
  if (!allowed.includes('SUBMITTED')) {
    throw new ConflictError(`Cannot submit order in ${order.status} status`);
  }

  const updated = await prisma.purchaseOrder.update({
    where: { id },
    data: { status: 'SUBMITTED', approvedBy: actorId },
    include: {
      supplier: { select: { id: true, name: true } },
      store: { select: { id: true, name: true } },
      items: { include: { product: { select: { id: true, name: true, sku: true } } } },
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId,
      action: 'SUBMIT_PURCHASE_ORDER',
      entityType: 'PurchaseOrder',
      entityId: id,
    },
  });

  res.json({ purchaseOrder: updated });
});

router.post('/:id/receive', requireRole('ADMIN', 'MANAGER', 'INVENTORY_STAFF'), validate(receivePurchaseOrderSchema), async (req, res) => {
  const { id } = req.params;
  const { receiptReference, supplierDeliveryRef, items } = req.body;
  const actorId = req.user.id;

  // 1. Replay idempotency: if receipt reference already exists, check if it's the exact same order receipt
  const existingReceipt = await prisma.purchaseReceipt.findUnique({
    where: { receiptReference },
    include: { items: true },
  });
  if (existingReceipt) {
    if (existingReceipt.purchaseOrderId === id) {
      // Replay of same receipt attempt - return original receipt without duplicate mutation
      return res.json({ receipt: existingReceipt, idempotent: true });
    }
    throw new ConflictError('Receipt reference already used on a different order');
  }

  // 2. Aggregate input items by purchaseOrderItemId to prevent duplicate line bypasses
  const aggregatedItemsMap = new Map();
  for (const item of items) {
    const existing = aggregatedItemsMap.get(item.purchaseOrderItemId) || {
      purchaseOrderItemId: item.purchaseOrderItemId,
      qtyReceived: 0,
      unitCost: item.unitCost,
      batchNumber: item.batchNumber || null,
      batchExpiryDate: item.batchExpiryDate || null,
    };
    existing.qtyReceived += item.qtyReceived;
    aggregatedItemsMap.set(item.purchaseOrderItemId, existing);
  }
  const aggregatedItems = Array.from(aggregatedItemsMap.values());

  const result = await prisma.$transaction(async (tx) => {
    // Re-check order status inside transaction under lock
    const order = await tx.purchaseOrder.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!order) throw new NotFoundError('Purchase order not found');

    if (!['SUBMITTED', 'PARTIALLY_RECEIVED'].includes(order.status)) {
      throw new ConflictError(`Cannot receive order in ${order.status} status`);
    }

    // Validate aggregated items against order lines inside transaction
    for (const aggItem of aggregatedItems) {
      const poItem = order.items.find(oi => oi.id === aggItem.purchaseOrderItemId);
      if (!poItem) {
        throw new ValidationError(`Order item ${aggItem.purchaseOrderItemId} not found`);
      }
      const remaining = poItem.orderedQty - poItem.receivedQty;
      if (aggItem.qtyReceived > remaining) {
        throw new ConflictError(
          `Cannot receive ${aggItem.qtyReceived}: only ${remaining} remaining for item ${poItem.id}`
        );
      }
    }

    // Create purchase receipt record
    const receipt = await tx.purchaseReceipt.create({
      data: {
        purchaseOrderId: id,
        receiptReference,
        receivedBy: actorId,
        supplierDeliveryRef,
        items: {
          create: items.map(i => {
            const poItem = order.items.find(oi => oi.id === i.purchaseOrderItemId);
            return {
              purchaseOrderItemId: i.purchaseOrderItemId,
              productId: poItem.productId,
              qtyReceived: i.qtyReceived,
              unitCost: i.unitCost,
              batchNumber: i.batchNumber || null,
              batchExpiryDate: i.batchExpiryDate ? new Date(i.batchExpiryDate) : null,
            };
          }),
        },
      },
      include: { items: true },
    });

    // Guarded atomic increments per aggregated PO item
    for (const aggItem of aggregatedItems) {
      const poItem = order.items.find(oi => oi.id === aggItem.purchaseOrderItemId);

      const updatePoResult = await tx.purchaseOrderItem.updateMany({
        where: {
          id: aggItem.purchaseOrderItemId,
          receivedQty: { lte: poItem.orderedQty - aggItem.qtyReceived },
        },
        data: {
          receivedQty: { increment: aggItem.qtyReceived },
        },
      });

      if (updatePoResult.count === 0) {
        throw new ConflictError(`Concurrent receiving race: line ${aggItem.purchaseOrderItemId} would exceed ordered quantity`);
      }

      // Upsert inventory balance atomically
      const inv = await tx.inventory.upsert({
        where: { storeId_productId: { storeId: order.storeId, productId: poItem.productId } },
        update: { quantityOnHand: { increment: aggItem.qtyReceived }, version: { increment: 1 } },
        create: {
          storeId: order.storeId,
          productId: poItem.productId,
          quantityOnHand: aggItem.qtyReceived,
          reservedQuantity: 0,
        },
      });

      // Create stock movement referencing inventory
      await tx.stockMovement.create({
        data: {
          storeId: order.storeId,
          productId: poItem.productId,
          inventoryId: inv.id,
          movementType: 'PURCHASE_RECEIPT',
          quantityDelta: aggItem.qtyReceived,
          reason: `Receipt ${receiptReference}`,
          actorId,
          referenceType: 'PURCHASE_RECEIPT',
          referenceId: receipt.id,
        },
      });

      // Create batch record if batch details provided
      if (aggItem.batchNumber && aggItem.batchExpiryDate) {
        await tx.productBatch.create({
          data: {
            storeId: order.storeId,
            productId: poItem.productId,
            batchNumber: aggItem.batchNumber,
            expiryDate: new Date(aggItem.batchExpiryDate),
            quantityOnHand: aggItem.qtyReceived,
            supplierId: order.supplierId,
            purchaseOrderId: id,
          },
        });
      }
    }

    const updatedItems = await tx.purchaseOrderItem.findMany({ where: { purchaseOrderId: id } });
    const allReceived = updatedItems.every(i => i.receivedQty >= i.orderedQty);
    const anyReceived = updatedItems.some(i => i.receivedQty > 0);

    let newStatus = order.status;
    if (allReceived) newStatus = 'RECEIVED';
    else if (anyReceived) newStatus = 'PARTIALLY_RECEIVED';

    if (newStatus !== order.status) {
      await tx.purchaseOrder.update({
        where: { id },
        data: { status: newStatus },
      });
    }

    await tx.auditLog.create({
      data: {
        actorId,
        action: 'RECEIVE_PURCHASE_ORDER',
        entityType: 'PurchaseOrder',
        entityId: id,
        details: { receiptReference, itemsCount: items.length, newStatus },
      },
    });

    return { receipt, newStatus, order };
  });

  const { receipt, newStatus, order } = result;

  for (const item of items) {
    if (item.qtyReceived > 0) {
      const poItem = order.items.find(oi => oi.id === item.purchaseOrderItemId);
      const inv = await prisma.inventory.findUnique({
        where: { storeId_productId: { storeId: order.storeId, productId: poItem.productId } },
      });
      if (inv) {
        const policy = await prisma.inventoryPolicy.findUnique({
          where: { storeId_productId: { storeId: order.storeId, productId: poItem.productId } },
        });
        const available = inv.quantityOnHand - inv.reservedQuantity;
        const safetyStock = policy?.safetyStock || 0;
        if (available > safetyStock) {
          await prisma.notification.updateMany({
            where: { 
              storeId: order.storeId, 
              productId: poItem.productId, 
              type: { in: ['LOW_STOCK', 'OUT_OF_STOCK'] },
              status: 'UNREAD',
            },
            data: { status: 'ARCHIVED' },
          });
        }
      }
    }
  }

  res.json({ 
    purchaseOrder: { ...order, status: result.newStatus },
    receipt: result.receipt,
  });
});

router.post('/:id/cancel', requireRole('ADMIN', 'MANAGER'), validate(cancelPurchaseOrderSchema), async (req, res) => {
  const { id } = req.params;
  const actorId = req.user.id;

  const order = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!order) throw new NotFoundError('Purchase order not found');

  const allowed = VALID_TRANSITIONS[order.status] || [];
  if (!allowed.includes('CANCELLED')) {
    throw new ConflictError(`Cannot cancel order in ${order.status} status`);
  }

  const receivedItems = order.items.filter(i => i.receivedQty > 0);
  if (receivedItems.length > 0) {
    throw new ConflictError('Cannot cancel order with received items. Process returns instead.');
  }

  const updated = await prisma.purchaseOrder.update({
    where: { id },
    data: { status: 'CANCELLED' },
  });

  await prisma.auditLog.create({
    data: {
      actorId,
      action: 'CANCEL_PURCHASE_ORDER',
      entityType: 'PurchaseOrder',
      entityId: id,
    },
  });

  res.json({ purchaseOrder: updated });
});

export default router;