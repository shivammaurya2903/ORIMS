import { z } from 'zod';

export const checkoutSchema = z.object({
  body: z.object({
    items: z.array(z.object({
      productId: z.string().uuid(),
      quantity: z.number().int().positive(),
    })).min(1, 'At least one item required'),
    paymentMethod: z.string().max(50).optional(),
    idempotencyKey: z.string().uuid(),
  }),
});

const dateRefinement = z.string().refine(v => !isNaN(Date.parse(v)), { message: "Invalid date format" });

export const salesQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    startDate: dateRefinement.optional(),
    endDate: dateRefinement.optional(),
    status: z.enum(['COMPLETED', 'CANCELLED', 'REFUNDED']).optional(),
    receiptNumber: z.string().optional(),
    createdBy: z.string().uuid().optional(),
    sort: z.enum(['createdAt', 'total', 'receiptNumber']).default('createdAt'),
    order: z.enum(['asc', 'desc']).default('desc'),
  }),
});

export const returnSchema = z.object({
  body: z.object({
    items: z.array(z.object({
      saleItemId: z.string().uuid(),
      qtyReturned: z.number().int().positive(),
      restockQty: z.number().int().nonnegative(),
      writeOffQty: z.number().int().nonnegative(),
    })).min(1),
    reason: z.string().min(1).max(500),
  }),
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const saleDetailSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});