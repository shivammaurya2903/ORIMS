import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestServer, stopTestServer, apiRequest, getAuthToken, prisma } from './helpers.js';

describe('Reports & Financial Metrics Suite', () => {
  let adminToken;
  let testStoreId = 'default-store';

  beforeAll(async () => {
    await startTestServer();
    adminToken = await getAuthToken('ADMIN');
  });

  afterAll(async () => {
    await stopTestServer();
    await prisma.$disconnect();
  });

  it('GET /api/v1/reports/sales calculates revenue, profit, and totals', async () => {
    const today = new Date().toISOString().split('T')[0];
    const res = await apiRequest(`/api/v1/reports/sales?startDate=2020-01-01&endDate=${today}&storeId=${testStoreId}`, {
      token: adminToken,
    });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('totals');
    expect(res.body.totals).toHaveProperty('totalRevenue');
    expect(res.body.totals).toHaveProperty('totalOrders');
    expect(res.body.totals).toHaveProperty('totalUnits');
    expect(Number(res.body.totals.totalRevenue)).toBeGreaterThanOrEqual(0);
  });

  it('GET /api/v1/reports/inventory-valuation returns valuation by product and category', async () => {
    const res = await apiRequest(`/api/v1/reports/inventory-valuation?storeId=${testStoreId}`, {
      token: adminToken,
    });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('totalValue');
    expect(res.body).toHaveProperty('itemCount');
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(Number(res.body.totalValue)).toBeGreaterThanOrEqual(0);
  });

  it('GET /api/v1/reports/turnover returns COGS and inventory turnover rate', async () => {
    const today = new Date().toISOString().split('T')[0];
    const res = await apiRequest(`/api/v1/reports/turnover?startDate=2020-01-01&endDate=${today}&storeId=${testStoreId}`, {
      token: adminToken,
    });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('cogs');
    expect(res.body).toHaveProperty('turnoverRatio');
    expect(Number(res.body.cogs)).toBeGreaterThanOrEqual(0);
  });
});
