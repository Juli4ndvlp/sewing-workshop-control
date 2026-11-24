import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../../repositories/dexie/db';
import { OrdersPage } from './OrdersPage';
import { ToastProvider } from '../../components/ToastProvider';
import type { Customer, Order } from '../../models/types';

async function resetDb() {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
  });
}

describe('OrdersPage - Ordenamiento de pedidos', () => {
  beforeEach(async () => {
    await db.open();
    await resetDb();

    const customer: Customer = {
      id: 'cust-1',
      fullName: 'Carolina Herrera',
      phone: '3001234567',
      createdAt: '2026-01-01T00:00:00.000Z'
    };
    await db.customers.add(customer);
  });

  const orderMayo: Order = {
    id: 'ord-mayo',
    customerId: 'cust-1',
    garmentTypeId: 'g-1',
    garmentType: 'Vestido Mayo',
    status: 'pending',
    deliveryDate: '2026-05-10',
    measurements: {},
    financials: {
      materialCost: 20000,
      laborCost: 30000,
      totalCost: 50000,
      profitMargin: 50,
      totalPrice: 150000, // Precio intermedio
      advancePayment: 0,
      pendingBalance: 150000
    },
    createdAt: '2026-02-01T10:00:00.000Z' // Creado primero
  };

  const orderAbril: Order = {
    id: 'ord-abril',
    customerId: 'cust-1',
    garmentTypeId: 'g-1',
    garmentType: 'Camisa Abril',
    status: 'pending',
    deliveryDate: '2026-04-01', // Entrega más próxima
    measurements: {},
    financials: {
      materialCost: 10000,
      laborCost: 15000,
      totalCost: 25000,
      profitMargin: 50,
      totalPrice: 50000, // Menor valor
      advancePayment: 0,
      pendingBalance: 50000
    },
    createdAt: '2026-02-10T10:00:00.000Z' // Creado intermedio
  };

  const orderJunio: Order = {
    id: 'ord-junio',
    customerId: 'cust-1',
    garmentTypeId: 'g-1',
    garmentType: 'Pantalón Junio',
    status: 'pending',
    deliveryDate: '2026-06-20', // Entrega más lejana
    measurements: {},
    financials: {
      materialCost: 30000,
      laborCost: 40000,
      totalCost: 70000,
      profitMargin: 50,
      totalPrice: 300000, // Mayor valor
      advancePayment: 0,
      pendingBalance: 300000
    },
    createdAt: '2026-03-01T10:00:00.000Z' // Creado más reciente
  };

  it('ordena pedidos por fecha de entrega más próxima por defecto (delivery_asc)', async () => {
    await db.orders.bulkAdd([orderMayo, orderAbril, orderJunio]);

    render(
      <ToastProvider>
        <OrdersPage onOpenCreate={() => {}} />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Camisa Abril')).toBeInTheDocument();
    });

    const garmentTitles = screen
      .getAllByRole('row')
      .slice(1) // Omitir header
      .map((row) => row.querySelector('p.font-semibold')?.textContent);

    // Abril (2026-04-01) -> Mayo (2026-05-10) -> Junio (2026-06-20)
    expect(garmentTitles).toEqual(['Camisa Abril', 'Vestido Mayo', 'Pantalón Junio']);
  });

  it('ordena pedidos por más recientes primero cuando se selecciona created_desc', async () => {
    const user = userEvent.setup();
    await db.orders.bulkAdd([orderMayo, orderAbril, orderJunio]);

    render(
      <ToastProvider>
        <OrdersPage onOpenCreate={() => {}} />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Camisa Abril')).toBeInTheDocument();
    });

    const sortSelect = screen.getByLabelText('Ordenar pedidos');
    await user.selectOptions(sortSelect, 'created_desc');

    const garmentTitles = screen
      .getAllByRole('row')
      .slice(1)
      .map((row) => row.querySelector('p.font-semibold')?.textContent);

    // Junio (creado marzo) -> Abril (creado feb 10) -> Mayo (creado feb 1)
    expect(garmentTitles).toEqual(['Pantalón Junio', 'Camisa Abril', 'Vestido Mayo']);
  });

  it('ordena pedidos por mayor valor primero cuando se selecciona total_desc', async () => {
    const user = userEvent.setup();
    await db.orders.bulkAdd([orderMayo, orderAbril, orderJunio]);

    render(
      <ToastProvider>
        <OrdersPage onOpenCreate={() => {}} />
      </ToastProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Camisa Abril')).toBeInTheDocument();
    });

    const sortSelect = screen.getByLabelText('Ordenar pedidos');
    await user.selectOptions(sortSelect, 'total_desc');

    const garmentTitles = screen
      .getAllByRole('row')
      .slice(1)
      .map((row) => row.querySelector('p.font-semibold')?.textContent);

    // Pantalón Junio ($300.000) -> Vestido Mayo ($150.000) -> Camisa Abril ($50.000)
    expect(garmentTitles).toEqual(['Pantalón Junio', 'Vestido Mayo', 'Camisa Abril']);
  });
});
