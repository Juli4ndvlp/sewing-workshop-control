import { describe, expect, it } from 'vitest';
import Dexie from 'dexie';
import type { Dexie as DexieDatabase, Table } from 'dexie/dist/dexie.js';
import type { Order, Payment } from '../../models/types';
import { calculatePendingBalance, formatCurrency } from '../../utils/money';

interface TestDb extends DexieDatabase {
  orders: Table<Order, string>;
  payments: Table<Payment, string>;
}

async function registerPayment(
  db: TestDb,
  orderId: string,
  amount: number,
  date = '2026-01-02'
): Promise<Order> {
  return db.transaction('rw', [db.orders, db.payments], async () => {
    const fresh = await db.orders.get(orderId);
    if (!fresh) throw new Error('El pedido ya no existe.');

    const freshTotal = Math.max(0, fresh.financials?.totalPrice ?? 0);
    const existingPayments = await db.payments.where('orderId').equals(orderId).toArray();
    const alreadyPaid = existingPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const freshPending = calculatePendingBalance(freshTotal, alreadyPaid);

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Ingresa un monto de abono válido.');
    }
    if (amount > freshPending) {
      throw new Error(
        `El abono no puede superar el saldo pendiente (${formatCurrency(freshPending)}).`
      );
    }

    await db.payments.add({
      id: crypto.randomUUID(),
      orderId,
      amount,
      date,
      createdAt: new Date().toISOString()
    });

    const newAdvance = alreadyPaid + amount;
    const newPending = calculatePendingBalance(freshTotal, newAdvance);
    const updatedAt = new Date().toISOString();

    await db.orders.update(orderId, {
      financials: {
        ...fresh.financials,
        advancePayment: newAdvance,
        pendingBalance: newPending
      },
      updatedAt
    });

    return {
      ...fresh,
      financials: {
        ...fresh.financials,
        advancePayment: newAdvance,
        pendingBalance: newPending
      },
      updatedAt
    };
  });
}

describe('registro de abonos en transacción', () => {
  it('dos abonos consecutivos conservan la suma, saldo e historial', async () => {
    const db = new Dexie(`test-payments-${crypto.randomUUID()}`) as TestDb;
    db.version(1).stores({ orders: 'id', payments: 'id, orderId, date, createdAt' });
    await db.open();

    const order: Order = {
      id: 'order-1',
      customerId: 'cust-1',
      garmentTypeId: 'garment-1',
      status: 'pending',
      deliveryDate: '2026-12-01',
      measurements: {},
      financials: {
        materialCost: 0,
        laborCost: 0,
        totalCost: 0,
        profitMargin: 0,
        totalPrice: 100000,
        advancePayment: 0,
        pendingBalance: 100000
      },
      createdAt: '2026-01-01T00:00:00.000Z'
    };

    await db.orders.add(order);

    const afterFirst = await registerPayment(db, order.id, 30000, '2026-01-02');
    const afterSecond = await registerPayment(db, order.id, 20000, '2026-01-03');

    expect(afterFirst.financials.advancePayment).toBe(30000);
    expect(afterFirst.financials.pendingBalance).toBe(70000);
    expect(afterSecond.financials.advancePayment).toBe(50000);
    expect(afterSecond.financials.pendingBalance).toBe(50000);

    const persisted = await db.orders.get(order.id);
    const payments = await db.payments.where('orderId').equals(order.id).toArray();
    expect(persisted?.financials.advancePayment).toBe(50000);
    expect(persisted?.financials.pendingBalance).toBe(50000);
    expect(payments).toHaveLength(2);
    expect(payments.reduce((sum, p) => sum + p.amount, 0)).toBe(50000);

    db.close();
  });

  it('rechaza un abono mayor al saldo pendiente y no crea historial', async () => {
    const db = new Dexie(`test-payments-${crypto.randomUUID()}`) as TestDb;
    db.version(1).stores({ orders: 'id', payments: 'id, orderId, date, createdAt' });
    await db.open();

    await db.orders.add({
      id: 'order-2',
      customerId: 'cust-1',
      garmentTypeId: 'garment-1',
      status: 'pending',
      deliveryDate: '2026-12-01',
      measurements: {},
      financials: {
        materialCost: 0,
        laborCost: 0,
        totalCost: 0,
        profitMargin: 0,
        totalPrice: 100000,
        advancePayment: 20000,
        pendingBalance: 80000
      },
      createdAt: '2026-01-01T00:00:00.000Z'
    });
    await db.payments.add({
      id: 'p1',
      orderId: 'order-2',
      amount: 20000,
      date: '2026-01-01',
      createdAt: '2026-01-01T00:00:00.000Z'
    });

    await expect(registerPayment(db, 'order-2', 90000)).rejects.toThrow(/saldo pendiente/i);

    const persisted = await db.orders.get('order-2');
    const payments = await db.payments.where('orderId').equals('order-2').toArray();
    expect(persisted?.financials.advancePayment).toBe(20000);
    expect(persisted?.financials.pendingBalance).toBe(80000);
    expect(payments).toHaveLength(1);

    db.close();
  });
});
