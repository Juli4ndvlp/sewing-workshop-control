import { db } from './db';
import { GarmentType, Fabric, MeasurementDefinition, AppConfig } from '../../models/types';

export const settingsRepository = {
  // App Config
  async getConfig(): Promise<AppConfig> {
    const config = await db.appConfig.get('default');
    if (!config) {
      const defaultConfig: AppConfig = { id: 'default', profitMargin: 30, currency: 'COP', logoDataUrl: '/edna-logo.svg' };
      await db.appConfig.add(defaultConfig);
      return defaultConfig;
    }
    return config;
  },

  async updateConfig(config: Partial<AppConfig>): Promise<void> {
    await db.appConfig.update('default', config);
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
    await db.garmentTypes.delete(id);
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
    await db.fabrics.delete(id);
  },

  // Measurement Definitions
  async getMeasurementDefinitions(): Promise<MeasurementDefinition[]> {
    return await db.measurementDefinitions.toArray();
  },

  async addMeasurementDefinition(key: string, name: string, category: MeasurementDefinition['category'] = 'general'): Promise<string> {
    const id = crypto.randomUUID();
    await db.measurementDefinitions.add({ id, key, name, category, active: true });
    return id;
  },

  async updateMeasurementDefinition(id: string, data: Partial<MeasurementDefinition>): Promise<void> {
    await db.measurementDefinitions.update(id, data);
  },

  async deleteMeasurementDefinition(id: string): Promise<void> {
    await db.measurementDefinitions.delete(id);
  }
};