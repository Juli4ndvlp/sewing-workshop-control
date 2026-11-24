import { describe, expect, it } from 'vitest';
import { generateOrderInvoicePdf } from './pdfService';
import { AppConfig, Customer, GarmentType, Order } from '../models/types';

describe('pdfService', () => {
  const mockConfig: AppConfig = {
    id: 'default',
    profitMargin: 30,
    currency: 'COP',
    businessName: 'Edna Atelier',
    logoDataUrl: '/edna-logo.jpg'
  };

  const mockCustomer: Customer = {
    id: 'cust-1',
    fullName: 'Valentina Restrepo',
    phone: '3001234567',
    email: 'valentina@example.com',
    createdAt: '2026-03-01T10:00:00Z'
  };

  const mockGarment: GarmentType = {
    id: 'garment-1',
    name: 'Vestido de Noche',
    active: true
  };

  const mockOrder: Order = {
    id: 'order-12345678-abcd',
    customerId: 'cust-1',
    garmentTypeId: 'garment-1',
    status: 'in_progress',
    deliveryDate: '2026-04-15',
    measurements: { busto: 92, cintura: 70, cadera: 98 },
    financials: {
      materialCost: 100000,
      laborCost: 150000,
      totalCost: 250000,
      totalPrice: 400000,
      profitMargin: 37.5,
      advancePayment: 150000,
      pendingBalance: 250000
    },
    description: 'Vestido en satén de seda con corte sirena',
    notes: 'Prueba de ajuste programada para el 10 de abril',
    size: 'M',
    createdAt: '2026-03-10T08:30:00Z',
    updatedAt: '2026-03-10T08:30:00Z'
  };

  it('genera un documento jsPDF con la estructura de la factura', async () => {
    const doc = await generateOrderInvoicePdf(mockOrder, mockCustomer, mockGarment, mockConfig);
    expect(doc).toBeDefined();
    expect(doc.internal.pageSize.getWidth()).toBeGreaterThan(500);
    expect(doc.internal.pageSize.getHeight()).toBeGreaterThan(800);
  });

  it('genera el documento correctamente incluso sin cliente registrado o sin prenda vinculada', async () => {
    const minimalOrder: Order = {
      id: 'order-minimal-999',
      customerId: 'cust-unknown',
      garmentTypeId: 'garment-unknown',
      deliveryDate: '',
      measurements: {},
      status: 'pending',
      financials: {
        materialCost: 0,
        laborCost: 0,
        totalCost: 0,
        totalPrice: 200000,
        profitMargin: 0,
        advancePayment: 200000,
        pendingBalance: 0
      },
      createdAt: '2026-03-12T00:00:00Z',
      updatedAt: '2026-03-12T00:00:00Z'
    };

    const doc = await generateOrderInvoicePdf(minimalOrder, null, null, mockConfig);
    expect(doc).toBeDefined();
  });

  it('funciona correctamente con logo DataUrl en base64 o ruta relativa', async () => {
    const configWithDataUrl: AppConfig = {
      ...mockConfig,
      logoDataUrl:
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
    };

    const doc = await generateOrderInvoicePdf(
      mockOrder,
      mockCustomer,
      mockGarment,
      configWithDataUrl
    );
    expect(doc).toBeDefined();
  });
});
