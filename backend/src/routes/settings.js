import { Router } from 'express';
import { prisma } from '../index.js';
import { storeSettingsSchema, inventoryPolicySchema, updateInventoryPolicySchema } from '../validators/settings.js';
import { validate } from '../utils/validation.js';
import { requireRole } from '../middleware/auth.js';

const router = Router();

// Store settings (singleton for single store)
router.get('/store', async (req, res) => {
  let store = await prisma.store.findFirst();
  if (!store) {
    store = await prisma.store.create({
      data: { name: 'Main Store', active: true },
    });
  }
  res.json({ store });
});

router.put('/store', requireRole('ADMIN', 'MANAGER'), validate(storeSettingsSchema), async (req, res) => {
  let store = await prisma.store.findFirst();
  if (!store) {
    store = await prisma.store.create({ data: { name: 'Main Store', active: true } });
  }

  const updated = await prisma.store.update({
    where: { id: store.id },
    data: req.body,
  });

  await prisma.auditLog.create({
    data: {
      actorId: req.user.id,
      action: 'UPDATE_STORE_SETTINGS',
      entityType: 'Store',
      entityId: store.id,
      details: { changes: req.body },
    },
  });

  res.json({ store: updated });
});

// Inventory policies
router.get('/inventory-policies', async (req, res) => {
  const storeId = req.query.storeId || 'default-store';
  
  const policies = await prisma.inventoryPolicy.findMany({
    where: { storeId },
    include: { product: { select: { id: true, name: true, sku: true } } },
  });

  res.json({ data: policies });
});

router.post('/inventory-policies', requireRole('ADMIN', 'MANAGER'), validate(inventoryPolicySchema), async (req, res) => {
  const storeId = req.body.storeId || req.query.storeId || 'default-store';
  const { productId, storeId: _s, ...data } = req.body;

  const existing = await prisma.inventoryPolicy.findUnique({
    where: { storeId_productId: { storeId, productId } },
  });
  if (existing) {
    return res.status(409).json({ error: 'Policy already exists for this product', code: 'DUPLICATE_ENTRY' });
  }

  const policy = await prisma.inventoryPolicy.create({
    data: { storeId, productId, ...data },
    include: { product: { select: { id: true, name: true, sku: true } } },
  });

  await prisma.auditLog.create({
    data: {
      actorId: req.user.id,
      action: 'CREATE_INVENTORY_POLICY',
      entityType: 'InventoryPolicy',
      entityId: policy.id,
      details: { productId, storeId, ...data },
    },
  });

  res.status(201).json({ policy });
});

router.put('/inventory-policies/:productId', requireRole('ADMIN', 'MANAGER'), validate(updateInventoryPolicySchema), async (req, res) => {
  const { productId } = req.params;
  const storeId = req.body.storeId || req.query.storeId || 'default-store';
  const { storeId: _s, ...data } = req.body;

  const policy = await prisma.inventoryPolicy.update({
    where: { storeId_productId: { storeId, productId } },
    data,
    include: { product: { select: { id: true, name: true, sku: true } } },
  });

  await prisma.auditLog.create({
    data: {
      actorId: req.user.id,
      action: 'UPDATE_INVENTORY_POLICY',
      entityType: 'InventoryPolicy',
      entityId: policy.id,
      details: { changes: req.body },
    },
  });

  res.json({ policy });
});

export default router;