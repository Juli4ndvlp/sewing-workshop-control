import { db } from '../repositories/dexie/db';
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
import { toDateOnly } from '../utils/dates';

const BACKUP_APP = 'edna-atelier';
const BACKUP_VERSION = 4;
const MAX_BACKUP_BYTES = 25 * 1024 * 1024;

export interface BackupData {
  customers: Customer[];
  orders: Order[];
  garmentTypes: GarmentType[];
  fabrics: Fabric[];
  measurementDefinitions: MeasurementDefinition[];
  appConfig: AppConfig[];
  inventory: InventoryItem[];
  payments: Payment[];
  orderStatusHistory: OrderStatusHistory[];
  inventoryMovements: InventoryMovement[];
}

export interface BackupPayload {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: string;
  data: BackupData;
}

export interface EncryptedBackupPayload {
  app: typeof BACKUP_APP;
  version: number;
  exportedAt: string;
  encrypted: true;
  kdf: 'PBKDF2-SHA256';
  cipher: 'AES-GCM';
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isBackupPayload = (value: unknown): value is BackupPayload => {
  if (!isRecord(value) || value.app !== BACKUP_APP) return false;
  if (typeof value.version !== 'number' || value.version < 1 || value.version > BACKUP_VERSION)
    return false;

  const data = value.data;
  if (!isRecord(data)) return false;

  const requiredTables: Array<keyof BackupData> = [
    'customers',
    'orders',
    'garmentTypes',
    'fabrics',
    'measurementDefinitions',
    'appConfig',
    'inventory'
  ];

  const hasRequired = requiredTables.every((table) => Array.isArray(data[table]));
  if (!hasRequired) return false;
  if (value.version >= 2 && !Array.isArray(data.payments)) return false;
  if (value.version >= 3 && !Array.isArray(data.orderStatusHistory)) return false;
  if (value.version >= 4 && !Array.isArray(data.inventoryMovements)) return false;
  return true;
};

const isEncryptedBackupPayload = (value: unknown): value is EncryptedBackupPayload => {
  if (!isRecord(value) || value.app !== BACKUP_APP) return false;
  if (value.encrypted !== true) return false;
  return (
    typeof value.version === 'number' &&
    typeof value.exportedAt === 'string' &&
    value.kdf === 'PBKDF2-SHA256' &&
    value.cipher === 'AES-GCM' &&
    typeof value.iterations === 'number' &&
    typeof value.salt === 'string' &&
    typeof value.iv === 'string' &&
    typeof value.ciphertext === 'string'
  );
};

const toBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
};
const fromBase64 = (value: string): Uint8Array<ArrayBuffer> => {
  const binary = atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

async function deriveBackupKey(
  password: string,
  salt: BufferSource,
  iterations: number
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveKey'
  ]);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptBackupPayload(
  payload: BackupPayload,
  password: string
): Promise<EncryptedBackupPayload> {
  if (!password.trim()) throw new Error('La contraseña del respaldo no puede estar vacía.');
  const iterations = 150000;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveBackupKey(password, salt, iterations);
  const encoded = new TextEncoder().encode(JSON.stringify(payload.data));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  return {
    app: BACKUP_APP,
    version: payload.version,
    exportedAt: payload.exportedAt,
    encrypted: true,
    kdf: 'PBKDF2-SHA256',
    cipher: 'AES-GCM',
    iterations,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(ciphertext))
  };
}

export async function decryptBackupPayload(
  payload: EncryptedBackupPayload,
  password: string
): Promise<BackupPayload> {
  if (!password) throw new Error('Se requiere contraseña para este respaldo.');
  const key = await deriveBackupKey(password, fromBase64(payload.salt), payload.iterations);
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(payload.iv) },
      key,
      fromBase64(payload.ciphertext)
    );
    const data = JSON.parse(new TextDecoder().decode(decrypted)) as unknown;
    const candidate = {
      app: BACKUP_APP,
      version: payload.version,
      exportedAt: payload.exportedAt,
      data
    };
    if (!isBackupPayload(candidate))
      throw new Error('El respaldo descifrado no tiene un formato válido.');
    return candidate;
  } catch (e) {
    if (e instanceof Error && e.message.includes('formato válido')) throw e;
    throw new Error('Contraseña incorrecta o respaldo cifrado dañado.');
  }
}

export const createBackup = async (): Promise<BackupPayload> => {
  const [
    customers,
    orders,
    garmentTypes,
    fabrics,
    measurementDefinitions,
    appConfig,
    inventory,
    payments,
    orderStatusHistory,
    inventoryMovements
  ] = await Promise.all([
    db.customers.toArray(),
    db.orders.toArray(),
    db.garmentTypes.toArray(),
    db.fabrics.toArray(),
    db.measurementDefinitions.toArray(),
    db.appConfig.toArray(),
    db.inventory.toArray(),
    db.payments.toArray(),
    db.orderStatusHistory.toArray(),
    db.inventoryMovements.toArray()
  ]);

  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      customers,
      orders,
      garmentTypes,
      fabrics,
      measurementDefinitions,
      appConfig,
      inventory,
      payments,
      orderStatusHistory,
      inventoryMovements
    }
  };
};

export const downloadBackup = async (password?: string): Promise<void> => {
  const backup = await createBackup();
  const payload = password?.trim() ? await encryptBackupPayload(backup, password.trim()) : backup;
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `edna-atelier-respaldo-${toDateOnly(new Date())}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export interface BackupSummary {
  version: number;
  exportedAt: string;
  customers: number;
  orders: number;
  payments: number;
  inventory: number;
  garmentTypes: number;
  fabrics: number;
}

export interface NormalizedBackupData extends BackupData {
  payments: Payment[];
  orderStatusHistory: OrderStatusHistory[];
  inventoryMovements: InventoryMovement[];
}

export const readBackupPayload = async (
  file: File,
  password?: string
): Promise<{ payload: BackupPayload; data: NormalizedBackupData }> => {
  if (file.size > MAX_BACKUP_BYTES) {
    throw new Error('El archivo supera el tamaño máximo permitido (25 MB).');
  }

  const text = await file.text();
  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('El archivo no es un JSON válido.');
  }

  let backupPayload: BackupPayload;
  if (isEncryptedBackupPayload(parsed)) {
    if (!password)
      throw new Error('Este respaldo está cifrado. Ingresa la contraseña para restaurarlo.');
    backupPayload = await decryptBackupPayload(parsed, password);
  } else if (isBackupPayload(parsed)) {
    backupPayload = parsed;
  } else {
    throw new Error('El archivo no es un respaldo válido de Edna Atelier.');
  }

  const { data } = backupPayload;
  const payments = Array.isArray(data.payments) ? data.payments : [];
  const orderStatusHistory = Array.isArray(data.orderStatusHistory) ? data.orderStatusHistory : [];
  const inventoryMovements = Array.isArray(data.inventoryMovements) ? data.inventoryMovements : [];

  const errors: string[] = [];
  const isNonEmptyString = (v: unknown): v is string =>
    typeof v === 'string' && v.trim().length > 0;
  const isDateOnly = (v: unknown): v is string =>
    typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
  const isFiniteNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  const validStatuses = new Set(['pending', 'in_progress', 'ready', 'delivered', 'cancelled']);

  const customerIds = new Set<string>();
  for (const c of data.customers) {
    if (!isRecord(c) || !isNonEmptyString(c.id) || !isNonEmptyString(c.fullName))
      errors.push('Cliente inválido en respaldo.');
    else if (customerIds.has(c.id)) errors.push(`ID de cliente duplicado: ${c.id}`);
    else customerIds.add(c.id);
  }

  const orderIds = new Set<string>();
  for (const o of data.orders) {
    if (
      !isRecord(o) ||
      !isNonEmptyString(o.id) ||
      !isNonEmptyString(o.customerId) ||
      !validStatuses.has(String(o.status))
    ) {
      errors.push('Pedido inválido en respaldo.');
      continue;
    }
    if (orderIds.has(o.id)) errors.push(`ID de pedido duplicado: ${o.id}`);
    orderIds.add(o.id);
    if (!customerIds.has(o.customerId as string))
      errors.push(`Pedido ${o.id}: customerId inexistente.`);
    if (!isDateOnly(o.deliveryDate)) errors.push(`Pedido ${o.id}: deliveryDate inválida.`);
    if (!isRecord(o.financials)) errors.push(`Pedido ${o.id}: financials inválidos.`);
    else {
      for (const k of [
        'materialCost',
        'laborCost',
        'totalCost',
        'profitMargin',
        'totalPrice',
        'advancePayment',
        'pendingBalance'
      ] as const) {
        if (
          !isFiniteNum((o.financials as Record<string, unknown>)[k]) ||
          ((o.financials as Record<string, unknown>)[k] as number) < 0
        ) {
          errors.push(`Pedido ${o.id}: financials.${k} inválido.`);
        }
      }
    }
  }

  for (const p of payments) {
    if (
      !isRecord(p) ||
      !isNonEmptyString(p.id) ||
      !isNonEmptyString(p.orderId) ||
      !isFiniteNum(p.amount) ||
      p.amount <= 0 ||
      !isDateOnly(p.date)
    ) {
      errors.push('Pago inválido en respaldo.');
      continue;
    }
    if (!orderIds.has(p.orderId)) errors.push(`Pago ${p.id}: orderId inexistente.`);
  }

  for (const h of orderStatusHistory) {
    if (
      !isRecord(h) ||
      !isNonEmptyString(h.id) ||
      !isNonEmptyString(h.orderId) ||
      !validStatuses.has(String(h.toStatus))
    ) {
      errors.push('Historial de estado inválido en respaldo.');
      continue;
    }
    if (!orderIds.has(h.orderId)) errors.push(`Historial ${h.id}: orderId inexistente.`);
  }

  const garmentTypeIds = new Set<string>();
  for (const g of data.garmentTypes) {
    if (!isRecord(g) || !isNonEmptyString(g.id) || !isNonEmptyString(g.name))
      errors.push('Tipo de prenda inválido en respaldo.');
    else garmentTypeIds.add(g.id);
  }
  const fabricIds = new Set<string>();
  for (const f of data.fabrics) {
    if (!isRecord(f) || !isNonEmptyString(f.id) || !isNonEmptyString(f.name))
      errors.push('Tela inválida en respaldo.');
    else fabricIds.add(f.id);
  }

  const inventoryIds = new Set<string>();
  for (const i of data.inventory) {
    if (!isRecord(i) || !isNonEmptyString(i.id) || !isNonEmptyString(i.name))
      errors.push('Insumo inválido en respaldo.');
    else inventoryIds.add(i.id);
  }
  // Validate order refs to catalogs/consumptions
  for (const o of data.orders) {
    if (!isRecord(o) || !isNonEmptyString(o.id)) continue;
    if (
      isNonEmptyString(o.garmentTypeId) &&
      garmentTypeIds.size > 0 &&
      !garmentTypeIds.has(o.garmentTypeId)
    ) {
      errors.push(`Pedido ${o.id}: garmentTypeId inexistente.`);
    }
    if (isNonEmptyString(o.fabricId) && fabricIds.size > 0 && !fabricIds.has(o.fabricId)) {
      errors.push(`Pedido ${o.id}: fabricId inexistente.`);
    }
    if (Array.isArray(o.consumptions)) {
      for (const c of o.consumptions) {
        if (
          !isRecord(c) ||
          !isNonEmptyString(c.inventoryItemId) ||
          !isFiniteNum(c.quantity) ||
          c.quantity < 0
        ) {
          errors.push(`Pedido ${o.id}: consumo inválido.`);
          continue;
        }
        if (!inventoryIds.has(c.inventoryItemId)) {
          errors.push(`Pedido ${o.id}: consumo referencia insumo inexistente.`);
        }
      }
    }
  }

  const paymentIds = new Set<string>();
  for (const p of payments) {
    if (!isRecord(p) || !isNonEmptyString(p.id)) continue;
    if (paymentIds.has(p.id)) errors.push(`ID de pago duplicado: ${p.id}`);
    paymentIds.add(p.id);
  }
  const historyIds = new Set<string>();
  for (const h of orderStatusHistory) {
    if (!isRecord(h) || !isNonEmptyString(h.id)) continue;
    if (historyIds.has(h.id)) errors.push(`ID de historial duplicado: ${h.id}`);
    historyIds.add(h.id);
  }

  for (const m of inventoryMovements) {
    if (
      !isRecord(m) ||
      !isNonEmptyString(m.id) ||
      !isNonEmptyString(m.inventoryItemId) ||
      !isFiniteNum(m.quantityChange) ||
      !isFiniteNum(m.stockAfter)
    ) {
      errors.push('Movimiento de inventario inválido en respaldo.');
      continue;
    }
    if (!inventoryIds.has(m.inventoryItemId))
      errors.push(`Movimiento ${m.id}: inventoryItemId inexistente.`);
  }

  if (errors.length > 0) {
    const preview = errors.slice(0, 5).join(' ');
    throw new Error(
      `Respaldo inválido: ${preview}${errors.length > 5 ? ` (+${errors.length - 5} más)` : ''}`
    );
  }

  return {
    payload: backupPayload,
    data: { ...data, payments, orderStatusHistory, inventoryMovements } as NormalizedBackupData
  };
};

export const getBackupSummary = (
  payload: BackupPayload,
  data: NormalizedBackupData
): BackupSummary => ({
  version: payload.version,
  exportedAt: payload.exportedAt,
  customers: data.customers.length,
  orders: data.orders.length,
  payments: data.payments.length,
  inventory: data.inventory.length,
  garmentTypes: data.garmentTypes.length,
  fabrics: data.fabrics.length
});

export const restoreBackupPayload = async (data: NormalizedBackupData): Promise<void> => {
  const { payments, orderStatusHistory, inventoryMovements } = data;
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

      await Promise.all([
        db.customers.bulkAdd(data.customers),
        db.orders.bulkAdd(data.orders),
        db.garmentTypes.bulkAdd(data.garmentTypes),
        db.fabrics.bulkAdd(data.fabrics),
        db.measurementDefinitions.bulkAdd(data.measurementDefinitions),
        db.appConfig.bulkPut(data.appConfig),
        db.inventory.bulkAdd(data.inventory),
        db.payments.bulkAdd(payments),
        db.orderStatusHistory.bulkAdd(orderStatusHistory),
        db.inventoryMovements.bulkAdd(inventoryMovements)
      ]);

      if (payments.length === 0) {
        const synthesized: Payment[] = data.orders
          .filter((order) => (order.financials?.advancePayment ?? 0) > 0)
          .map((order) => {
            const createdAt = order.updatedAt || order.createdAt || new Date().toISOString();
            const parsed = new Date(createdAt);
            const date = Number.isNaN(parsed.getTime())
              ? toDateOnly(new Date())
              : toDateOnly(parsed);
            return {
              id: crypto.randomUUID(),
              orderId: order.id,
              amount: Math.max(0, Number(order.financials?.advancePayment ?? 0)),
              date,
              note: 'Abono migrado desde respaldo',
              createdAt
            };
          });
        if (synthesized.length > 0) await db.payments.bulkAdd(synthesized);
      }
    }
  );
};

export const restoreBackup = async (file: File): Promise<void> => {
  const { data } = await readBackupPayload(file);
  await restoreBackupPayload(data);
};
