import { db } from './db';
import { GarmentType, Fabric, MeasurementDefinition, AppConfig } from '../../models/types';

export const settingsRepository = {
  // App Config
  async getConfig(): Promise<AppConfig> {
    const config = await db.appConfig.get('default');
    if (!config) {
      const defaultConfig: AppConfig = {
        id: 'default',
        profitMargin: 30,
        currency: 'COP',
        defaultMeasurementUnit: 'cm',
        logoDataUrl: '/edna-logo.jpg'
      };
      await db.appConfig.add(defaultConfig);
      return defaultConfig;
    }
    if (!config.logoDataUrl || config.logoDataUrl.includes('edna-logo.svg')) {
      config.logoDataUrl = '/edna-logo.jpg';
      await db.appConfig.update('default', { logoDataUrl: '/edna-logo.jpg' });
    }
    return {
      defaultMeasurementUnit: 'cm',
      ...config
    };
  },

  async updateConfig(config: Partial<AppConfig>): Promise<void> {
    const existing = await db.appConfig.get('default');
    if (existing) {
      await db.appConfig.update('default', config);
    } else {
      const base: AppConfig = {
        id: 'default',
        profitMargin: 30,
        currency: 'COP',
        defaultMeasurementUnit: 'cm',
        logoDataUrl: '/edna-logo.jpg',
        ...config
      };
      await db.appConfig.put(base);
    }
  },

  // Garment Types
  async getGarmentTypes(): Promise<GarmentType[]> {
    return await db.garmentTypes.toArray();
  },

  async addGarmentType(name: string): Promise<string> {
    const id = crypto.randomUUID();
    await db.garmentTypes.add({ id, name, active: true });
    return id;
  },

  async deleteGarmentType(id: string): Promise<void> {
    await db.transaction('rw', [db.garmentTypes, db.orders], async () => {
      const orderCount = await db.orders.where('garmentTypeId').equals(id).count();
      if (orderCount > 0) {
        throw new Error(`No se puede eliminar: la prenda está asociada a ${orderCount} pedido(s).`);
      }
      await db.garmentTypes.delete(id);
    });
  },

  async updateGarmentType(id: string, data: Partial<GarmentType>): Promise<void> {
    await db.garmentTypes.update(id, data);
  },

  // Fabrics
  async getFabrics(): Promise<Fabric[]> {
    return await db.fabrics.toArray();
  },

  async addFabric(name: string): Promise<string> {
    const id = crypto.randomUUID();
    await db.fabrics.add({ id, name, active: true });
    return id;
  },

  async deleteFabric(id: string): Promise<void> {
    await db.transaction('rw', [db.fabrics, db.orders], async () => {
      const orderCount = await db.orders.where('fabricId').equals(id).count();
      if (orderCount > 0) {
        throw new Error(`No se puede eliminar: la tela está asociada a ${orderCount} pedido(s).`);
      }
      await db.fabrics.delete(id);
    });
  },

  async updateFabric(id: string, data: Partial<Fabric>): Promise<void> {
    await db.fabrics.update(id, data);
  },

  // Measurement Definitions
  async getMeasurementDefinitions(): Promise<MeasurementDefinition[]> {
    return await db.measurementDefinitions.toArray();
  },

  async addMeasurementDefinition(
    key: string,
    name: string,
    category: MeasurementDefinition['category'] = 'general'
  ): Promise<string> {
    const id = crypto.randomUUID();
    await db.measurementDefinitions.add({ id, key, name, category, active: true });
    return id;
  },

  async updateMeasurementDefinition(
    id: string,
    data: Partial<MeasurementDefinition>
  ): Promise<void> {
    await db.measurementDefinitions.update(id, data);
  },

  async deleteMeasurementDefinition(id: string): Promise<void> {
    await db.transaction('rw', [db.measurementDefinitions, db.orders], async () => {
      const def = await db.measurementDefinitions.get(id);
      if (!def) return;
      const orders = await db.orders.toArray();
      const used = orders.some((o) => o.measurements && def.key in o.measurements);
      if (used) {
        throw new Error('No se puede eliminar: la medida está en uso en pedidos existentes.');
      }
      await db.measurementDefinitions.delete(id);
    });
  }
};
