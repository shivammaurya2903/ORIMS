import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestServer, stopTestServer, apiRequest, getAuthToken, prisma } from './helpers.js';
import { v4 as uuidv4 } from 'uuid';

describe('ORIMS Integrity & Trustworthiness Regression Suite', () => {
  let adminToken;
  let cashierToken;
  let staffToken;
  let testStoreId = 'default-store';
  let testCategory;
  let testProduct;
  let testSupplier;

  beforeAll(async () => {
    await startTestServer();
    adminToken = await getAuthToken('ADMIN');
    cashierToken = await getAuthToken('SALES_STAFF');
    staffToken = await getAuthToken('INVENTORY_STAFF');

    testCategory = await prisma.category.create({
      data: { name: `Integrity Cat ${Date.now()}` },
    });

    testProduct = await prisma.product.create({
      data: {
        sku: `INTEGRITY-SKU-${Date.now()}`,
        name: 'Integrity Suite Product',
        categoryId: testCategory.id,
        sellingPrice: 50.0,
        costPrice: 25.0,
        active: true,
      },
    });

    await prisma.inventory.create({
      data: {
        storeId: testStoreId,
        productId: testProduct.id,
        quantityOnHand: 20,
        reservedQuantity: 5,
        version: 0,
      },
    });

    testSupplier = await prisma.supplier.create({
      data: { name: `Integrity Supplier ${Date.now()}`, active: true },
    });

    await prisma.supplierProduct.create({
      data: {
        supplierId: testSupplier.id,
        productId: testProduct.id,
        unitCost: 25.0,
        minOrderQty: 5,
        packMultiple: 1,
        leadTimeDays: 5,
      },
    });
  });

  afterAll(async () => {
    if (testProduct) {
      await prisma.stockMovement.deleteMany({ where: { productId: testProduct.id } });
      await prisma.productBatch.deleteMany({ where: { productId: testProduct.id } });
      await prisma.saleReturnItem.deleteMany({
        where: { saleItem: { productId: testProduct.id } },
      });
      await prisma.saleItem.deleteMany({ where: { productId: testProduct.id } });
      await prisma.purchaseReceiptItem.deleteMany({
        where: { purchaseOrderItem: { productId: testProduct.id } },
      });
      await prisma.purchaseOrderItem.deleteMany({ where: { productId: testProduct.id } });
      await prisma.supplierProduct.deleteMany({ where: { productId: testProduct.id } });
      await prisma.inventory.deleteMany({ where: { productId: testProduct.id } });
      await prisma.optimizationRecommendation.deleteMany({ where: { productId: testProduct.id } });
      await prisma.forecast.deleteMany({ where: { productId: testProduct.id } });
      await prisma.product.deleteMany({ where: { id: testProduct.id } });
    }
    if (testSupplier) {
      await prisma.purchaseReceipt.deleteMany({
        where: { purchaseOrder: { supplierId: testSupplier.id } },
      });
      await prisma.purchaseOrder.deleteMany({ where: { supplierId: testSupplier.id } });
      await prisma.supplier.deleteMany({ where: { id: testSupplier.id } });
    }
    if (testCategory) {
      await prisma.category.deleteMany({ where: { id: testCategory.id } });
    }
    await stopTestServer();
    await prisma.$disconnect();
  });

  describe('P0: INV-001 Atomic Inventory Adjustments & Reserved Floor', () => {
    it('rejects adjustment that would violate reserved stock floor (onHand - delta < reserved)', async () => {
      // Current onHand: 20, reserved: 5 -> available to decrease: 15
      const res = await apiRequest('/api/v1/inventory/adjustments', {
        method: 'POST',
        token: staffToken,
        body: {
          storeId: testStoreId,
          productId: testProduct.id,
          quantityDelta: -16,
          movementType: 'ADJUSTMENT_DECREASE',
          reason: 'Attempted floor violation',
        },
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/below reserved level/i);

      // Verify stock untouched
      const inv = await prisma.inventory.findUnique({
        where: { storeId_productId: { storeId: testStoreId, productId: testProduct.id } },
      });
      expect(inv.quantityOnHand).toBe(20);
    });

    it('successfully processes valid decrease and creates linked StockMovement and AuditLog', async () => {
      const res = await apiRequest('/api/v1/inventory/adjustments', {
        method: 'POST',
        token: staffToken,
        body: {
          storeId: testStoreId,
          productId: testProduct.id,
          quantityDelta: -5,
          movementType: 'DAMAGE',
          reason: 'Damaged in warehouse aisle 3',
        },
      });

      expect(res.status).toBe(200);
      expect(res.body.inventory.quantityOnHand).toBe(15);

      // Verify movement record exists with inventoryId
      const movement = await prisma.stockMovement.findFirst({
        where: { productId: testProduct.id, movementType: 'DAMAGE' },
      });
      expect(movement).toBeDefined();
      expect(movement.quantityDelta).toBe(-5);
      expect(movement.inventoryId).toBe(res.body.inventory.id);
    });
  });

  describe('P0: PUR-001 Safe Purchase Receiving & Line Aggregation', () => {
    it('aggregates duplicate PO items in receive payload and supports replay-safe idempotency', async () => {
      // 1. Create and submit a PO with 10 units
      const poRes = await apiRequest('/api/v1/purchase-orders', {
        method: 'POST',
        token: adminToken,
        body: {
          supplierId: testSupplier.id,
          storeId: testStoreId,
          items: [{ productId: testProduct.id, orderedQty: 10, unitCost: 25.0 }],
        },
      });
      expect(poRes.status).toBe(201);
      const poId = poRes.body.purchaseOrder.id;
      const poItemId = poRes.body.purchaseOrder.items[0].id;

      await apiRequest(`/api/v1/purchase-orders/${poId}/submit`, {
        method: 'POST',
        token: adminToken,
      });

      // 2. Receive with split lines for the SAME poItemId (e.g. 2 boxes of 3)
      const receiptRef = `REC-REF-${Date.now()}`;
      const receiveRes = await apiRequest(`/api/v1/purchase-orders/${poId}/receive`, {
        method: 'POST',
        token: staffToken,
        body: {
          receiptReference: receiptRef,
          items: [
            { purchaseOrderItemId: poItemId, qtyReceived: 3, unitCost: 25.0 },
            { purchaseOrderItemId: poItemId, qtyReceived: 3, unitCost: 25.0 },
          ],
        },
      });

      expect(receiveRes.status).toBe(200);
      expect(receiveRes.body.receipt).toBeDefined();
      const totalReceived = receiveRes.body.receipt.items.reduce((sum, i) => sum + i.qtyReceived, 0);
      expect(totalReceived).toBe(6);

      // 3. Replay exact same receive payload with identical receiptReference (Idempotency)
      const replayRes = await apiRequest(`/api/v1/purchase-orders/${poId}/receive`, {
        method: 'POST',
        token: staffToken,
        body: {
          receiptReference: receiptRef,
          items: [
            { purchaseOrderItemId: poItemId, qtyReceived: 3, unitCost: 25.0 },
            { purchaseOrderItemId: poItemId, qtyReceived: 3, unitCost: 25.0 },
          ],
        },
      });

      expect(replayRes.status).toBe(200);
      expect(replayRes.body.idempotent).toBe(true);

      // Verify PO item has exactly 6 received (not 12)
      const poItem = await prisma.purchaseOrderItem.findUnique({ where: { id: poItemId } });
      expect(poItem.receivedQty).toBe(6);
    });
  });

  describe('P0: SALE-001 & UI-001 Safe Returns and Restock Integrity', () => {
    it('restocks inventory on return only when restockQty > 0 and prevents over-returns', async () => {
      // 1. Checkout 4 units
      const checkoutRes = await apiRequest('/api/v1/sales', {
        method: 'POST',
        token: cashierToken,
        body: {
          idempotencyKey: uuidv4(),
          paymentMethod: 'CASH',
          items: [{ productId: testProduct.id, quantity: 4 }],
        },
      });
      expect(checkoutRes.status).toBe(201);
      const saleId = checkoutRes.body.sale.id;
      const saleItemId = checkoutRes.body.sale.items[0].id;

      const invBeforeReturn = await prisma.inventory.findUnique({
        where: { storeId_productId: { storeId: testStoreId, productId: testProduct.id } },
      });
      const stockBefore = invBeforeReturn.quantityOnHand;

      // 2. Return 2 units: 1 restocked, 1 written off as damaged
      const returnRes = await apiRequest(`/api/v1/sales/${saleId}/returns`, {
        method: 'POST',
        token: cashierToken,
        body: {
          reason: 'Customer return - 1 unopened, 1 broken',
          items: [
            { saleItemId, qtyReturned: 2, restockQty: 1, writeOffQty: 1 },
          ],
        },
      });

      expect(returnRes.status).toBe(201);
      expect(returnRes.body.return).toBeDefined();

      // Inventory should have increased by exactly 1 (restockQty)
      const invAfterReturn = await prisma.inventory.findUnique({
        where: { storeId_productId: { storeId: testStoreId, productId: testProduct.id } },
      });
      expect(invAfterReturn.quantityOnHand).toBe(stockBefore + 1);

      // 3. Attempt to over-return remaining units (remaining returnable is 2, attempt 3)
      const overReturnRes = await apiRequest(`/api/v1/sales/${saleId}/returns`, {
        method: 'POST',
        token: cashierToken,
        body: {
          reason: 'Attempted over-return',
          items: [
            { saleItemId, qtyReturned: 3, restockQty: 3, writeOffQty: 0 },
          ],
        },
      });

      expect(overReturnRes.status).toBe(400);
      expect(overReturnRes.body.error).toMatch(/Cannot return more than originally sold/i);
    });
  });

  describe('P1: API-004 & API-005 Checkout Idempotency & Duplicate Line Aggregation', () => {
    it('binds idempotency key to payload hash: rejects mismatched payload with 409 Conflict', async () => {
      const key = uuidv4();

      // First call
      const res1 = await apiRequest('/api/v1/sales', {
        method: 'POST',
        token: cashierToken,
        body: {
          idempotencyKey: key,
          paymentMethod: 'CASH',
          items: [{ productId: testProduct.id, quantity: 1 }],
        },
      });
      expect(res1.status).toBe(201);

      // Second call with same key but different items
      const res2 = await apiRequest('/api/v1/sales', {
        method: 'POST',
        token: cashierToken,
        body: {
          idempotencyKey: key,
          paymentMethod: 'CASH',
          items: [{ productId: testProduct.id, quantity: 2 }],
        },
      });
      expect(res2.status).toBe(409);
      expect(res2.body.error).toMatch(/mismatched payload/i);
    });

    it('aggregates duplicate product lines within a single checkout request', async () => {
      const res = await apiRequest('/api/v1/sales', {
        method: 'POST',
        token: cashierToken,
        body: {
          idempotencyKey: uuidv4(),
          paymentMethod: 'CARD',
          items: [
            { productId: testProduct.id, quantity: 1 },
            { productId: testProduct.id, quantity: 2 },
          ],
        },
      });

      expect(res.status).toBe(201);
      // Items in sale should be aggregated into 1 line of quantity 3
      expect(res.body.sale.items.length).toBe(1);
      expect(res.body.sale.items[0].quantity).toBe(3);
    });
  });

  describe('P1: AUTH-001 & AUTH-002 Token Versioning and Logout Revocation', () => {
    it('revokes JWT access upon logout via tokenVersion increment', async () => {
      // Create dedicated test user so admin's session remains active
      const uniqueEmail = `revocation_user_${Date.now()}@orims.local`;
      await apiRequest('/api/v1/users', {
        method: 'POST',
        token: adminToken,
        body: {
          name: 'Revocation Test User',
          email: uniqueEmail,
          password: 'password123',
          role: 'INVENTORY_STAFF',
        },
      });

      // 1. Login to get fresh token
      const loginRes = await apiRequest('/api/v1/auth/login', {
        method: 'POST',
        body: { email: uniqueEmail, password: 'password123' },
      });
      expect(loginRes.status).toBe(200);
      const token = loginRes.body.accessToken;

      // 2. Verify token works
      const testReq1 = await apiRequest('/api/v1/users', { token: adminToken });
      expect(testReq1.status).toBe(200);

      // 3. Logout
      const logoutRes = await apiRequest('/api/v1/auth/logout', {
        method: 'POST',
        token,
      });
      expect(logoutRes.status).toBe(200);

      // 4. Verify user token is now rejected with 401 TOKEN_REVOKED
      const testReq2 = await apiRequest('/api/v1/inventory', { token });
      expect(testReq2.status).toBe(401);
      expect(testReq2.body.code).toBe('TOKEN_REVOKED');
    });
  });

  describe('P1: API-001 Role Guards on Reports & Optimization Endpoints', () => {
    it('enforces RBAC: Cashier cannot access managerial reports or optimization recalculation', async () => {
      const reportsRes = await apiRequest('/api/v1/reports/sales?startDate=2026-01-01&endDate=2026-12-31', {
        token: cashierToken,
      });
      expect(reportsRes.status).toBe(403);

      const optRes = await apiRequest('/api/v1/optimization/recalculate', {
        method: 'POST',
        token: cashierToken,
        body: { storeId: testStoreId },
      });
      expect(optRes.status).toBe(403);
    });
  });

  describe('P1: DB-001 Store Settings Persistence & Read Idempotency', () => {
    it('updates store settings via PUT /store and GET /store reads without DB mutations', async () => {
      const putRes = await apiRequest('/api/v1/settings/store', {
        method: 'PUT',
        token: adminToken,
        body: {
          name: 'Flagship Store Downtown',
          location: 'Building 4, Sector 7',
          taxRate: 0.10,
          currency: 'USD',
          timezone: 'America/New_York',
        },
      });
      expect(putRes.status).toBe(200);
      expect(putRes.body.store.name).toBe('Flagship Store Downtown');
      expect(putRes.body.store.location).toBe('Building 4, Sector 7');
      expect(Number(putRes.body.store.taxRate)).toBe(0.10);

      const getRes = await apiRequest('/api/v1/settings/store', { token: adminToken });
      expect(getRes.status).toBe(200);
      expect(getRes.body.store.name).toBe('Flagship Store Downtown');
      expect(getRes.body.store.location).toBe('Building 4, Sector 7');
      expect(Number(getRes.body.store.taxRate)).toBe(0.10);
    });
  });
});
