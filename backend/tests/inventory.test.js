import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestServer, stopTestServer, apiRequest, getAuthToken, prisma } from './helpers.js';

describe('Inventory & Stock Ledger Suite', () => {
  let adminToken;
  let testProduct;
  let testStoreId = 'default-store';

  beforeAll(async () => {
    await startTestServer();
    adminToken = await getAuthToken('ADMIN');

    testProduct = await prisma.product.create({
      data: {
        sku: `INV-TEST-${Date.now()}`,
        name: 'Inventory Test Product',
        sellingPrice: 15.00,
        costPrice: 8.00,
        active: true,
      },
    });

    await prisma.inventory.create({
      data: {
        storeId: testStoreId,
        productId: testProduct.id,
        quantityOnHand: 5,
        reservedQuantity: 0,
      },
    });
  });

  afterAll(async () => {
    if (testProduct) {
      await prisma.stockMovement.deleteMany({ where: { productId: testProduct.id } });
      await prisma.inventory.deleteMany({ where: { productId: testProduct.id } });
      await prisma.product.deleteMany({ where: { id: testProduct.id } });
    }
    await stopTestServer();
    await prisma.$disconnect();
  });

  it('GET /api/v1/inventory returns paginated inventory items', async () => {
    const res = await apiRequest('/api/v1/inventory', { token: adminToken });
    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(res.body.pagination).toBeDefined();
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('POST /api/v1/inventory/adjustments increases stock and writes to ledger', async () => {
    const res = await apiRequest('/api/v1/inventory/adjustments', {
      method: 'POST',
      token: adminToken,
      body: {
        storeId: testStoreId,
        productId: testProduct.id,
        quantityDelta: 10,
        reason: 'Initial stock intake adjustment',
        movementType: 'ADJUSTMENT_INCREASE',
      },
    });

    expect(res.status).toBe(200);
    expect(res.body.inventory.quantityOnHand).toBe(15);
    expect(res.body.movement.movementType).toBe('ADJUSTMENT_INCREASE');

    const inv = await prisma.inventory.findUnique({
      where: {
        storeId_productId: { storeId: testStoreId, productId: testProduct.id },
      },
    });
    expect(inv.quantityOnHand).toBe(15);
  });

  it('POST /api/v1/inventory/adjustments decrements stock for damages', async () => {
    const res = await apiRequest('/api/v1/inventory/adjustments', {
      method: 'POST',
      token: adminToken,
      body: {
        storeId: testStoreId,
        productId: testProduct.id,
        quantityDelta: -3,
        reason: 'Water damaged units',
        movementType: 'DAMAGE',
      },
    });

    expect(res.status).toBe(200);
    expect(res.body.inventory.quantityOnHand).toBe(12);

    const inv = await prisma.inventory.findUnique({
      where: {
        storeId_productId: { storeId: testStoreId, productId: testProduct.id },
      },
    });
    expect(inv.quantityOnHand).toBe(12);
  });

  it('POST /api/v1/inventory/adjustments rejects adjustments causing negative inventory', async () => {
    const res = await apiRequest('/api/v1/inventory/adjustments', {
      method: 'POST',
      token: adminToken,
      body: {
        storeId: testStoreId,
        productId: testProduct.id,
        quantityDelta: -999,
        reason: 'Excessive subtraction test',
        movementType: 'ADJUSTMENT_DECREASE',
      },
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Adjustment would result in negative stock/i);

    // Ensure inventory remained unchanged
    const inv = await prisma.inventory.findUnique({
      where: {
        storeId_productId: { storeId: testStoreId, productId: testProduct.id },
      },
    });
    expect(inv.quantityOnHand).toBe(12);
  });

  it('GET /api/v1/inventory/:productId/movements returns movement audit trail', async () => {
    const res = await apiRequest(`/api/v1/inventory/${testProduct.id}/movements`, {
      token: adminToken,
    });

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
  });
});
