// src/repositories/contracts/IOrderRepository.ts
import { Order } from '../../models/types';

export interface IOrderRepository {
  getAll(): Promise<Order[]>;
  getById(id: string): Promise<Order | undefined>;
  create(order: Omit<Order, 'id' | 'createdAt'>): Promise<Order>;
  updateStatus(id: string, status: Order['status']): Promise<Order>;
  delete(id: string): Promise<boolean>;
}