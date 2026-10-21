import { Router } from 'express';
import { prisma } from '../index.js';
import { createCategorySchema, updateCategorySchema, categoryQuerySchema } from '../validators/categories.js';
import { validate } from '../utils/validation.js';
import { requireRole } from '../middleware/auth.js';
import { NotFoundError } from '../middleware/errorHandler.js';

const router = Router();

router.get('/', validate(categoryQuerySchema), async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const search = req.query.search;
  const skip = (page - 1) * limit;

  const where = search ? { name: { contains: search } } : {};

  const [categories, total] = await Promise.all([
    prisma.category.findMany({
      where,
      skip,
      take: limit,
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } } },
    }),
    prisma.category.count({ where }),
  ]);

  res.json({
    data: categories,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

router.post('/', requireRole('ADMIN', 'MANAGER'), validate(createCategorySchema), async (req, res) => {
  const category = await prisma.category.create({
    data: req.body,
    include: { _count: { select: { products: true } } },
  });

  await prisma.auditLog.create({
    data: {
      actorId: req.user.id,
      action: 'CREATE_CATEGORY',
      entityType: 'Category',
      entityId: category.id,
      details: { name: category.name },
    },
  });

  res.status(201).json({ category });
});

router.get('/:id', async (req, res) => {
  const category = await prisma.category.findUnique({
    where: { id: req.params.id },
    include: { _count: { select: { products: true } } },
  });

  if (!category) {
    throw new NotFoundError('Category not found');
  }

  res.json({ category });
});

router.put('/:id', requireRole('ADMIN', 'MANAGER'), validate(updateCategorySchema), async (req, res) => {
  const category = await prisma.category.update({
    where: { id: req.params.id },
    data: req.body,
    include: { _count: { select: { products: true } } },
  });

  await prisma.auditLog.create({
    data: {
      actorId: req.user.id,
      action: 'UPDATE_CATEGORY',
      entityType: 'Category',
      entityId: category.id,
      details: { changes: req.body },
    },
  });

  res.json({ category });
});

export default router;