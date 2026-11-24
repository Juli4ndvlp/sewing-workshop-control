// src/models/types.ts

export interface Customer {
  id: string;
  fullName: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  measurements?: Record<string, number>;
  createdAt: string;
}

export type OrderStatus = 'pending' | 'in_progress' | 'ready' | 'delivered' | 'cancelled';

export interface OrderFinancials {
  materialCost: number;
  laborCost: number;
  totalCost: number;
  profitMargin: number;
  totalPrice: number;
  advancePayment: number;
  pendingBalance: number;
}

export interface Payment {
  id: string;
  orderId: string;
  amount: number;
  date: string; // YYYY-MM-DD
  note?: string;
  createdAt: string;
}

export interface OrderStatusHistory {
  id: string;
  orderId: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  note?: string;
  createdAt: string;
}

export interface OrderConsumption {
  inventoryItemId: string;
  quantity: number;
}

export interface InventoryMovement {
  id: string;
  inventoryItemId: string;
  orderId?: string;
  type: 'manual' | 'order_deduct' | 'order_return' | 'adjustment';
  quantityChange: number; // signed: negative deducts, positive returns/adds
  stockAfter: number;
  note?: string;
  createdAt: string;
}

export interface Order {
  id: string;
  customerId: string;
  garmentTypeId: string;
  garmentType?: string;
  size?: 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL' | string;
  fabricId?: string;
  status: OrderStatus;
  deliveryDate: string;
  measurements: Record<string, number>;
  financials: OrderFinancials;
  consumptions?: OrderConsumption[];
  createdAt: string;
  description?: string;
  notes?: string;
  cancellationReason?: string;
  updatedAt?: string;
}

export interface GarmentType {
  id: string;
  name: string;
  active: boolean;
}

export interface Fabric {
  id: string;
  name: string;
  active: boolean;
}

export interface AppConfig {
  id: string;
  profitMargin: number;
  currency: string;
  defaultMeasurementUnit?: 'cm' | 'in';
  businessName?: string;
  logoDataUrl?: string;
}

export interface MeasurementDefinition {
  id: string;
  key: string;
  name: string;
  label?: string;
  category?: 'superior' | 'inferior' | 'general';
  active: boolean;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  stock: number;
  unit: string;
  unitCost: number;
  minStock?: number;
  quantity?: number;
  unitPrice?: number;
  updatedAt: string;
}
