// src/repositories/contracts/IConfigRepository.ts
import { AppConfig, GarmentType, Fabric, MeasurementDefinition } from '../../models/types';

export interface IConfigRepository {
  getConfig(): Promise<AppConfig>;
  updateConfig(config: Partial<AppConfig>): Promise<AppConfig>;
  
  getGarmentTypes(): Promise<GarmentType[]>;
  addGarmentType(name: string): Promise<GarmentType>;
  toggleGarmentType(id: string, active: boolean): Promise<void>;
  
  getFabrics(): Promise<Fabric[]>;
  addFabric(name: string): Promise<Fabric>;
  toggleFabric(id: string, active: boolean): Promise<void>;
  
  getMeasurementDefinitions(): Promise<MeasurementDefinition[]>;
  addMeasurementDefinition(key: string, label: string): Promise<MeasurementDefinition>;
  toggleMeasurementDefinition(id: string, active: boolean): Promise<void>;
}