import React, { useState } from "react";
import {
  LayoutDashboard,
  ShoppingBag,
  Users,
  Scissors,
  Settings,
  Package,
  Menu,
  X,
} from "lucide-react";

interface MainLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  businessName?: string;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  activeTab,
  onTabChange,
  businessName = "Edna Atelier",
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "orders", label: "Pedidos", icon: ShoppingBag },
    { id: "clients", label: "Clientes", icon: Users },
    { id: "inventory", label: "Inventario", icon: Package },
    { id: "production", label: "Producción", icon: Scissors },
    { id: "settings", label: "Configuración", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col md:flex-row antialiased">
      {/* Mobile Header */}
      <header className="md:hidden bg-white/80 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30 px-4 py-3 flex items-center justify-between">
        <span className="font-semibold text-lg tracking-tight text-slate-900">
          {businessName}
        </span>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
        >
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {/* Sidebar Navigation */}
      <aside
        className={`
        fixed inset-y-0 left-0 z-40 w-64 bg-white/90 backdrop-blur-xl border-r border-slate-200/80 p-6 flex flex-col justify-between
        transform transition-transform duration-200 ease-in-out md:translate-x-0 md:static md:z-auto
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
      `}
      >
        <div>
          {/* Brand Logo / Title */}
          <div className="hidden md:flex items-center space-x-3 mb-8 px-2">
            <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center text-white font-serif font-bold text-sm">
              E
            </div>
            <h1 className="font-semibold text-lg tracking-tight text-slate-900">
              {businessName}
            </h1>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onTabChange(item.id);
                    setSidebarOpen(false);
                  }}
                  className={`
                    w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150
                    ${
                      isActive
                        ? "bg-slate-900 text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
                    }
                  `}
                >
                  <Icon
                    size={18}
                    className={isActive ? "text-white" : "text-slate-400"}
                  />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer info */}
        <div className="px-2 pt-4 border-t border-slate-100">
          <p className="text-xs text-slate-400 font-medium">
            Edna Atelier v1.0.0
          </p>
          <p className="text-[10px] text-slate-400">
            Almacenamiento Local Activo
          </p>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
};
