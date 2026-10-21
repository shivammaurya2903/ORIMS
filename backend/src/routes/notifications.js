import { Router } from 'express';
import { prisma } from '../index.js';
import { notificationsQuerySchema, markNotificationReadSchema } from '../validators/notifications.js';
import { validate } from '../utils/validation.js';
import { NotFoundError } from '../middleware/errorHandler.js';

const router = Router();

router.get('/', validate(notificationsQuerySchema), async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const status = req.query.status;
  const type = req.query.type;
  const skip = (page - 1) * limit;

  const where = {};
  if (status) where.status = status;
  if (type) where.type = type;
  // Add store filtering based on user role
  // For now, show all notifications

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        store: { select: { id: true, name: true } },
        product: { select: { id: true, name: true, sku: true } },
      },
    }),
    prisma.notification.count({ where }),
  ]);

  res.json({
    data: notifications,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

router.patch('/:id/read', validate(markNotificationReadSchema), async (req, res) => {
  const notification = await prisma.notification.update({
    where: { id: req.params.id },
    data: { status: 'READ', readAt: new Date() },
  });

  if (!notification) {
    throw new NotFoundError('Notification not found');
  }

  res.json({ notification });
});

router.patch('/read-all', async (req, res) => {
  await prisma.notification.updateMany({
    where: { status: 'UNREAD' },
    data: { status: 'READ', readAt: new Date() },
  });

  res.json({ message: 'All notifications marked as read' });
});

export default router;