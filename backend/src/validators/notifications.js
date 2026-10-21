import { z } from 'zod';

export const notificationsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    status: z.enum(['UNREAD', 'READ', 'ARCHIVED']).optional(),
    type: z.enum(['LOW_STOCK', 'OUT_OF_STOCK', 'EXPIRY_WARNING', 'EXPIRY_EXPIRED', 'PURCHASE_ORDER_DUE', 'FORECAST_AVAILABLE']).optional(),
  }),
});

export const markNotificationReadSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});