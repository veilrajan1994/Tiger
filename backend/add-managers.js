// Run with: node add-managers.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash('manager123', 10);

  const stores = await prisma.store.findMany({ orderBy: { storeId: 'asc' } });
  console.log('Found stores:', stores.map(s => `${s.storeId} = ${s.storeName}`));

  const managers = [
    { email: 'newyork@example.com', firstName: 'New York', lastName: 'Manager', storeId: 'STORE001' },
    { email: 'london@example.com', firstName: 'London', lastName: 'Manager', storeId: 'STORE002' },
    { email: 'tokyo@example.com', firstName: 'Tokyo', lastName: 'Manager', storeId: 'STORE003' },
    { email: 'paris@example.com', firstName: 'Paris', lastName: 'Manager', storeId: 'STORE004' },
    { email: 'sydney@example.com', firstName: 'Sydney', lastName: 'Manager', storeId: 'STORE005' }
  ];

  for (const mgr of managers) {
    const store = stores.find(s => s.storeId === mgr.storeId);
    if (!store) {
      console.log(`Store ${mgr.storeId} not found, skipping ${mgr.email}`);
      continue;
    }

    try {
      const user = await prisma.user.upsert({
        where: { email: mgr.email },
        update: { password },
        create: {
          email: mgr.email,
          password,
          firstName: mgr.firstName,
          lastName: mgr.lastName,
          role: 'STORE_MANAGER',
          storeId: store.id
        }
      });
      console.log(`Created/updated: ${mgr.email} -> ${store.storeName} (${user.id})`);
    } catch (e) {
      console.error(`Failed for ${mgr.email}:`, e.message);
    }
  }

  console.log('\nDone! All managers created with password: manager123');
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
