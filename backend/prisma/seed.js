import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create default store
  const store = await prisma.store.upsert({
    where: { id: 'default-store' },
    update: {},
    create: {
      id: 'default-store',
      name: 'Main Store',
      location: '123 Main St',
      active: true,
    },
  });
  console.log('✅ Store created:', store.name);

  // Create users
  const passwordHash = await bcrypt.hash('password123', 12);
  
  const admin = await prisma.user.upsert({
    where: { email: 'admin@orims.local' },
    update: {},
    create: {
      email: 'admin@orims.local',
      name: 'Admin User',
      passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });
  console.log('✅ Admin user created:', admin.email);

  const manager = await prisma.user.upsert({
    where: { email: 'manager@orims.local' },
    update: {},
    create: {
      email: 'manager@orims.local',
      name: 'Store Manager',
      passwordHash,
      role: 'MANAGER',
      status: 'ACTIVE',
    },
  });
  console.log('✅ Manager user created:', manager.email);

  const salesStaff = await prisma.user.upsert({
    where: { email: 'sales@orims.local' },
    update: {},
    create: {
      email: 'sales@orims.local',
      name: 'Sales Staff',
      passwordHash,
      role: 'SALES_STAFF',
      status: 'ACTIVE',
    },
  });
  console.log('✅ Sales staff created:', salesStaff.email);

  const inventoryStaff = await prisma.user.upsert({
    where: { email: 'inventory@orims.local' },
    update: {},
    create: {
      email: 'inventory@orims.local',
      name: 'Inventory Staff',
      passwordHash,
      role: 'INVENTORY_STAFF',
      status: 'ACTIVE',
    },
  });
  console.log('✅ Inventory staff created:', inventoryStaff.email);

  // Create categories
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
      create: { name: 'Food & Beverages', description: 'Consumable products' },
    }),
    prisma.category.upsert({
      where: { name: 'Home & Garden' },
      update: {},
      create: { name: 'Home & Garden', description: 'Home improvement and garden supplies' },
    }),
  ]);
  console.log('✅ Categories created:', categories.map(c => c.name).join(', '));

  // Create products
  const products = await Promise.all([
    prisma.product.upsert({
      where: { sku: 'ELEC-001' },
      update: {},
      create: {
        sku: 'ELEC-001',
        barcode: '1234567890123',
        name: 'Wireless Headphones',
        description: 'Bluetooth noise-cancelling headphones',
        categoryId: categories[0].id,
        costPrice: 49.99,
        sellingPrice: 89.99,
        unitOfMeasure: 'EA',
        active: true,
      },
    }),
    prisma.product.upsert({
      where: { sku: 'ELEC-002' },
      update: {},
      create: {
        sku: 'ELEC-002',
        barcode: '1234567890124',
        name: 'USB-C Cable 2m',
        description: 'Fast charging USB-C to USB-C cable',
        categoryId: categories[0].id,
        costPrice: 4.99,
        sellingPrice: 12.99,
        unitOfMeasure: 'EA',
        active: true,
      },
    }),
    prisma.product.upsert({
      where: { sku: 'CLTH-001' },
      update: {},
      create: {
        sku: 'CLTH-001',
        barcode: '1234567890125',
        name: 'Cotton T-Shirt',
        description: '100% organic cotton t-shirt',
        categoryId: categories[1].id,
        costPrice: 8.99,
        sellingPrice: 24.99,
        unitOfMeasure: 'EA',
        active: true,
      },
    }),
    prisma.product.upsert({
      where: { sku: 'CLTH-002' },
      update: {},
      create: {
        sku: 'CLTH-002',
        barcode: '1234567890126',
        name: 'Denim Jeans',
        description: 'Classic fit denim jeans',
        categoryId: categories[1].id,
        costPrice: 24.99,
        sellingPrice: 59.99,
        unitOfMeasure: 'EA',
        active: true,
      },
    }),
    prisma.product.upsert({
      where: { sku: 'FOOD-001' },
      update: {},
      create: {
        sku: 'FOOD-001',
        barcode: '1234567890127',
        name: 'Organic Coffee Beans 1kg',
        description: 'Fair trade organic coffee beans',
        categoryId: categories[2].id,
        costPrice: 12.99,
        sellingPrice: 22.99,
        unitOfMeasure: 'KG',
        active: true,
      },
    }),
    prisma.product.upsert({
      where: { sku: 'HOME-001' },
      update: {},
      create: {
        sku: 'HOME-001',
        barcode: '1234567890128',
        name: 'LED Desk Lamp',
        description: 'Adjustable brightness LED desk lamp',
        categoryId: categories[3].id,
        costPrice: 19.99,
        sellingPrice: 39.99,
        unitOfMeasure: 'EA',
        active: true,
      },
    }),
  ]);
  console.log('✅ Products created:', products.length);

  // Create inventory for each product
  for (const product of products) {
    await prisma.inventory.upsert({
      where: { storeId_productId: { storeId: store.id, productId: product.id } },
      update: {},
      create: {
        storeId: store.id,
        productId: product.id,
        quantityOnHand: Math.floor(Math.random() * 100) + 10,
        reservedQuantity: 0,
      },
    });
  }
  console.log('✅ Inventory records created');

  // Create inventory policies
  for (const product of products) {
    await prisma.inventoryPolicy.upsert({
      where: { storeId_productId: { storeId: store.id, productId: product.id } },
      update: {},
      create: {
        storeId: store.id,
        productId: product.id,
        safetyStock: 10,
        serviceLevel: 0.95,
        reviewPeriod: 7,
        policySource: 'MANUAL',
      },
    });
  }
  console.log('✅ Inventory policies created');

  // Create suppliers
  const suppliers = await Promise.all([
    prisma.supplier.upsert({
      where: { id: 'sup-001' },
      update: {},
      create: {
        id: 'sup-001',
        name: 'TechSupplies Inc',
        email: 'orders@techsupplies.com',
        phone: '+1-555-0101',
        address: '100 Tech Park, San Francisco, CA',
        notes: 'Primary electronics supplier',
        active: true,
      },
    }),
    prisma.supplier.upsert({
      where: { id: 'sup-002' },
      update: {},
      create: {
        id: 'sup-002',
        name: 'Fashion Wholesale Co',
        email: 'sales@fashionwholesale.com',
        phone: '+1-555-0102',
        address: '200 Fashion Ave, New York, NY',
        notes: 'Clothing and apparel supplier',
        active: true,
      },
    }),
    prisma.supplier.upsert({
      where: { id: 'sup-003' },
      update: {},
      create: {
        id: 'sup-003',
        name: 'Fresh Foods Distributors',
        email: 'orders@freshfoods.com',
        phone: '+1-555-0103',
        address: '300 Market St, Chicago, IL',
        notes: 'Food and beverage distributor',
        active: true,
      },
    }),
  ]);
  console.log('✅ Suppliers created:', suppliers.map(s => s.name).join(', '));

  // Link suppliers to products
  await Promise.all([
    prisma.supplierProduct.upsert({
      where: { supplierId_productId: { supplierId: suppliers[0].id, productId: products[0].id } },
      update: {},
      create: { supplierId: suppliers[0].id, productId: products[0].id, leadTimeDays: 7, minOrderQty: 10, packMultiple: 5, unitCost: 45.00 },
    }),
    prisma.supplierProduct.upsert({
      where: { supplierId_productId: { supplierId: suppliers[0].id, productId: products[1].id } },
      update: {},
      create: { supplierId: suppliers[0].id, productId: products[1].id, leadTimeDays: 5, minOrderQty: 50, packMultiple: 10, unitCost: 3.50 },
    }),
    prisma.supplierProduct.upsert({
      where: { supplierId_productId: { supplierId: suppliers[1].id, productId: products[2].id } },
      update: {},
      create: { supplierId: suppliers[1].id, productId: products[2].id, leadTimeDays: 14, minOrderQty: 20, packMultiple: 10, unitCost: 7.50 },
    }),
    prisma.supplierProduct.upsert({
      where: { supplierId_productId: { supplierId: suppliers[1].id, productId: products[3].id } },
      update: {},
      create: { supplierId: suppliers[1].id, productId: products[3].id, leadTimeDays: 14, minOrderQty: 15, packMultiple: 5, unitCost: 22.00 },
    }),
    prisma.supplierProduct.upsert({
      where: { supplierId_productId: { supplierId: suppliers[2].id, productId: products[4].id } },
      update: {},
      create: { supplierId: suppliers[2].id, productId: products[4].id, leadTimeDays: 3, minOrderQty: 10, packMultiple: 5, unitCost: 11.00 },
    }),
    prisma.supplierProduct.upsert({
      where: { supplierId_productId: { supplierId: suppliers[0].id, productId: products[5].id } },
      update: {},
      create: { supplierId: suppliers[0].id, productId: products[5].id, leadTimeDays: 10, minOrderQty: 10, packMultiple: 5, unitCost: 18.00 },
    }),
  ]);
  console.log('✅ Supplier-product links created');

  // Create sample purchase order
  const po = await prisma.purchaseOrder.create({
    data: {
      supplierId: suppliers[0].id,
      storeId: store.id,
      status: 'RECEIVED',
      orderDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      expectedDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      createdBy: manager.id,
      approvedBy: manager.id,
      items: {
        create: [
          { productId: products[0].id, orderedQty: 20, receivedQty: 20, unitCost: 45.00 },
          { productId: products[1].id, orderedQty: 100, receivedQty: 100, unitCost: 3.50 },
        ],
      },
    },
  });
  console.log('✅ Sample purchase order created:', po.id);

  // Create sample sales
  for (let i = 0; i < 5; i++) {
    const saleItems = [];
    const numItems = Math.floor(Math.random() * 3) + 1;
    let total = 0;
    
    for (let j = 0; j < numItems; j++) {
      const product = products[Math.floor(Math.random() * products.length)];
      const qty = Math.floor(Math.random() * 5) + 1;
      const lineTotal = Number(product.sellingPrice) * qty * 1.1; // with tax
      total += lineTotal;
      
      saleItems.push({
        productId: product.id,
        quantity: qty,
        unitPrice: product.sellingPrice,
        unitCost: product.costPrice,
        lineDiscount: 0,
        taxRate: 0.10,
        lineTotal,
      });
    }

    await prisma.sale.create({
      data: {
        storeId: store.id,
        receiptNumber: `RCP-${Date.now()}-${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
        status: 'COMPLETED',
        subtotal: total / 1.1,
        discountTotal: 0,
        taxTotal: total / 11,
        total,
        paymentMethod: 'CASH',
        paymentStatus: 'PAID',
        idempotencyKey: `idem-${Date.now()}-${i}`,
        createdBy: salesStaff.id,
        createdAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
        items: { create: saleItems },
      },
    });
  }
  console.log('✅ Sample sales created');

  console.log('🎉 Seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });