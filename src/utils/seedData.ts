// src/utils/seedData.ts
import { db } from '../repositories/dexie/db';

export const injectTestData = async () => {
  // Limpiar datos existentes
  await db.customers.clear();
  await db.garmentTypes.clear();
  await db.fabrics.clear();
  await db.measurementDefinitions.clear();
  await db.orders.clear();

  // 1. Clientes
  const customer1Id = crypto.randomUUID();
  const customer2Id = crypto.randomUUID();

  await db.customers.bulkAdd([
    {
      id: customer1Id,
      fullName: 'Carolina Mendoza',
      phone: '3105550192',
      email: 'carolina@gmail.com',
      notes: 'Cliente frecuente. Prefiere cortes ajustados.',
      createdAt: new Date().toISOString()
    },
    {
      id: customer2Id,
      fullName: 'Alejandro Gomez',
      phone: '3124449821',
      email: 'agomez@hotmail.com',
      notes: 'Entregas únicamente en la tarde.',
      createdAt: new Date().toISOString()
    }
  ]);

  // 2. Tipos de Prenda
  const g1Id = crypto.randomUUID();
  const g2Id = crypto.randomUUID();

  await db.garmentTypes.bulkAdd([
    { id: g1Id, name: 'Vestido de Gala', active: true },
    { id: g2Id, name: 'Traje de Dos Piezas', active: true },
    { id: crypto.randomUUID(), name: 'Chaqueta de Cuero', active: true }
  ]);

  // 3. Telas
  const f1Id = crypto.randomUUID();

  await db.fabrics.bulkAdd([
    { id: f1Id, name: 'Seda Francesa', active: true },
    { id: crypto.randomUUID(), name: 'Lino Italiano', active: true },
    { id: crypto.randomUUID(), name: 'Lana Fría', active: true }
  ]);

  // 4. Medidas Corporales
  await db.measurementDefinitions.bulkAdd([
    { id: crypto.randomUUID(), key: 'busto', name: 'Busto (cm)', label: 'Busto (cm)', active: true },
    { id: crypto.randomUUID(), key: 'cintura', name: 'Cintura (cm)', label: 'Cintura (cm)', active: true },
    { id: crypto.randomUUID(), key: 'cadera', name: 'Cadera (cm)', label: 'Cadera (cm)', active: true },
    { id: crypto.randomUUID(), key: 'largoTalle', name: 'Largo de Talle (cm)', label: 'Largo de Talle (cm)', active: true },
    { id: crypto.randomUUID(), key: 'anchoEspalda', name: 'Ancho de Espalda (cm)', label: 'Ancho de Espalda (cm)', active: true }
  ]);

  // 5. Pedido de prueba
  await db.orders.add({
    id: crypto.randomUUID(),
    customerId: customer1Id,
    garmentTypeId: g1Id,
    fabricId: f1Id,
    status: 'in_progress',
    deliveryDate: '2026-09-15',
    measurements: { busto: 90, cintura: 68, cadera: 96, largoTalle: 42 },
    financials: {
      materialCost: 120000,
      laborCost: 180000,
      totalCost: 300000,
      profitMargin: 40,
      totalPrice: 420000,
      advancePayment: 200000,
      pendingBalance: 220000
    },
    createdAt: new Date().toISOString()
  });

  console.log('¡Datos de prueba cargados exitosamente!');
};