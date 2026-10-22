import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestServer, stopTestServer, apiRequest, getAuthToken, prisma } from './helpers.js';

describe('Optimization & ML Forecasting Suite', () => {
  let adminToken;
  let testSupplier;
  let testProduct;
  let testStoreId = 'default-store';

  beforeAll(async () => {
    await startTestServer();
    adminToken = await getAuthToken('ADMIN');

    // Create supplier, product and supplierProduct with MOQ & pack size
    testSupplier = await prisma.supplier.create({
      data: {
        name: `Opt Supplier ${Date.now()}`,
        active: true,
      },
    });

    testProduct = await prisma.product.create({
      data: {
        sku: `OPT-SKU-${Date.now()}`,
        name: 'Optimization Engine Item',
        sellingPrice: 40.00,
        costPrice: 20.00,
        active: true,
      },
    });

    await prisma.supplierProduct.create({
      data: {
        supplierId: testSupplier.id,
        productId: testProduct.id,
        unitCost: 20.00,
        minOrderQty: 10,
        packMultiple: 5,
        leadTimeDays: 7,
      },
    });

    // Create inventory with 0 stock so recommendation generates an order
    await prisma.inventory.create({
      data: {
        storeId: testStoreId,
        productId: testProduct.id,
        quantityOnHand: 2,
        reservedQuantity: 0,
      },
    });
  });

  afterAll(async () => {
    if (testProduct) {
      await prisma.optimizationRecommendation.deleteMany({
        where: { productId: testProduct.id },
      });
      await prisma.forecast.deleteMany({
        where: { productId: testProduct.id },
      });
      await prisma.purchaseOrderItem.deleteMany({
        where: { productId: testProduct.id },
      });
      await prisma.supplierProduct.deleteMany({
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
      await prisma.purchaseOrder.deleteMany({
        where: { supplierId: testSupplier.id },
      });
      await prisma.supplier.deleteMany({
        where: { id: testSupplier.id },
      });
    }
    await stopTestServer();
    await prisma.$disconnect();
  });

  it('POST /api/v1/optimization/recalculate triggers forecast & recommendation generation', async () => {
    const res = await apiRequest('/api/v1/optimization/recalculate', {
      method: 'POST',
      token: adminToken,
      body: {
        storeId: testStoreId,
        productIds: [testProduct.id],
      },
    });

    expect(res.status).toBe(200);
    expect(res.body.recommendationsGenerated).toBeGreaterThanOrEqual(1);
    expect(res.body.forecastsGenerated).toBeGreaterThanOrEqual(1);

    // Verify recommendations persisted in database
    const rec = await prisma.optimizationRecommendation.findFirst({
      where: { storeId: testStoreId, productId: testProduct.id },
    });
    expect(rec).toBeDefined();
    expect(rec.status).toBe('PENDING');
    // MOQ is 10 and pack size is 5; recommendation should respect MOQ and pack size rounding
    expect(rec.finalSuggestedQty).toBeGreaterThanOrEqual(10);
    expect(rec.finalSuggestedQty % 5).toBe(0);
  });

  it('GET /api/v1/optimization/forecasts returns generated demand forecasts', async () => {
    const res = await apiRequest(`/api/v1/optimization/forecasts?productId=${testProduct.id}`, {
      token: adminToken,
    });

    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data[0].productId).toBe(testProduct.id);
  });

  it('POST /api/v1/optimization/recommendations/:id/approve creates draft PO and sets status to CONVERTED_TO_PO', async () => {
    const rec = await prisma.optimizationRecommendation.findFirst({
      where: { storeId: testStoreId, productId: testProduct.id, status: 'PENDING' },
    });
    expect(rec).toBeDefined();

    const approveRes = await apiRequest(`/api/v1/optimization/recommendations/${rec.id}/approve`, {
      method: 'POST',
      token: adminToken,
      body: {
        approvedQty: 15,
        createPurchaseOrder: true,
      },
    });

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.recommendation.status).toBe('CONVERTED_TO_PO');
    expect(approveRes.body.recommendation.finalSuggestedQty).toBe(15);
    expect(approveRes.body.purchaseOrder).toBeDefined();

    // Verify purchase order created
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: approveRes.body.purchaseOrder.id },
      include: { items: true },
    });
    expect(po).toBeDefined();
    expect(po.status).toBe('DRAFT');
    expect(po.items[0].orderedQty).toBe(15);
  });

  it('POST /api/v1/optimization/recommendations/:id/reject updates status to REJECTED with reason', async () => {
    // Create another pending recommendation for reject test
    const testRec = await prisma.optimizationRecommendation.create({
      data: {
        storeId: testStoreId,
        productId: testProduct.id,
        onHandQty: 10,
        incomingQty: 0,
        committedQty: 0,
        safetyStock: 3,
        targetStock: 20,
        rawSuggestedQty: 10,
        finalSuggestedQty: 10,
        constraintsApplied: {},
        explanation: 'Test recommendation for rejection',
        status: 'PENDING',
      },
    });

    const rejectRes = await apiRequest(`/api/v1/optimization/recommendations/${testRec.id}/reject`, {
      method: 'POST',
      token: adminToken,
      body: {
        reason: 'Budget constraint for this cycle',
      },
    });

    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.recommendation.status).toBe('REJECTED');
    expect(rejectRes.body.recommendation.reviewReason).toBe('Budget constraint for this cycle');
  });

  it('GET /api/v1/optimization/model-info returns active or graceful fallback metadata', async () => {
    const res = await apiRequest('/api/v1/optimization/model-info', {
      token: adminToken,
    });
    expect(res.status).toBe(200);
    expect(res.body).toBeDefined();
    expect(res.body.model_family).toBeDefined();
  });
});
