// src/repositories/dexie/DexieOrderRepository.ts
import { db } from './db';
import { Order } from '../../models/types';
import { IOrderRepository } from '../contracts/IOrderRepository';

export class DexieOrderRepository implements IOrderRepository {
  async getAll(): Promise<Order[]> {
    return await db.orders.orderBy('createdAt').reverse().toArray();
  }

  async getById(id: string): Promise<Order | undefined> {
    return await db.orders.get(id);
  }

  async create(data: Omit<Order, 'id' | 'createdAt'>): Promise<Order> {
    const newOrder: Order = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString()
    };
    await db.orders.add(newOrder);
    return newOrder;
  }

  async updateStatus(id: string, status: Order['status']): Promise<Order> {
    await db.orders.update(id, { status });
    const updated = await this.getById(id);
    if (!updated) throw new Error('Pedido no encontrado');
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    await db.orders.delete(id);
    return true;
  }
}