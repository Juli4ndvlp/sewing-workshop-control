import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../repositories/dexie/db';
import {
  createBackup,
  downloadBackup,
  encryptBackupPayload,
  getBackupSummary,
  readBackupPayload,
  restoreBackup,
  restoreBackupPayload
} from './backupService';
import type { BackupPayload } from './backupService';
import type {
  AppConfig,
  Customer,
  Fabric,
  GarmentType,
  InventoryItem,
  InventoryMovement,
  MeasurementDefinition,
  Order,
  OrderStatusHistory,
  Payment
} from '../models/types';

const sampleCustomer: Customer = {
  id: 'cust-1',
  fullName: 'Ana Pérez',
  phone: '3001234567',
  createdAt: '2026-01-01T10:00:00.000Z'
};

const sampleOrder: Order = {
  id: 'ord-1',
  customerId: 'cust-1',
  garmentTypeId: 'gar-1',
  garmentType: 'Blusa',
  status: 'pending',
  deliveryDate: '2026-12-01',
  measurements: { busto: 90 },
  financials: {
    materialCost: 10000,
    laborCost: 20000,
    totalCost: 30000,
    profitMargin: 30,
    totalPrice: 39000,
    advancePayment: 10000,
    pendingBalance: 29000
  },
  createdAt: '2026-01-01T10:00:00.000Z'
};

const sampleGarment: GarmentType = { id: 'gar-1', name: 'Blusa', active: true };
const sampleFabric: Fabric = { id: 'fab-1', name: 'Lino', active: true };
const sampleMeasurement: MeasurementDefinition = {
  id: 'm-1',
  key: 'busto',
  name: 'Busto',
  active: true
};
const sampleConfig: AppConfig = {
  id: 'default',
  profitMargin: 30,
  currency: 'COP',
  businessName: 'Edna Atelier'
};
const sampleInventory: InventoryItem = {
  id: 'inv-1',
  name: 'Hilo',
  category: 'Insumos',
  stock: 10,
  unit: 'unidad',
  unitCost: 2000,
  updatedAt: '2026-01-01T10:00:00.000Z'
};

const samplePayment: Payment = {
  id: 'pay-1',
  orderId: 'ord-1',
  amount: 10000,
  date: '2026-01-01',
  note: 'Abono inicial',
  createdAt: '2026-01-01T10:00:00.000Z'
};

const sampleStatusHistory: OrderStatusHistory = {
  id: 'hist-1',
  orderId: 'ord-1',
  fromStatus: null,
  toStatus: 'pending',
  note: 'Pedido creado',
  createdAt: '2026-01-01T10:00:00.000Z'
};

const sampleInventoryMovement: InventoryMovement = {
  id: 'mov-1',
  inventoryItemId: 'inv-1',
  type: 'manual',
  quantityChange: 10,
  stockAfter: 10,
  note: 'Stock inicial',
  createdAt: '2026-01-01T10:00:00.000Z'
};

async function clearDatabase() {
  await db.transaction(
    'rw',
    [
      db.customers,
      db.orders,
      db.garmentTypes,
      db.fabrics,
      db.measurementDefinitions,
      db.appConfig,
      db.inventory,
      db.payments,
      db.orderStatusHistory,
      db.inventoryMovements
    ],
    async () => {
      await Promise.all([
        db.customers.clear(),
        db.orders.clear(),
        db.garmentTypes.clear(),
        db.fabrics.clear(),
        db.measurementDefinitions.clear(),
        db.appConfig.clear(),
        db.inventory.clear(),
        db.payments.clear(),
        db.orderStatusHistory.clear(),
        db.inventoryMovements.clear()
      ]);
    }
  );
}

async function seedDatabase() {
  await db.transaction(
    'rw',
    [
      db.customers,
      db.orders,
      db.garmentTypes,
      db.fabrics,
      db.measurementDefinitions,
      db.appConfig,
      db.inventory,
      db.payments,
      db.orderStatusHistory,
      db.inventoryMovements
    ],
    async () => {
      await Promise.all([
        db.customers.add(sampleCustomer),
        db.orders.add(sampleOrder),
        db.garmentTypes.add(sampleGarment),
        db.fabrics.add(sampleFabric),
        db.measurementDefinitions.add(sampleMeasurement),
        db.appConfig.add(sampleConfig),
        db.inventory.add(sampleInventory),
        db.payments.add(samplePayment),
        db.orderStatusHistory.add(sampleStatusHistory),
        db.inventoryMovements.add(sampleInventoryMovement)
      ]);
    }
  );
}

describe('backupService', () => {
  beforeEach(async () => {
    await db.open();
    await clearDatabase();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
  });

  it('createBackup devuelve payload con app, versión y datos de las tablas', async () => {
    await seedDatabase();

    const backup = await createBackup();

    expect(backup.app).toBe('edna-atelier');
    expect(backup.version).toBe(4);
    expect(typeof backup.exportedAt).toBe('string');
    expect(new Date(backup.exportedAt).toISOString()).toBe(backup.exportedAt);
    expect(backup.data.customers).toEqual([sampleCustomer]);
    expect(backup.data.orders).toEqual([sampleOrder]);
    expect(backup.data.garmentTypes).toEqual([sampleGarment]);
    expect(backup.data.fabrics).toEqual([sampleFabric]);
    expect(backup.data.measurementDefinitions).toEqual([sampleMeasurement]);
    expect(backup.data.appConfig).toEqual([sampleConfig]);
    expect(backup.data.inventory).toEqual([sampleInventory]);
    expect(backup.data.payments).toEqual([samplePayment]);
    expect(backup.data.orderStatusHistory).toEqual([sampleStatusHistory]);
    expect(backup.data.inventoryMovements).toEqual([sampleInventoryMovement]);
  });

  it('restoreBackup reemplaza los datos existentes por los del respaldo', async () => {
    await seedDatabase();
    await db.customers.add({
      id: 'cust-extra',
      fullName: 'Extra',
      createdAt: '2026-02-01T00:00:00.000Z'
    });

    const payload: BackupPayload = {
      app: 'edna-atelier',
      version: 4,
      exportedAt: '2026-03-01T00:00:00.000Z',
      data: {
        customers: [
          { id: 'cust-restored', fullName: 'Restaurada', createdAt: '2026-03-01T00:00:00.000Z' }
        ],
        orders: [],
        garmentTypes: [sampleGarment],
        fabrics: [],
        measurementDefinitions: [],
        appConfig: [sampleConfig],
        inventory: [],
        payments: [],
        orderStatusHistory: [],
        inventoryMovements: []
      }
    };

    const file = new File([JSON.stringify(payload)], 'backup.json', { type: 'application/json' });
    await restoreBackup(file);

    const customers = await db.customers.toArray();
    const orders = await db.orders.toArray();
    const garments = await db.garmentTypes.toArray();
    const payments = await db.payments.toArray();
    const history = await db.orderStatusHistory.toArray();
    const movements = await db.inventoryMovements.toArray();

    expect(customers).toEqual(payload.data.customers);
    expect(orders).toEqual([]);
    expect(garments).toEqual([sampleGarment]);
    expect(payments).toEqual([]);
    expect(history).toEqual([]);
    expect(movements).toEqual([]);
  });

  it('restoreBackup rechaza JSON inválido', async () => {
    const file = new File(['{no-es-json'], 'bad.json', { type: 'application/json' });

    await expect(restoreBackup(file)).rejects.toThrow('El archivo no es un JSON válido.');
  });

  it('restoreBackup rechaza un payload que no es respaldo de Edna Atelier', async () => {
    const file = new File([JSON.stringify({ app: 'otra-app', version: 1, data: {} })], 'bad.json', {
      type: 'application/json'
    });

    await expect(restoreBackup(file)).rejects.toThrow(
      'El archivo no es un respaldo válido de Edna Atelier.'
    );
  });

  it('restoreBackup rechaza archivos que superan el tamaño máximo', async () => {
    const largeFile = {
      size: 26 * 1024 * 1024,
      text: async () => '{"app":"edna-atelier"}'
    } as unknown as File;

    await expect(restoreBackup(largeFile)).rejects.toThrow(
      'El archivo supera el tamaño máximo permitido (25 MB).'
    );
  });

  it('downloadBackup crea blob, URL de objeto y dispara descarga', async () => {
    await seedDatabase();

    const createObjectURL = vi.fn(() => 'blob:backup-url');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });

    const click = vi.fn();
    const remove = vi.fn();
    const anchor = { href: '', download: '', click, remove } as unknown as HTMLAnchorElement;
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(((tagName: string) => {
      if (tagName === 'a') return anchor;
      return originalCreateElement(tagName);
    }) as typeof document.createElement);
    const appendChildSpy = vi
      .spyOn(document.body, 'appendChild')
      .mockImplementation((node) => node);

    await downloadBackup();

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blobArg = createObjectURL.mock.calls.at(0)?.at(0);
    expect(blobArg).toBeInstanceOf(Blob);
    expect((blobArg as unknown as Blob).type).toBe('application/json');

    expect(anchor.href).toBe('blob:backup-url');
    expect(anchor.download).toMatch(/^edna-atelier-respaldo-\d{4}-\d{2}-\d{2}\.json$/);
    expect(appendChildSpy).toHaveBeenCalledWith(anchor);
    expect(click).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:backup-url');
  });

  it('restoreBackup rechaza pedido con customerId inexistente', async () => {
    const payload: BackupPayload = {
      app: 'edna-atelier',
      version: 4,
      exportedAt: '2026-03-01T00:00:00.000Z',
      data: {
        customers: [],
        orders: [sampleOrder],
        garmentTypes: [sampleGarment],
        fabrics: [],
        measurementDefinitions: [],
        appConfig: [sampleConfig],
        inventory: [],
        payments: [],
        orderStatusHistory: [],
        inventoryMovements: []
      }
    };
    const file = new File([JSON.stringify(payload)], 'bad-ref.json', { type: 'application/json' });
    await expect(restoreBackup(file)).rejects.toThrow('customerId inexistente');
  });

  it('readBackupPayload y getBackupSummary devuelven resumen del respaldo', async () => {
    const payload: BackupPayload = {
      app: 'edna-atelier',
      version: 4,
      exportedAt: '2026-03-01T00:00:00.000Z',
      data: {
        customers: [sampleCustomer],
        orders: [sampleOrder],
        garmentTypes: [sampleGarment],
        fabrics: [sampleFabric],
        measurementDefinitions: [],
        appConfig: [sampleConfig],
        inventory: [sampleInventory],
        payments: [samplePayment],
        orderStatusHistory: [],
        inventoryMovements: []
      }
    };
    const file = new File([JSON.stringify(payload)], 'backup.json', { type: 'application/json' });
    const { payload: parsed, data } = await readBackupPayload(file);
    const summary = getBackupSummary(parsed, data);
    expect(summary).toMatchObject({
      version: 4,
      customers: 1,
      orders: 1,
      payments: 1,
      inventory: 1,
      garmentTypes: 1,
      fabrics: 1
    });
  });

  it('cifra y restaura un respaldo con contraseña', async () => {
    await seedDatabase();
    const backup = await createBackup();
    const encrypted = await encryptBackupPayload(backup, 'secreto123');
    const file = new File([JSON.stringify(encrypted)], 'backup.json', { type: 'application/json' });

    await expect(readBackupPayload(file)).rejects.toThrow(/cifrado/i);
    await expect(readBackupPayload(file, 'mala')).rejects.toThrow(/Contraseña incorrecta|dañado/i);

    const { data } = await readBackupPayload(file, 'secreto123');
    await clearDatabase();
    await restoreBackupPayload(data);
    expect(await db.customers.count()).toBe(1);
    expect(await db.orders.count()).toBe(1);
  });
});
