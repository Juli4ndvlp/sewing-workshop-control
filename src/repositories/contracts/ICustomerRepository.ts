// src/repositories/contracts/ICustomerRepository.ts
import { Customer } from '../../models/types';

export interface ICustomerRepository {
  getAll(): Promise<Customer[]>;
  getById(id: string): Promise<Customer | undefined>;
  search(query: string): Promise<Customer[]>;
  create(customer: Omit<Customer, 'id' | 'createdAt'>): Promise<Customer>;
  update(id: string, customer: Partial<Customer>): Promise<Customer>;
  delete(id: string): Promise<boolean>;
}