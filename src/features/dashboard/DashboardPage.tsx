import React, { useEffect, useState } from 'react';
import { DollarSign, TrendingUp, Package, Users, AlertCircle, Clock, Calendar } from 'lucide-react';
import { db } from '../../repositories/dexie/db';
import { Customer, InventoryItem, Order } from '../../models/types';
import { daysUntil, formatDate, toDateOnly } from '../../utils/dates';
import { formatCurrency } from '../../utils/money';
import { DeliveryCalendar } from './DeliveryCalendar';
import { OrderDetailModal } from '../orders/OrderDetailModal';

interface DashboardPageProps {
  onNavigate?: (tab: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [deliveryFilter, setDeliveryFilter] = useState<
    'all' | 'overdue' | 'ready' | 'with_balance'
  >('all');

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const [allOrders, allCustomers, allInventory] = await Promise.all([
        db.orders.toArray(),
        db.customers.toArray(),
        db.inventory.toArray()
      ]);
      setOrders(allOrders);
      setCustomers(allCustomers);
      setInventory(allInventory);
    } catch (error) {
      console.error('Error al cargar datos del dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboard();
  }, []);

  // Los pedidos cancelados no representan ingresos, cartera ni trabajo en curso.
  const billableOrders = orders.filter((order) => order.status !== 'cancelled');
  const cancelledCount = orders.length - billableOrders.length;
  const costedOrders = billableOrders.filter((order) => (order.financials?.totalCost ?? 0) > 0);

  const totalRevenue = billableOrders.reduce(
    (sum, order) => sum + (order.financials?.totalPrice || 0),
    0
  );
  const totalProfit = costedOrders.reduce(
    (sum, order) =>
      sum + ((order.financials?.totalPrice || 0) - (order.financials?.totalCost || 0)),
    0
  );
  const pendingCollection = billableOrders.reduce(
    (sum, order) =>
      sum +
      Math.max(0, (order.financials?.totalPrice || 0) - (order.financials?.advancePayment || 0)),
    0
  );
  const uncostedCount = billableOrders.filter(
    (order) => (order.financials?.totalPrice ?? 0) > 0 && (order.financials?.totalCost ?? 0) === 0
  ).length;

  // Filtrado de estados de producción
  const activeOrders = orders.filter(
    (order) => order.status !== 'delivered' && order.status !== 'cancelled'
  );
  const pendingOrders = orders.filter((order) => order.status === 'pending');
  const inProgressOrders = orders.filter((order) => order.status === 'in_progress');
  const readyOrders = orders.filter((order) => order.status === 'ready');
  const deliveredOrders = orders.filter((order) => order.status === 'delivered');

  const customersById = Object.fromEntries(customers.map((customer) => [customer.id, customer]));

  const today = toDateOnly(new Date());
  // Próximas entregas activas ordenadas por fecha más cercana
  const upcomingDeliveries = activeOrders
    .filter((order) => order.deliveryDate)
    .sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate));
  const filteredUpcomingDeliveries = upcomingDeliveries
    .filter((order) => {
      if (deliveryFilter === 'overdue') return order.deliveryDate < today;
      if (deliveryFilter === 'ready') return order.status === 'ready';
      if (deliveryFilter === 'with_balance')
        return (
          Math.max(
            0,
            (order.financials?.totalPrice || 0) - (order.financials?.advancePayment || 0)
          ) > 0
        );
      return true;
    })
    .slice(0, 8);

  const overdueOrders = activeOrders.filter(
    (order) => order.deliveryDate && order.deliveryDate < today
  );
  const dueSoonOrders = activeOrders.filter((order) => {
    const days = daysUntil(order.deliveryDate);
    return days !== null && days >= 0 && days <= 3;
  });
  const lowStockItems = inventory.filter((item) => item.stock <= (item.minStock ?? 3));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6f2f3a]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#5f6b4d]">
          Resumen del taller
        </p>
        <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-stone-800">
          Métricas y Dashboard
        </h2>
        <p className="text-sm md:text-base text-stone-500 max-w-2xl">
          Rendimiento operativo y financiero de Edna Atelier, con una vista clara de lo que requiere
          atención.
        </p>
      </div>

      {(overdueOrders.length > 0 || dueSoonOrders.length > 0 || lowStockItems.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => onNavigate?.('orders')}
            className="text-left bg-[#6f2f3a]/12 backdrop-blur-xl border border-[#6f2f3a]/25 shadow-[0_8px_25px_rgba(111,47,58,0.1),inset_0_1px_1px_rgba(255,255,255,0.8)] rounded-2xl p-4 hover:bg-[#6f2f3a]/18 transition-all hover:-translate-y-0.5"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-[#6f2f3a]">
              Entregas vencidas
            </p>
            <p className="text-2xl font-bold text-[#582430] mt-1">{overdueOrders.length}</p>
            <p className="text-xs text-[#6f2f3a]/80 mt-1">Pedidos activos con fecha pasada</p>
          </button>
          <button
            type="button"
            onClick={() => onNavigate?.('orders')}
            className="text-left bg-[#a08a63]/14 backdrop-blur-xl border border-[#a08a63]/30 shadow-[0_8px_25px_rgba(160,138,99,0.1),inset_0_1px_1px_rgba(255,255,255,0.8)] rounded-2xl p-4 hover:bg-[#a08a63]/20 transition-all hover:-translate-y-0.5"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-[#7a6843]">
              Entregas próximas
            </p>
            <p className="text-2xl font-bold text-[#6b5a38] mt-1">{dueSoonOrders.length}</p>
            <p className="text-xs text-[#7a6843]/80 mt-1">Vencen en los próximos 3 días</p>
          </button>
          <button
            type="button"
            onClick={() => onNavigate?.('inventory')}
            className="text-left bg-[#5f6b4d]/14 backdrop-blur-xl border border-[#5f6b4d]/30 shadow-[0_8px_25px_rgba(95,107,77,0.1),inset_0_1px_1px_rgba(255,255,255,0.8)] rounded-2xl p-4 hover:bg-[#5f6b4d]/20 transition-all hover:-translate-y-0.5"
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-[#4c5640]">
              Stock bajo
            </p>
            <p className="text-2xl font-bold text-stone-800 mt-1">{lowStockItems.length}</p>
            <p className="text-xs text-[#5f6b4d] mt-1">Insumos en o bajo el mínimo</p>
          </button>
        </div>
      )}

      {/* Grid de Tarjetas KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Ingresos Totales */}
        <div className="glass-panel rounded-2xl p-6">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Ingresos Totales</span>
            <div className="p-2.5 bg-white/70 backdrop-blur-md border border-white/80 rounded-xl text-stone-700 shadow-sm">
              <DollarSign size={16} />
            </div>
          </div>
          <div className="text-2xl font-bold text-stone-800">{formatCurrency(totalRevenue)}</div>
          <p className="text-xs text-stone-400 mt-1">Facturación proyectada sin cancelados</p>
        </div>

        {/* Ganancia Neta */}
        <div className="glass-panel rounded-2xl p-6">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Ganancia Neta</span>
            <div className="p-2.5 bg-emerald-500/15 border border-emerald-500/25 rounded-xl text-emerald-800 shadow-sm">
              <TrendingUp size={16} />
            </div>
          </div>
          <div
            className={`text-2xl font-bold ${totalProfit < 0 ? 'text-[#6f2f3a]' : 'text-emerald-700'}`}
          >
            {formatCurrency(totalProfit)}
          </div>
          <p
            className={`text-xs mt-1 ${uncostedCount > 0 ? 'text-amber-600' : 'text-emerald-600/80'}`}
          >
            {uncostedCount > 0
              ? `${uncostedCount} pedido${uncostedCount === 1 ? '' : 's'} sin costear`
              : 'Rentabilidad de pedidos costeados'}
          </p>
        </div>

        {/* Por Cobrar */}
        <div className="glass-panel rounded-2xl p-6">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Por Cobrar</span>
            <div className="p-2.5 bg-amber-500/15 border border-amber-500/25 rounded-xl text-amber-800 shadow-sm">
              <AlertCircle size={16} />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-600">
            {formatCurrency(pendingCollection)}
          </div>
          <p className="text-xs text-amber-600/80 mt-1">Saldos pendientes</p>
        </div>

        {/* Pedidos En Curso */}
        <div className="glass-panel rounded-2xl p-6">
          <div className="flex items-center justify-between text-stone-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Pedidos En Curso</span>
            <div className="p-2.5 bg-[#6f2f3a]/12 border border-[#6f2f3a]/20 rounded-xl text-[#582430] shadow-sm">
              <Package size={16} />
            </div>
          </div>
          <div className="text-2xl font-bold text-stone-800">{activeOrders.length}</div>
          <p className="text-xs text-stone-400 mt-1 flex items-center gap-1">
            <Users size={12} /> {customers.length} clientes registrados
          </p>
        </div>
      </div>

      {/* Grid Principal: Estado de Producción + Próximas Entregas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        {/* Barra de Progreso y Estado de la Producción */}
        <div className="glass-panel rounded-2xl p-6 md:p-7 shadow-sm shadow-stone-900/5 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-stone-800 flex items-center gap-2">
              <Clock size={18} className="text-stone-500" /> Estado de Producción
            </h3>
            <span className="text-xs font-medium text-stone-400">
              {billableOrders.length} pedidos
            </span>
          </div>

          <div className="space-y-4">
            {[
              { label: 'Pendientes', count: pendingOrders.length, color: 'bg-amber-500' },
              { label: 'En Confección', count: inProgressOrders.length, color: 'bg-blue-500' },
              { label: 'Listos para Entrega', count: readyOrders.length, color: 'bg-purple-500' },
              { label: 'Entregados', count: deliveredOrders.length, color: 'bg-emerald-500' }
            ].map((item) => {
              const percentage =
                billableOrders.length > 0 ? (item.count / billableOrders.length) * 100 : 0;
              return (
                <div key={item.label} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-stone-700">{item.label}</span>
                    <span className="text-stone-500">
                      {item.count} ({percentage.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${item.color} transition-all duration-300`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {cancelledCount > 0 && (
            <p className="text-xs text-stone-400 border-t border-stone-100 pt-3">
              {cancelledCount} pedido{cancelledCount === 1 ? '' : 's'} cancelado
              {cancelledCount === 1 ? '' : 's'} excluido{cancelledCount === 1 ? '' : 's'} de las
              métricas.
            </p>
          )}
        </div>

        {/* Módulo de Próximas Entregas Urgentes */}
        <div className="lg:col-span-2 glass-panel rounded-2xl p-6 md:p-7 shadow-sm shadow-stone-900/5 space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-base font-semibold text-stone-800 flex items-center gap-2">
              <Calendar size={18} className="text-stone-500" /> Entregas Próximas
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ['all', 'Todas'],
                  ['overdue', 'Vencidas'],
                  ['ready', 'Listas'],
                  ['with_balance', 'Con saldo']
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setDeliveryFilter(key)}
                  className={`px-3 py-1.5 text-xs rounded-full border transition-all ${deliveryFilter === key ? 'bg-[#6f2f3a] text-[#fffaf5] border-[#6f2f3a] shadow-sm shadow-[#6f2f3a]/15' : 'bg-white/45 text-stone-600 border-white/65 hover:bg-white/70'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {filteredUpcomingDeliveries.length === 0 ? (
            <div className="text-center py-10 text-stone-400 text-sm">
              {deliveryFilter === 'all'
                ? 'No hay pedidos activos con fecha de entrega programada.'
                : 'No hay pedidos para este filtro.'}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredUpcomingDeliveries.map((order) => {
                const daysRemaining = daysUntil(order.deliveryDate);
                const isUrgent = daysRemaining !== null && daysRemaining <= 3;
                const customer = customersById[order.customerId];

                return (
                  <button
                    type="button"
                    key={order.id}
                    onClick={() => setSelectedOrder(order)}
                    className="w-full py-3 flex items-center justify-between first:pt-0 last:pb-0 text-left hover:bg-stone-50/60 -mx-2 px-2 rounded-lg transition-colors"
                  >
                    <div className="space-y-0.5">
                      <p className="text-sm font-semibold text-stone-800">
                        {order.garmentType || 'Prenda personalizada'}
                      </p>
                      <p className="text-xs text-stone-500">
                        {customer?.fullName ?? 'Cliente no encontrado'}
                        {customer?.phone ? ` • ${customer.phone}` : ''} • #{order.id.slice(0, 6)}
                      </p>
                      <p className="text-[11px] text-stone-400">
                        Saldo:{' '}
                        {formatCurrency(
                          Math.max(
                            0,
                            (order.financials?.totalPrice || 0) -
                              (order.financials?.advancePayment || 0)
                          )
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {/* Badge de Estado */}
                      <span
                        className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                          order.status === 'ready'
                            ? 'bg-[#5f6b4d]/12 text-[#4c5640] border border-[#5f6b4d]/25'
                            : order.status === 'in_progress'
                              ? 'bg-stone-200/50 text-stone-700 border border-stone-300/60'
                              : 'bg-[#a08a63]/12 text-[#7a6843] border border-[#a08a63]/25'
                        }`}
                      >
                        {order.status === 'ready'
                          ? 'Listo'
                          : order.status === 'in_progress'
                            ? 'En confección'
                            : 'Pendiente'}
                      </span>

                      {/* Badge de Fecha */}
                      <div
                        className={`text-xs font-medium px-2.5 py-1 rounded-lg flex items-center gap-1.5 ${
                          isUrgent
                            ? 'bg-[#6f2f3a]/10 text-[#6f2f3a] border border-[#6f2f3a]/20'
                            : 'bg-stone-50 text-stone-600 border border-stone-200'
                        }`}
                      >
                        <Calendar size={13} />
                        {formatDate(order.deliveryDate)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <DeliveryCalendar
        orders={activeOrders}
        customersById={customersById}
        onSelectOrder={setSelectedOrder}
      />

      <OrderDetailModal
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
        onOrderUpdated={(updated) => {
          setSelectedOrder(updated);
          void loadDashboard();
        }}
      />
    </div>
  );
};
