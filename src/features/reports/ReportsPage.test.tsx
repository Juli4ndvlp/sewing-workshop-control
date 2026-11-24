import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../../repositories/dexie/db';
import { ReportsPage } from './ReportsPage';
import type { Order, Payment } from '../../models/types';

async function resetDb() {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
  });
}

function getCard(label: string): HTMLElement {
  const labelEl = screen.getByText(label);
  const card = labelEl.closest('div[class*="rounded-2xl"]');
  if (!card) throw new Error(`Tarjeta no encontrada para etiqueta: ${label}`);
  return card as HTMLElement;
}

describe('ReportsPage - Criterios de fecha y métricas de negocio', () => {
  beforeEach(async () => {
    await db.open();
    await resetDb();
  });

  it('filtra por fecha de encargo (createdAt) por defecto, ignorando la fecha de entrega', async () => {
    // Pedido 1: encargado en marzo 2026, entrega en abril 2026
    const order1: Order = {
      id: 'ord-1',
      customerId: 'c-1',
      garmentTypeId: 'g-1',
      status: 'pending',
      deliveryDate: '2026-04-20',
      measurements: {},
      financials: {
        materialCost: 20000,
        laborCost: 30000,
        totalCost: 50000,
        profitMargin: 50,
        totalPrice: 75000,
        advancePayment: 0,
        pendingBalance: 75000
      },
      createdAt: '2026-03-10T10:00:00.000Z'
    };

    // Pedido 2: encargado en febrero 2026, entrega en marzo 2026
    const order2: Order = {
      id: 'ord-2',
      customerId: 'c-1',
      garmentTypeId: 'g-1',
      status: 'ready',
      deliveryDate: '2026-03-15',
      measurements: {},
      financials: {
        materialCost: 10000,
        laborCost: 15000,
        totalCost: 25000,
        profitMargin: 60,
        totalPrice: 40000,
        advancePayment: 40000,
        pendingBalance: 0
      },
      createdAt: '2026-02-15T10:00:00.000Z'
    };

    await db.orders.bulkAdd([order1, order2]);

    render(<ReportsPage />);

    await waitFor(() => {
      expect(screen.queryByText(/Cargando reporte/i)).not.toBeInTheDocument();
    });

    // Ajusta el rango a marzo de 2026
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-03-01' } });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-03-31' } });

    // Por defecto (createdAt), solo entra order1 (creado el 10 de marzo)
    await waitFor(() => {
      const facturadoCard = getCard('Facturado');
      expect(within(facturadoCard).getByText('$ 75.000')).toBeInTheDocument();
      expect(within(facturadoCard).getByText('1 pedidos en rango')).toBeInTheDocument();

      const costoCard = getCard('Costo');
      expect(within(costoCard).getByText('$ 50.000')).toBeInTheDocument();

      const margenCard = getCard('Margen real');
      expect(within(margenCard).getByText('$ 25.000')).toBeInTheDocument();
    });
  });

  it('permite alternar al criterio de fecha de entrega (deliveryDate) y actualiza métricas del período', async () => {
    const user = userEvent.setup();

    const order1: Order = {
      id: 'ord-1',
      customerId: 'c-1',
      garmentTypeId: 'g-1',
      status: 'pending',
      deliveryDate: '2026-04-20',
      measurements: {},
      financials: {
        materialCost: 20000,
        laborCost: 30000,
        totalCost: 50000,
        profitMargin: 50,
        totalPrice: 75000,
        advancePayment: 0,
        pendingBalance: 75000
      },
      createdAt: '2026-03-10T10:00:00.000Z'
    };

    const order2: Order = {
      id: 'ord-2',
      customerId: 'c-1',
      garmentTypeId: 'g-1',
      status: 'ready',
      deliveryDate: '2026-03-15',
      measurements: {},
      financials: {
        materialCost: 10000,
        laborCost: 15000,
        totalCost: 25000,
        profitMargin: 60,
        totalPrice: 40000,
        advancePayment: 40000,
        pendingBalance: 0
      },
      createdAt: '2026-02-15T10:00:00.000Z'
    };

    await db.orders.bulkAdd([order1, order2]);

    render(<ReportsPage />);
    await waitFor(() => {
      expect(screen.queryByText(/Cargando reporte/i)).not.toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-03-01' } });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-03-31' } });

    // Cambiar a "Por fecha de entrega"
    const criterionSelect = screen.getByLabelText('Criterio de fecha para pedidos');
    await user.selectOptions(criterionSelect, 'deliveryDate');

    // Con fecha de entrega en marzo: entra únicamente order2 (entrega 15 de marzo)
    await waitFor(() => {
      const facturadoCard = getCard('Facturado');
      expect(within(facturadoCard).getByText('$ 40.000')).toBeInTheDocument();
      expect(within(facturadoCard).getByText('1 pedidos en rango')).toBeInTheDocument();

      const costoCard = getCard('Costo');
      expect(within(costoCard).getByText('$ 25.000')).toBeInTheDocument();

      const margenCard = getCard('Margen real');
      expect(within(margenCard).getByText('$ 15.000')).toBeInTheDocument();
    });
  });

  it('detecta y reporta pedidos sin costear dentro del período', async () => {
    // Pedido sin costear: totalCost = 0 pero totalPrice > 0
    const uncostedOrder: Order = {
      id: 'ord-uncosted',
      customerId: 'c-1',
      garmentTypeId: 'g-1',
      status: 'pending',
      deliveryDate: '2026-03-18',
      measurements: {},
      financials: {
        materialCost: 0,
        laborCost: 0,
        totalCost: 0,
        profitMargin: 0,
        totalPrice: 60000,
        advancePayment: 20000,
        pendingBalance: 40000
      },
      createdAt: '2026-03-05T12:00:00.000Z'
    };

    await db.orders.add(uncostedOrder);

    render(<ReportsPage />);
    await waitFor(() => {
      expect(screen.queryByText(/Cargando reporte/i)).not.toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-03-01' } });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-03-31' } });

    await waitFor(() => {
      const margenCard = getCard('Margen real');
      expect(within(margenCard).getByText('Facturado - costo (1 sin costear)')).toBeInTheDocument();
      expect(within(margenCard).getByText('$ 60.000')).toBeInTheDocument();
    });
  });

  it('excluye pedidos cancelados de los totales de facturación y margen', async () => {
    const cancelledOrder: Order = {
      id: 'ord-canc',
      customerId: 'c-1',
      garmentTypeId: 'g-1',
      status: 'cancelled',
      cancellationReason: 'Cliente desistió del encargo',
      deliveryDate: '2026-03-12',
      measurements: {},
      financials: {
        materialCost: 15000,
        laborCost: 20000,
        totalCost: 35000,
        profitMargin: 30,
        totalPrice: 50000,
        advancePayment: 0,
        pendingBalance: 50000
      },
      createdAt: '2026-03-02T10:00:00.000Z'
    };

    await db.orders.add(cancelledOrder);

    render(<ReportsPage />);
    await waitFor(() => {
      expect(screen.queryByText(/Cargando reporte/i)).not.toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-03-01' } });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-03-31' } });

    await waitFor(() => {
      const facturadoCard = getCard('Facturado');
      expect(within(facturadoCard).getByText('0 pedidos en rango')).toBeInTheDocument();
      expect(within(facturadoCard).getByText('$ 0')).toBeInTheDocument();

      const margenCard = getCard('Margen real');
      expect(within(margenCard).getByText('$ 0')).toBeInTheDocument();
    });
  });

  it('calcula cobros de abonos registrados en el período', async () => {
    const payment1: Payment = {
      id: 'pay-1',
      orderId: 'ord-1',
      amount: 35000,
      date: '2026-03-08',
      createdAt: '2026-03-08T10:00:00.000Z'
    };

    const payment2: Payment = {
      id: 'pay-2',
      orderId: 'ord-2',
      amount: 20000,
      date: '2026-02-15',
      createdAt: '2026-02-15T10:00:00.000Z'
    };

    await db.payments.bulkAdd([payment1, payment2]);

    render(<ReportsPage />);
    await waitFor(() => {
      expect(screen.queryByText(/Cargando reporte/i)).not.toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-03-01' } });
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-03-31' } });

    await waitFor(() => {
      const cobradoCard = getCard('Cobrado');
      expect(within(cobradoCard).getByText('1 abonos en rango')).toBeInTheDocument();
      expect(within(cobradoCard).getByText('$ 35.000')).toBeInTheDocument();
    });
  });
});
