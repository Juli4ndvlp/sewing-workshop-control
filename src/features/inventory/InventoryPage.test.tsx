import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../../repositories/dexie/db';
import { InventoryPage } from './InventoryPage';
import { ToastProvider } from '../../components/ToastProvider';
import type { InventoryItem, Order } from '../../models/types';

async function resetDb() {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
  });
}

describe('InventoryPage - Eliminación segura de insumos', () => {
  beforeEach(async () => {
    await db.open();
    await resetDb();
    vi.restoreAllMocks();
  });

  it('bloquea la eliminación de un insumo si está registrado en consumos de pedidos', async () => {
    const user = userEvent.setup();
    const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const confirmMock = vi.spyOn(window, 'confirm');

    const item: InventoryItem = {
      id: 'inv-hilo',
      name: 'Hilo Dorado',
      category: 'Hilos',
      stock: 10,
      unit: 'Carretes',
      unitCost: 5000,
      minStock: 2,
      updatedAt: '2026-03-01T10:00:00.000Z'
    };
    await db.inventory.add(item);

    // Pedido que consume este insumo
    const order: Order = {
      id: 'ord-1',
      customerId: 'cust-1',
      garmentTypeId: 'g-1',
      status: 'pending',
      deliveryDate: '2026-04-15',
      measurements: {},
      consumptions: [{ inventoryItemId: 'inv-hilo', quantity: 2 }],
      financials: {
        materialCost: 10000,
        laborCost: 20000,
        totalCost: 30000,
        profitMargin: 50,
        totalPrice: 45000,
        advancePayment: 0,
        pendingBalance: 45000
      },
      createdAt: '2026-03-02T10:00:00.000Z'
    };
    await db.orders.add(order);

    render(
      <ToastProvider>
        <InventoryPage />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Hilo Dorado')).toBeInTheDocument();
    });

    const deleteBtn = screen.getByLabelText('Eliminar Hilo Dorado');
    await user.click(deleteBtn);

    // Debe mostrar feedback de bloqueo y no pedir confirmación de borrado
    expect(alertMock).not.toHaveBeenCalled();
    expect(confirmMock).not.toHaveBeenCalled();
    expect(await screen.findByText(/No se puede eliminar/i)).toBeInTheDocument();

    // El insumo debe seguir existiendo en la base de datos
    const persisted = await db.inventory.get('inv-hilo');
    expect(persisted).toBeDefined();
    expect(persisted?.name).toBe('Hilo Dorado');
  });

  it('permite eliminar un insumo no referenciado tras confirmación del usuario y limpia sus movimientos', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    const item: InventoryItem = {
      id: 'inv-botones',
      name: 'Botones Perla',
      category: 'Botones',
      stock: 50,
      unit: 'Unidades',
      unitCost: 500,
      minStock: 10,
      updatedAt: '2026-03-01T10:00:00.000Z'
    };
    await db.inventory.add(item);

    await db.inventoryMovements.add({
      id: 'mov-1',
      inventoryItemId: 'inv-botones',
      type: 'manual',
      quantityChange: 50,
      stockAfter: 50,
      note: 'Inventario inicial',
      createdAt: '2026-03-01T10:00:00.000Z'
    });

    render(
      <ToastProvider>
        <InventoryPage />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Botones Perla')).toBeInTheDocument();
    });

    const deleteBtn = screen.getByLabelText('Eliminar Botones Perla');
    await user.click(deleteBtn);

    expect(window.confirm).toHaveBeenCalledWith(
      expect.stringContaining('¿Seguro que deseas eliminar "Botones Perla"')
    );

    await waitFor(async () => {
      const persistedItem = await db.inventory.get('inv-botones');
      expect(persistedItem).toBeUndefined();
    });

    const remainingMovements = await db.inventoryMovements
      .where('inventoryItemId')
      .equals('inv-botones')
      .toArray();
    expect(remainingMovements).toHaveLength(0);
  });

  it('cancela la eliminación si el usuario rechaza el diálogo de confirmación', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    const item: InventoryItem = {
      id: 'inv-encaje',
      name: 'Encaje Francés',
      category: 'Telas',
      stock: 5,
      unit: 'Metros',
      unitCost: 25000,
      minStock: 1,
      updatedAt: '2026-03-01T10:00:00.000Z'
    };
    await db.inventory.add(item);

    render(
      <ToastProvider>
        <InventoryPage />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Encaje Francés')).toBeInTheDocument();
    });

    const deleteBtn = screen.getByLabelText('Eliminar Encaje Francés');
    await user.click(deleteBtn);

    expect(window.confirm).toHaveBeenCalled();

    // Sigue existiendo en base de datos
    const persisted = await db.inventory.get('inv-encaje');
    expect(persisted).toBeDefined();
  });
});
