import { z } from 'zod';

const dateRefinement = z.string().refine(v => !isNaN(Date.parse(v)), { message: "Invalid date format" });

export const salesReportSchema = z.object({
  query: z.object({
    startDate: dateRefinement,
    endDate: dateRefinement,
    storeId: z.string().min(1).optional(),
    groupBy: z.enum(['day', 'week', 'month']).default('day'),
  }),
});

export const inventoryValuationSchema = z.object({
  query: z.object({
    storeId: z.string().min(1).optional(),
    categoryId: z.string().uuid().optional(),
    valuationMethod: z.enum(['CURRENT_COST', 'WEIGHTED_AVERAGE']).default('CURRENT_COST'),
  }),
});

export const turnoverReportSchema = z.object({
  query: z.object({
    startDate: dateRefinement,
    endDate: dateRefinement,
    storeId: z.string().min(1).optional(),
    categoryId: z.string().uuid().optional(),
  }),
});

export const stockMovementReportSchema = z.object({
  query: z.object({
    startDate: dateRefinement,
    endDate: dateRefinement,
    storeId: z.string().min(1).optional(),
    productId: z.string().uuid().optional(),
    movementType: z.enum(['SALE', 'PURCHASE_RECEIPT', 'ADJUSTMENT_INCREASE', 'ADJUSTMENT_DECREASE', 'RETURN_RESTOCK', 'RETURN_WRITE_OFF', 'DAMAGE', 'WASTAGE', 'TRANSFER_IN', 'TRANSFER_OUT']).optional(),
  }),
});

export const expiryRiskReportSchema = z.object({
  query: z.object({
    storeId: z.string().min(1).optional(),
    daysAhead: z.coerce.number().int().positive().default(30),
  }),
});