import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../repositories/dexie/db';
import { changeOrderStatus, registerOrderPayment, saveOrderWithConsumptions } from './orderService';

async function resetDb() {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
  });
}

const baseInput = {
  customerId: 'cust-1',
  garmentTypeId: 'g-1',
  garmentType: 'Blusa',
  deliveryDate: '2026-12-01',
  measurements: {},
  consumptions: [],
  financials: {
    materialCost: 10000,
    laborCost: 20000,
    totalCost: 30000,
    profitMargin: 50,
    totalPrice: 45000,
    advancePayment: 0,
    pendingBalance: 45000
  }
};

describe('orderService', () => {
  beforeEach(async () => {
    await db.open();
    await resetDb();
    await db.customers.add({
      id: 'cust-1',
      fullName: 'Ana',
      createdAt: '2026-01-01T00:00:00.000Z'
    });
    await db.inventory.add({
      id: 'inv-1',
      name: 'Tela',
      category: 'Telas',
      stock: 10,
      unit: 'm',
      unitCost: 1000,
      updatedAt: '2026-01-01T00:00:00.000Z'
    });
  });

  it('crea pedido con abono inicial, historial y descuento de inventario', async () => {
    await saveOrderWithConsumptions({
      ...baseInput,
      consumptions: [{ inventoryItemId: 'inv-1', quantity: 2 }],
      financials: { ...baseInput.financials, advancePayment: 5000, pendingBalance: 40000 }
    });

    const orders = await db.orders.toArray();
    expect(orders).toHaveLength(1);
    expect(orders[0].status).toBe('pending');
    expect(orders[0].financials.advancePayment).toBe(5000);

    const payments = await db.payments.where('orderId').equals(orders[0].id).toArray();
    expect(payments).toHaveLength(1);
    expect(payments[0].amount).toBe(5000);

    const history = await db.orderStatusHistory.where('orderId').equals(orders[0].id).toArray();
    expect(history).toHaveLength(1);
    expect(history[0].toStatus).toBe('pending');

    const inv = await db.inventory.get('inv-1');
    expect(inv?.stock).toBe(8);
    const moves = await db.inventoryMovements.where('inventoryItemId').equals('inv-1').toArray();
    expect(moves).toHaveLength(1);
    expect(moves[0].type).toBe('order_deduct');
  });

  it('rechaza creación cuando no hay stock suficiente', async () => {
    await expect(
      saveOrderWithConsumptions({
        ...baseInput,
        consumptions: [{ inventoryItemId: 'inv-1', quantity: 99 }]
      })
    ).rejects.toThrow(/Stock insuficiente/i);

    expect(await db.orders.count()).toBe(0);
    expect((await db.inventory.get('inv-1'))?.stock).toBe(10);
  });

  it('cancela pedido y devuelve inventario consumido', async () => {
    await saveOrderWithConsumptions({
      ...baseInput,
      consumptions: [{ inventoryItemId: 'inv-1', quantity: 3 }]
    });
    const order = (await db.orders.toArray())[0];

    const cancelled = await changeOrderStatus(order.id, 'cancelled', 'Cliente desistió');
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.cancellationReason).toBe('Cliente desistió');
    expect((await db.inventory.get('inv-1'))?.stock).toBe(10);

    const moves = await db.inventoryMovements.where('orderId').equals(order.id).toArray();
    expect(moves.some((m) => m.type === 'order_return')).toBe(true);
  });

  it('registra abono, valida saldo y actualiza financials', async () => {
    await saveOrderWithConsumptions({
      ...baseInput,
      financials: { ...baseInput.financials, totalPrice: 100000, pendingBalance: 100000 }
    });
    const order = (await db.orders.toArray())[0];

    const updated = await registerOrderPayment(order.id, 30000, '2026-02-01');
    expect(updated.financials.advancePayment).toBe(30000);
    expect(updated.financials.pendingBalance).toBe(70000);

    await expect(registerOrderPayment(order.id, 80000, '2026-02-02')).rejects.toThrow(
      /saldo pendiente/i
    );
  });

  it('no permite transición de estado inválida', async () => {
    await saveOrderWithConsumptions(baseInput);
    const order = (await db.orders.toArray())[0];
    await expect(changeOrderStatus(order.id, 'delivered')).rejects.toThrow(/No se puede cambiar/i);
  });

  it('al editar pedido ajusta consumos e inventario correctamente', async () => {
    await saveOrderWithConsumptions({
      ...baseInput,
      consumptions: [{ inventoryItemId: 'inv-1', quantity: 3 }]
    });
    const order = (await db.orders.toArray())[0];
    expect((await db.inventory.get('inv-1'))?.stock).toBe(7);

    await saveOrderWithConsumptions(
      {
        ...baseInput,
        consumptions: [{ inventoryItemId: 'inv-1', quantity: 1 }]
      },
      { id: order.id }
    );

    expect((await db.inventory.get('inv-1'))?.stock).toBe(9);
    const updated = await db.orders.get(order.id);
    expect(updated?.consumptions).toEqual([{ inventoryItemId: 'inv-1', quantity: 1 }]);
  });

  it('permite crear pedido con precio final acordado personalizado mayor al sugerido por margen', async () => {
    // totalCost = 30000, margen 50% sugeriría 45000, pero se acuerda 60000 con abono de 20000
    await saveOrderWithConsumptions({
      ...baseInput,
      financials: {
        materialCost: 10000,
        laborCost: 20000,
        totalCost: 30000,
        profitMargin: 100, // margen recalculado respecto al precio acordado
        totalPrice: 60000,
        advancePayment: 20000,
        pendingBalance: 40000
      }
    });

    const order = (await db.orders.toArray())[0];
    expect(order.financials.totalPrice).toBe(60000);
    expect(order.financials.advancePayment).toBe(20000);
    expect(order.financials.pendingBalance).toBe(40000);

    const payments = await db.payments.where('orderId').equals(order.id).toArray();
    expect(payments).toHaveLength(1);
    expect(payments[0].amount).toBe(20000);
  });

  it('permite crear pedido con precio final acordado con descuento por debajo del margen sugerido', async () => {
    // totalCost = 30000, margen 50% sugeriría 45000, pero se acuerda 35000
    await saveOrderWithConsumptions({
      ...baseInput,
      financials: {
        materialCost: 10000,
        laborCost: 20000,
        totalCost: 30000,
        profitMargin: 17,
        totalPrice: 35000,
        advancePayment: 10000,
        pendingBalance: 25000
      }
    });

    const order = (await db.orders.toArray())[0];
    expect(order.financials.totalPrice).toBe(35000);
    expect(order.financials.pendingBalance).toBe(25000);
  });

  it('al editar pedido con nuevo precio final acordado recalcula el saldo pendiente respetando los abonos previos', async () => {
    await saveOrderWithConsumptions({
      ...baseInput,
      financials: {
        ...baseInput.financials,
        totalPrice: 50000,
        advancePayment: 20000,
        pendingBalance: 30000
      }
    });
    const order = (await db.orders.toArray())[0];

    // Se acuerda un nuevo precio de 55000; el saldo pendiente debe ser 55000 - 20000 = 35000
    await saveOrderWithConsumptions(
      {
        ...baseInput,
        financials: {
          ...baseInput.financials,
          totalPrice: 55000,
          advancePayment: 20000,
          pendingBalance: 35000
        }
      },
      { id: order.id }
    );

    const updated = await db.orders.get(order.id);
    expect(updated?.financials.totalPrice).toBe(55000);
    expect(updated?.financials.advancePayment).toBe(20000);
    expect(updated?.financials.pendingBalance).toBe(35000);
  });

  it('rechaza edición de pedido si los abonos registrados superan el nuevo precio acordado', async () => {
    await saveOrderWithConsumptions({
      ...baseInput,
      financials: {
        ...baseInput.financials,
        totalPrice: 50000,
        advancePayment: 20000,
        pendingBalance: 30000
      }
    });
    const order = (await db.orders.toArray())[0];

    // Registra un segundo abono de 15000 (total abonos acumulados: 35000)
    await registerOrderPayment(order.id, 15000, '2026-02-05');

    // Intenta reducir el precio total a 30000, que es menor a los 35000 ya abonados
    await expect(
      saveOrderWithConsumptions(
        {
          ...baseInput,
          financials: {
            ...baseInput.financials,
            totalPrice: 30000,
            advancePayment: 0,
            pendingBalance: 30000
          }
        },
        { id: order.id }
      )
    ).rejects.toThrow(/Los abonos registrados superan el nuevo precio total/i);
  });
});
