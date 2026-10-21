import { z } from 'zod';

export const inventoryQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    search: z.string().optional(),
    categoryId: z.string().uuid().optional(),
    storeId: z.string().min(1).optional(),
    stockStatus: z.enum(['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK']).optional(),
    sort: z.enum(['productName', 'onHand', 'available', 'updatedAt']).default('productName'),
    order: z.enum(['asc', 'desc']).default('asc'),
  }),
});

export const adjustmentSchema = z.object({
  body: z.object({
    productId: z.string().uuid(),
    storeId: z.string().min(1),
    quantityDelta: z.number().int().refine(val => val !== 0, 'Quantity must not be zero'),
    reason: z.string().min(1).max(500),
    movementType: z.enum(['ADJUSTMENT_INCREASE', 'ADJUSTMENT_DECREASE', 'DAMAGE', 'WASTAGE']),
  }),
});

export const inventoryDetailQuerySchema = z.object({
  params: z.object({
    productId: z.string().uuid(),
  }),
  query: z.object({
    storeId: z.string().min(1).optional(),
  }),
});

export const movementsQuerySchema = z.object({
  params: z.object({
    productId: z.string().uuid(),
  }),
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(50),
    storeId: z.string().min(1).optional(),
    movementType: z.enum(['SALE', 'PURCHASE_RECEIPT', 'ADJUSTMENT_INCREASE', 'ADJUSTMENT_DECREASE', 'RETURN_RESTOCK', 'RETURN_WRITE_OFF', 'DAMAGE', 'WASTAGE', 'TRANSFER_IN', 'TRANSFER_OUT']).optional(),
    startDate: z.string().refine(v => !isNaN(Date.parse(v)), { message: "Invalid date format" }).optional(),
    endDate: z.string().refine(v => !isNaN(Date.parse(v)), { message: "Invalid date format" }).optional(),
  }),
});