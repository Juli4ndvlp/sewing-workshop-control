import React, { useState, useEffect } from 'react';
import { Plus, Search, Eye, Printer, ShoppingBag, Download } from 'lucide-react';
import { db } from '../../repositories/dexie/db';
import { Customer, Order, OrderStatus } from '../../models/types';
import { formatDate } from '../../utils/dates';
import { calculatePendingBalance, formatCurrency } from '../../utils/money';
import { OrderDetailModal } from './OrderDetailModal';
import { OrderReceiptModal } from './OrderReceiptModal';
import { EmptyState } from '../../components/EmptyState';
import { useToast } from '../../components/ToastProvider';

interface OrdersPageProps {
  onOpenCreate: () => void;
}

export const OrdersPage: React.FC<OrdersPageProps> = ({ onOpenCreate }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Record<string, Customer>>({});
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'delivery_asc' | 'created_desc' | 'total_desc'>(
    'delivery_asc'
  );

  // Modales
  const [selectedOrderForDetails, setSelectedOrderForDetails] = useState<Order | null>(null);
  const [selectedOrderForReceipt, setSelectedOrderForReceipt] = useState<Order | null>(null);
  const { showToast } = useToast();

  const loadOrders = async () => {
    setLoading(true);
    try {
      const allOrders = await db.orders.toArray();
      const allCustomers = await db.customers.toArray();

      setOrders(allOrders);
      setCustomers(Object.fromEntries(allCustomers.map((customer) => [customer.id, customer])));

      // Refresca el pedido abierto para que el modal no trabaje con datos obsoletos.
      setSelectedOrderForDetails((current) =>
        current ? (allOrders.find((order) => order.id === current.id) ?? null) : null
      );
      setSelectedOrderForReceipt((current) =>
        current ? (allOrders.find((order) => order.id === current.id) ?? null) : null
      );
    } catch (error) {
      console.error('Error al cargar pedidos:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOrders();
  }, []);

  const handleOrderUpdated = (updated: Order) => {
    setSelectedOrderForDetails(updated);
    setSelectedOrderForReceipt((current) => (current?.id === updated.id ? updated : current));
    void loadOrders();
  };

  const filteredOrders = orders.filter((order) => {
    const matchesStatus = filterStatus === 'all' || order.status === filterStatus;
    const searchLower = searchTerm.trim().toLowerCase();
    if (!searchLower) return matchesStatus;

    const customer = customers[order.customerId];
    const matchesSearch =
      (order.garmentType ?? '').toLowerCase().includes(searchLower) ||
      (order.notes ?? '').toLowerCase().includes(searchLower) ||
      (order.description ?? '').toLowerCase().includes(searchLower) ||
      order.id.toLowerCase().includes(searchLower) ||
      (customer?.fullName ?? '').toLowerCase().includes(searchLower) ||
      (customer?.phone ?? '').toLowerCase().includes(searchLower);

    return matchesStatus && matchesSearch;
  });

  const exportCsv = () => {
    try {
      const rows = [['ID', 'Cliente', 'Prenda', 'Estado', 'Entrega', 'Total', 'Abonado', 'Saldo']];
      const statusLabels: Record<string, string> = {
        pending: 'Pendiente',
        in_progress: 'En confección',
        ready: 'Listo',
        delivered: 'Entregado',
        cancelled: 'Cancelado'
      };
      for (const o of sortedOrders) {
        const total = Math.max(0, o.financials?.totalPrice ?? 0);
        const adv = Math.max(0, o.financials?.advancePayment ?? 0);
        rows.push([
          o.id.slice(0, 8),
          customers[o.customerId]?.fullName ?? '',
          o.garmentType || '',
          statusLabels[o.status] ?? o.status,
          o.deliveryDate || '',
          String(total),
          String(adv),
          String(Math.max(0, total - adv))
        ]);
      }
      const csv = rows
        .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
        .join('\n');
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'pedidos.csv';
      a.click();
      URL.revokeObjectURL(url);
      showToast('CSV de pedidos exportado.', 'success');
    } catch (err) {
      console.error('Error exportando pedidos CSV:', err);
      showToast('No se pudo exportar el CSV de pedidos.', 'error');
    }
  };

  const sortedOrders = [...filteredOrders].sort((a, b) => {
    if (sortBy === 'delivery_asc') {
      if (!a.deliveryDate) return 1;
      if (!b.deliveryDate) return -1;
      return a.deliveryDate.localeCompare(b.deliveryDate);
    }
    if (sortBy === 'created_desc') {
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    }
    if (sortBy === 'total_desc') {
      return (b.financials?.totalPrice ?? 0) - (a.financials?.totalPrice ?? 0);
    }
    return 0;
  });

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'pending':
        return (
          <span className="glass-badge bg-[#a08a63]/15 text-[#6b5a38] border-[#a08a63]/30">
            Pendiente
          </span>
        );
      case 'in_progress':
        return (
          <span className="glass-badge bg-blue-500/12 text-blue-900 border-blue-300/40">
            En Confección
          </span>
        );
      case 'ready':
        return (
          <span className="glass-badge bg-[#5f6b4d]/15 text-[#3e4731] border-[#5f6b4d]/30">
            Listo
          </span>
        );
      case 'delivered':
        return (
          <span className="glass-badge bg-emerald-500/12 text-emerald-900 border-emerald-300/40">
            Entregado
          </span>
        );
      case 'cancelled':
        return (
          <span className="glass-badge bg-[#6f2f3a]/12 text-[#6f2f3a] border-[#6f2f3a]/25">
            Cancelado
          </span>
        );
      default:
        return <span className="glass-badge text-stone-600">{status}</span>;
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
            Encargos
          </p>
          <h1 className="text-3xl font-semibold text-stone-900">Gestión de Pedidos</h1>
          <p className="text-sm text-stone-500 mt-1">
            Administra confección, entregas y pagos del taller.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportCsv}
            className="glass-btn-secondary"
            aria-label="Exportar pedidos a CSV"
          >
            <Download size={16} /> CSV
          </button>
          <button onClick={onOpenCreate} className="glass-btn-primary">
            <Plus size={18} /> Nuevo pedido
          </button>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="bg-[#fffdf9]/90 p-4 rounded-2xl border border-stone-200/70 shadow-sm shadow-stone-900/5 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={16} />
            <input
              type="text"
              placeholder="Buscar por cliente, prenda, ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white/45 backdrop-blur-md border border-white/70 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300/45 focus:border-amber-300/70"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) =>
              setSortBy(e.target.value as 'delivery_asc' | 'created_desc' | 'total_desc')
            }
            className="text-xs font-medium border border-stone-200 rounded-xl px-2.5 py-2 bg-white text-stone-700 focus:outline-none"
            aria-label="Ordenar pedidos"
          >
            <option value="delivery_asc">Entrega más próxima</option>
            <option value="created_desc">Más recientes primero</option>
            <option value="total_desc">Mayor valor primero</option>
          </select>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {[
            { key: 'all', label: 'Todos' },
            { key: 'pending', label: 'Pendientes' },
            { key: 'in_progress', label: 'En Confección' },
            { key: 'ready', label: 'Listos' },
            { key: 'delivered', label: 'Entregados' },
            { key: 'cancelled', label: 'Cancelados' }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilterStatus(tab.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap ${
                filterStatus === tab.key
                  ? 'bg-stone-900 text-white shadow-sm'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla de Pedidos */}
      <div className="glass-panel rounded-2xl shadow-sm shadow-stone-900/5 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-stone-900"></div>
          </div>
        ) : sortedOrders.length === 0 ? (
          <div className="p-8 md:p-12">
            <EmptyState
              icon={ShoppingBag}
              title={
                searchTerm || filterStatus !== 'all'
                  ? 'Sin pedidos para este filtro'
                  : 'No hay pedidos registrados'
              }
              description={
                searchTerm || filterStatus !== 'all'
                  ? 'Prueba cambiando el término de búsqueda o seleccionando otro estado.'
                  : 'Comienza registrando el primer encargo de confección para tu taller.'
              }
              actionLabel={searchTerm || filterStatus !== 'all' ? undefined : 'Nuevo pedido'}
              onAction={searchTerm || filterStatus !== 'all' ? undefined : onOpenCreate}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-stone-100 bg-stone-50/50 text-xs font-semibold text-stone-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Pedido / Prenda</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4">Entrega</th>
                  <th className="py-3 px-4">Total</th>
                  <th className="py-3 px-4">Saldo Pendiente</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {sortedOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-stone-50/60 transition-colors">
                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-stone-800">
                        {order.garmentType || 'Prenda a medida'}
                      </p>
                      <p className="text-xs text-stone-400">
                        {customers[order.customerId]?.fullName ?? 'Cliente no encontrado'} • ID: #
                        {order.id.slice(0, 8)}
                      </p>
                    </td>
                    <td className="py-3.5 px-4">{getStatusBadge(order.status)}</td>
                    <td className="py-3.5 px-4 text-stone-600 text-xs">
                      {order.deliveryDate ? formatDate(order.deliveryDate) : 'No definida'}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-stone-900">
                      {formatCurrency(order.financials?.totalPrice ?? 0)}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-amber-600">
                      {formatCurrency(
                        calculatePendingBalance(
                          order.financials?.totalPrice ?? 0,
                          order.financials?.advancePayment ?? 0
                        )
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setSelectedOrderForDetails(order)}
                          title="Ver detalles / Registrar pago"
                          className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => setSelectedOrderForReceipt(order)}
                          title="Imprimir comprobante"
                          className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors"
                        >
                          <Printer size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modales vinculadas */}
      <OrderDetailModal
        order={selectedOrderForDetails}
        onClose={() => setSelectedOrderForDetails(null)}
        onOrderUpdated={handleOrderUpdated}
      />

      <OrderReceiptModal
        order={selectedOrderForReceipt}
        onClose={() => setSelectedOrderForReceipt(null)}
      />
    </div>
  );
};
