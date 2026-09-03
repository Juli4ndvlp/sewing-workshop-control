import React, { useEffect, useState } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  Package, 
  Users, 
  AlertCircle, 
  Clock, 
  Calendar, 
  CheckCircle2,
  ArrowUpRight 
} from 'lucide-react';
import { db } from '../../repositories/dexie/db';
import { Order } from '../../models/types';

export const DashboardPage: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [customersCount, setCustomersCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const loadDashboard = async () => {
      setLoading(true);
      try {
        const [allOrders, totalCustomers] = await Promise.all([
          db.orders.toArray(),
          db.customers.count()
        ]);
        setOrders(allOrders);
        setCustomersCount(totalCustomers);
      } catch (error) {
        console.error('Error al cargar datos del dashboard:', error);
      } finally {
        setLoading(false);
      }
    };
    loadDashboard();
  }, []);

  // Cálculos de KPIs Financieros
  const totalRevenue = orders.reduce((sum, o) => sum + (o.financials?.totalPrice || 0), 0);
  const totalCost = orders.reduce((sum, o) => sum + (o.financials?.totalCost || 0), 0);
  const totalProfit = totalRevenue - totalCost;
  const pendingCollection = orders.reduce((sum, o) => sum + (o.financials?.pendingBalance || 0), 0);

  // Filtrado de estados de producción
  const activeOrders = orders.filter(o => o.status !== 'delivered');
  const pendingOrders = orders.filter(o => o.status === 'pending');
  const inProgressOrders = orders.filter(o => o.status === 'in_progress');
  const readyOrders = orders.filter(o => o.status === 'ready');

  // Próximas entregas activas ordenadas por fecha más cercana
  const upcomingDeliveries = activeOrders
    .filter(o => o.deliveryDate)
    .sort((a, b) => new Date(a.deliveryDate).getTime() - new Date(b.deliveryDate).getTime())
    .slice(0, 5);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Métricas & Dashboard</h2>
        <p className="text-sm text-slate-500">Resumen operativo y rendimiento financiero de Edna Atelier.</p>
      </div>

      {/* Grid de Tarjetas KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Ingresos Totales */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Ingresos Totales</span>
            <div className="p-2 bg-slate-100 rounded-xl text-slate-700"><DollarSign size={16} /></div>
          </div>
          <div className="text-2xl font-bold text-slate-900">${totalRevenue.toLocaleString()}</div>
          <p className="text-xs text-slate-400 mt-1">Facturación proyectada</p>
        </div>

        {/* Ganancia Neta */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Ganancia Neta</span>
            <div className="p-2 bg-emerald-50 rounded-xl text-emerald-700"><TrendingUp size={16} /></div>
          </div>
          <div className="text-2xl font-bold text-emerald-700">${totalProfit.toLocaleString()}</div>
          <p className="text-xs text-emerald-600/80 mt-1">Rentabilidad acumulada</p>
        </div>

        {/* Por Cobrar */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Por Cobrar</span>
            <div className="p-2 bg-amber-50 rounded-xl text-amber-700"><AlertCircle size={16} /></div>
          </div>
          <div className="text-2xl font-bold text-amber-600">${pendingCollection.toLocaleString()}</div>
          <p className="text-xs text-amber-600/80 mt-1">Saldos pendientes</p>
        </div>

        {/* Pedidos En Curso */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Pedidos En Curso</span>
            <div className="p-2 bg-slate-100 rounded-xl text-slate-700"><Package size={16} /></div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{activeOrders.length}</div>
          <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
            <Users size={12} /> {customersCount} clientes registrados
          </p>
        </div>
      </div>

      {/* Grid Principal: Estado de Producción + Próximas Entregas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Barra de Progreso y Estado de la Producción */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Clock size={18} className="text-slate-500" /> Estado de Producción
            </h3>
            <span className="text-xs font-medium text-slate-400">{orders.length} pedidos</span>
          </div>

          <div className="space-y-4">
            {[
              { label: 'Pendientes', count: pendingOrders.length, color: 'bg-amber-500' },
              { label: 'En Confección', count: inProgressOrders.length, color: 'bg-blue-500' },
              { label: 'Listos para Entrega', count: readyOrders.length, color: 'bg-purple-500' },
              { label: 'Entregados', count: orders.filter(o => o.status === 'delivered').length, color: 'bg-emerald-500' }
            ].map((item) => {
              const percentage = orders.length > 0 ? (item.count / orders.length) * 100 : 0;
              return (
                <div key={item.label} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-slate-700">{item.label}</span>
                    <span className="text-slate-500">{item.count} ({percentage.toFixed(0)}%)</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${item.color} transition-all duration-300`} 
                      style={{ width: `${percentage}%` }} 
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Módulo de Próximas Entregas Urgentes */}
        <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Calendar size={18} className="text-slate-500" /> Entregas Próximas
            </h3>
            <span className="text-xs text-slate-400">Orden de urgencia</span>
          </div>

          {upcomingDeliveries.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">
              No hay pedidos activos con fecha de entrega programada.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {upcomingDeliveries.map((order) => {
                const deliveryDate = new Date(order.deliveryDate);
                const daysRemaining = Math.ceil(
                  (deliveryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                );
                const isUrgent = daysRemaining <= 3;

                return (
                  <div key={order.id} className="py-3 flex items-center justify-between first:pt-0 last:pb-0">
                    <div className="space-y-0.5">
                      <p className="text-sm font-semibold text-slate-800">
                        Prenda #{order.garmentTypeId.slice(0, 8)}
                      </p>
                      <p className="text-xs text-slate-400">
                        Cliente ID: {order.customerId?.slice(0, 8)} • Orden #{order.id?.slice(0, 6)}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Badge de Estado */}
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                        order.status === 'ready' 
                          ? 'bg-purple-50 text-purple-700 border border-purple-200' 
                          : order.status === 'in_progress'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {order.status === 'ready' ? 'Listo' : order.status === 'in_progress' ? 'En confección' : 'Pendiente'}
                      </span>

                      {/* Badge de Fecha */}
                      <div className={`text-xs font-medium px-2.5 py-1 rounded-lg flex items-center gap-1.5 ${
                        isUrgent 
                          ? 'bg-rose-50 text-rose-700 border border-rose-200' 
                          : 'bg-slate-50 text-slate-600 border border-slate-200'
                      }`}>
                        <Calendar size={13} />
                        {deliveryDate.toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};