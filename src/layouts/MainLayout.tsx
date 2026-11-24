import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { LayoutDashboard, ShoppingBag, Users, Settings, Package, BarChart3 } from 'lucide-react';

interface MainLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  businessName?: string;
  logoDataUrl?: string;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  activeTab,
  onTabChange,
  businessName = 'Edna Atelier',
  logoDataUrl
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Inicio', icon: LayoutDashboard },
    { id: 'orders', label: 'Pedidos', icon: ShoppingBag },
    { id: 'clients', label: 'Clientes', icon: Users },
    { id: 'inventory', label: 'Inventario', icon: Package },
    { id: 'reports', label: 'Reportes', icon: BarChart3 },
    { id: 'settings', label: 'Ajustes', icon: Settings }
  ];

  const containerRef = useRef<HTMLDivElement | null>(null);
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [indicator, setIndicator] = useState({ left: 0, width: 0, opacity: 0 });
  const [isOnline, setIsOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine
  );

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  useLayoutEffect(() => {
    const update = () => {
      const container = containerRef.current;
      const btn = btnRefs.current[activeTab];
      if (!container || !btn) return;
      const c = container.getBoundingClientRect();
      const b = btn.getBoundingClientRect();
      setIndicator({ left: b.left - c.left, width: b.width, opacity: 1 });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [activeTab]);

  return (
    <div className="min-h-screen text-stone-800 antialiased relative">
      <div className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        {/* Orbe superior burdeos profundo */}
        <div className="absolute -top-32 left-1/4 h-[32rem] w-[40rem] -translate-x-1/2 rounded-full bg-gradient-to-br from-[#6f2f3a]/35 via-[#582430]/25 to-transparent blur-3xl" />
        {/* Orbe dorado cálido superior derecho */}
        <div className="absolute -top-16 right-[-5%] h-[28rem] w-[34rem] rounded-full bg-gradient-to-bl from-[#c5a059]/35 via-[#a08a63]/25 to-transparent blur-3xl" />
        {/* Orbe verde olivo/salvia intermedio izquierdo */}
        <div className="absolute top-[35%] -left-24 h-[30rem] w-[30rem] rounded-full bg-gradient-to-tr from-[#5f6b4d]/25 to-transparent blur-3xl" />
        {/* Orbe burdeos / rosa champagne intermedio derecho */}
        <div className="absolute top-[50%] -right-20 h-[32rem] w-[32rem] rounded-full bg-gradient-to-tl from-[#6f2f3a]/28 via-[#9e4354]/18 to-transparent blur-3xl" />
        {/* Orbe oro suave inferior */}
        <div className="absolute -bottom-28 left-1/3 h-[32rem] w-[38rem] -translate-x-1/2 rounded-full bg-gradient-to-t from-[#c5a059]/30 to-transparent blur-3xl" />
      </div>

      <header className="sticky top-0 z-30 px-4 md:px-8 pt-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between rounded-2xl border border-white/80 bg-white/60 backdrop-blur-2xl shadow-[0_12px_40px_rgba(35,18,24,0.08),inset_0_1.5px_1px_rgba(255,255,255,0.95)] px-4 md:px-6 py-3.5">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="h-11 sm:h-12 w-auto max-w-[160px] sm:max-w-[180px] rounded-xl overflow-hidden ring-1 ring-black/15 shadow-md shadow-[#45131e]/20 bg-[#45131e] flex items-center justify-center p-0.5 flex-shrink-0">
              <img
                src={logoDataUrl || '/edna-logo.jpg'}
                alt={businessName}
                className="h-full w-auto object-contain rounded-lg"
                onError={(e) => {
                  const target = e.currentTarget;
                  target.src = '/edna-logo.jpg';
                }}
              />
            </div>
            <div className="min-w-0">
              <p className="font-display text-lg md:text-xl leading-none font-semibold text-stone-800 truncate">
                {businessName}
              </p>
              <p className="text-[11px] uppercase tracking-[0.2em] text-stone-500 mt-1.5">
                Atelier de confección
              </p>
            </div>
          </div>
          <div
            className="hidden sm:flex items-center gap-2 text-xs text-stone-500"
            aria-live="polite"
          >
            <span
              className={`inline-flex h-2 w-2 rounded-full ${isOnline ? 'bg-[#5f6b4d]' : 'bg-[#a08a63]'}`}
            />
            {isOnline ? 'Local' : 'Sin conexión'}
          </div>
        </div>
      </header>

      <main className="relative z-10 px-4 md:px-8 lg:px-10 pt-8 md:pt-10 pb-[calc(7.5rem+env(safe-area-inset-bottom))] md:pb-36 max-w-7xl mx-auto w-full">
        {children}
      </main>

      <nav
        className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-40 w-[calc(100%-1.5rem)] max-w-fit"
        aria-label="Navegación principal"
      >
        <div
          ref={containerRef}
          className="relative flex items-center gap-1 md:gap-1.5 p-1.5 md:p-2 rounded-2xl border border-white/80 bg-white/60 backdrop-blur-3xl shadow-[0_20px_50px_rgba(35,18,24,0.16),inset_0_1.5px_1px_rgba(255,255,255,0.95)]"
        >
          <span
            className="absolute top-1.5 bottom-1.5 md:top-2 md:bottom-2 rounded-xl bg-[#6f2f3a]/92 shadow-lg shadow-[#6f2f3a]/20 transition-all duration-300 ease-out"
            style={{ left: indicator.left, width: indicator.width, opacity: indicator.opacity }}
            aria-hidden="true"
          />
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                ref={(el) => {
                  btnRefs.current[item.id] = el;
                }}
                type="button"
                onClick={() => onTabChange(item.id)}
                className={`group relative z-10 flex items-center gap-2 px-3.5 md:px-4 py-2.5 rounded-xl text-sm font-medium transition-colors duration-300 ${
                  isActive ? 'text-[#fffaf5]' : 'text-stone-600 hover:text-stone-800'
                }`}
                aria-current={isActive ? 'page' : undefined}
                title={item.label}
              >
                <Icon
                  size={18}
                  className={
                    isActive ? 'text-[#fffaf5]' : 'text-stone-500 group-hover:text-stone-800'
                  }
                />
                <span className={`${isActive ? 'inline' : 'hidden md:inline'}`}>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
