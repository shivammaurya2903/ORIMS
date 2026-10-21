import { z } from 'zod';

export const createSupplierSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(200),
    email: z.string().email().optional().nullable(),
    phone: z.string().max(50).optional().nullable(),
    address: z.string().max(500).optional().nullable(),
    notes: z.string().max(1000).optional().nullable(),
  }),
});

export const updateSupplierSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(200).optional(),
    email: z.string().email().optional().nullable(),
    phone: z.string().max(50).optional().nullable(),
    address: z.string().max(500).optional().nullable(),
    notes: z.string().max(1000).optional().nullable(),
    active: z.boolean().optional(),
  }),
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const supplierQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    search: z.string().optional(),
    active: z.coerce.boolean().optional(),
  }),
});

export const supplierProductSchema = z.object({
  body: z.object({
    productId: z.string().uuid(),
    leadTimeDays: z.number().int().nonnegative().default(7),
    minOrderQty: z.number().int().positive().default(1),
    packMultiple: z.number().int().positive().default(1),
    unitCost: z.number().nonnegative().multipleOf(0.0001),
  }),
  params: z.object({
    supplierId: z.string().uuid(),
  }),
});

export const updateSupplierProductSchema = z.object({
  body: z.object({
    leadTimeDays: z.number().int().nonnegative().optional(),
    minOrderQty: z.number().int().positive().optional(),
    packMultiple: z.number().int().positive().optional(),
    unitCost: z.number().nonnegative().multipleOf(0.0001).optional(),
    active: z.boolean().optional(),
  }),
  params: z.object({
    supplierId: z.string().uuid(),
    productId: z.string().uuid(),
  }),
});