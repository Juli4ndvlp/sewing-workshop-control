import Dexie from 'dexie';
import type { Dexie as DexieDatabase, Table, Transaction } from 'dexie/dist/dexie.js';
import {
  Customer,
  Order,
  GarmentType,
  Fabric,
  MeasurementDefinition,
  AppConfig,
  InventoryItem,
  InventoryMovement,
  Payment,
  OrderStatusHistory
} from '../../models/types';
import { toDateOnly } from '../../utils/dates';

type LegacyOrder = Order & {
  dates?: {
    createdAt?: string;
    deliveryDate?: string;
  };
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const base = new Dexie('EdnaAtelierDB');

export interface EdnaAtelierDB extends DexieDatabase {
  customers: Table<Customer, string>;
  orders: Table<Order, string>;
  garmentTypes: Table<GarmentType, string>;
  fabrics: Table<Fabric, string>;
  measurementDefinitions: Table<MeasurementDefinition, string>;
  appConfig: Table<AppConfig, string>;
  inventory: Table<InventoryItem, string>;
  payments: Table<Payment, string>;
  orderStatusHistory: Table<OrderStatusHistory, string>;
  inventoryMovements: Table<InventoryMovement, string>;
}

export const db = base as unknown as EdnaAtelierDB;

db.version(1).stores({
  customers: 'id, fullName, phone, createdAt',
  orders: 'id, customerId, garmentTypeId, status, deliveryDate, createdAt',
  garmentTypes: 'id, name, active',
  fabrics: 'id, name, active',
  measurementDefinitions: 'id, key, active',
  appConfig: 'id'
});
db.version(2).stores({
  customers: 'id, fullName, phone, createdAt',
  orders: 'id, customerId, garmentTypeId, status, deliveryDate, createdAt',
  garmentTypes: 'id, name, active',
  fabrics: 'id, name, active',
  measurementDefinitions: 'id, key, active',
  appConfig: 'id',
  inventory: 'id, name, category, updatedAt'
});

/**
 * Migración de datos:
 * - Lleva `dates.deliveryDate` a la raíz y elimina el campo duplicado.
 * - Convierte el texto libre que se guardaba en `garmentTypeId` en una FK real
 *   al catálogo de prendas, creando el tipo si hace falta.
 */
db.version(3)
  .stores({
    customers: 'id, fullName, phone, createdAt',
    orders: 'id, customerId, garmentTypeId, status, deliveryDate, createdAt',
    garmentTypes: 'id, name, active',
    fabrics: 'id, name, active',
    measurementDefinitions: 'id, key, active',
    appConfig: 'id',
    inventory: 'id, name, category, updatedAt'
  })
  .upgrade(async (tx: Transaction) => {
    const ordersTable = tx.table<LegacyOrder, string>('orders');
    const garmentsTable = tx.table<GarmentType, string>('garmentTypes');

    await ordersTable.toCollection().modify((order) => {
      if (!order.deliveryDate && order.dates?.deliveryDate) {
        order.deliveryDate = order.dates.deliveryDate;
      }
      delete order.dates;
    });

    const [orders, garments] = await Promise.all([ordersTable.toArray(), garmentsTable.toArray()]);

    const byName = new Map(garments.map((garment) => [garment.name.trim().toLowerCase(), garment]));
    const garmentIds = new Set(garments.map((garment) => garment.id));

    for (const order of orders) {
      if (order.garmentTypeId && garmentIds.has(order.garmentTypeId)) continue;

      const legacyId = order.garmentTypeId?.trim() ?? '';
      const fallbackName =
        legacyId && !UUID_PATTERN.test(legacyId) ? legacyId : 'Prenda personalizada';
      const name = (order.garmentType?.trim() || fallbackName).trim();
      const key = name.toLowerCase();

      let garment = byName.get(key);
      if (!garment) {
        garment = { id: crypto.randomUUID(), name, active: true };
        await garmentsTable.add(garment);
        byName.set(key, garment);
        garmentIds.add(garment.id);
      }

      await ordersTable.update(order.id, {
        garmentTypeId: garment.id,
        garmentType: garment.name
      });
    }
  });

/**
 * v4: historial de pagos.
 * - Crea tabla payments.
 * - Migra advancePayment existente a un pago inicial para no perder historial.
 */
db.version(4)
  .stores({
    customers: 'id, fullName, phone, createdAt',
    orders: 'id, customerId, garmentTypeId, status, deliveryDate, createdAt',
    garmentTypes: 'id, name, active',
    fabrics: 'id, name, active',
    measurementDefinitions: 'id, key, active',
    appConfig: 'id',
    inventory: 'id, name, category, updatedAt',
    payments: 'id, orderId, date, createdAt'
  })
  .upgrade(async (tx: Transaction) => {
    const ordersTable = tx.table<Order, string>('orders');
    const paymentsTable = tx.table<Payment, string>('payments');
    const orders = await ordersTable.toArray();

    for (const order of orders) {
      const advance = Math.max(0, Number(order.financials?.advancePayment ?? 0));
      if (advance <= 0) continue;

      const existing = await paymentsTable.where('orderId').equals(order.id).count();
      if (existing > 0) continue;

      const createdAt = order.updatedAt || order.createdAt || new Date().toISOString();
      const parsed = new Date(createdAt);
      const date = Number.isNaN(parsed.getTime()) ? toDateOnly(new Date()) : toDateOnly(parsed);
      await paymentsTable.add({
        id: crypto.randomUUID(),
        orderId: order.id,
        amount: advance,
        date,
        note: 'Abono migrado',
        createdAt
      });
    }
  });

// v5: umbral de stock mínimo para inventario (campo opcional, sin migración de datos).
db.version(5).stores({
  customers: 'id, fullName, phone, createdAt',
  orders: 'id, customerId, garmentTypeId, status, deliveryDate, createdAt',
  garmentTypes: 'id, name, active',
  fabrics: 'id, name, active',
  measurementDefinitions: 'id, key, active',
  appConfig: 'id',
  inventory: 'id, name, category, updatedAt',
  payments: 'id, orderId, date, createdAt'
});

// v6: historial de estados por pedido.
db.version(6)
  .stores({
    customers: 'id, fullName, phone, createdAt',
    orders: 'id, customerId, garmentTypeId, status, deliveryDate, createdAt',
    garmentTypes: 'id, name, active',
    fabrics: 'id, name, active',
    measurementDefinitions: 'id, key, active',
    appConfig: 'id',
    inventory: 'id, name, category, updatedAt',
    payments: 'id, orderId, date, createdAt',
    orderStatusHistory: 'id, orderId, createdAt'
  })
  .upgrade(async (tx: Transaction) => {
    const ordersTable = tx.table<Order, string>('orders');
    const historyTable = tx.table<OrderStatusHistory, string>('orderStatusHistory');
    const orders = await ordersTable.toArray();

    for (const order of orders) {
      const existing = await historyTable.where('orderId').equals(order.id).count();
      if (existing > 0) continue;
      await historyTable.add({
        id: crypto.randomUUID(),
        orderId: order.id,
        fromStatus: null,
        toStatus: order.status,
        note: 'Estado inicial (migrado)',
        createdAt: order.createdAt || order.updatedAt || new Date().toISOString()
      });
    }
  });

// v7: movimientos de inventario y consumo por pedido.
db.version(7).stores({
  customers: 'id, fullName, phone, createdAt',
  orders: 'id, customerId, garmentTypeId, status, deliveryDate, createdAt',
  garmentTypes: 'id, name, active',
  fabrics: 'id, name, active',
  measurementDefinitions: 'id, key, active',
  appConfig: 'id',
  inventory: 'id, name, category, updatedAt',
  payments: 'id, orderId, date, createdAt',
  orderStatusHistory: 'id, orderId, createdAt',
  inventoryMovements: 'id, inventoryItemId, orderId, createdAt'
});
