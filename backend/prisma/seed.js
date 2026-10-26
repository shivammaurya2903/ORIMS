import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

// Rounding helper for currency amounts in INR (paise precision)
function roundToTwo(num) {
  return Math.round((Number(num) + Number.EPSILON) * 100) / 100;
}

async function main() {
  console.log('🌱 Seeding ORIMS database (Indian Retail Store / INR)...');

  // 1. Create or update Default Store in Bengaluru, India
  const store = await prisma.store.upsert({
    where: { id: 'default-store' },
    update: {
      name: 'ORIMS Supermarket',
      location: '100 MG Road, Bengaluru, Karnataka',
      taxRate: 0.10,
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      active: true,
    },
    create: {
      id: 'default-store',
      name: 'ORIMS Supermarket',
      location: '100 MG Road, Bengaluru, Karnataka',
      taxRate: 0.10,
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      active: true,
    },
  });
  console.log(`✅ Store ready: ${store.name} (${store.currency}, ${store.timezone})`);

  // 2. Create standard users
  const passwordHash = await bcrypt.hash('password123', 12);
  
  const admin = await prisma.user.upsert({
    where: { email: 'admin@orims.local' },
    update: { passwordHash, status: 'ACTIVE' },
    create: {
      email: 'admin@orims.local',
      name: 'Admin User',
      passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: 'manager@orims.local' },
    update: { passwordHash, status: 'ACTIVE' },
    create: {
      email: 'manager@orims.local',
      name: 'Store Manager',
      passwordHash,
      role: 'MANAGER',
      status: 'ACTIVE',
    },
  });

  const salesStaff = await prisma.user.upsert({
    where: { email: 'sales@orims.local' },
    update: { passwordHash, status: 'ACTIVE' },
    create: {
      email: 'sales@orims.local',
      name: 'Sales Staff',
      passwordHash,
      role: 'SALES_STAFF',
      status: 'ACTIVE',
    },
  });

  const inventoryStaff = await prisma.user.upsert({
    where: { email: 'inventory@orims.local' },
    update: { passwordHash, status: 'ACTIVE' },
    create: {
      email: 'inventory@orims.local',
      name: 'Inventory Staff',
      passwordHash,
      role: 'INVENTORY_STAFF',
      status: 'ACTIVE',
    },
  });
  console.log('✅ Core users verified (admin, manager, sales, inventory)');

  // 3. Categories
  const categories = await Promise.all([
    prisma.category.upsert({
      where: { name: 'Electronics' },
      update: {},
      create: { name: 'Electronics', description: 'Electronic devices and accessories' },
    }),
    prisma.category.upsert({
      where: { name: 'Clothing' },
      update: {},
      create: { name: 'Clothing', description: 'Apparel and fashion items' },
    }),
    prisma.category.upsert({
      where: { name: 'Food & Beverages' },
      update: {},
      create: { name: 'Food & Beverages', description: 'Consumable food and grocery products' },
    }),
    prisma.category.upsert({
      where: { name: 'Home & Garden' },
      update: {},
      create: { name: 'Home & Garden', description: 'Home improvement and living supplies' },
    }),
  ]);
  console.log('✅ Categories verified:', categories.map(c => c.name).join(', '));

  // 4. Products with realistic INR pricing
  const productConfigs = [
    {
      sku: 'ELEC-001',
      barcode: '8901234567890',
      name: 'Wireless Headphones',
      description: 'Bluetooth noise-cancelling over-ear headphones',
      categoryId: categories[0].id,
      costPrice: 1800.00,
      sellingPrice: 2999.00,
      unitOfMeasure: 'EA',
      safetyStock: 10,
      openingStock: 50,
    },
    {
      sku: 'ELEC-002',
      barcode: '8901234567891',
      name: 'Fast Charging USB-C Cable 2m',
      description: 'Braided durable USB-C to USB-C charging cable',
      categoryId: categories[0].id,
      costPrice: 150.00,
      sellingPrice: 399.00,
      unitOfMeasure: 'EA',
      safetyStock: 15,
      openingStock: 150,
    },
    {
      sku: 'CLTH-001',
      barcode: '8901234567892',
      name: 'Classic Cotton T-Shirt',
      description: '100% combed bio-wash cotton t-shirt',
      categoryId: categories[1].id,
      costPrice: 350.00,
      sellingPrice: 799.00,
      unitOfMeasure: 'EA',
      safetyStock: 15,
      openingStock: 100,
    },
    {
      sku: 'CLTH-002',
      barcode: '8901234567893',
      name: 'Slim Fit Denim Jeans',
      description: 'Stretchable comfort denim jeans',
      categoryId: categories[1].id,
      costPrice: 850.00,
      sellingPrice: 1899.00,
      unitOfMeasure: 'EA',
      safetyStock: 10,
      openingStock: 80,
    },
    {
      sku: 'FOOD-001',
      barcode: '8901234567894',
      name: 'Estate Arabica Coffee Beans 1kg',
      description: 'Freshly roasted single-origin Chikmagalur Arabica coffee beans',
      categoryId: categories[2].id,
      costPrice: 450.00,
      sellingPrice: 750.00,
      unitOfMeasure: 'KG',
      safetyStock: 15,
      openingStock: 90,
    },
    {
      sku: 'HOME-001',
      barcode: '8901234567895',
      name: 'Adjustable LED Desk Lamp',
      description: 'Eye-care dimmable LED study desk lamp',
      categoryId: categories[3].id,
      costPrice: 600.00,
      sellingPrice: 1299.00,
      unitOfMeasure: 'EA',
      safetyStock: 10,
      openingStock: 20,
    },
  ];

  const products = [];
  for (const pc of productConfigs) {
    const prod = await prisma.product.upsert({
      where: { sku: pc.sku },
      update: {
        barcode: pc.barcode,
        name: pc.name,
        description: pc.description,
        categoryId: pc.categoryId,
        costPrice: pc.costPrice,
        sellingPrice: pc.sellingPrice,
        unitOfMeasure: pc.unitOfMeasure,
        active: true,
      },
      create: {
        sku: pc.sku,
        barcode: pc.barcode,
        name: pc.name,
        description: pc.description,
        categoryId: pc.categoryId,
        costPrice: pc.costPrice,
        sellingPrice: pc.sellingPrice,
        unitOfMeasure: pc.unitOfMeasure,
        active: true,
      },
    });
    products.push({ ...prod, openingStock: pc.openingStock, safetyStock: pc.safetyStock });
  }
  console.log(`✅ ${products.length} products verified with INR pricing`);

  // 5. Inventory Policies
  for (const p of products) {
    await prisma.inventoryPolicy.upsert({
      where: { storeId_productId: { storeId: store.id, productId: p.id } },
      update: {
        safetyStock: p.safetyStock,
        serviceLevel: 0.95,
        reviewPeriod: 7,
        policySource: 'MANUAL',
      },
      create: {
        storeId: store.id,
        productId: p.id,
        safetyStock: p.safetyStock,
        serviceLevel: 0.95,
        reviewPeriod: 7,
        policySource: 'MANUAL',
      },
    });
  }
  console.log('✅ Inventory policies verified');

  // 6. Suppliers & Product-Supplier Links
  const suppliers = await Promise.all([
    prisma.supplier.upsert({
      where: { id: 'sup-001' },
      update: {
        name: 'TechSupplies India Ltd',
        email: 'orders@techsupplies.in',
        phone: '+91-80-25550101',
        address: 'Plot 45, Electronics City, Bengaluru, Karnataka',
        notes: 'Primary electronics distributor',
        active: true,
      },
      create: {
        id: 'sup-001',
        name: 'TechSupplies India Ltd',
        email: 'orders@techsupplies.in',
        phone: '+91-80-25550101',
        address: 'Plot 45, Electronics City, Bengaluru, Karnataka',
        notes: 'Primary electronics distributor',
        active: true,
      },
    }),
    prisma.supplier.upsert({
      where: { id: 'sup-002' },
      update: {
        name: 'Fashion Wholesale India',
        email: 'sales@fashionwholesale.in',
        phone: '+91-22-24950102',
        address: '120 Lower Parel, Mumbai, Maharashtra',
        notes: 'Clothing and textiles wholesaler',
        active: true,
      },
      create: {
        id: 'sup-002',
        name: 'Fashion Wholesale India',
        email: 'sales@fashionwholesale.in',
        phone: '+91-22-24950102',
        address: '120 Lower Parel, Mumbai, Maharashtra',
        notes: 'Clothing and textiles wholesaler',
        active: true,
      },
    }),
    prisma.supplier.upsert({
      where: { id: 'sup-003' },
      update: {
        name: 'Fresh Harvest Foods Distributors',
        email: 'orders@freshharvest.in',
        phone: '+91-11-26850103',
        address: '24 Okhla Industrial Area, New Delhi',
        notes: 'Gourmet beverage and packaged goods distributor',
        active: true,
      },
      create: {
        id: 'sup-003',
        name: 'Fresh Harvest Foods Distributors',
        email: 'orders@freshharvest.in',
        phone: '+91-11-26850103',
        address: '24 Okhla Industrial Area, New Delhi',
        notes: 'Gourmet beverage and packaged goods distributor',
        active: true,
      },
    }),
  ]);

  await Promise.all([
    prisma.supplierProduct.upsert({
      where: { supplierId_productId: { supplierId: suppliers[0].id, productId: products[0].id } },
      update: { unitCost: 1800.00, leadTimeDays: 7, minOrderQty: 10, packMultiple: 5 },
      create: { supplierId: suppliers[0].id, productId: products[0].id, leadTimeDays: 7, minOrderQty: 10, packMultiple: 5, unitCost: 1800.00 },
    }),
    prisma.supplierProduct.upsert({
      where: { supplierId_productId: { supplierId: suppliers[0].id, productId: products[1].id } },
      update: { unitCost: 150.00, leadTimeDays: 5, minOrderQty: 50, packMultiple: 10 },
      create: { supplierId: suppliers[0].id, productId: products[1].id, leadTimeDays: 5, minOrderQty: 50, packMultiple: 10, unitCost: 150.00 },
    }),
    prisma.supplierProduct.upsert({
      where: { supplierId_productId: { supplierId: suppliers[1].id, productId: products[2].id } },
      update: { unitCost: 350.00, leadTimeDays: 14, minOrderQty: 20, packMultiple: 10 },
      create: { supplierId: suppliers[1].id, productId: products[2].id, leadTimeDays: 14, minOrderQty: 20, packMultiple: 10, unitCost: 350.00 },
    }),
    prisma.supplierProduct.upsert({
      where: { supplierId_productId: { supplierId: suppliers[1].id, productId: products[3].id } },
      update: { unitCost: 850.00, leadTimeDays: 14, minOrderQty: 15, packMultiple: 5 },
      create: { supplierId: suppliers[1].id, productId: products[3].id, leadTimeDays: 14, minOrderQty: 15, packMultiple: 5, unitCost: 850.00 },
    }),
    prisma.supplierProduct.upsert({
      where: { supplierId_productId: { supplierId: suppliers[2].id, productId: products[4].id } },
      update: { unitCost: 450.00, leadTimeDays: 3, minOrderQty: 10, packMultiple: 5 },
      create: { supplierId: suppliers[2].id, productId: products[4].id, leadTimeDays: 3, minOrderQty: 10, packMultiple: 5, unitCost: 450.00 },
    }),
    prisma.supplierProduct.upsert({
      where: { supplierId_productId: { supplierId: suppliers[0].id, productId: products[5].id } },
      update: { unitCost: 600.00, leadTimeDays: 10, minOrderQty: 10, packMultiple: 5 },
      create: { supplierId: suppliers[0].id, productId: products[5].id, leadTimeDays: 10, minOrderQty: 10, packMultiple: 5, unitCost: 600.00 },
    }),
  ]);
  console.log('✅ Suppliers and catalog linkage verified');

  // 7. Deterministic Purchase Order (Idempotent)
  const poDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const poExpected = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
  const po = await prisma.purchaseOrder.upsert({
    where: { id: 'demo-po-001' },
    update: {
      status: 'RECEIVED',
      orderDate: poDate,
      expectedDate: poExpected,
    },
    create: {
      id: 'demo-po-001',
      supplierId: suppliers[0].id,
      storeId: store.id,
      status: 'RECEIVED',
      orderDate: poDate,
      expectedDate: poExpected,
      createdBy: manager.id,
      approvedBy: manager.id,
      items: {
        create: [
          { productId: products[0].id, orderedQty: 20, receivedQty: 20, unitCost: 1800.00 },
          { productId: products[1].id, orderedQty: 100, receivedQty: 100, unitCost: 150.00 },
        ],
      },
    },
  });
  console.log('✅ Demo purchase order verified:', po.id);

  // 8. Safe Idempotency Cleanup for Demo Sales
  // Only targets demo-labeled sales (DEMO-SALE-*) so user/production data is never touched
  const existingDemoSales = await prisma.sale.findMany({
    where: { idempotencyKey: { startsWith: 'DEMO-SALE-' } },
    select: { id: true },
  });

  if (existingDemoSales.length > 0) {
    const saleIds = existingDemoSales.map(s => s.id);
    await prisma.stockMovement.deleteMany({
      where: { referenceType: 'SALE', referenceId: { in: saleIds } },
    });
    await prisma.saleItem.deleteMany({
      where: { saleId: { in: saleIds } },
    });
    await prisma.sale.deleteMany({
      where: { id: { in: saleIds } },
    });
    console.log(`🧹 Cleaned up ${existingDemoSales.length} existing demo sales for idempotent re-seed`);
  }

  // 9. Initialize / Reset Opening Inventory
  for (const p of products) {
    await prisma.inventory.upsert({
      where: { storeId_productId: { storeId: store.id, productId: p.id } },
      update: {
        quantityOnHand: p.openingStock,
        reservedQuantity: 0,
      },
      create: {
        storeId: store.id,
        productId: p.id,
        quantityOnHand: p.openingStock,
        reservedQuantity: 0,
      },
    });
  }
  console.log('✅ Opening inventory baseline initialized');

  // 10. Generate 5 Consecutive Days of Realistic Shop Sales
  // Date window: Day -4 to Day 0 (Today) in Asia/Kolkata
  // Daily volume:
  //   Day -4 (Thu): 9 sales
  //   Day -3 (Fri): 11 sales
  //   Day -2 (Sat): 15 sales (Weekend peak)
  //   Day -1 (Sun): 13 sales (Busy weekend)
  //   Day  0 (Mon): 10 sales (Weekday trade)
  // Total: 58 completed retail sales
  const dailyDistribution = [
    { dayOffset: 4, count: 9 },
    { dayOffset: 3, count: 11 },
    { dayOffset: 2, count: 15 },
    { dayOffset: 1, count: 13 },
    { dayOffset: 0, count: 10 },
  ];

  // Sale item templates with natural basket mix:
  // p[0]=Headphones(₹2999), p[1]=Cable(₹399), p[2]=T-Shirt(₹799),
  // p[3]=Jeans(₹1899), p[4]=Coffee(₹750), p[5]=Lamp(₹1299)
  const basketMixes = [
    [{ pIdx: 1, qty: 2 }, { pIdx: 0, qty: 1 }],            // Cable + Headphones
    [{ pIdx: 2, qty: 2 }, { pIdx: 3, qty: 1 }],            // T-Shirts + Jeans
    [{ pIdx: 4, qty: 2 }],                                  // Coffee Beans x2
    [{ pIdx: 1, qty: 1 }, { pIdx: 5, qty: 1 }],            // Cable + Desk Lamp
    [{ pIdx: 2, qty: 1 }, { pIdx: 4, qty: 1 }],            // T-Shirt + Coffee
    [{ pIdx: 0, qty: 1 }],                                  // Single Headphones
    [{ pIdx: 1, qty: 3 }],                                  // 3x Cables (office supply)
    [{ pIdx: 3, qty: 1 }, { pIdx: 2, qty: 2 }],            // Jeans + 2 T-shirts
    [{ pIdx: 5, qty: 1 }],                                  // Desk Lamp
    [{ pIdx: 4, qty: 1 }, { pIdx: 1, qty: 1 }],            // Coffee + Cable
    [{ pIdx: 0, qty: 1 }, { pIdx: 1, qty: 2 }],            // Headphones + Cables
    [{ pIdx: 2, qty: 1 }],                                  // Single T-Shirt
  ];

  const paymentCycle = ['UPI', 'UPI', 'CARD', 'UPI', 'CASH', 'UPI', 'CARD'];
  const cashierCycle = [salesStaff.id, salesStaff.id, manager.id, salesStaff.id];

  const inventoryDeductions = {};
  for (const p of products) {
    inventoryDeductions[p.id] = 0;
  }

  let totalSeededSales = 0;
  let totalSeededItems = 0;
  let totalSeededRevenue = 0;

  // Retrieve inventory IDs for movements
  const inventoryRecords = await prisma.inventory.findMany({
    where: { storeId: store.id },
  });
  const invIdMap = {};
  for (const inv of inventoryRecords) {
    invIdMap[inv.productId] = inv.id;
  }

  const baseNow = new Date();

  for (const day of dailyDistribution) {
    const dayDate = new Date(baseNow);
    dayDate.setDate(dayDate.getDate() - day.dayOffset);
    
    // Store operating hours: 10:30 AM to 08:30 PM IST (05:00 UTC to 15:00 UTC)
    // Ensures date is identical in both UTC and Asia/Kolkata
    for (let sIdx = 0; sIdx < day.count; sIdx++) {
      const saleDate = new Date(dayDate);
      const hourIST = 10 + Math.floor((sIdx * 10) / day.count);
      const minIST = (sIdx * 17) % 60;
      // Convert IST to UTC (subtract 5 hours 30 minutes)
      saleDate.setUTCHours(hourIST - 5, minIST - 30, (sIdx * 7) % 60, 0);

      const basket = basketMixes[(day.dayOffset * 3 + sIdx) % basketMixes.length];
      const cashierId = cashierCycle[sIdx % cashierCycle.length];
      const paymentMethod = paymentCycle[sIdx % paymentCycle.length];

      let subtotal = 0;
      let taxTotal = 0;
      const saleItemsData = [];

      for (const item of basket) {
        const prod = products[item.pIdx];
        const lineSubtotal = roundToTwo(Number(prod.sellingPrice) * item.qty);
        const lineDiscount = 0;
        const lineTax = roundToTwo(lineSubtotal * store.taxRate);
        const lineTotal = roundToTwo(lineSubtotal + lineTax);

        subtotal = roundToTwo(subtotal + lineSubtotal);
        taxTotal = roundToTwo(taxTotal + lineTax);

        saleItemsData.push({
          productId: prod.id,
          quantity: item.qty,
          unitPrice: prod.sellingPrice,
          unitCost: prod.costPrice,
          lineDiscount: lineDiscount,
          taxRate: store.taxRate,
          lineTotal: lineTotal,
        });

        inventoryDeductions[prod.id] += item.qty;
      }

      const total = roundToTwo(subtotal + taxTotal);
      const idempotencyKey = `DEMO-SALE-D${day.dayOffset}-S${String(sIdx + 1).padStart(3, '0')}`;
      const receiptNumber = `DEMO-RCP-D${day.dayOffset}-${String(sIdx + 1).padStart(3, '0')}`;

      // Create completed sale with items atomically
      const createdSale = await prisma.sale.create({
        data: {
          storeId: store.id,
          receiptNumber,
          status: 'COMPLETED',
          subtotal,
          discountTotal: 0,
          taxTotal,
          total,
          paymentMethod,
          paymentStatus: 'PAID',
          idempotencyKey,
          createdBy: cashierId,
          createdAt: saleDate,
          items: {
            create: saleItemsData,
          },
        },
      });

      // Stock movements for audit ledger
      for (const item of saleItemsData) {
        await prisma.stockMovement.create({
          data: {
            storeId: store.id,
            productId: item.productId,
            inventoryId: invIdMap[item.productId],
            movementType: 'SALE',
            quantityDelta: -item.quantity,
            reason: `Demo Sale ${receiptNumber}`,
            actorId: cashierId,
            referenceType: 'SALE',
            referenceId: createdSale.id,
            createdAt: saleDate,
          },
        });
      }

      totalSeededSales++;
      totalSeededItems += saleItemsData.length;
      totalSeededRevenue = roundToTwo(totalSeededRevenue + total);
    }
  }

  // 11. Atomically deduct physical inventory balances
  for (const p of products) {
    const totalDeducted = inventoryDeductions[p.id];
    const finalOnHand = p.openingStock - totalDeducted;
    await prisma.inventory.update({
      where: { storeId_productId: { storeId: store.id, productId: p.id } },
      data: {
        quantityOnHand: finalOnHand,
      },
    });
    console.log(`📦 ${p.sku} (${p.name}): Opening ${p.openingStock} - Sold ${totalDeducted} = On-Hand ${finalOnHand} (Safety Stock: ${p.safetyStock})`);
  }

  console.log(`✅ 5-Day demo sales seeded successfully:`);
  console.log(`   - Completed Sales: ${totalSeededSales}`);
  console.log(`   - Total Line Items: ${totalSeededItems}`);
  console.log(`   - Total Gross Revenue: ₹${totalSeededRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`);
  console.log(`   - Store Currency: ${store.currency}`);
  console.log(`   - Store Timezone: ${store.timezone}`);
  console.log('🎉 Seeding completed cleanly!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
