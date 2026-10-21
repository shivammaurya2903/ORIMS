import { z } from 'zod';

export const createProductSchema = z.object({
  body: z.object({
    sku: z.string().min(1).max(50).regex(/^[A-Z0-9_-]+$/, 'SKU must be uppercase alphanumeric with hyphens/underscores'),
    barcode: z.string().max(50).optional().nullable(),
    name: z.string().min(1).max(200),
    description: z.string().max(1000).optional(),
    categoryId: z.string().uuid().optional().nullable(),
    costPrice: z.number().nonnegative().multipleOf(0.0001),
    sellingPrice: z.number().nonnegative().multipleOf(0.0001),
    unitOfMeasure: z.string().max(20).default('EA'),
  }),
});

export const updateProductSchema = z.object({
  body: z.object({
    sku: z.string().min(1).max(50).regex(/^[A-Z0-9_-]+$/).optional(),
    barcode: z.string().max(50).optional().nullable(),
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(1000).optional(),
    categoryId: z.string().uuid().optional().nullable(),
    costPrice: z.number().nonnegative().multipleOf(0.0001).optional(),
    sellingPrice: z.number().nonnegative().multipleOf(0.0001).optional(),
    unitOfMeasure: z.string().max(20).optional(),
  }),
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const productStatusSchema = z.object({
  body: z.object({
    active: z.boolean(),
  }),
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const productQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    search: z.string().optional(),
    categoryId: z.string().uuid().optional(),
    active: z.coerce.boolean().optional(),
    sort: z.enum(['name', 'sku', 'sellingPrice', 'createdAt']).default('createdAt'),
    order: z.enum(['asc', 'desc']).default('desc'),
  }),
});