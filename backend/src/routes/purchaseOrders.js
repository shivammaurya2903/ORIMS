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

  const order = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!order) throw new NotFoundError('Purchase order not found');

  if (!['SUBMITTED', 'PARTIALLY_RECEIVED'].includes(order.status)) {
    throw new ConflictError(`Cannot receive order in ${order.status} status`);
  }

  const existingReceipt = await prisma.purchaseReceipt.findUnique({ where: { receiptReference } });
  if (existingReceipt) {
    throw new ConflictError('Receipt reference already used');
  }

  for (const item of items) {
    const poItem = order.items.find(oi => oi.id === item.purchaseOrderItemId);
    if (!poItem) throw new ValidationError(`Order item ${item.purchaseOrderItemId} not found`);
    
    const alreadyReceived = poItem.receivedQty;
    const remaining = poItem.orderedQty - alreadyReceived;
    if (item.qtyReceived > remaining) {
      throw new ValidationError(`Cannot receive more than remaining (${remaining}) for product ${poItem.productId}`);
    }
  }

  const result = await prisma.$transaction(async (tx) => {
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

    for (const item of items) {
      const poItem = order.items.find(oi => oi.id === item.purchaseOrderItemId);
      
      await tx.purchaseOrderItem.update({
        where: { id: item.purchaseOrderItemId },
        data: { receivedQty: { increment: item.qtyReceived } },
      });

      await tx.inventory.upsert({
        where: { storeId_productId: { storeId: order.storeId, productId: poItem.productId } },
        update: { quantityOnHand: { increment: item.qtyReceived }, version: { increment: 1 } },
        create: {
          storeId: order.storeId,
          productId: poItem.productId,
          quantityOnHand: item.qtyReceived,
          reservedQuantity: 0,
        },
      });

      await tx.stockMovement.create({
        data: {
          storeId: order.storeId,
          productId: poItem.productId,
          movementType: 'PURCHASE_RECEIPT',
          quantityDelta: item.qtyReceived,
          reason: `Receipt ${receiptReference}`,
          actorId,
          referenceType: 'PURCHASE_RECEIPT',
          referenceId: receipt.id,
        },
      });

      if (item.batchNumber && item.batchExpiryDate) {
        await tx.productBatch.create({
          data: {
            storeId: order.storeId,
            productId: poItem.productId,
            batchNumber: item.batchNumber,
            expiryDate: new Date(item.batchExpiryDate),
            quantityOnHand: item.qtyReceived,
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

    return { receipt, newStatus };
  });

  await prisma.auditLog.create({
    data: {
      actorId,
      action: 'RECEIVE_PURCHASE_ORDER',
      entityType: 'PurchaseOrder',
      entityId: id,
      details: { receiptReference, itemsCount: items.length },
    },
  });

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