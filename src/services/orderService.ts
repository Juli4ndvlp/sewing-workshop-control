import { db } from '../repositories/dexie/db';
import type { Order, OrderConsumption, OrderStatus, Payment } from '../models/types';
import { calculatePendingBalance, formatCurrency } from '../utils/money';
import { toDateOnly } from '../utils/dates';

export const ALLOWED_ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['in_progress', 'cancelled'],
  in_progress: ['pending', 'ready', 'cancelled'],
  ready: ['in_progress', 'delivered', 'cancelled'],
  delivered: ['ready'],
  cancelled: []
};

export function canTransitionOrderStatus(from: OrderStatus, to: OrderStatus): boolean {
  return from === to || ALLOWED_ORDER_TRANSITIONS[from].includes(to);
}

export interface SaveOrderInput {
  customerId: string;
  garmentTypeId: string;
  garmentType: string;
  fabricId?: string;
  size?: string;
  deliveryDate: string;
  measurements: Record<string, number>;
  description?: string;
  notes?: string;
  consumptions: OrderConsumption[];
  financials: {
    materialCost: number;
    laborCost: number;
    totalCost: number;
    profitMargin: number;
    totalPrice: number;
    advancePayment: number;
    pendingBalance: number;
  };
}

function normalizeConsumptions(consumptions: OrderConsumption[]): OrderConsumption[] {
  return Object.values(
    consumptions
      .filter((c) => c.inventoryItemId && Number.isFinite(c.quantity) && c.quantity > 0)
      .reduce<Record<string, OrderConsumption>>((acc, c) => {
        const qty = Number(c.quantity);
        acc[c.inventoryItemId] = {
          inventoryItemId: c.inventoryItemId,
          quantity: (acc[c.inventoryItemId]?.quantity ?? 0) + qty
        };
        return acc;
      }, {})
  );
}

export async function saveOrderWithConsumptions(
  input: SaveOrderInput,
  orderToEdit?: Pick<Order, 'id'> | null
): Promise<void> {
  const normalizedConsumptions = normalizeConsumptions(input.consumptions);
  const now = new Date().toISOString();

  const payload = {
    customerId: input.customerId,
    garmentTypeId: input.garmentTypeId,
    garmentType: input.garmentType,
    fabricId: input.fabricId || undefined,
    size: input.size,
    deliveryDate: input.deliveryDate,
    measurements: input.measurements,
    description: input.description?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    consumptions: normalizedConsumptions,
    financials: input.financials,
    updatedAt: now
  };

  if (orderToEdit) {
    await db.transaction(
      'rw',
      [db.orders, db.payments, db.inventory, db.inventoryMovements],
      async () => {
        const fresh = await db.orders.get(orderToEdit.id);
        if (!fresh) throw new Error('El pedido ya no existe.');

        const existingPayments = await db.payments
          .where('orderId')
          .equals(orderToEdit.id)
          .toArray();
        const paidFromHistory = existingPayments.reduce(
          (sum, p) => sum + (Number(p.amount) || 0),
          0
        );
        const effectiveAdvance =
          existingPayments.length > 0 ? paidFromHistory : input.financials.advancePayment;
        if (effectiveAdvance > input.financials.totalPrice) {
          throw new Error(
            'Los abonos registrados superan el nuevo precio total. Ajusta el precio o los abonos.'
          );
        }

        const oldMap = new Map(
          (fresh.consumptions ?? []).map((c) => [c.inventoryItemId, Number(c.quantity) || 0])
        );
        const newMap = new Map(
          normalizedConsumptions.map((c) => [c.inventoryItemId, Number(c.quantity) || 0])
        );
        const ids = new Set([...oldMap.keys(), ...newMap.keys()]);
        const txNow = new Date().toISOString();

        for (const itemId of ids) {
          const oldQty = oldMap.get(itemId) ?? 0;
          const newQty = newMap.get(itemId) ?? 0;
          const delta = newQty - oldQty;
          if (delta === 0) continue;
          const item = await db.inventory.get(itemId);
          if (!item) throw new Error('Un insumo seleccionado ya no existe en inventario.');
          const nextStock = Number(item.stock) - delta;
          if (nextStock < 0) {
            throw new Error(
              `Stock insuficiente para "${item.name}". Disponible: ${item.stock} ${item.unit}.`
            );
          }
          await db.inventory.update(itemId, { stock: nextStock, updatedAt: txNow });
          await db.inventoryMovements.add({
            id: crypto.randomUUID(),
            inventoryItemId: itemId,
            orderId: orderToEdit.id,
            type: delta > 0 ? 'order_deduct' : 'order_return',
            quantityChange: -delta,
            stockAfter: nextStock,
            note:
              delta > 0
                ? 'Consumo actualizado por edición de pedido'
                : 'Devolución por edición de pedido',
            createdAt: txNow
          });
        }

        await db.orders.update(orderToEdit.id, {
          ...payload,
          updatedAt: txNow,
          financials: {
            ...payload.financials,
            advancePayment: effectiveAdvance,
            pendingBalance: calculatePendingBalance(input.financials.totalPrice, effectiveAdvance)
          }
        });
      }
    );
    return;
  }

  const newOrderId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  await db.transaction(
    'rw',
    [db.orders, db.payments, db.orderStatusHistory, db.inventory, db.inventoryMovements],
    async () => {
      for (const c of normalizedConsumptions) {
        const item = await db.inventory.get(c.inventoryItemId);
        if (!item) throw new Error('Un insumo seleccionado ya no existe en inventario.');
        const nextStock = Number(item.stock) - Number(c.quantity);
        if (nextStock < 0) {
          throw new Error(
            `Stock insuficiente para "${item.name}". Disponible: ${item.stock} ${item.unit}.`
          );
        }
        await db.inventory.update(c.inventoryItemId, { stock: nextStock, updatedAt: createdAt });
        await db.inventoryMovements.add({
          id: crypto.randomUUID(),
          inventoryItemId: c.inventoryItemId,
          orderId: newOrderId,
          type: 'order_deduct',
          quantityChange: -Number(c.quantity),
          stockAfter: nextStock,
          note: 'Consumo automático por creación de pedido',
          createdAt
        });
      }

      await db.orders.add({
        id: newOrderId,
        ...payload,
        status: 'pending',
        createdAt,
        updatedAt: createdAt
      } as Order);

      await db.orderStatusHistory.add({
        id: crypto.randomUUID(),
        orderId: newOrderId,
        fromStatus: null,
        toStatus: 'pending',
        note: 'Pedido creado',
        createdAt
      });

      if (input.financials.advancePayment > 0) {
        await db.payments.add({
          id: crypto.randomUUID(),
          orderId: newOrderId,
          amount: input.financials.advancePayment,
          date: toDateOnly(new Date()),
          note: 'Abono inicial',
          createdAt
        });
      }
    }
  );
}

export async function registerOrderPayment(
  orderId: string,
  amount: number,
  date: string
): Promise<Order> {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Ingresa un monto de abono válido.');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('Ingresa una fecha de abono válida.');
  }

  return db.transaction('rw', [db.orders, db.payments], async () => {
    const fresh = await db.orders.get(orderId);
    if (!fresh) throw new Error('El pedido ya no existe.');

    const freshTotal = Math.max(0, fresh.financials?.totalPrice ?? 0);
    const existingPayments = await db.payments.where('orderId').equals(orderId).toArray();
    const alreadyPaid = existingPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const freshPending = calculatePendingBalance(freshTotal, alreadyPaid);

    if (amount > freshPending) {
      throw new Error(
        `El abono no puede superar el saldo pendiente (${formatCurrency(freshPending)}).`
      );
    }

    const payment: Payment = {
      id: crypto.randomUUID(),
      orderId,
      amount,
      date,
      createdAt: new Date().toISOString()
    };
    await db.payments.add(payment);

    const newAdvance = alreadyPaid + amount;
    const newPending = calculatePendingBalance(freshTotal, newAdvance);
    const updatedAt = new Date().toISOString();
    const financials = {
      ...fresh.financials,
      advancePayment: newAdvance,
      pendingBalance: newPending
    };

    await db.orders.update(orderId, { financials, updatedAt });
    return { ...fresh, financials, updatedAt };
  });
}

export async function changeOrderStatus(
  orderId: string,
  newStatus: OrderStatus,
  cancellationReason?: string
): Promise<Order> {
  return db.transaction(
    'rw',
    [db.orders, db.orderStatusHistory, db.inventory, db.inventoryMovements],
    async () => {
      const fresh = await db.orders.get(orderId);
      if (!fresh) throw new Error('El pedido ya no existe.');
      if (fresh.status === newStatus) return fresh;
      if (!canTransitionOrderStatus(fresh.status, newStatus)) {
        throw new Error(`No se puede cambiar de "${fresh.status}" a "${newStatus}".`);
      }

      const updatedAt = new Date().toISOString();
      const changes: Partial<Order> = { status: newStatus, updatedAt };

      if (newStatus === 'cancelled') {
        changes.cancellationReason = cancellationReason?.trim() || 'Sin motivo especificado';
        for (const c of fresh.consumptions ?? []) {
          const qty = Number(c.quantity) || 0;
          if (!c.inventoryItemId || qty <= 0) continue;
          const item = await db.inventory.get(c.inventoryItemId);
          if (!item) continue;
          const nextStock = Number(item.stock) + qty;
          await db.inventory.update(item.id, { stock: nextStock, updatedAt });
          await db.inventoryMovements.add({
            id: crypto.randomUUID(),
            inventoryItemId: item.id,
            orderId,
            type: 'order_return',
            quantityChange: qty,
            stockAfter: nextStock,
            note: 'Devolución automática por cancelación de pedido',
            createdAt: updatedAt
          });
        }
      }

      await db.orders.update(orderId, changes);
      await db.orderStatusHistory.add({
        id: crypto.randomUUID(),
        orderId,
        fromStatus: fresh.status,
        toStatus: newStatus,
        note: newStatus === 'cancelled' ? changes.cancellationReason : undefined,
        createdAt: updatedAt
      });

      return { ...fresh, ...changes };
    }
  );
}
