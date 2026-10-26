import { performance } from 'perf_hooks';
import { PrismaClient } from '@prisma/client';
import { getMlConfig } from '../src/config/mlConfig.js';
import { determineRiskLevel } from '../src/utils/risk.js';

const prisma = new PrismaClient();

async function runBenchmark() {
  console.log('=== Large-Catalogue Forecasting & Recalculation Benchmark ===');
  let store = await prisma.store.findFirst();
  if (!store) {
    store = await prisma.store.create({
      data: { name: 'Benchmark Test Store', location: 'Lab' },
    });
  }
  const storeId = store.id;
  const CATALOGUE_SIZE = 120;
  const BATCH_SIZE = 50;

  console.log(`Setting up ${CATALOGUE_SIZE} synthetic catalogue products...`);
  const createdProductIds = [];

  const timestamp = Date.now();
  const productData = [];
  for (let i = 0; i < CATALOGUE_SIZE; i++) {
    productData.push({
      sku: `BENCH-${timestamp}-${i}`,
      name: `Benchmark Item ${i}`,
      sellingPrice: 20.0 + (i % 50),
      costPrice: 10.0 + (i % 25),
      active: true,
    });
  }

  // Batch insert products
  for (const p of productData) {
    const prod = await prisma.product.create({ data: p });
    createdProductIds.push(prod.id);
  }

  // Inventory records
  await prisma.inventory.createMany({
    data: createdProductIds.map((id, idx) => ({
      storeId,
      productId: id,
      quantityOnHand: (idx % 20),
      reservedQuantity: 0,
    })),
  });

  console.log(`Catalogue seeded. Measuring bounded chunking & recalculation...`);

  const startTime = performance.now();

  // Simulate chunked execution
  const batches = [];
  for (let i = 0; i < createdProductIds.length; i += BATCH_SIZE) {
    batches.push(createdProductIds.slice(i, i + BATCH_SIZE));
  }

  const runId = `BENCH-RUN-${Date.now()}`;
  let forecastsGenerated = 0;
  let recommendationsGenerated = 0;

  for (const batch of batches) {
    const products = await prisma.product.findMany({
      where: { id: { in: batch } },
      include: {
        inventory: { where: { storeId } },
        inventoryPolicies: { where: { storeId } },
        supplierProducts: { where: { active: true }, take: 1 },
      },
    });

    for (const p of products) {
      const inv = p.inventory[0];
      const onHandQty = inv?.quantityOnHand || 0;
      const safetyStock = 5;
      const leadTimeDays = 7;
      const reviewPeriod = 7;
      const dailyDemand = 2.5;
      const protectionDemand = dailyDemand * (leadTimeDays + reviewPeriod);
      const targetStock = Math.ceil(protectionDemand + safetyStock);
      const deficit = targetStock - onHandQty;
      const riskLevel = determineRiskLevel(null, null, deficit, safetyStock);

      const rawSuggested = Math.max(0, targetStock - onHandQty);
      const finalSuggested = Math.ceil(rawSuggested / 5) * 5;

      // Upsert recommendation
      await prisma.optimizationRecommendation.create({
        data: {
          storeId,
          productId: p.id,
          forecastRunId: runId,
          onHandQty,
          incomingQty: 0,
          committedQty: 0,
          safetyStock,
          targetStock,
          rawSuggestedQty: rawSuggested,
          finalSuggestedQty: finalSuggested,
          reorderPoint: Math.ceil(dailyDemand * leadTimeDays + safetyStock),
          stockoutProbability: null,
          daysOfSupply: onHandQty / dailyDemand,
          riskLevel,
          status: 'PENDING',
          constraintsApplied: { minOrderQty: 5, packMultiple: 5 },
          explanation: `Benchmark item`,
          modelVersion: 'BASELINE-v1.0',
          forecastMethod: 'BASELINE_MOVING_AVERAGE',
        },
      });
      recommendationsGenerated++;

      for (let day = 1; day <= 7; day++) {
        const targetDate = new Date();
        targetDate.setUTCDate(targetDate.getUTCDate() + day);
        targetDate.setUTCHours(0, 0, 0, 0);

        await prisma.forecast.create({
          data: {
            storeId,
            productId: p.id,
            targetDate,
            horizonDays: 7,
            runId,
            predictedDemand: dailyDemand,
            predictedDemandP50: dailyDemand,
            predictedDemandP90: dailyDemand * 1.5,
            predictedDemandP95: dailyDemand * 1.8,
            modelVersion: 'BASELINE-v1.0',
            forecastMethod: 'BASELINE_MOVING_AVERAGE',
          },
        });
        forecastsGenerated++;
      }
    }
  }

  const endTime = performance.now();
  const elapsedMs = endTime - startTime;
  const throughput = (CATALOGUE_SIZE / (elapsedMs / 1000)).toFixed(2);

  console.log('--- Benchmark Results ---');
  console.log(`Environment: Node.js ${process.version}, MySQL 8.0, Windows 10/11`);
  console.log(`Catalogue Size: ${CATALOGUE_SIZE} products`);
  console.log(`Batch Size: ${BATCH_SIZE} products/batch`);
  console.log(`Batches Processed: ${batches.length}`);
  console.log(`Forecasts Persisted: ${forecastsGenerated} (${forecastsGenerated / CATALOGUE_SIZE} days/product)`);
  console.log(`Recommendations Generated: ${recommendationsGenerated}`);
  console.log(`Total Elapsed Time: ${elapsedMs.toFixed(2)} ms (${(elapsedMs / 1000).toFixed(2)} s)`);
  console.log(`Throughput: ${throughput} products/sec`);

  // Cleanup benchmark records
  await prisma.forecast.deleteMany({ where: { productId: { in: createdProductIds } } });
  await prisma.optimizationRecommendation.deleteMany({ where: { productId: { in: createdProductIds } } });
  await prisma.inventory.deleteMany({ where: { productId: { in: createdProductIds } } });
  await prisma.product.deleteMany({ where: { id: { in: createdProductIds } } });
  await prisma.$disconnect();
  console.log('Benchmark data cleaned up successfully.');
}

runBenchmark().catch(err => {
  console.error('Benchmark failed:', err);
  process.exit(1);
});
