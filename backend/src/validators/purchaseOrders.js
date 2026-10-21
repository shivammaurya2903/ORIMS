import { z } from 'zod';

const dateRefinement = z.string().refine(v => !isNaN(Date.parse(v)), { message: "Invalid date format" });

export const createPurchaseOrderSchema = z.object({
  body: z.object({
    supplierId: z.string().uuid(),
    storeId: z.string().min(1),
    expectedDate: dateRefinement.optional().nullable(),
    items: z.array(z.object({
      productId: z.string().uuid(),
      orderedQty: z.number().int().positive(),
      unitCost: z.number().nonnegative().multipleOf(0.0001),
      taxRate: z.number().nonnegative().max(1).default(0),
      discount: z.number().nonnegative().multipleOf(0.0001).default(0),
    })).min(1, 'At least one item required'),
  }),
});

export const purchaseOrderQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    supplierId: z.string().uuid().optional(),
    storeId: z.string().min(1).optional(),
    status: z.enum(['DRAFT', 'SUBMITTED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED']).optional(),
    startDate: dateRefinement.optional(),
    endDate: dateRefinement.optional(),
    sort: z.enum(['orderDate', 'expectedDate', 'createdAt']).default('createdAt'),
    order: z.enum(['asc', 'desc']).default('desc'),
  }),
});

export const submitPurchaseOrderSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const receivePurchaseOrderSchema = z.object({
  body: z.object({
    receiptReference: z.string().min(1).max(100),
    supplierDeliveryRef: z.string().max(100).optional().nullable(),
    items: z.array(z.object({
      purchaseOrderItemId: z.string().uuid(),
      qtyReceived: z.number().int().positive(),
      unitCost: z.number().nonnegative().multipleOf(0.0001),
      batchNumber: z.string().max(50).optional().nullable(),
      batchExpiryDate: dateRefinement.optional().nullable(),
    })).min(1),
  }),
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const cancelPurchaseOrderSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});

export const purchaseOrderDetailSchema = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
});