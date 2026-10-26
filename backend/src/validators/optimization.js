import { z } from 'zod';

const dateRefinement = z.string().refine(v => !isNaN(Date.parse(v)), { message: "Invalid date format" });

export const recommendationsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    storeId: z.string().min(1).optional(),
    productId: z.string().uuid().optional(),
    categoryId: z.string().uuid().optional(),
    status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CONVERTED_TO_PO']).optional(),
    riskLevel: z.enum(['HIGH', 'MEDIUM', 'LOW']).optional(),
    sort: z.enum(['calculatedAt', 'createdAt', 'rawSuggestedQty', 'finalSuggestedQty', 'targetStock', 'onHandQty', 'urgency']).default('calculatedAt'),
    order: z.enum(['asc', 'desc']).default('desc'),
  }),
});

export const approveRecommendationSchema = z.object({
  body: z.object({
    approvedQty: z.number().int().nonnegative().optional(),
    createPurchaseOrder: z.boolean().default(false),
  }),
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const rejectRecommendationSchema = z.object({
  body: z.object({
    reason: z.string().min(1).max(500),
  }),
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const recalculateSchema = z.object({
  body: z.object({
    storeId: z.string().min(1).optional(),
    productIds: z.array(z.string().uuid()).optional(),
  }),
});

export const forecastsQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    storeId: z.string().min(1).optional(),
    productId: z.string().uuid().optional(),
    modelVersion: z.string().optional(),
    forecastMethod: z.enum(['MODEL', 'BASELINE_MOVING_AVERAGE', 'BASELINE_DAY_OF_WEEK', 'INSUFFICIENT_DATA', 'FALLBACK', 'MODEL_QUANTILE']).optional(),
    startDate: dateRefinement.optional(),
    endDate: dateRefinement.optional(),
  }),
});

export const slowMovingQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    storeId: z.string().min(1).optional(),
    categoryId: z.string().uuid().optional(),
    daysNoSale: z.coerce.number().int().positive().default(30),
  }),
});

export const expiryRiskQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    storeId: z.string().min(1).optional(),
    daysUntilExpiry: z.coerce.number().int().positive().default(30),
  }),
});
