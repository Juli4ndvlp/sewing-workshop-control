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

export interface Order {
  id: string;
  customerId: string;
  garmentTypeId: string;
  garmentType?: string;
  size?: 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL' | string;
  fabricId?: string;
  status: OrderStatus;
  deliveryDate: string;
  dates?: {
    createdAt?: string;
    deliveryDate?: string;
  };
  measurements: Record<string, number>;
  financials: OrderFinancials;
  createdAt: string;
  description?: string;
  notes?: string;
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
  quantity?: number;
  unitPrice?: number;
  updatedAt: string;
}
