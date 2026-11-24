import { db } from '../repositories/dexie/db';
import type { InventoryItem, InventoryMovement } from '../models/types';

export interface SaveInventoryItemInput {
  name: string;
  category: string;
  stock: number;
  unit: string;
  unitCost: number;
  minStock?: number;
}

export async function listInventoryItems(): Promise<InventoryItem[]> {
  return db.inventory.toArray();
}

export async function listInventoryMovements(limit = 50): Promise<InventoryMovement[]> {
  return db.inventoryMovements.orderBy('createdAt').reverse().limit(limit).toArray();
}

export async function saveInventoryItem(
  input: SaveInventoryItemInput,
  editingId?: string
): Promise<InventoryItem> {
  const name = input.name.trim();
  if (!name) throw new Error('El nombre del insumo es obligatorio.');
  if (!Number.isFinite(input.stock) || input.stock < 0) throw new Error('Stock inválido.');
  if (!Number.isFinite(input.unitCost) || input.unitCost < 0)
    throw new Error('Costo unitario inválido.');
  if (input.minStock !== undefined && (!Number.isFinite(input.minStock) || input.minStock < 0)) {
    throw new Error('Stock mínimo inválido.');
  }

  const now = new Date().toISOString();
  const nextStock = Number(input.stock);
  const basePayload = {
    name,
    category: input.category,
    stock: nextStock,
    unit: input.unit,
    unitCost: Number(input.unitCost),
    minStock: input.minStock,
    updatedAt: now
  };

  return db.transaction('rw', [db.inventory, db.inventoryMovements], async () => {
    if (editingId) {
      const fresh = await db.inventory.get(editingId);
      if (!fresh) throw new Error('El insumo ya no existe.');
      const prevStock = Number(fresh.stock ?? 0);
      await db.inventory.update(editingId, basePayload);
      const delta = nextStock - prevStock;
      if (delta !== 0) {
        await db.inventoryMovements.add({
          id: crypto.randomUUID(),
          inventoryItemId: editingId,
          type: 'manual',
          quantityChange: delta,
          stockAfter: nextStock,
          note: 'Ajuste manual desde inventario',
          createdAt: now
        } as InventoryMovement);
      }
      return { ...fresh, ...basePayload, id: editingId } as InventoryItem;
    }

    const id = crypto.randomUUID();
    const item: InventoryItem = { ...basePayload, id } as InventoryItem;
    await db.inventory.add(item);
    if (nextStock !== 0) {
      await db.inventoryMovements.add({
        id: crypto.randomUUID(),
        inventoryItemId: id,
        type: 'manual',
        quantityChange: nextStock,
        stockAfter: nextStock,
        note: 'Stock inicial',
        createdAt: now
      } as InventoryMovement);
    }
    return item;
  });
}

export async function deleteInventoryItemSafely(id: string): Promise<void> {
  await db.transaction('rw', [db.inventory, db.inventoryMovements, db.orders], async () => {
    const allOrders = await db.orders.toArray();
    const isUsed = allOrders.some((o) =>
      o.consumptions?.some((c) => c.inventoryItemId === id && c.quantity > 0)
    );
    if (isUsed) {
      throw new Error('No se puede eliminar: el insumo está registrado en consumos de pedidos.');
    }
    await db.inventory.delete(id);
    await db.inventoryMovements.where('inventoryItemId').equals(id).delete();
  });
}

export async function isInventoryItemReferenced(id: string): Promise<boolean> {
  const allOrders = await db.orders.toArray();
  return allOrders.some((o) =>
    o.consumptions?.some((c) => c.inventoryItemId === id && c.quantity > 0)
  );
}
