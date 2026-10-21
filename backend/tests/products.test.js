import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestServer, stopTestServer, apiRequest, getAuthToken, prisma } from './helpers.js';

describe('Products & Categories Suite', () => {
  let adminToken;
  let cashierToken;
  let createdProductId;
  const testSku = `TEST-SKU-${Date.now()}`;

  beforeAll(async () => {
    await startTestServer();
    adminToken = await getAuthToken('ADMIN');
    cashierToken = await getAuthToken('SALES_STAFF');
  });

  afterAll(async () => {
    if (createdProductId) {
      await prisma.inventory.deleteMany({ where: { productId: createdProductId } });
      await prisma.product.deleteMany({ where: { id: createdProductId } });
    }
    await stopTestServer();
    await prisma.$disconnect();
  });

  it('GET /api/v1/products returns paginated products list', async () => {
    const res = await apiRequest('/api/v1/products', { token: adminToken });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('pagination');
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('POST /api/v1/products creates a product successfully when authorized', async () => {
    const category = await prisma.category.findFirst();
    const res = await apiRequest('/api/v1/products', {
      method: 'POST',
      token: adminToken,
      body: {
        sku: testSku,
        name: 'Automated Test Product',
        categoryId: category.id,
        sellingPrice: 19.99,
        costPrice: 9.99,
      },
    });

    expect(res.status).toBe(201);
    expect(res.body.product.sku).toBe(testSku);
    expect(res.body.product.name).toBe('Automated Test Product');
    createdProductId = res.body.product.id;
  });

  it('POST /api/v1/products rejects duplicate SKU with 409 Conflict', async () => {
    const category = await prisma.category.findFirst();
    const res = await apiRequest('/api/v1/products', {
      method: 'POST',
      token: adminToken,
      body: {
        sku: testSku,
        name: 'Duplicate SKU Product',
        categoryId: category.id,
        sellingPrice: 25.00,
        costPrice: 12.00,
      },
    });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('DUPLICATE_ENTRY');
  });

  it('enforces RBAC: SALES_STAFF cannot create products (returns 403)', async () => {
    const res = await apiRequest('/api/v1/products', {
      method: 'POST',
      token: cashierToken,
      body: {
        sku: `UNAUTH-${Date.now()}`,
        name: 'Unauthorized Product',
        sellingPrice: 10,
        costPrice: 5,
      },
    });

    expect(res.status).toBe(403);
  });

  it('PATCH /api/v1/products/:id/status changes product status', async () => {
    const res = await apiRequest(`/api/v1/products/${createdProductId}/status`, {
      method: 'PATCH',
      token: adminToken,
      body: { active: false },
    });

    expect(res.status).toBe(200);
    expect(res.body.product.active).toBe(false);
  });
});
