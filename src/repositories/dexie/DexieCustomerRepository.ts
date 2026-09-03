// src/repositories/dexie/DexieCustomerRepository.ts
import { db } from './db';
import { Customer } from '../../models/types';
import { ICustomerRepository } from '../contracts/ICustomerRepository';

export class DexieCustomerRepository implements ICustomerRepository {
  async getAll(): Promise<Customer[]> {
    return await db.customers.orderBy('createdAt').reverse().toArray();
  }

  async getById(id: string): Promise<Customer | undefined> {
    return await db.customers.get(id);
  }

  async search(query: string): Promise<Customer[]> {
    const q = query.toLowerCase().trim();
    if (!q) return this.getAll();
    return await db.customers
      .filter((c: Customer) => c.fullName.toLowerCase().includes(q) || (c.phone ?? '').includes(q))
      .toArray();
  }

  async create(data: Omit<Customer, 'id' | 'createdAt'>): Promise<Customer> {
    const newCustomer: Customer = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString()
    };
    await db.customers.add(newCustomer);
    return newCustomer;
  }

  async update(id: string, data: Partial<Customer>): Promise<Customer> {
    await db.customers.update(id, data);
    const updated = await this.getById(id);
    if (!updated) throw new Error('Cliente no encontrado');
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    await db.customers.delete(id);
    return true;
  }
}