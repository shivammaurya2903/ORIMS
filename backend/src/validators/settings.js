import { z } from 'zod';

export const storeSettingsSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    location: z.string().max(200).optional(),
    taxRate: z.number().nonnegative().max(1).optional(),
    currency: z.string().length(3).optional(),
    timezone: z.string().optional(),
  }),
});

export const inventoryPolicySchema = z.object({
  body: z.object({
    productId: z.string().uuid(),
    storeId: z.string().min(1).optional(),
    safetyStock: z.number().int().nonnegative().optional(),
    serviceLevel: z.number().min(0).max(1).optional(),
    reviewPeriod: z.number().int().positive().optional(),
    minLevel: z.number().int().nonnegative().optional().nullable(),
    maxLevel: z.number().int().nonnegative().optional().nullable(),
  }),
});

export const updateInventoryPolicySchema = z.object({
  body: z.object({
    storeId: z.string().min(1).optional(),
    safetyStock: z.number().int().nonnegative().optional(),
    serviceLevel: z.number().min(0).max(1).optional(),
    reviewPeriod: z.number().int().positive().optional(),
    minLevel: z.number().int().nonnegative().optional().nullable(),
    maxLevel: z.number().int().nonnegative().optional().nullable(),
  }),
  params: z.object({
    productId: z.string().uuid(),
  }),
});