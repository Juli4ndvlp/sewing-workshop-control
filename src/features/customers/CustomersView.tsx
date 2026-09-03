import React, { useState, useRef } from 'react';
import { Customer } from '../../models/types';
import { CustomerListPage } from './CustomerListPage';
import { CustomerFormModal } from './CustomerFormModal';

export const CustomersView: React.FC = () => {
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleOpenCreate = () => {
    setSelectedCustomer(null);
    setIsModalOpen(true);
  };

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedCustomer(null);
  };

  const handleSuccess = () => {
    // Forzar recarga de la lista tras crear o editar
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="w-full min-h-screen bg-slate-50">
      <CustomerListPage
        key={refreshKey}
        onOpenCreate={handleOpenCreate}
        onSelectCustomer={handleSelectCustomer}
      />

      <CustomerFormModal
        isOpen={isModalOpen}
        customer={selectedCustomer}
        onClose={handleCloseModal}
        onSuccess={handleSuccess}
      />
    </div>
  );
};