import { Router } from 'express';
import { prisma } from '../index.js';
import { createUserSchema, updateUserSchema } from '../validators/auth.js';
import { validate } from '../utils/validation.js';
import { requireRole } from '../middleware/auth.js';
import bcrypt from 'bcryptjs';
import { ValidationError } from '../middleware/errorHandler.js';

const router = Router();

router.get('/', requireRole('ADMIN'), async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, email: true, role: true, status: true, createdAt: true },
    }),
    prisma.user.count(),
  ]);

  res.json({
    data: users,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

router.post('/', requireRole('ADMIN'), validate(createUserSchema), async (req, res) => {
  const { name, email, password, role } = req.body;

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    throw new ValidationError('Email already registered', { field: 'email' });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: { name, email: email.toLowerCase(), passwordHash, role },
    select: { id: true, name: true, email: true, role: true, status: true, createdAt: true },
  });

  await prisma.auditLog.create({
    data: {
      actorId: req.user.id,
      action: 'CREATE_USER',
      entityType: 'User',
      entityId: user.id,
      details: { email: user.email, role: user.role },
    },
  });

  res.status(201).json({ user });
});

router.get('/:id', requireRole('ADMIN'), async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: { id: true, name: true, email: true, role: true, status: true, createdAt: true, updatedAt: true },
  });

  if (!user) {
    return res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });
  }

  res.json({ user });
});

router.patch('/:id', requireRole('ADMIN'), validate(updateUserSchema), async (req, res) => {
  const { name, email, role, status } = req.body;
  const userId = req.params.id;

  if (email) {
    const existing = await prisma.user.findFirst({
      where: { email: email.toLowerCase(), NOT: { id: userId } },
    });
    if (existing) {
      throw new ValidationError('Email already in use', { field: 'email' });
    }
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { name, email: email?.toLowerCase(), role, status },
    select: { id: true, name: true, email: true, role: true, status: true, updatedAt: true },
  });

  await prisma.auditLog.create({
    data: {
      actorId: req.user.id,
      action: 'UPDATE_USER',
      entityType: 'User',
      entityId: user.id,
      details: { changes: req.body },
    },
  });

  res.json({ user });
});

export default router;