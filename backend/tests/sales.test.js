import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestServer, stopTestServer, apiRequest, getAuthToken, prisma } from './helpers.js';
import { v4 as uuidv4 } from 'uuid';

describe('Sales & Concurrency Suite', () => {
  let cashierToken;
  let testProduct;
  let testStoreId = 'default-store';

  beforeAll(async () => {
    await startTestServer();
    cashierToken = await getAuthToken('SALES_STAFF');

    // Create a dedicated product and inventory for isolated test runs
    testProduct = await prisma.product.create({
      data: {
        sku: `CONCUR-SKU-${Date.now()}`,
        name: 'Concurrency Test Item',
        sellingPrice: 50.00,
        costPrice: 20.00,
        active: true,
      },
    });

    await prisma.inventory.create({
      data: {
        storeId: testStoreId,
        productId: testProduct.id,
        quantityOnHand: 10,
        reservedQuantity: 0,
      },
    });
  });

  afterAll(async () => {
    if (testProduct) {
      await prisma.stockMovement.deleteMany({ where: { productId: testProduct.id } });
      const saleItems = await prisma.saleItem.findMany({
        where: { productId: testProduct.id },
        select: { id: true },
      });
      const saleItemIds = saleItems.map((si) => si.id);
      if (saleItemIds.length > 0) {
        await prisma.saleReturnItem.deleteMany({
          where: { saleItemId: { in: saleItemIds } },
        });
      }
      await prisma.saleItem.deleteMany({ where: { productId: testProduct.id } });
      await prisma.inventory.deleteMany({ where: { productId: testProduct.id } });
      await prisma.product.deleteMany({ where: { id: testProduct.id } });
    }
    await stopTestServer();
    await prisma.$disconnect();
  });

  it('POST /api/v1/sales checkouts successfully and deducts inventory atomically', async () => {
    const idempotencyKey = uuidv4();
    const res = await apiRequest('/api/v1/sales', {
      method: 'POST',
      token: cashierToken,
      body: {
        storeId: testStoreId,
        items: [{ productId: testProduct.id, quantity: 2 }],
        paymentMethod: 'CASH',
        idempotencyKey,
      },
    });

    expect(res.status).toBe(201);
    expect(res.body.sale).toBeDefined();
    expect(Number(res.body.sale.subtotal)).toBe(100);
    expect(Number(res.body.sale.taxTotal)).toBe(10);
    expect(Number(res.body.sale.total)).toBe(110);

    const inv = await prisma.inventory.findUnique({
      where: {
        storeId_productId: { storeId: testStoreId, productId: testProduct.id },
      },
    });
    expect(inv.quantityOnHand).toBe(8);

    const movement = await prisma.stockMovement.findFirst({
      where: { productId: testProduct.id, movementType: 'SALE' },
    });
    expect(movement).toBeDefined();
    expect(movement.quantityDelta).toBe(-2);
  });

  it('POST /api/v1/sales prevents double-submission via idempotency key', async () => {
    const idempotencyKey = uuidv4();
    const firstRes = await apiRequest('/api/v1/sales', {
      method: 'POST',
      token: cashierToken,
      body: {
        storeId: testStoreId,
        items: [{ productId: testProduct.id, quantity: 1 }],
        paymentMethod: 'CARD',
        idempotencyKey,
      },
    });
    expect(firstRes.status).toBe(201);

    const secondRes = await apiRequest('/api/v1/sales', {
      method: 'POST',
      token: cashierToken,
      body: {
        storeId: testStoreId,
        items: [{ productId: testProduct.id, quantity: 1 }],
        paymentMethod: 'CARD',
        idempotencyKey,
      },
    });
    expect(secondRes.status).toBe(200);
    expect(secondRes.body.sale.id).toBe(firstRes.body.sale.id);

    // Inventory should have been deducted only once (8 - 1 = 7)
    const inv = await prisma.inventory.findUnique({
      where: {
        storeId_productId: { storeId: testStoreId, productId: testProduct.id },
      },
    });
    expect(inv.quantityOnHand).toBe(7);
  });

  it('POST /api/v1/sales rejects checkout when stock is insufficient', async () => {
    const res = await apiRequest('/api/v1/sales', {
      method: 'POST',
      token: cashierToken,
      body: {
        storeId: testStoreId,
        items: [{ productId: testProduct.id, quantity: 999 }],
        paymentMethod: 'CASH',
        idempotencyKey: uuidv4(),
      },
    });

    expect([400, 409]).toContain(res.status);
    expect(res.body.error).toMatch(/Insufficient stock/i);
  });

  it('handles concurrent checkout attempts without overselling or negative inventory', async () => {
    // Current on hand is 7. Attempt 10 parallel checkouts of 1 unit each.
    // Exactly 7 should succeed and 3 should fail with Insufficient stock.
    const promises = Array.from({ length: 10 }).map(() =>
      apiRequest('/api/v1/sales', {
        method: 'POST',
        token: cashierToken,
        body: {
          storeId: testStoreId,
          items: [{ productId: testProduct.id, quantity: 1 }],
          paymentMethod: 'CASH',
          idempotencyKey: uuidv4(),
        },
      })
    );

    const results = await Promise.all(promises);
    const successCount = results.filter((r) => r.status === 201).length;
    const failCount = results.filter((r) => r.status === 400 || r.status === 409).length;

    expect(successCount).toBe(7);
    expect(failCount).toBe(3);

    const inv = await prisma.inventory.findUnique({
      where: {
        storeId_productId: { storeId: testStoreId, productId: testProduct.id },
      },
    });
    expect(inv.quantityOnHand).toBe(0);
  });

  it('POST /api/v1/sales/:id/returns processes return and restocks inventory correctly', async () => {
    // Restock 5 units to test return
    await prisma.inventory.update({
      where: {
        storeId_productId: { storeId: testStoreId, productId: testProduct.id },
      },
      data: { quantityOnHand: 5 },
    });

    // Make a sale of 3 units
    const saleRes = await apiRequest('/api/v1/sales', {
      method: 'POST',
      token: cashierToken,
      body: {
        storeId: testStoreId,
        items: [{ productId: testProduct.id, quantity: 3 }],
        paymentMethod: 'CASH',
        idempotencyKey: uuidv4(),
      },
    });
    expect(saleRes.status).toBe(201);
    const saleId = saleRes.body.sale.id;
    const saleItemId = saleRes.body.sale.items[0].id;

    // Return 2 units with restock
    const returnRes = await apiRequest(`/api/v1/sales/${saleId}/returns`, {
      method: 'POST',
      token: cashierToken,
      body: {
        items: [{ saleItemId, qtyReturned: 2, restockQty: 2, writeOffQty: 0 }],
        reason: 'Customer return',
      },
    });
    expect(returnRes.status).toBe(201);

    // Stock was 5 - 3 = 2, + 2 restock = 4
    const inv = await prisma.inventory.findUnique({
      where: {
        storeId_productId: { storeId: testStoreId, productId: testProduct.id },
      },
    });
    expect(inv.quantityOnHand).toBe(4);

    // Over-return should be rejected (attempting to return 2 more when only 1 is left refundable)
    const overReturnRes = await apiRequest(`/api/v1/sales/${saleId}/returns`, {
      method: 'POST',
      token: cashierToken,
      body: {
        items: [{ saleItemId, qtyReturned: 2, restockQty: 2, writeOffQty: 0 }],
        reason: 'Attempted over-return',
      },
    });
    expect(overReturnRes.status).toBe(400);
    expect(overReturnRes.body.error).toMatch(/Cannot return more than originally sold/i);

    // Return the final 1 unit with restock: false (damaged write-off)
    const finalReturnRes = await apiRequest(`/api/v1/sales/${saleId}/returns`, {
      method: 'POST',
      token: cashierToken,
      body: {
        items: [{ saleItemId, qtyReturned: 1, restockQty: 0, writeOffQty: 1 }],
        reason: 'Damaged item write-off',
      },
    });
    expect(finalReturnRes.status).toBe(201);

    // Inventory should remain 4 (write-off does not increase stock)
    const invAfterWriteOff = await prisma.inventory.findUnique({
      where: {
        storeId_productId: { storeId: testStoreId, productId: testProduct.id },
      },
    });
    expect(invAfterWriteOff.quantityOnHand).toBe(4);

    // Sale status should now be updated to REFUNDED
    const updatedSale = await prisma.sale.findUnique({ where: { id: saleId } });
    expect(updatedSale.status).toBe('REFUNDED');
  });
});
