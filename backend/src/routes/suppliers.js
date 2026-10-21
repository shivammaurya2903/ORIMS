import { Router } from 'express';
import { prisma } from '../index.js';
import { createSupplierSchema, updateSupplierSchema, supplierQuerySchema, supplierProductSchema, updateSupplierProductSchema } from '../validators/suppliers.js';
import { validate } from '../utils/validation.js';
import { requireRole } from '../middleware/auth.js';
import { NotFoundError, ValidationError } from '../middleware/errorHandler.js';

const router = Router();

router.get('/', validate(supplierQuerySchema), async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const search = req.query.search;
  const active = req.query.active !== undefined ? req.query.active === 'true' : undefined;
  const skip = (page - 1) * limit;

  const where = {};
  if (search) where.name = { contains: search };
  if (active !== undefined) where.active = active;

  const [suppliers, total] = await Promise.all([
    prisma.supplier.findMany({
      where,
      skip,
      take: limit,
      orderBy: { name: 'asc' },
      include: { _count: { select: { purchaseOrders: true, supplierProducts: true } } },
    }),
    prisma.supplier.count({ where }),
  ]);

  res.json({
    data: suppliers,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

router.post('/', requireRole('ADMIN', 'MANAGER'), validate(createSupplierSchema), async (req, res) => {
  const supplier = await prisma.supplier.create({ data: req.body });

  await prisma.auditLog.create({
    data: {
      actorId: req.user.id,
      action: 'CREATE_SUPPLIER',
      entityType: 'Supplier',
      entityId: supplier.id,
      details: { name: supplier.name },
    },
  });

  res.status(201).json({ supplier });
});

router.get('/:id', async (req, res) => {
  const supplier = await prisma.supplier.findUnique({
    where: { id: req.params.id },
    include: {
      supplierProducts: {
        include: { product: { select: { id: true, name: true, sku: true, sellingPrice: true } } },
      },
      purchaseOrders: {
        take: 10,
        orderBy: { orderDate: 'desc' },
        include: { items: { include: { product: { select: { name: true } } } } },
      },
    },
  });

  if (!supplier) {
    throw new NotFoundError('Supplier not found');
  }

  res.json({ supplier });
});

router.put('/:id', requireRole('ADMIN', 'MANAGER'), validate(updateSupplierSchema), async (req, res) => {
  const supplier = await prisma.supplier.update({
    where: { id: req.params.id },
    data: req.body,
  });

  await prisma.auditLog.create({
    data: {
      actorId: req.user.id,
      action: 'UPDATE_SUPPLIER',
      entityType: 'Supplier',
      entityId: supplier.id,
      details: { changes: req.body },
    },
  });

  res.json({ supplier });
});

router.post('/:supplierId/products', requireRole('ADMIN', 'MANAGER'), validate(supplierProductSchema), async (req, res) => {
  const { supplierId } = req.params;
  const { productId, leadTimeDays, minOrderQty, packMultiple, unitCost } = req.body;

  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
  if (!supplier) throw new NotFoundError('Supplier not found');

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new NotFoundError('Product not found');

  const existing = await prisma.supplierProduct.findUnique({
    where: { supplierId_productId: { supplierId, productId } },
  });
  if (existing) throw new ValidationError('Product already linked to this supplier');

  const supplierProduct = await prisma.supplierProduct.create({
    data: { supplierId, productId, leadTimeDays, minOrderQty, packMultiple, unitCost },
    include: { product: { select: { id: true, name: true, sku: true } } },
  });

  res.status(201).json({ supplierProduct });
});

router.put('/:supplierId/products/:productId', requireRole('ADMIN', 'MANAGER'), validate(updateSupplierProductSchema), async (req, res) => {
  const { supplierId, productId } = req.params;

  const supplierProduct = await prisma.supplierProduct.update({
    where: { supplierId_productId: { supplierId, productId } },
    data: req.body,
    include: { product: { select: { id: true, name: true, sku: true } } },
  });

  res.json({ supplierProduct });
});

router.delete('/:supplierId/products/:productId', requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  const { supplierId, productId } = req.params;

  await prisma.supplierProduct.delete({
    where: { supplierId_productId: { supplierId, productId } },
  });

  res.json({ message: 'Supplier product link removed' });
});

export default router;