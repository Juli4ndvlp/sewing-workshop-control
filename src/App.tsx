import React, { useState } from 'react';
import { MainLayout } from './layouts/MainLayout';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { ClientsPage } from './features/clients/ClientsPage';
import { OrdersPage } from './features/orders/OrdersPage';
import { OrderFormModal } from './features/orders/OrderFormModal';
import { SettingsView as SettingsPage } from './features/settings/SettingsView';
import { InventoryPage } from './features/inventory/InventoryPage';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  // Estado para el modal de nuevo pedido y recarga
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const handleOrderSuccess = () => {
    setReloadKey(prev => prev + 1);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardPage />;
      case 'orders':
        return (
          <OrdersPage
            key={reloadKey}
            onOpenCreate={() => setIsOrderModalOpen(true)}
          />
        );
      case 'clients':
        return <ClientsPage />;
      case 'settings':
        return <SettingsPage />;
      case 'inventory':
        return <InventoryPage />;
      default:
        return <DashboardPage />;
    }
  };

  return (
    <MainLayout 
      activeTab={activeTab} 
      onTabChange={setActiveTab}
      businessName="Edna Atelier"
    >
      {renderContent()}

      {/* Modal global de pedidos */}
      <OrderFormModal
        isOpen={isOrderModalOpen}
        onClose={() => setIsOrderModalOpen(false)}
        onSuccess={handleOrderSuccess}
      />
    </MainLayout>
  );
};

export default App;