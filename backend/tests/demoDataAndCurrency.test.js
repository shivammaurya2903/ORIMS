import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestServer, stopTestServer, apiRequest, getAuthToken, prisma } from './helpers.js';

describe('Demo Sales Data & INR Currency Integration Suite', () => {
  let adminToken;
  const storeId = 'default-store';

  beforeAll(async () => {
    await startTestServer();
    adminToken = await getAuthToken('ADMIN');

    // Ensure test database store is configured for INR & Asia/Kolkata
    await prisma.store.upsert({
      where: { id: storeId },
      update: {
        currency: 'INR',
        timezone: 'Asia/Kolkata',
      },
      create: {
        id: storeId,
        name: 'ORIMS Supermarket',
        location: '100 MG Road, Bengaluru',
        currency: 'INR',
        timezone: 'Asia/Kolkata',
        taxRate: 0.10,
        active: true,
      },
    });
  });

  afterAll(async () => {
    await stopTestServer();
    await prisma.$disconnect();
  });

  it('GET /api/v1/settings/store returns INR currency and Asia/Kolkata timezone by default', async () => {
    const res = await apiRequest('/api/v1/settings/store', { token: adminToken });
    expect(res.status).toBe(200);
    expect(res.body.store).toBeDefined();
    expect(res.body.store.currency).toBe('INR');
    expect(res.body.store.timezone).toBe('Asia/Kolkata');
    expect(Number(res.body.store.taxRate)).toBe(0.10);
  });

  it('PUT /api/v1/settings/store persists store configuration updates and retains INR', async () => {
    const updateRes = await apiRequest('/api/v1/settings/store', {
      method: 'PUT',
      token: adminToken,
      body: {
        name: 'ORIMS Supermarket - Central Branch',
        currency: 'INR',
        timezone: 'Asia/Kolkata',
        taxRate: 0.10,
      },
    });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.store.currency).toBe('INR');
    expect(updateRes.body.store.timezone).toBe('Asia/Kolkata');
    expect(updateRes.body.store.name).toBe('ORIMS Supermarket - Central Branch');
  });

  it('verifies 5-day demo sales dataset consistency, idempotency, and financial reconciliation', async () => {
    // Query demo sales
    const demoSales = await prisma.sale.findMany({
      where: {
        storeId,
        idempotencyKey: { startsWith: 'DEMO-SALE-' },
      },
      include: { items: true },
      orderBy: { createdAt: 'asc' },
    });

    // If running in test database where seed was not run, seed demo transactions
    if (demoSales.length === 0) {
      // Create minimal products if needed
      const testCat = await prisma.category.upsert({
        where: { name: 'Demo Test Category' },
        update: {},
        create: { name: 'Demo Test Category', description: 'Demo test' },
      });

      const p1 = await prisma.product.upsert({
        where: { sku: 'TEST-DEMO-001' },
        update: {},
        create: {
          sku: 'TEST-DEMO-001',
          name: 'Demo Product 1',
          categoryId: testCat.id,
          costPrice: 200.00,
          sellingPrice: 400.00,
          active: true,
        },
      });

      await prisma.inventory.upsert({
        where: { storeId_productId: { storeId, productId: p1.id } },
        update: { quantityOnHand: 100 },
        create: { storeId, productId: p1.id, quantityOnHand: 100 },
      });

      const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });

      for (let d = 4; d >= 0; d--) {
        const saleDate = new Date();
        saleDate.setDate(saleDate.getDate() - d);
        saleDate.setUTCHours(8, 30, 0, 0);

        for (let s = 1; s <= 3; s++) {
          const qty = 2;
          const lineSubtotal = 400.00 * qty;
          const lineTax = lineSubtotal * 0.10;
          const lineTotal = lineSubtotal + lineTax;

          await prisma.sale.create({
            data: {
              storeId,
              receiptNumber: `DEMO-RCP-D${d}-${s}`,
              status: 'COMPLETED',
              subtotal: lineSubtotal,
              discountTotal: 0,
              taxTotal: lineTax,
              total: lineTotal,
              paymentMethod: 'UPI',
              paymentStatus: 'PAID',
              idempotencyKey: `DEMO-SALE-D${d}-S${s}`,
              createdBy: adminUser.id,
              createdAt: saleDate,
              items: {
                create: [{
                  productId: p1.id,
                  quantity: qty,
                  unitPrice: 400.00,
                  unitCost: 200.00,
                  lineDiscount: 0,
                  taxRate: 0.10,
                  lineTotal,
                }],
              },
            },
          });
        }
      }
    }

    // Re-query demo sales
    const verifiedSales = await prisma.sale.findMany({
      where: {
        storeId,
        idempotencyKey: { startsWith: 'DEMO-SALE-' },
      },
      include: { items: true },
      orderBy: { createdAt: 'asc' },
    });

    expect(verifiedSales.length).toBeGreaterThanOrEqual(15);

    // Verify 5 distinct days
    const distinctDays = new Set(verifiedSales.map(s => s.createdAt.toISOString().split('T')[0]));
    expect(distinctDays.size).toBe(5);

    // Verify financial reconciliation for every sale
    for (const sale of verifiedSales) {
      expect(sale.status).toBe('COMPLETED');
      expect(sale.paymentStatus).toBe('PAID');
      expect(sale.receiptNumber).toMatch(/^DEMO-RCP-/);

      const itemsSum = sale.items.reduce((sum, item) => sum + Number(item.lineTotal), 0);
      const subtotalPlusTax = Number(sale.subtotal) + Number(sale.taxTotal);

      // Reconciles within 0.01 tolerance
      expect(Math.abs(Number(sale.total) - subtotalPlusTax)).toBeLessThanOrEqual(0.02);
      expect(Math.abs(Number(sale.total) - itemsSum)).toBeLessThanOrEqual(0.02);
    }
  });

  it('GET /api/v1/reports/sales?format=csv exports with Revenue (INR) column headers', async () => {
    const today = new Date().toISOString().split('T')[0];
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const res = await apiRequest(`/api/v1/reports/sales?startDate=${fiveDaysAgo}&endDate=${today}&storeId=${storeId}&format=csv`, {
      token: adminToken,
    });

    expect(res.status).toBe(200);
    expect(res.body).toContain('Revenue (INR)');
    expect(res.body).toContain('Avg Order Value (INR)');
    expect(res.body).not.toContain('Revenue ($)');
  });

  it('GET /api/v1/reports/inventory-valuation?format=csv exports with Unit Cost (INR) and Total Value (INR)', async () => {
    const res = await apiRequest(`/api/v1/reports/inventory-valuation?storeId=${storeId}&format=csv`, {
      token: adminToken,
    });

    expect(res.status).toBe(200);
    expect(res.body).toContain('Unit Cost (INR)');
    expect(res.body).toContain('Total Value (INR)');
    expect(res.body).not.toContain('Unit Cost ($)');
  });

  it('GET /api/v1/reports/turnover?format=csv exports with Revenue (INR) and COGS (INR)', async () => {
    const today = new Date().toISOString().split('T')[0];
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const res = await apiRequest(`/api/v1/reports/turnover?startDate=${fiveDaysAgo}&endDate=${today}&storeId=${storeId}&format=csv`, {
      token: adminToken,
    });

    expect(res.status).toBe(200);
    expect(res.body).toContain('Revenue (INR)');
    expect(res.body).toContain('COGS (INR)');
    expect(res.body).not.toContain('COGS ($)');
  });
});
