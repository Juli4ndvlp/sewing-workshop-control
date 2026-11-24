import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../../repositories/dexie/db';
import { NewOrderStepper } from './NewOrderStepper';
import { ToastProvider } from '../../components/ToastProvider';
import type { Customer } from '../../models/types';
import { toDateOnly } from '../../utils/dates';

async function resetDb() {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
  });
}

describe('NewOrderStepper - Validación de fecha de entrega y precio acordado', () => {
  const customer: Customer = {
    id: 'cust-1',
    fullName: 'Mariana Pajón',
    phone: '3119876543',
    createdAt: '2026-01-01T00:00:00.000Z'
  };

  beforeEach(async () => {
    await db.open();
    await resetDb();
    await db.customers.add(customer);
    await db.garmentTypes.add({ id: 'g-1', name: 'Vestido', active: true });
  });

  it('exige seleccionar fecha de entrega antes de avanzar del Paso 1', async () => {
    const user = userEvent.setup();

    render(
      <ToastProvider>
        <NewOrderStepper isOpen={true} onClose={() => {}} onSuccess={() => {}} />
      </ToastProvider>
    );

    // Esperar a que el cliente esté cargado en las opciones
    await screen.findByRole('option', { name: /Mariana Pajón/i });

    // Vaciar el campo de fecha de entrega
    const dateInput = screen.getByLabelText(/Fecha de entrega/i);
    fireEvent.change(dateInput, { target: { value: '' } });

    // Intenta avanzar
    const nextBtn = screen.getByRole('button', { name: /Siguiente/i });
    await user.click(nextBtn);

    expect(screen.getByText('Selecciona la fecha acordada de entrega.')).toBeInTheDocument();
  });

  it('rechaza fecha de entrega anterior a hoy en un nuevo pedido', async () => {
    const user = userEvent.setup();

    render(
      <ToastProvider>
        <NewOrderStepper isOpen={true} onClose={() => {}} onSuccess={() => {}} />
      </ToastProvider>
    );

    await screen.findByRole('option', { name: /Mariana Pajón/i });

    // Ingresa una fecha en el pasado
    const dateInput = screen.getByLabelText(/Fecha de entrega/i);
    fireEvent.change(dateInput, { target: { value: '2020-01-01' } });

    const nextBtn = screen.getByRole('button', { name: /Siguiente/i });
    await user.click(nextBtn);

    expect(
      screen.getByText('La fecha acordada de entrega no puede ser anterior a hoy.')
    ).toBeInTheDocument();
  });

  it('permite fijar un precio final acordado manual diferente al sugerido por costos', async () => {
    const user = userEvent.setup();
    const today = toDateOnly(new Date());

    render(
      <ToastProvider>
        <NewOrderStepper isOpen={true} onClose={() => {}} onSuccess={() => {}} />
      </ToastProvider>
    );

    await screen.findByRole('option', { name: /Mariana Pajón/i });

    // Paso 1: fecha válida (hoy)
    const dateInput = screen.getByLabelText(/Fecha de entrega/i);
    fireEvent.change(dateInput, { target: { value: today } });

    // Avanza a Paso 2 (Medidas)
    await user.click(screen.getByRole('button', { name: /Siguiente/i }));

    await waitFor(() => {
      expect(screen.getByText(/Medidas del encargo/i)).toBeInTheDocument();
    });

    // Avanza a Paso 3 (Costos y Precios)
    await user.click(screen.getByRole('button', { name: /Siguiente/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/Precio final acordado/i)).toBeInTheDocument();
    });

    // Ingresa costo de mano de obra
    const laborInput = screen.getByLabelText(/Mano de obra/i);
    fireEvent.change(laborInput, { target: { value: '50000' } });

    // Modificamos manualmente el precio acordado a 80000 (sugerido por costos sería 65000)
    const finalPriceInput = screen.getByLabelText(/Precio final acordado/i);
    fireEvent.change(finalPriceInput, { target: { value: '80000' } });

    // Ingresa un abono inicial de 30000
    const advanceInput = screen.getByLabelText(/Abono inicial/i);
    fireEvent.change(advanceInput, { target: { value: '30000' } });

    // El saldo pendiente calculado debe reflejar $ 50.000 (80000 - 30000)
    await waitFor(() => {
      expect(screen.getByText('Precio total del pedido').parentElement).toHaveTextContent(
        '$ 80.000'
      );
      expect(screen.getByText('Saldo pendiente').parentElement).toHaveTextContent('$ 50.000');
    });

    // Guarda el pedido
    const submitBtn = screen.getByRole('button', { name: /Guardar pedido/i });
    await user.click(submitBtn);

    await waitFor(async () => {
      const orders = await db.orders.toArray();
      expect(orders).toHaveLength(1);
      expect(orders[0].financials.totalPrice).toBe(80000);
      expect(orders[0].financials.advancePayment).toBe(30000);
      expect(orders[0].financials.pendingBalance).toBe(50000);
    });
  });
});
