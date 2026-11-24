import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { db } from '../../repositories/dexie/db';
import { ClientsPage } from './ClientsPage';
import { ToastProvider } from '../../components/ToastProvider';

async function resetDb() {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
  });
}

describe('ClientsPage - guardado y feedback', () => {
  beforeEach(async () => {
    await db.open();
    await resetDb();
    vi.restoreAllMocks();
  });

  it('guarda cliente, muestra feedback y cierra modal', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ClientsPage />
      </ToastProvider>
    );
    await user.click(screen.getByRole('button', { name: /Nuevo cliente/i }));
    fireEvent.change(screen.getByLabelText(/Nombre Completo/i), { target: { value: 'Ana Perez' } });
    fireEvent.change(document.getElementById('client-phone') as HTMLInputElement, {
      target: { value: '3001234567' }
    });
    await user.click(screen.getByRole('button', { name: /^Guardar$/i }));
    await waitFor(async () => {
      const clients = await db.customers.toArray();
      expect(clients).toHaveLength(1);
      expect(clients[0].fullName).toBe('Ana Perez');
    });
    expect(screen.getByText(/Cliente registrado/i)).toBeInTheDocument();
  });
});
