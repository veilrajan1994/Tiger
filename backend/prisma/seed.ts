import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create stores
  const stores = [
    { storeId: 'STORE001', storeName: 'New York Store', country: 'USA', city: 'New York' },
    { storeId: 'STORE002', storeName: 'London Store', country: 'UK', city: 'London' },
    { storeId: 'STORE003', storeName: 'Tokyo Store', country: 'Japan', city: 'Tokyo' },
    { storeId: 'STORE004', storeName: 'Paris Store', country: 'France', city: 'Paris' },
    { storeId: 'STORE005', storeName: 'Sydney Store', country: 'Australia', city: 'Sydney' }
  ];

  const createdStores = [];
  for (const store of stores) {
    const created = await prisma.store.upsert({
      where: { storeId: store.storeId },
      update: {},
      create: store
    });
    createdStores.push(created);
    console.log(`Created store: ${store.storeName}`);
  }

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      password: adminPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN'
    }
  });
  console.log('Created admin user: admin@example.com / admin123');

  // Create store manager
  const managerPassword = await bcrypt.hash('manager123', 10);

  const storeManagers = [
    { email: 'newyork@example.com', firstName: 'New York', lastName: 'Manager', storeIndex: 0 },
    { email: 'london@example.com', firstName: 'London', lastName: 'Manager', storeIndex: 1 },
    { email: 'tokyo@example.com', firstName: 'Tokyo', lastName: 'Manager', storeIndex: 2 },
    { email: 'paris@example.com', firstName: 'Paris', lastName: 'Manager', storeIndex: 3 },
    { email: 'sydney@example.com', firstName: 'Sydney', lastName: 'Manager', storeIndex: 4 }
  ];

  for (const mgr of storeManagers) {
    await prisma.user.upsert({
      where: { email: mgr.email },
      update: {},
      create: {
        email: mgr.email,
        password: managerPassword,
        firstName: mgr.firstName,
        lastName: mgr.lastName,
        role: 'STORE_MANAGER',
        storeId: createdStores[mgr.storeIndex].id
      }
    });
    console.log(`Created store manager: ${mgr.email} / manager123 → ${createdStores[mgr.storeIndex].storeId}`);
  }

  // Keep legacy manager for backward compatibility
  await prisma.user.upsert({
    where: { email: 'manager@example.com' },
    update: {},
    create: {
      email: 'manager@example.com',
      password: managerPassword,
      firstName: 'Store',
      lastName: 'Manager',
      role: 'STORE_MANAGER',
      storeId: createdStores[0].id
    }
  });
  console.log('Created store manager: manager@example.com / manager123');

  // Create sample pricing records
  const products = [
    { sku: 'SKU001', productName: 'Laptop Computer', price: 999.99 },
    { sku: 'SKU002', productName: 'Wireless Mouse', price: 29.99 },
    { sku: 'SKU003', productName: 'USB Keyboard', price: 49.99 },
    { sku: 'SKU004', productName: 'Monitor 24"', price: 199.99 },
    { sku: 'SKU005', productName: 'Webcam HD', price: 79.99 }
  ];

  const today = new Date();
  for (const store of createdStores) {
    for (const product of products) {
      await prisma.pricingRecord.create({
        data: {
          storeId: store.id,
          sku: product.sku,
          productName: product.productName,
          price: product.price,
          date: today,
          createdBy: admin.id
        }
      });
    }
  }
  console.log(`Created ${products.length * createdStores.length} pricing records`);

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
