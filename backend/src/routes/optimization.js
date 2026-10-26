import { Router } from 'express';
import { prisma } from '../index.js';
import { 
  recommendationsQuerySchema, 
  approveRecommendationSchema, 
  rejectRecommendationSchema,
  recalculateSchema,
  forecastsQuerySchema,
  slowMovingQuerySchema,
  expiryRiskQuerySchema
} from '../validators/optimization.js';
import { validate } from '../utils/validation.js';
import { requireRole } from '../middleware/auth.js';
import { NotFoundError, ValidationError } from '../middleware/errorHandler.js';
import { getMlConfig } from '../config/mlConfig.js';
import { determineRiskLevel } from '../utils/risk.js';

export { determineRiskLevel };

const router = Router();

// Recommendations
router.get('/recommendations', requireRole('ADMIN', 'MANAGER'), validate(recommendationsQuerySchema), async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const storeId = req.query.storeId;
  const productId = req.query.productId;
  const categoryId = req.query.categoryId;
  const status = req.query.status;
  const riskLevel = req.query.riskLevel;
  const sort = req.query.sort || 'calculatedAt';
  const order = req.query.order || 'desc';
  const skip = (page - 1) * limit;

  const where = {};
  if (storeId) where.storeId = storeId;
  if (productId) where.productId = productId;
  if (status) where.status = status;
  if (categoryId) {
    where.product = { categoryId };
  }
  // Database-level filtering before pagination
  if (riskLevel) {
    where.riskLevel = riskLevel;
  }

  const allowedSortFields = ['calculatedAt', 'createdAt', 'rawSuggestedQty', 'finalSuggestedQty', 'targetStock', 'onHandQty'];
  let primarySort;
  if (sort === 'urgency') {
    primarySort = { finalSuggestedQty: order };
  } else if (allowedSortFields.includes(sort)) {
    primarySort = { [sort]: order };
  } else {
    primarySort = { calculatedAt: order };
  }

  // Deterministic tie-breaker
  const orderBy = [primarySort, { id: 'asc' }];

  const [recommendations, totalCount] = await Promise.all([
    prisma.optimizationRecommendation.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        store: { select: { id: true, name: true } },
        product: { 
          select: { id: true, name: true, sku: true, category: { select: { id: true, name: true } } } 
        },
      },
    }),
    prisma.optimizationRecommendation.count({ where }),
  ]);

  // Backfill riskLevel if legacy records have null in DB
  const data = recommendations.map(r => {
    if (r.riskLevel) return r;
    const inventoryPosition = r.onHandQty + r.incomingQty - r.committedQty;
    const deficit = r.targetStock - inventoryPosition;
    const computedRisk = determineRiskLevel(r.stockoutProbability, r.daysOfSupply, deficit, r.safetyStock);
    return { ...r, riskLevel: computedRisk };
  });

  res.json({
    data,
    pagination: { page, limit, total: totalCount, totalPages: Math.ceil(totalCount / limit) },
  });
});

router.post('/recommendations/:id/approve', requireRole('ADMIN', 'MANAGER'), validate(approveRecommendationSchema), async (req, res) => {
  const { id } = req.params;
  const { approvedQty, createPurchaseOrder } = req.body;
  const actorId = req.user.id;

  const result = await prisma.$transaction(async (tx) => {
    const recommendation = await tx.optimizationRecommendation.findUnique({
      where: { id },
      include: { product: true, store: true },
    });
    if (!recommendation) throw new NotFoundError('Recommendation not found');

    if (recommendation.status !== 'PENDING') {
      throw new ValidationError('Recommendation already processed');
    }

    const finalQty = approvedQty !== undefined ? approvedQty : recommendation.finalSuggestedQty;

    let createdPo = null;
    let newStatus = 'APPROVED';

    if (createPurchaseOrder && finalQty > 0) {
      const supplierProduct = await tx.supplierProduct.findFirst({
        where: { productId: recommendation.productId, active: true },
      });
      if (supplierProduct) {
        createdPo = await tx.purchaseOrder.create({
          data: {
            supplierId: supplierProduct.supplierId,
            storeId: recommendation.storeId,
            status: 'DRAFT',
            createdBy: actorId,
            items: {
              create: [
                {
                  productId: recommendation.productId,
                  orderedQty: finalQty,
                  unitCost: supplierProduct.unitCost,
                },
              ],
            },
          },
          include: { items: true },
        });
        newStatus = 'CONVERTED_TO_PO';
      }
    }

    const updatedRec = await tx.optimizationRecommendation.update({
      where: { id },
      data: {
        status: newStatus,
        finalSuggestedQty: finalQty,
        reviewedBy: actorId,
        reviewedAt: new Date(),
      },
      include: {
        product: { select: { id: true, name: true, sku: true } },
        store: { select: { id: true, name: true } },
      },
    });

    await tx.auditLog.create({
      data: {
        actorId,
        action: 'UPDATE',
        entityType: 'OptimizationRecommendation',
        entityId: id,
        details: { approvedQty: finalQty, createPurchaseOrder, poId: createdPo?.id },
      },
    });

    return { recommendation: updatedRec, purchaseOrder: createdPo };
  });

  res.json(result);
});

router.post('/recommendations/:id/reject', requireRole('ADMIN', 'MANAGER'), validate(rejectRecommendationSchema), async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const actorId = req.user.id;

  const recommendation = await prisma.optimizationRecommendation.findUnique({ where: { id } });
  if (!recommendation) throw new NotFoundError('Recommendation not found');

  if (recommendation.status !== 'PENDING') {
    throw new ValidationError('Recommendation already processed');
  }

  const updated = await prisma.optimizationRecommendation.update({
    where: { id },
    data: {
      status: 'REJECTED',
      reviewedBy: actorId,
      reviewedAt: new Date(),
      reviewReason: reason,
    },
    include: {
      product: { select: { id: true, name: true, sku: true } },
      store: { select: { id: true, name: true } },
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId,
      action: 'UPDATE',
      entityType: 'OptimizationRecommendation',
      entityId: id,
      details: { reason },
    },
  });

  res.json({ recommendation: updated });
});

router.post('/recalculate', requireRole('ADMIN', 'MANAGER'), validate(recalculateSchema), async (req, res) => {
  const { storeId, productIds } = req.body;
  const targetStoreId = storeId || 'default-store';

  // 1. Fetch active products with inventory, policy, supplierProducts
  const productWhere = { active: true };
  if (productIds && productIds.length > 0) {
    productWhere.id = { in: productIds };
  }

  const products = await prisma.product.findMany({
    where: productWhere,
    include: {
      inventory: { where: { storeId: targetStoreId } },
      inventoryPolicies: { where: { storeId: targetStoreId } },
      supplierProducts: { where: { active: true } },
    },
  });

  if (products.length === 0) {
    return res.json({ message: 'No products to recalculate', count: 0, productsProcessed: 0 });
  }

  // 2. Fetch incoming order quantities
  const openPOItems = await prisma.purchaseOrderItem.findMany({
    where: {
      purchaseOrder: {
        storeId: targetStoreId,
        status: { in: ['SUBMITTED', 'PARTIALLY_RECEIVED'] },
      },
    },
    select: { productId: true, orderedQty: true, receivedQty: true },
  });

  const incomingQtyMap = {};
  for (const item of openPOItems) {
    const remaining = Math.max(0, item.orderedQty - item.receivedQty);
    incomingQtyMap[item.productId] = (incomingQtyMap[item.productId] || 0) + remaining;
  }

  // 3. Dense 28-day daily calendar with zero-filled missing days
  const DAYS_HISTORY = 28;
  const now = new Date();
  const dateBuckets = [];
  for (let i = DAYS_HISTORY; i >= 1; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    dateBuckets.push(d.toISOString().slice(0, 10)); // 'YYYY-MM-DD'
  }
  const historyStart = new Date(now.getTime() - (DAYS_HISTORY + 1) * 24 * 60 * 60 * 1000);

  const recentSalesItems = await prisma.saleItem.findMany({
    where: {
      sale: {
        storeId: targetStoreId,
        status: 'COMPLETED',
        createdAt: { gte: historyStart },
      },
    },
    select: {
      productId: true,
      quantity: true,
      createdAt: true,
      sale: { select: { createdAt: true } },
    },
  });

  const productDailySales = {};
  for (const item of recentSalesItems) {
    const itemDate = item.sale?.createdAt || item.createdAt;
    const dateStr = new Date(itemDate).toISOString().slice(0, 10);
    if (!productDailySales[item.productId]) {
      productDailySales[item.productId] = {};
    }
    productDailySales[item.productId][dateStr] = (productDailySales[item.productId][dateStr] || 0) + item.quantity;
  }

  const salesMap = {};
  for (const p of products) {
    const dailyMap = productDailySales[p.id] || {};
    salesMap[p.id] = dateBuckets.map(dayStr => dailyMap[dayStr] || 0);
  }

  // 4. Prepare feature payloads
  const mlProducts = products.map(p => {
    const inv = p.inventory[0];
    const policy = p.inventoryPolicies[0];
    const supplierProd = p.supplierProducts[0];
    const recent = salesMap[p.id] || [];

    const onHand = inv?.quantityOnHand || 0;
    const reserved = inv?.reservedQuantity || 0;
    const available = Math.max(0, onHand - reserved);
    const safetyStock = policy?.safetyStock || 0;
    const incoming = incomingQtyMap[p.id] || 0;
    const leadTime = supplierProd?.leadTimeDays || 7;

    const slice7 = recent.slice(-7);
    const mean7 = slice7.length > 0 ? slice7.reduce((a, b) => a + b, 0) / slice7.length : 0;
    const std7 = slice7.length > 1 ? Math.sqrt(slice7.reduce((a, b) => a + Math.pow(b - mean7, 2), 0) / slice7.length) : 0;

    const slice14 = recent.slice(-14);
    const mean14 = slice14.length > 0 ? slice14.reduce((a, b) => a + b, 0) / slice14.length : 0;
    const std14 = slice14.length > 1 ? Math.sqrt(slice14.reduce((a, b) => a + Math.pow(b - mean14, 2), 0) / slice14.length) : 0;

    return {
      product_id: p.id,
      store_id: targetStoreId,
      selling_price: Number(p.sellingPrice),
      cost_price: Number(p.costPrice),
      on_hand: onHand,
      available,
      safety_stock: safetyStock,
      incoming_qty: incoming,
      lead_time_days: leadTime,
      lag_1: recent[recent.length - 1] || 0,
      lag_7: recent[recent.length - 7] || 0,
      lag_14: recent[recent.length - 14] || 0,
      lag_28: recent[recent.length - 28] || 0,
      rolling_mean_7: Math.round(mean7 * 100) / 100,
      rolling_std_7: Math.round(std7 * 100) / 100,
      rolling_mean_14: Math.round(mean14 * 100) / 100,
      rolling_std_14: Math.round(std14 * 100) / 100,
      recent_sales: recent,
    };
  });

  // 5. Bounded chunked batches with retry & validation
  const mlConfig = getMlConfig();
  const mlUrl = mlConfig.url;
  const mlApiKey = mlConfig.apiKey;
  const batchSize = mlConfig.batchSize;
  const timeoutMs = mlConfig.timeoutMs;
  const maxRetries = mlConfig.maxRetries;

  const batches = [];
  for (let i = 0; i < mlProducts.length; i += batchSize) {
    batches.push(mlProducts.slice(i, i + batchSize));
  }

  const predictionMap = new Map();
  let failedBatchesCount = 0;
  let activeModelVersion = 'BASELINE-v1.0';

  for (let bIdx = 0; bIdx < batches.length; bIdx++) {
    const batch = batches[bIdx];
    let batchSuccess = false;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const mlResponse = await fetch(`${mlUrl}/internal/forecasts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': mlApiKey,
          },
          body: JSON.stringify({
            products: batch,
            horizon_days: 7,
            feature_schema_version: '2.0',
          }),
          signal: AbortSignal.timeout(timeoutMs),
        });

        if (mlResponse.ok) {
          const batchData = await mlResponse.json();
          if (batchData?.model_version) {
            activeModelVersion = batchData.model_version;
          }

          if (Array.isArray(batchData?.predictions)) {
            for (const item of batchData.predictions) {
              if (item?.product_id && item.status === 'success' && Array.isArray(item.predictions)) {
                // Strict validation of predictions before persistence
                const validPreds = item.predictions.filter(pred => 
                  pred.target_date && 
                  typeof pred.predicted_demand === 'number' && 
                  isFinite(pred.predicted_demand) && 
                  pred.predicted_demand >= 0
                );

                if (validPreds.length > 0) {
                  predictionMap.set(item.product_id, {
                    predictions: validPreds,
                    method: item.method || 'MODEL_QUANTILE',
                    stockout: item.stockout || null,
                    status: 'success',
                  });
                }
              }
            }
            batchSuccess = true;
            break;
          }
        }
      } catch (err) {
        console.warn(`[ML Service] Batch ${bIdx + 1}/${batches.length} attempt ${attempt + 1} failed: ${err.message}`);
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 200 * (attempt + 1)));
        }
      }
    }

    if (!batchSuccess) {
      failedBatchesCount++;
    }
  }

  const runId = `RUN-${Date.now()}`;
  let modelForecastsCount = 0;
  let fallbackForecastsCount = 0;
  let createdForecastsCount = 0;
  let createdRecommendationsCount = 0;

  // 6. Persist forecasts and generate replenishment recommendations
  for (const product of products) {
    const inv = product.inventory[0];
    const policy = product.inventoryPolicies[0];
    const supplierProd = product.supplierProducts[0];
    const recent = salesMap[product.id] || [];

    let productPreds = [];
    let forecastMethod = 'MODEL';
    const mlProdResult = predictionMap.get(product.id);

    if (mlProdResult && mlProdResult.status === 'success' && mlProdResult.predictions.length > 0) {
      productPreds = mlProdResult.predictions;
      const validMethods = ['MODEL', 'MODEL_QUANTILE', 'BASELINE_MOVING_AVERAGE', 'BASELINE_DAY_OF_WEEK', 'INSUFFICIENT_DATA', 'FALLBACK'];
      forecastMethod = validMethods.includes(mlProdResult.method) ? mlProdResult.method : 'MODEL';
      if (forecastMethod === 'MODEL' || forecastMethod === 'MODEL_QUANTILE') {
        modelForecastsCount++;
      } else {
        fallbackForecastsCount++;
      }
    } else {
      // Legitimate fallback moving average
      const totalSales = recent.reduce((s, v) => s + v, 0);
      if (recent.length < 7) {
        forecastMethod = 'INSUFFICIENT_DATA';
      } else {
        forecastMethod = 'BASELINE_MOVING_AVERAGE';
      }
      fallbackForecastsCount++;

      const avg = totalSales > 0 ? totalSales / recent.length : 1;
      for (let i = 1; i <= 7; i++) {
        const targetDate = new Date();
        targetDate.setUTCDate(targetDate.getUTCDate() + i);
        targetDate.setUTCHours(0, 0, 0, 0);
        productPreds.push({
          target_date: targetDate.toISOString(),
          predicted_demand: Math.round(avg * 10) / 10,
          demand_p50: Math.round(avg * 10) / 10,
          demand_p90: Math.round(avg * 15) / 10,
          demand_p95: Math.round(avg * 18) / 10,
        });
      }
    }

    // Persist forecasts
    for (const pred of productPreds) {
      const targetDate = new Date(pred.target_date);
      targetDate.setUTCHours(0, 0, 0, 0);

      const p50 = pred.demand_p50 !== undefined ? Number(pred.demand_p50) : Number(pred.predicted_demand);
      const p90 = pred.demand_p90 !== undefined ? Number(pred.demand_p90) : null;
      const p95 = pred.demand_p95 !== undefined ? Number(pred.demand_p95) : null;
      const stockoutProb = mlProdResult?.stockout?.probability_within_lead_time !== undefined
        ? Number(mlProdResult.stockout.probability_within_lead_time)
        : null;
      const dos = mlProdResult?.stockout?.days_of_supply !== undefined
        ? Number(mlProdResult.stockout.days_of_supply)
        : null;
      const stockoutRisk = mlProdResult?.stockout?.risk_level || null;

      await prisma.forecast.upsert({
        where: {
          storeId_productId_targetDate_runId: {
            storeId: targetStoreId,
            productId: product.id,
            targetDate,
            runId,
          },
        },
        create: {
          storeId: targetStoreId,
          productId: product.id,
          targetDate,
          horizonDays: 7,
          runId,
          predictedDemand: pred.predicted_demand,
          predictedDemandP50: p50,
          predictedDemandP90: p90,
          predictedDemandP95: p95,
          stockoutProbability: stockoutProb,
          daysOfSupply: dos,
          stockoutRiskLevel: stockoutRisk,
          modelVersion: activeModelVersion,
          forecastMethod,
        },
        update: {
          predictedDemand: pred.predicted_demand,
          predictedDemandP50: p50,
          predictedDemandP90: p90,
          predictedDemandP95: p95,
          stockoutProbability: stockoutProb,
          daysOfSupply: dos,
          stockoutRiskLevel: stockoutRisk,
          modelVersion: activeModelVersion,
          forecastMethod,
        },
      });
      createdForecastsCount++;
    }

    // 7. Calculate Recommendation
    const onHandQty = inv?.quantityOnHand || 0;
    const incomingQty = incomingQtyMap[product.id] || 0;
    const committedQty = inv?.reservedQuantity || 0;
    const inventoryPosition = onHandQty + incomingQty - committedQty;

    const safetyStock = policy?.safetyStock || 0;
    const reviewPeriod = policy?.reviewPeriod || 7;
    const leadTimeDays = supplierProd?.leadTimeDays || 7;
    const minOrderQty = supplierProd?.minOrderQty || 1;
    const packMultiple = supplierProd?.packMultiple || 1;

    const total7DayDemand = productPreds.reduce((sum, p) => sum + p.predicted_demand, 0);
    const dailyDemand = total7DayDemand / 7;
    const protectionPeriod = leadTimeDays + reviewPeriod;
    const protectionDemand = dailyDemand * protectionPeriod;
    const targetStock = Math.ceil(protectionDemand + safetyStock);
    const reorderPoint = Math.ceil((dailyDemand * leadTimeDays) + safetyStock);
    const deficit = targetStock - inventoryPosition;

    const stockoutProb = mlProdResult?.stockout?.probability_within_lead_time !== undefined
      ? Number(mlProdResult.stockout.probability_within_lead_time)
      : null;
    const dos = mlProdResult?.stockout?.days_of_supply !== undefined
      ? Number(mlProdResult.stockout.days_of_supply)
      : null;

    // Authoritative risk level persisted directly to DB
    const riskLevel = determineRiskLevel(stockoutProb, dos, deficit, safetyStock);

    const rawSuggestedQty = Math.max(0, targetStock - inventoryPosition);
    let finalSuggestedQty = 0;

    if (rawSuggestedQty > 0) {
      let qty = Math.max(rawSuggestedQty, minOrderQty);
      if (packMultiple > 1) {
        qty = Math.ceil(qty / packMultiple) * packMultiple;
      }
      finalSuggestedQty = qty;
    }

    const explanation = `Inv Pos: ${inventoryPosition} (On-Hand: ${onHandQty}, Incoming: ${incomingQty}, Committed: ${committedQty}). Target Stock: ${targetStock} (Forecast ${Math.round(protectionDemand)} + Safety ${safetyStock}). Lead Time: ${leadTimeDays}d. Suggested: ${rawSuggestedQty}, Adjusted (MOQ: ${minOrderQty}, Pack: ${packMultiple}): ${finalSuggestedQty}.`;

    // Upsert recommendation
    const existingRec = await prisma.optimizationRecommendation.findFirst({
      where: {
        storeId: targetStoreId,
        productId: product.id,
        status: 'PENDING',
      },
    });

    if (existingRec) {
      await prisma.optimizationRecommendation.update({
        where: { id: existingRec.id },
        data: {
          forecastRunId: runId,
          onHandQty,
          incomingQty,
          committedQty,
          safetyStock,
          targetStock,
          rawSuggestedQty,
          finalSuggestedQty,
          reorderPoint,
          stockoutProbability: stockoutProb,
          daysOfSupply: dos,
          riskLevel,
          constraintsApplied: { minOrderQty, packMultiple, leadTimeDays, reviewPeriod },
          explanation,
          modelVersion: activeModelVersion,
          forecastMethod,
          calculatedAt: new Date(),
        },
      });
    } else {
      await prisma.optimizationRecommendation.create({
        data: {
          storeId: targetStoreId,
          productId: product.id,
          forecastRunId: runId,
          onHandQty,
          incomingQty,
          committedQty,
          safetyStock,
          targetStock,
          rawSuggestedQty,
          finalSuggestedQty,
          reorderPoint,
          stockoutProbability: stockoutProb,
          daysOfSupply: dos,
          riskLevel,
          constraintsApplied: { minOrderQty, packMultiple, leadTimeDays, reviewPeriod },
          explanation,
          modelVersion: activeModelVersion,
          forecastMethod,
          status: 'PENDING',
        },
      });
    }
    createdRecommendationsCount++;
  }

  const allBatchesFailed = batches.length > 0 && failedBatchesCount === batches.length;
  const isPartialSuccess = modelForecastsCount > 0 && (failedBatchesCount > 0 || fallbackForecastsCount > 0);
  const runStatus = (products.length > 0 && createdForecastsCount === 0)
    ? 'FAILED'
    : allBatchesFailed
      ? 'FALLBACK_ONLY'
      : isPartialSuccess
        ? 'PARTIAL_SUCCESS'
        : modelForecastsCount === 0
          ? 'FALLBACK_ONLY'
          : 'SUCCESS';

  if (runStatus === 'FAILED') {
    return res.status(502).json({
      error: 'Recalculation failed to generate forecasts or recommendations',
      runId,
      runStatus: 'FAILED',
      storeId: targetStoreId,
      productsProcessed: products.length,
      modelForecastsCount: 0,
      fallbackForecastsCount: 0,
      failedBatchesCount,
      forecastsGenerated: 0,
      recommendationsGenerated: 0,
    });
  }

  const message = runStatus === 'SUCCESS'
    ? 'Recalculation completed successfully'
    : runStatus === 'PARTIAL_SUCCESS'
      ? 'Recalculation completed with partial ML coverage'
      : 'ML forecasting service unavailable; baseline fallbacks applied';

  res.json({
    message,
    runId,
    runStatus,
    storeId: targetStoreId,
    productsProcessed: products.length,
    modelForecastsCount,
    fallbackForecastsCount,
    failedBatchesCount,
    forecastsGenerated: createdForecastsCount,
    recommendationsGenerated: createdRecommendationsCount,
    modelVersion: activeModelVersion,
  });
});

// Forecasts
router.get('/forecasts', requireRole('ADMIN', 'MANAGER'), validate(forecastsQuerySchema), async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const storeId = req.query.storeId;
  const productId = req.query.productId;
  const modelVersion = req.query.modelVersion;
  const forecastMethod = req.query.forecastMethod;
  const startDate = req.query.startDate ? new Date(req.query.startDate) : undefined;
  const endDate = req.query.endDate ? new Date(req.query.endDate) : undefined;
  const skip = (page - 1) * limit;

  const where = {};
  if (storeId) where.storeId = storeId;
  if (productId) where.productId = productId;
  if (modelVersion) where.modelVersion = modelVersion;
  if (forecastMethod) where.forecastMethod = forecastMethod;
  if (startDate || endDate) {
    where.targetDate = {};
    if (startDate) where.targetDate = { ...where.targetDate, gte: startDate };
    if (endDate) where.targetDate = { ...where.targetDate, lte: endDate };
  }

  const [forecasts, total] = await Promise.all([
    prisma.forecast.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ targetDate: 'asc' }, { id: 'asc' }],
      include: {
        store: { select: { id: true, name: true } },
        product: { select: { id: true, name: true, sku: true } },
      },
    }),
    prisma.forecast.count({ where }),
  ]);

  res.json({
    data: forecasts,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// Slow moving
router.get('/slow-moving', requireRole('ADMIN', 'MANAGER'), validate(slowMovingQuerySchema), async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const storeId = req.query.storeId || 'default-store';
  const categoryId = req.query.categoryId;
  const daysNoSale = parseInt(req.query.daysNoSale) || 30;
  const skip = (page - 1) * limit;

  const cutoffDate = new Date(Date.now() - daysNoSale * 24 * 60 * 60 * 1000);

  const where = {
    storeId,
    quantityOnHand: { gt: 0 },
    product: { active: true },
    ...(categoryId && { product: { categoryId } }),
  };

  const inventoryItems = await prisma.inventory.findMany({
    where,
    include: {
      product: { include: { category: true } },
      store: true,
    },
  });

  const slowMoving = [];
  for (const inv of inventoryItems) {
    const recentSale = await prisma.saleItem.findFirst({
      where: {
        productId: inv.productId,
        sale: {
          storeId,
          status: 'COMPLETED',
          createdAt: { gte: cutoffDate },
        },
      },
    });

    if (!recentSale) {
      slowMoving.push({
        id: inv.id,
        product: inv.product,
        store: inv.store,
        onHand: inv.quantityOnHand,
        daysSinceLastSale: daysNoSale,
        inventoryValue: Number(inv.quantityOnHand) * Number(inv.product.costPrice),
      });
    }
  }

  slowMoving.sort((a, b) => b.inventoryValue - a.inventoryValue);

  res.json({
    data: slowMoving.slice(skip, skip + limit),
    pagination: { page, limit, total: slowMoving.length, totalPages: Math.ceil(slowMoving.length / limit) },
  });
});

// Expiry risk
router.get('/expiry-risk', requireRole('ADMIN', 'MANAGER', 'INVENTORY_STAFF'), validate(expiryRiskQuerySchema), async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);
  const storeId = req.query.storeId || 'default-store';
  const daysUntilExpiry = parseInt(req.query.daysUntilExpiry) || 30;
  const skip = (page - 1) * limit;

  const expiryCutoff = new Date(Date.now() + daysUntilExpiry * 24 * 60 * 60 * 1000);

  const batches = await prisma.productBatch.findMany({
    where: {
      storeId,
      expiryDate: { lte: expiryCutoff },
      quantityOnHand: { gt: 0 },
    },
    include: {
      product: { include: { category: true } },
      store: true,
    },
    orderBy: { expiryDate: 'asc' },
  });

  const data = batches.map(b => ({
    batch: b,
    daysUntilExpiry: Math.ceil((b.expiryDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
    riskLevel: b.expiryDate < new Date() ? 'EXPIRED' : 
               b.expiryDate < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) ? 'CRITICAL' : 'WARNING',
    valueAtRisk: Number(b.quantityOnHand) * Number(b.product.costPrice),
  }));

  res.json({
    data: data.slice(skip, skip + limit),
    pagination: { page, limit, total: data.length, totalPages: Math.ceil(data.length / limit) },
  });
});

router.get('/model-info', requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  const mlConfig = getMlConfig();
  const mlUrl = mlConfig.url;
  const mlApiKey = mlConfig.apiKey;
  try {
    const response = await fetch(`${mlUrl}/internal/model-info`, {
      headers: { 'X-API-Key': mlApiKey },
      signal: AbortSignal.timeout(3000),
    });
    if (response.ok) {
      const data = await response.json();
      return res.json(data);
    }
    return res.status(response.status).json({ error: 'Failed to retrieve model info' });
  } catch (err) {
    return res.json({
      status: 'DEGRADED',
      version: 'FALLBACK-v1.0',
      model_family: 'rule_based_fallback',
      metrics: {},
      error: err.message,
    });
  }
});

export default router;
