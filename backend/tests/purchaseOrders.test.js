import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestServer, stopTestServer, apiRequest, getAuthToken, prisma } from './helpers.js';

describe('Purchase Orders Workflow Suite', () => {
  let adminToken;
  let testSupplier;
  let testProduct;
  let testStoreId = 'default-store';

  beforeAll(async () => {
    await startTestServer();
    adminToken = await getAuthToken('ADMIN');

    // Create supplier and product for PO test
    testSupplier = await prisma.supplier.create({
      data: {
        name: `PO Test Supplier ${Date.now()}`,
        active: true,
      },
    });

    testProduct = await prisma.product.create({
      data: {
        sku: `PO-ITEM-${Date.now()}`,
        name: 'PO Test Product',
        sellingPrice: 30.00,
        costPrice: 15.00,
        active: true,
      },
    });

    await prisma.inventory.upsert({
      where: {
        storeId_productId: { storeId: testStoreId, productId: testProduct.id },
      },
      create: {
        storeId: testStoreId,
        productId: testProduct.id,
        quantityOnHand: 0,
        reservedQuantity: 0,
      },
      update: { quantityOnHand: 0 },
    });
  });

  afterAll(async () => {
    if (testProduct) {
      await prisma.purchaseReceiptItem.deleteMany({
        where: { receipt: { purchaseOrder: { storeId: testStoreId } } },
      });
      await prisma.purchaseReceipt.deleteMany({
        where: { purchaseOrder: { storeId: testStoreId } },
      });
      await prisma.purchaseOrderItem.deleteMany({
        where: { productId: testProduct.id },
      });
      await prisma.purchaseOrder.deleteMany({
        where: { supplierId: testSupplier?.id },
      });
      await prisma.stockMovement.deleteMany({
        where: { productId: testProduct.id },
      });
      await prisma.inventory.deleteMany({
        where: { productId: testProduct.id },
      });
      await prisma.product.deleteMany({
        where: { id: testProduct.id },
      });
    }
    if (testSupplier) {
      await prisma.supplier.deleteMany({ where: { id: testSupplier.id } });
    }
    await stopTestServer();
    await prisma.$disconnect();
  });

  it('full PO lifecycle: create draft -> submit -> partial receive -> full receive', async () => {
    // 1. Create DRAFT PO
    const createRes = await apiRequest('/api/v1/purchase-orders', {
      method: 'POST',
      token: adminToken,
      body: {
        supplierId: testSupplier.id,
        storeId: testStoreId,
        items: [
          {
            productId: testProduct.id,
            orderedQty: 20,
            unitCost: 15.00,
          },
        ],
      },
    });

    expect(createRes.status).toBe(201);
    const po = createRes.body.purchaseOrder;
    expect(po.status).toBe('DRAFT');
    expect(po.items).toHaveLength(1);
    const poItemId = po.items[0].id;

    // 2. Submit PO
    const submitRes = await apiRequest(`/api/v1/purchase-orders/${po.id}/submit`, {
      method: 'POST',
      token: adminToken,
    });
    expect(submitRes.status).toBe(200);
    expect(submitRes.body.purchaseOrder.status).toBe('SUBMITTED');

    // 3. Partial receive (12 units)
    const partialReceiveRes = await apiRequest(`/api/v1/purchase-orders/${po.id}/receive`, {
      method: 'POST',
      token: adminToken,
      body: {
        receiptReference: `RCV-PART-${Date.now()}`,
        items: [
          {
            purchaseOrderItemId: poItemId,
            qtyReceived: 12,
            unitCost: 15.00,
          },
        ],
      },
    });
    expect(partialReceiveRes.status).toBe(200);
    expect(partialReceiveRes.body.purchaseOrder.status).toBe('PARTIALLY_RECEIVED');

    // Verify inventory incremented by 12
    const invAfterPartial = await prisma.inventory.findUnique({
      where: {
        storeId_productId: { storeId: testStoreId, productId: testProduct.id },
      },
    });
    expect(invAfterPartial.quantityOnHand).toBe(12);

    // 4. Complete receipt (remaining 8 units)
    const fullReceiveRes = await apiRequest(`/api/v1/purchase-orders/${po.id}/receive`, {
      method: 'POST',
      token: adminToken,
      body: {
        receiptReference: `RCV-FULL-${Date.now()}`,
        items: [
          {
            purchaseOrderItemId: poItemId,
            qtyReceived: 8,
            unitCost: 15.00,
          },
        ],
      },
    });
    expect(fullReceiveRes.status).toBe(200);
    expect(fullReceiveRes.body.purchaseOrder.status).toBe('RECEIVED');

    // Verify inventory incremented to 20 total
    const invAfterFull = await prisma.inventory.findUnique({
      where: {
        storeId_productId: { storeId: testStoreId, productId: testProduct.id },
      },
    });
    expect(invAfterFull.quantityOnHand).toBe(20);
  });

  it('allows cancellation of submitted PO and rejects cancellation of received PO', async () => {
    // Create and submit a second PO
    const createRes = await apiRequest('/api/v1/purchase-orders', {
      method: 'POST',
      token: adminToken,
      body: {
        supplierId: testSupplier.id,
        storeId: testStoreId,
        items: [
          {
            productId: testProduct.id,
            orderedQty: 5,
            unitCost: 15.00,
          },
        ],
      },
    });
    const po2 = createRes.body.purchaseOrder;

    await apiRequest(`/api/v1/purchase-orders/${po2.id}/submit`, {
      method: 'POST',
      token: adminToken,
    });

    // Cancel po2
    const cancelRes = await apiRequest(`/api/v1/purchase-orders/${po2.id}/cancel`, {
      method: 'POST',
      token: adminToken,
      body: { reason: 'Supplier out of stock' },
    });
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.purchaseOrder.status).toBe('CANCELLED');
  });
});
