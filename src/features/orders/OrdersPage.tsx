import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, Scissors, Eye, Printer, Calendar, DollarSign } from 'lucide-react';
import { db } from '../../repositories/dexie/db';
import { Order, OrderStatus } from '../../models/types';
import { OrderDetailModal } from './OrderDetailModal';
import { OrderReceiptModal } from './OrderReceiptModal';

interface OrdersPageProps {
  onOpenCreate: () => void;
  key?: number;
}

export const OrdersPage: React.FC<OrdersPageProps> = ({ onOpenCreate }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Modales
  const [selectedOrderForDetails, setSelectedOrderForDetails] = useState<Order | null>(null);
  const [selectedOrderForReceipt, setSelectedOrderForReceipt] = useState<Order | null>(null);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const allOrders = await db.orders.toArray();
      // Ordenar por fecha de creación o entrega más reciente
      setOrders(allOrders);
    } catch (error) {
      console.error('Error al cargar pedidos:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const filteredOrders = orders.filter(order => {
    const matchesStatus = filterStatus === 'all' || order.status === filterStatus;
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      (order.garmentType && order.garmentType.toLowerCase().includes(searchLower)) ||
      (order.notes && order.notes.toLowerCase().includes(searchLower)) ||
      (order.id && order.id.toLowerCase().includes(searchLower));
    return matchesStatus && matchesSearch;
  });

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'pending':
        return <span className="px-2.5 py-1 text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 rounded-full">Pendiente</span>;
      case 'in_progress':
        return <span className="px-2.5 py-1 text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 rounded-full">En Confección</span>;
      case 'ready':
        return <span className="px-2.5 py-1 text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200 rounded-full">Listo</span>;
      case 'delivered':
        return <span className="px-2.5 py-1 text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">Entregado</span>;
      case 'cancelled':
        return <span className="px-2.5 py-1 text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200 rounded-full">Cancelado</span>;
      default:
        return <span className="px-2.5 py-1 text-xs font-medium bg-slate-100 text-slate-600 rounded-full">{status}</span>;
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gestión de Pedidos</h1>
          <p className="text-sm text-slate-500">Administra los encargos, estados de confección y pagos del taller.</p>
        </div>
        <button
          onClick={onOpenCreate}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-xl shadow-sm transition-colors"
        >
          <Plus size={18} />
          Nuevo Pedido
        </button>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Buscar por prenda, ID o notas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {[
            { key: 'all', label: 'Todos' },
            { key: 'pending', label: 'Pendientes' },
            { key: 'in_progress', label: 'En Confección' },
            { key: 'ready', label: 'Listos' },
            { key: 'delivered', label: 'Entregados' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilterStatus(tab.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap ${
                filterStatus === tab.key
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla de Pedidos */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900"></div>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-sm">
            No se encontraron pedidos registrados con los filtros seleccionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-4">Pedido / Prenda</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4">Entrega</th>
                  <th className="py-3 px-4">Total</th>
                  <th className="py-3 px-4">Saldo Pendiente</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredOrders.map(order => (
                  <tr key={order.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-slate-800">{order.garmentType || 'Prenda a medida'}</p>
                      <p className="text-xs text-slate-400">ID: #{order.id?.slice(0, 8)}</p>
                    </td>
                    <td className="py-3.5 px-4">
                      {getStatusBadge(order.status)}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 text-xs">
                      {order.dates?.deliveryDate ? new Date(order.dates.deliveryDate).toLocaleDateString() : 'No definida'}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      ${order.financials?.totalPrice?.toLocaleString() || 0}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-amber-600">
                      ${order.financials?.pendingBalance?.toLocaleString() || 0}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setSelectedOrderForDetails(order)}
                          title="Ver detalles / Registrar pago"
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => setSelectedOrderForReceipt(order)}
                          title="Imprimir comprobante"
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
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
        onOrderUpdated={() => {
          loadOrders();
        }}
      />

      <OrderReceiptModal
        order={selectedOrderForReceipt}
        onClose={() => setSelectedOrderForReceipt(null)}
      />
    </div>
  );
};