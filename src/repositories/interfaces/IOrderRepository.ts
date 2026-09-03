import { Order } from '../../models/types';

export interface IOrderRepository {
  getAll(): Promise<Order[]>;
  getById(id: string): Promise<Order | null>;
  getByCustomerId(customerId: string): Promise<Order[]>;
  create(order: Omit<Order, 'id' | 'createdAt' | 'updatedAt'>): Promise<Order>;
  update(id: string, order: Partial<Order>): Promise<Order>;
  delete(id: string): Promise<void>;
}