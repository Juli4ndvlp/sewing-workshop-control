import React, { Suspense, lazy, useEffect, useState } from 'react';
import { MainLayout } from './layouts/MainLayout';
import { NewOrderStepper } from './features/orders/NewOrderStepper';

const DashboardPage = lazy(() =>
  import('./features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage }))
);
const ClientsPage = lazy(() =>
  import('./features/clients/ClientsPage').then((m) => ({ default: m.ClientsPage }))
);
const OrdersPage = lazy(() =>
  import('./features/orders/OrdersPage').then((m) => ({ default: m.OrdersPage }))
);
const SettingsPage = lazy(() =>
  import('./features/settings/SettingsView').then((m) => ({ default: m.SettingsView }))
);
const InventoryPage = lazy(() =>
  import('./features/inventory/InventoryPage').then((m) => ({ default: m.InventoryPage }))
);
const ReportsPage = lazy(() =>
  import('./features/reports/ReportsPage').then((m) => ({ default: m.ReportsPage }))
);
import { settingsRepository } from './repositories/dexie/settingsRepository';
import { AppConfig } from './models/types';

const DEFAULT_CONFIG: Pick<AppConfig, 'businessName' | 'logoDataUrl'> = {
  businessName: 'Edna Atelier',
  logoDataUrl: '/edna-logo.jpg'
};

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [config, setConfig] = useState(DEFAULT_CONFIG);

  const loadConfig = async () => {
    try {
      const loaded = await settingsRepository.getConfig();
      const resolvedLogo =
        !loaded.logoDataUrl || loaded.logoDataUrl.includes('edna-logo.svg')
          ? '/edna-logo.jpg'
          : loaded.logoDataUrl;
      setConfig({
        businessName: loaded.businessName || 'Edna Atelier',
        logoDataUrl: resolvedLogo
      });
    } catch (error) {
      console.error('Error al cargar configuración:', error);
    }
  };

  useEffect(() => {
    void loadConfig();
  }, []);

  useEffect(() => {
    if (activeTab === 'settings') {
      void loadConfig();
    }
  }, [activeTab, reloadKey]);

  const handleOrderSuccess = () => {
    setReloadKey((prev) => prev + 1);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardPage key={reloadKey} onNavigate={setActiveTab} />;
      case 'orders':
        return <OrdersPage key={reloadKey} onOpenCreate={() => setIsOrderModalOpen(true)} />;
      case 'clients':
        return <ClientsPage />;
      case 'inventory':
        return <InventoryPage />;
      case 'reports':
        return <ReportsPage key={reloadKey} />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <DashboardPage key={reloadKey} onNavigate={setActiveTab} />;
    }
  };

  return (
    <MainLayout
      activeTab={activeTab}
      onTabChange={(tab) => {
        setActiveTab(tab);
        if (
          tab === 'dashboard' ||
          tab === 'orders' ||
          tab === 'inventory' ||
          tab === 'clients' ||
          tab === 'reports'
        ) {
          setReloadKey((k) => k + 1);
        }
      }}
      businessName={config.businessName}
      logoDataUrl={config.logoDataUrl}
    >
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-[300px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6f2f3a]"></div>
          </div>
        }
      >
        <div key={activeTab} className="page-enter">
          {renderContent()}
        </div>
      </Suspense>

      <NewOrderStepper
        isOpen={isOrderModalOpen}
        onClose={() => setIsOrderModalOpen(false)}
        onSuccess={handleOrderSuccess}
      />
    </MainLayout>
  );
};

export default App;
