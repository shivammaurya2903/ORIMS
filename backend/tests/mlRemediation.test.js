import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getMlConfig } from '../src/config/mlConfig.js';
import { determineRiskLevel } from '../src/utils/risk.js';
import { startTestServer, stopTestServer, apiRequest, getAuthToken, prisma } from './helpers.js';

describe('ML Release Remediation Test Suite', () => {
  let adminToken;
  let testStoreId = 'default-store';
  let createdProductIds = [];
  let createdRecommendationIds = [];

  beforeAll(async () => {
    await startTestServer();
    adminToken = await getAuthToken('ADMIN');
  });

  afterAll(async () => {
    if (createdRecommendationIds.length > 0) {
      await prisma.optimizationRecommendation.deleteMany({
        where: { id: { in: createdRecommendationIds } },
      });
    }
    if (createdProductIds.length > 0) {
      await prisma.optimizationRecommendation.deleteMany({
        where: { productId: { in: createdProductIds } },
      });
      await prisma.forecast.deleteMany({
        where: { productId: { in: createdProductIds } },
      });
      await prisma.supplierProduct.deleteMany({
        where: { productId: { in: createdProductIds } },
      });
      await prisma.inventory.deleteMany({
        where: { productId: { in: createdProductIds } },
      });
      await prisma.product.deleteMany({
        where: { id: { in: createdProductIds } },
      });
    }
    await stopTestServer();
    await prisma.$disconnect();
  });

  // ==========================================
  // WORKSTREAM 1: Secure ML Service Authentication
  // ==========================================
  describe('Workstream 1: Secure ML Authentication & Secret Contract', () => {
    it('fails configuration in production mode when ML_SERVICE_API_KEY is missing or empty', () => {
      expect(() => {
        getMlConfig({ NODE_ENV: 'production' });
      }).toThrow(/\[SECURITY\] ML_SERVICE_API_KEY is required in production environment/);

      expect(() => {
        getMlConfig({ NODE_ENV: 'production', ML_SERVICE_API_KEY: '   ' });
      }).toThrow(/\[SECURITY\] ML_SERVICE_API_KEY is required in production environment/);
    });

    it('fails configuration in staging mode when ML_SERVICE_API_KEY is missing or empty', () => {
      expect(() => {
        getMlConfig({ NODE_ENV: 'staging' });
      }).toThrow(/\[SECURITY\] ML_SERVICE_API_KEY is required in staging environment/);
    });

    it('fails in production/staging when a known development default key is configured', () => {
      const knownDevKeys = ['dev-ml-api-key', 'your-ml-service-api-key', 'default-key', 'secret', 'test'];
      for (const devKey of knownDevKeys) {
        expect(() => {
          getMlConfig({ NODE_ENV: 'production', ML_SERVICE_API_KEY: devKey });
        }).toThrow(/cannot use known development default/);
        expect(() => {
          getMlConfig({ NODE_ENV: 'staging', ML_SERVICE_API_KEY: devKey });
        }).toThrow(/cannot use known development default/);
      }
    });

    it('fails in production/staging when key is shorter than 16 characters', () => {
      expect(() => {
        getMlConfig({ NODE_ENV: 'production', ML_SERVICE_API_KEY: 'short-key-123' });
      }).toThrow(/must be at least 16 characters/);
    });

    it('succeeds in production/staging when a valid strong secret is provided', () => {
      const validKey = 'production-secret-token-32-chars-long';
      const config = getMlConfig({
        NODE_ENV: 'production',
        ML_SERVICE_API_KEY: validKey,
        ML_SERVICE_URL: 'http://ml.internal:8000',
        ML_BATCH_SIZE: '60',
        ML_TIMEOUT_MS: '7000',
        ML_MAX_RETRIES: '2',
      });

      expect(config.apiKey).toBe(validKey);
      expect(config.url).toBe('http://ml.internal:8000');
      expect(config.batchSize).toBe(60);
      expect(config.timeoutMs).toBe(7000);
      expect(config.maxRetries).toBe(2);
    });

    it('permits development default key in development and test environments', () => {
      const devConfig = getMlConfig({ NODE_ENV: 'development' });
      expect(devConfig.apiKey).toBe('dev-ml-api-key');

      const testConfig = getMlConfig({ NODE_ENV: 'test' });
      expect(testConfig.apiKey).toBe('dev-ml-api-key');
    });

    it('error messages do not disclose secret values', () => {
      try {
        getMlConfig({ NODE_ENV: 'production', ML_SERVICE_API_KEY: 'dev-ml-api-key' });
      } catch (err) {
        expect(err.message).not.toContain('dev-ml-api-key');
        expect(err.message).toContain('cannot use known development default');
      }
    });
  });

  // ==========================================
  // WORKSTREAM 2: Large-Catalogue Forecasting & Chunking
  // ==========================================
  describe('Workstream 2: Large-Catalogue Forecasting & Fallbacks', () => {
    let batchProductA, batchProductB;

    beforeAll(async () => {
      batchProductA = await prisma.product.create({
        data: {
          sku: `BATCH-A-${Date.now()}`,
          name: 'Batch Product A',
          sellingPrice: 50.00,
          costPrice: 25.00,
          active: true,
        },
      });
      batchProductB = await prisma.product.create({
        data: {
          sku: `BATCH-B-${Date.now()}`,
          name: 'Batch Product B',
          sellingPrice: 75.00,
          costPrice: 35.00,
          active: true,
        },
      });
      createdProductIds.push(batchProductA.id, batchProductB.id);

      await prisma.inventory.createMany({
        data: [
          { storeId: testStoreId, productId: batchProductA.id, quantityOnHand: 5, reservedQuantity: 0 },
          { storeId: testStoreId, productId: batchProductB.id, quantityOnHand: 10, reservedQuantity: 0 },
        ],
      });
    });

    it('truthfully reports FALLBACK_ONLY when ML service is offline and does not claim full success', async () => {
      const res = await apiRequest('/api/v1/optimization/recalculate', {
        method: 'POST',
        token: adminToken,
        body: {
          storeId: testStoreId,
          productIds: [batchProductA.id, batchProductB.id],
        },
      });

      expect(res.status).toBe(200);
      expect(res.body.runStatus).toBe('FALLBACK_ONLY');
      expect(res.body.modelForecastsCount).toBe(0);
      expect(res.body.fallbackForecastsCount).toBe(2);
      expect(res.body.productsProcessed).toBe(2);
      expect(res.body.forecastsGenerated).toBe(14); // 7 days * 2 products
      expect(res.body.recommendationsGenerated).toBe(2);
    });

    it('persists quantile forecast columns idempotently without duplicates on repeated runs', async () => {
      // First run
      await apiRequest('/api/v1/optimization/recalculate', {
        method: 'POST',
        token: adminToken,
        body: { storeId: testStoreId, productIds: [batchProductA.id] },
      });

      // Second run
      await apiRequest('/api/v1/optimization/recalculate', {
        method: 'POST',
        token: adminToken,
        body: { storeId: testStoreId, productIds: [batchProductA.id] },
      });

      const recs = await prisma.optimizationRecommendation.findMany({
        where: { storeId: testStoreId, productId: batchProductA.id, status: 'PENDING' },
      });
      // Exactly 1 active pending recommendation
      expect(recs.length).toBe(1);
      expect(recs[0].riskLevel).toBeDefined();

      const forecasts = await prisma.forecast.findMany({
        where: { storeId: testStoreId, productId: batchProductA.id },
      });
      expect(forecasts.length).toBeGreaterThanOrEqual(7);
      for (const fc of forecasts) {
        expect(fc.predictedDemandP50).toBeDefined();
        expect(typeof Number(fc.predictedDemandP50)).toBe('number');
      }
    });
  });

  // ==========================================
  // WORKSTREAM 3: Recommendation Risk Filtering & Pagination
  // ==========================================
  describe('Workstream 3: Risk Classification, DB Filtering, and Deterministic Pagination', () => {
    let riskProduct;

    beforeAll(async () => {
      riskProduct = await prisma.product.create({
        data: {
          sku: `RISK-SKU-${Date.now()}`,
          name: 'Risk Level Test Item',
          sellingPrice: 30.00,
          costPrice: 15.00,
          active: true,
        },
      });
      createdProductIds.push(riskProduct.id);

      // Seed 3 recommendations with explicit HIGH, MEDIUM, and LOW risk levels
      const rHigh = await prisma.optimizationRecommendation.create({
        data: {
          storeId: testStoreId,
          productId: riskProduct.id,
          onHandQty: 2,
          incomingQty: 0,
          committedQty: 0,
          safetyStock: 10,
          targetStock: 50,
          rawSuggestedQty: 48,
          finalSuggestedQty: 48,
          stockoutProbability: 0.85,
          daysOfSupply: 3.5,
          riskLevel: 'HIGH',
          status: 'PENDING',
          constraintsApplied: {},
          explanation: 'High risk stockout test item',
        },
      });

      const rMed = await prisma.optimizationRecommendation.create({
        data: {
          storeId: testStoreId,
          productId: riskProduct.id,
          onHandQty: 15,
          incomingQty: 0,
          committedQty: 0,
          safetyStock: 10,
          targetStock: 35,
          rawSuggestedQty: 20,
          finalSuggestedQty: 20,
          stockoutProbability: 0.55,
          daysOfSupply: 8.0,
          riskLevel: 'MEDIUM',
          status: 'PENDING',
          constraintsApplied: {},
          explanation: 'Medium risk stockout test item',
        },
      });

      const rLow = await prisma.optimizationRecommendation.create({
        data: {
          storeId: testStoreId,
          productId: riskProduct.id,
          onHandQty: 40,
          incomingQty: 0,
          committedQty: 0,
          safetyStock: 10,
          targetStock: 45,
          rawSuggestedQty: 5,
          finalSuggestedQty: 5,
          stockoutProbability: 0.15,
          daysOfSupply: 25.0,
          riskLevel: 'LOW',
          status: 'PENDING',
          constraintsApplied: {},
          explanation: 'Low risk stockout test item',
        },
      });

      createdRecommendationIds.push(rHigh.id, rMed.id, rLow.id);
    });

    it('determineRiskLevel classifies correctly according to documented thresholds', () => {
      // Probabilistic rule: HIGH if prob > 0.7 or DOS < 7
      expect(determineRiskLevel(0.75, 10, 0, 0)).toBe('HIGH');
      expect(determineRiskLevel(0.30, 5, 0, 0)).toBe('HIGH');

      // Probabilistic rule: MEDIUM if prob > 0.4 or DOS < 10.5
      expect(determineRiskLevel(0.55, 12, 0, 0)).toBe('MEDIUM');
      expect(determineRiskLevel(0.20, 9, 0, 0)).toBe('MEDIUM');

      // Probabilistic rule: LOW otherwise
      expect(determineRiskLevel(0.15, 20, 0, 0)).toBe('LOW');

      // Baseline fallback rule (when stockout probability is null/NaN):
      expect(determineRiskLevel(null, null, 25, 10)).toBe('HIGH'); // deficit > 2 * safetyStock (25 > 20)
      expect(determineRiskLevel(null, null, 15, 10)).toBe('MEDIUM'); // deficit > safetyStock (15 > 10)
      expect(determineRiskLevel(null, null, 8, 10)).toBe('LOW'); // deficit <= safetyStock (8 <= 10)
    });

    it('filters by riskLevel at the database level and returns accurate pagination totals', async () => {
      // Request only HIGH
      const highRes = await apiRequest(`/api/v1/optimization/recommendations?productId=${riskProduct.id}&riskLevel=HIGH`, {
        token: adminToken,
      });
      expect(highRes.status).toBe(200);
      expect(highRes.body.data.length).toBe(1);
      expect(highRes.body.data[0].riskLevel).toBe('HIGH');
      expect(highRes.body.pagination.total).toBe(1);

      // Request only MEDIUM
      const medRes = await apiRequest(`/api/v1/optimization/recommendations?productId=${riskProduct.id}&riskLevel=MEDIUM`, {
        token: adminToken,
      });
      expect(medRes.status).toBe(200);
      expect(medRes.body.data.length).toBe(1);
      expect(medRes.body.data[0].riskLevel).toBe('MEDIUM');
      expect(medRes.body.pagination.total).toBe(1);

      // Request only LOW
      const lowRes = await apiRequest(`/api/v1/optimization/recommendations?productId=${riskProduct.id}&riskLevel=LOW`, {
        token: adminToken,
      });
      expect(lowRes.status).toBe(200);
      expect(lowRes.body.data.length).toBe(1);
      expect(lowRes.body.data[0].riskLevel).toBe('LOW');
      expect(lowRes.body.pagination.total).toBe(1);
    });

    it('deterministic pagination with id tie-breaker produces disjoint pages without duplicates', async () => {
      // Query page 1 with limit 2
      const p1Res = await apiRequest(`/api/v1/optimization/recommendations?productId=${riskProduct.id}&page=1&limit=2&sort=finalSuggestedQty&order=desc`, {
        token: adminToken,
      });
      expect(p1Res.status).toBe(200);
      expect(p1Res.body.data.length).toBe(2);

      // Query page 2 with limit 2
      const p2Res = await apiRequest(`/api/v1/optimization/recommendations?productId=${riskProduct.id}&page=2&limit=2&sort=finalSuggestedQty&order=desc`, {
        token: adminToken,
      });
      expect(p2Res.status).toBe(200);
      expect(p2Res.body.data.length).toBe(1);

      const p1Ids = p1Res.body.data.map(d => d.id);
      const p2Ids = p2Res.body.data.map(d => d.id);

      // Pages must be strictly disjoint
      for (const id of p1Ids) {
        expect(p2Ids).not.toContain(id);
      }
    });

    it('rejects invalid sort column with 400 Validation error', async () => {
      const res = await apiRequest('/api/v1/optimization/recommendations?sort=non_existent_column', {
        token: adminToken,
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });
  });
});
