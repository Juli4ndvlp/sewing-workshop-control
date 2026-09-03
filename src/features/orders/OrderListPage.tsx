import React, { useState, useEffect } from 'react';
import { Order, Customer } from '../../models/types';
import { DexieOrderRepository } from '../../repositories/dexie/DexieOrderRepository';
import { DexieCustomerRepository } from '../../repositories/dexie/DexieCustomerRepository';
import { OrderDetailModal } from './OrderDetailModal';
import { OrderReceiptModal } from './OrderReceiptModal';
import { Plus, Clock, CheckCircle2, AlertCircle, Trash2, Calendar, User, Eye, Printer } from 'lucide-react';

const orderRepo = new DexieOrderRepository();
const customerRepo = new DexieCustomerRepository();

interface Props {
  onOpenCreate: () => void;
}

export const OrderListPage: React.FC<Props> = ({ onOpenCreate }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Record<string, Customer>>({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrderForDetails, setSelectedOrderForDetails] = useState<Order | null>(null);
  const [selectedOrderForReceipt, setSelectedOrderForReceipt] = useState<Order | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [fetchedOrders, fetchedCustomers] = await Promise.all([
        orderRepo.getAll(),
        customerRepo.getAll()
      ]);

      const customerMap = fetchedCustomers.reduce((acc, c) => {
        acc[c.id] = c;
        return acc;
      }, {} as Record<string, Customer>);

      setOrders(fetchedOrders);
      setCustomers(customerMap);
    } catch (err) {
      console.error('Error al cargar pedidos:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleStatusChange = async (id: string, newStatus: Order['status']) => {
    try {
      await orderRepo.updateStatus(id, newStatus);
      loadData();
    } catch (err) {
      console.error('Error al actualizar estado:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Estás seguro de eliminar este pedido?')) {
      await orderRepo.delete(id);
      loadData();
    }
  };

  const filteredOrders = statusFilter === 'all' 
    ? orders 
    : orders.filter(o => o.status === statusFilter);

  const getStatusBadge = (status: Order['status']) => {
    switch (status) {
      case 'pending':
        return <span className="inline-flex items-center gap-1 text-xs font-medium bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full border border-amber-200"><Clock className="w-3 h-3"/> Pendiente</span>;
      case 'in_progress':
        return <span className="inline-flex items-center gap-1 text-xs font-medium bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full border border-blue-200"><AlertCircle className="w-3 h-3"/> En Proceso</span>;
      case 'ready':
        return <span className="inline-flex items-center gap-1 text-xs font-medium bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full border border-emerald-200"><CheckCircle2 className="w-3 h-3"/> Completado</span>;
      case 'delivered':
        return <span className="inline-flex items-center gap-1 text-xs font-medium bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full border border-slate-200">Entregado</span>;
      default:
        return null;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gestión de Pedidos</h1>
          <p className="text-sm text-slate-500">Control de prendas en taller y entregas</p>
        </div>
        <button
          onClick={onOpenCreate}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Nuevo Pedido
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {['all', 'pending', 'in_progress', 'ready', 'delivered'].map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              statusFilter === st
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {st === 'all' ? 'Todos' : st === 'pending' ? 'Pendientes' : st === 'in_progress' ? 'En Proceso' : st === 'ready' ? 'Listos' : 'Entregados'}
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="text-center py-12 text-slate-400 text-sm">Cargando pedidos...</div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-12 bg-white border border-dashed border-slate-200 rounded-xl">
          <p className="text-sm font-medium text-slate-600">No hay pedidos registrados</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOrders.map((o) => {
            const customer = customers[o.customerId];
            return (
              <div key={o.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    {getStatusBadge(o.status)}
                    <button onClick={() => handleDelete(o.id)} className="text-slate-300 hover:text-rose-600 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                      <User className="w-3.5 h-3.5" />
                      <span className="font-medium text-slate-700">{customer?.fullName || 'Cliente no encontrado'}</span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900">Prenda #{o.garmentTypeId.slice(0, 8)}</h3>
                  </div>

                  {o.deliveryDate && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Entrega: {new Date(o.deliveryDate).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400">Cambiar estado:</span>
                  <select
                    value={o.status}
                    onChange={(e) => handleStatusChange(o.id, e.target.value as Order['status'])}
                    className="text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 focus:outline-none"
                  >
                    <option value="pending">Pendiente</option>
                    <option value="in_progress">En Proceso</option>
                    <option value="ready">Listo para entrega</option>
                    <option value="delivered">Entregado</option>
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};