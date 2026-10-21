import { Router } from 'express';
import { prisma } from '../index.js';
import { createProductSchema, updateProductSchema, productStatusSchema, productQuerySchema } from '../validators/products.js';
import { validate } from '../utils/validation.js';
import { requireRole } from '../middleware/auth.js';
import { NotFoundError, ValidationError } from '../middleware/errorHandler.js';

const router = Router();

router.get('/', validate(productQuerySchema), async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const search = req.query.search;
  const categoryId = req.query.categoryId;
  const active = req.query.active !== undefined ? req.query.active === 'true' : undefined;
  const sort = req.query.sort || 'createdAt';
  const order = req.query.order || 'desc';
  const skip = (page - 1) * limit;

  const where = {};
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { sku: { contains: search } },
      { barcode: { contains: search } },
    ];
  }
  if (categoryId) where.categoryId = categoryId;
  if (active !== undefined) where.active = active;

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sort]: order },
      include: {
        category: { select: { id: true, name: true } },
        inventory: { select: { quantityOnHand: true, reservedQuantity: true, storeId: true } },
      },
    }),
    prisma.product.count({ where }),
  ]);

  const data = products.map(p => ({
    ...p,
    totalOnHand: p.inventory.reduce((sum, i) => sum + i.quantityOnHand, 0),
    totalReserved: p.inventory.reduce((sum, i) => sum + i.reservedQuantity, 0),
    totalAvailable: p.inventory.reduce((sum, i) => sum + i.quantityOnHand - i.reservedQuantity, 0),
  }));

  res.json({
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

router.post('/', requireRole('ADMIN', 'MANAGER'), validate(createProductSchema), async (req, res) => {
  const { sku, barcode, ...data } = req.body;
  
  if (barcode) {
    const existing = await prisma.product.findUnique({ where: { barcode } });
    if (existing) {
      throw new ValidationError('Barcode already exists', { field: 'barcode' });
    }
  }

  const product = await prisma.product.create({
    data: { sku: sku.toUpperCase(), barcode: barcode?.toUpperCase() || null, ...data },
    include: { category: { select: { id: true, name: true } } },
  });

  await prisma.auditLog.create({
    data: {
      actorId: req.user.id,
      action: 'CREATE_PRODUCT',
      entityType: 'Product',
      entityId: product.id,
      details: { sku: product.sku, name: product.name },
    },
  });

  res.status(201).json({ product });
});

router.get('/:id', async (req, res) => {
  const product = await prisma.product.findUnique({
    where: { id: req.params.id },
    include: {
      category: { select: { id: true, name: true } },
      inventory: { include: { store: { select: { id: true, name: true } } } },
      supplierProducts: { include: { supplier: { select: { id: true, name: true } } } },
      inventoryPolicies: { include: { store: { select: { id: true, name: true } } } },
    },
  });

  if (!product) {
    throw new NotFoundError('Product not found');
  }

  res.json({ product });
});

router.put('/:id', requireRole('ADMIN', 'MANAGER'), validate(updateProductSchema), async (req, res) => {
  const { sku, barcode, ...data } = req.body;
  
  if (barcode) {
    const existing = await prisma.product.findFirst({
      where: { barcode: barcode.toUpperCase(), NOT: { id: req.params.id } },
    });
    if (existing) {
      throw new ValidationError('Barcode already exists', { field: 'barcode' });
    }
  }

  const product = await prisma.product.update({
    where: { id: req.params.id },
    data: { 
      sku: sku?.toUpperCase(), 
      barcode: barcode?.toUpperCase() || null, 
      ...data 
    },
    include: { category: { select: { id: true, name: true } } },
  });

  await prisma.auditLog.create({
    data: {
      actorId: req.user.id,
      action: 'UPDATE_PRODUCT',
      entityType: 'Product',
      entityId: product.id,
      details: { changes: req.body },
    },
  });

  res.json({ product });
});

router.patch('/:id/status', requireRole('ADMIN', 'MANAGER'), validate(productStatusSchema), async (req, res) => {
  const product = await prisma.product.update({
    where: { id: req.params.id },
    data: { active: req.body.active },
    include: { category: { select: { id: true, name: true } } },
  });

  await prisma.auditLog.create({
    data: {
      actorId: req.user.id,
      action: req.body.active ? 'ACTIVATE_PRODUCT' : 'DEACTIVATE_PRODUCT',
      entityType: 'Product',
      entityId: product.id,
    },
  });

  res.json({ product });
});

export default router;