import Dexie from 'dexie';
import { 
  Customer, 
  Order, 
  GarmentType, 
  Fabric, 
  MeasurementDefinition, 
  AppConfig,
  InventoryItem
} from '../../models/types';

export class EdnaAtelierDB extends Dexie {
  customers!: Dexie.Table<Customer, string>;
  orders!: Dexie.Table<Order, string>;
  garmentTypes!: Dexie.Table<GarmentType, string>;
  fabrics!: Dexie.Table<Fabric, string>;
  measurementDefinitions!: Dexie.Table<MeasurementDefinition, string>;
  appConfig!: Dexie.Table<AppConfig, string>;
  inventory!: Dexie.Table<InventoryItem, string>;

  constructor() {
    super('EdnaAtelierDB');

    (this as Dexie).version(1).stores({
      customers: 'id, fullName, phone, createdAt',
      orders: 'id, customerId, garmentTypeId, status, deliveryDate, createdAt',
      garmentTypes: 'id, name, active',
      fabrics: 'id, name, active',
      measurementDefinitions: 'id, key, active',
      appConfig: 'id'
    });
      (this as Dexie).version(2).stores({
        customers: 'id, fullName, phone, createdAt',
        orders: 'id, customerId, garmentTypeId, status, deliveryDate, createdAt',
        garmentTypes: 'id, name, active',
        fabrics: 'id, name, active',
        measurementDefinitions: 'id, key, active',
        appConfig: 'id',
        inventory: 'id, name, category, updatedAt'
      });
  }
}

export const db = new EdnaAtelierDB();