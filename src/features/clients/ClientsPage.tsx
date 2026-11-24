import React, { useState, useEffect } from 'react';
import {
  Search,
  UserPlus,
  Phone,
  Mail,
  FileText,
  Edit2,
  Trash2,
  Ruler,
  History,
  X
} from 'lucide-react';
import { Customer, MeasurementDefinition, Order } from '../../models/types';
import { formatDate } from '../../utils/dates';
import { calculatePendingBalance, formatCurrency } from '../../utils/money';
import { db } from '../../repositories/dexie/db';
import { customerRepository } from '../../repositories/dexie/customerRepository';
import { useDialogA11y } from '../../hooks/useDialogA11y';
import { useToast } from '../../components/ToastProvider';
import { EmptyState } from '../../components/EmptyState';

export const ClientsPage: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  // Form State
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [measurementDefs, setMeasurementDefs] = useState<MeasurementDefinition[]>([]);
  const [measurements, setMeasurements] = useState<Record<string, number>>({});
  const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const { showToast } = useToast();

  const modalRef = useDialogA11y(isModalOpen, () => {
    if (!isSaving) setIsModalOpen(false);
  });
  const historyRef = useDialogA11y(!!historyCustomer, () => {
    setHistoryCustomer(null);
    setCustomerOrders([]);
  });

  const loadCustomers = async () => {
    const data = await customerRepository.search(searchQuery);
    setCustomers(data);
  };

  useEffect(() => {
    loadCustomers();
  }, [searchQuery]);

  useEffect(() => {
    const loadDefs = async () => {
      const defs = await db.measurementDefinitions.toArray();
      setMeasurementDefs(defs.filter((def) => def.active));
    };
    void loadDefs();
  }, []);

  const handleOpenModal = (customer?: Customer) => {
    if (customer) {
      setEditingCustomer(customer);
      setFullName(customer.fullName);
      setPhone(customer.phone ?? '');
      setEmail(customer.email || '');
      setNotes(customer.notes || '');
      setMeasurements(customer.measurements ?? {});
    } else {
      setEditingCustomer(null);
      setFullName('');
      setPhone('');
      setEmail('');
      setNotes('');
      setMeasurements({});
    }
    setIsModalOpen(true);
  };

  const handleMeasurementChange = (key: string, value: string) => {
    const parsed = Number.parseFloat(value);
    setMeasurements((prev) => {
      const next = { ...prev };
      if (Number.isFinite(parsed) && parsed > 0) next[key] = parsed;
      else delete next[key];
      return next;
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !phone.trim()) return;

    const cleanMeasurements = Object.fromEntries(
      Object.entries(measurements).filter(([, value]) => Number.isFinite(value) && value > 0)
    );

    const payload = {
      fullName: fullName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      notes: notes.trim(),
      measurements: cleanMeasurements
    };

    setIsSaving(true);
    try {
      if (editingCustomer) {
        await customerRepository.update(editingCustomer.id, payload);
        showToast('Cliente actualizado.', 'success');
      } else {
        await customerRepository.create(payload);
        showToast('Cliente registrado.', 'success');
      }
      setIsModalOpen(false);
      await loadCustomers();
    } catch (err) {
      console.error('Error al guardar cliente:', err);
      showToast('No se pudo guardar el cliente. Intenta de nuevo.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const orderCount = await db.orders.where('customerId').equals(id).count();
      if (orderCount > 0) {
        showToast(`No se puede eliminar: tiene ${orderCount} pedido(s) asociados.`, 'error');
        return;
      }
      if (!window.confirm('¿Estás seguro de eliminar este cliente?')) return;
      setIsDeletingId(id);
      await customerRepository.delete(id);
      showToast('Cliente eliminado.', 'success');
      await loadCustomers();
    } catch (err) {
      console.error('Error al eliminar cliente:', err);
      showToast('No se pudo eliminar el cliente.', 'error');
    } finally {
      setIsDeletingId(null);
    }
  };

  const openHistory = async (customer: Customer) => {
    setHistoryCustomer(customer);
    const orders = await db.orders
      .where('customerId')
      .equals(customer.id)
      .reverse()
      .sortBy('createdAt');
    setCustomerOrders(orders);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
            Relaciones
          </p>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-stone-800">
            Directorio de Clientes
          </h2>
          <p className="text-sm text-stone-500 mt-1">
            Gestiona la información de contacto e historial de tus clientes.
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="inline-flex items-center justify-center space-x-2 bg-[#6f2f3a] hover:bg-[#582430] text-stone-50 px-4 py-2.5 rounded-xl font-medium text-sm transition shadow-sm"
        >
          <UserPlus size={18} />
          <span>Nuevo cliente</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
        <input
          type="text"
          placeholder="Buscar por nombre o teléfono..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white/55 backdrop-blur-md border border-white/70 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#6f2f3a]/20 focus:border-[#6f2f3a]/35 focus:border-stone-400 transition"
        />
      </div>

      {/* Grid de Clientes */}
      {customers.length === 0 ? (
        <EmptyState
          icon={UserPlus}
          title={searchQuery ? 'Sin clientes encontrados' : 'No hay clientes registrados'}
          description={
            searchQuery
              ? 'No encontramos ningún cliente que coincida con la búsqueda.'
              : 'Registra a tus clientes con sus datos de contacto y medidas personalizadas.'
          }
          actionLabel={searchQuery ? undefined : 'Registrar cliente'}
          onAction={searchQuery ? undefined : () => handleOpenModal()}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {customers.map((c) => (
            <div
              key={c.id}
              className="glass-panel rounded-2xl shadow-stone-900/5 p-5 hover:shadow-md transition duration-200 flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold text-stone-800">{c.fullName}</h3>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => void openHistory(c)}
                      className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg"
                      aria-label={`Ver historial de ${c.fullName}`}
                      title="Historial de pedidos"
                    >
                      <History size={16} />
                    </button>
                    <button
                      onClick={() => handleOpenModal(c)}
                      className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg"
                      aria-label={`Editar ${c.fullName}`}
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(c.id)}
                      disabled={isDeletingId === c.id}
                      className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
                      aria-label={`Eliminar ${c.fullName}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="mt-3 space-y-1.5 text-xs text-stone-600">
                  <p className="flex items-center space-x-2">
                    <Phone size={14} className="text-stone-400" />
                    <span>{c.phone}</span>
                  </p>
                  {c.email && (
                    <p className="flex items-center space-x-2">
                      <Mail size={14} className="text-stone-400" />
                      <span>{c.email}</span>
                    </p>
                  )}
                  {c.notes && (
                    <p className="flex items-center space-x-2 text-stone-500 italic mt-2 pt-2 border-t border-stone-100">
                      <FileText size={14} className="text-stone-400 shrink-0" />
                      <span className="truncate">{c.notes}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Formulario */}
      {isModalOpen && (
        <div
          ref={modalRef}
          tabIndex={-1}
          className="fixed inset-0 z-50 bg-[#252220]/35 backdrop-blur-md flex items-center justify-center p-4 outline-none"
          role="dialog"
          aria-modal="true"
        >
          <div className="glass-panel-strong rounded-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-stone-800 mb-4">
              {editingCustomer ? 'Editar Cliente' : 'Nuevo Cliente'}
            </h3>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label
                  htmlFor="client-name"
                  className="block text-xs font-medium text-stone-700 mb-1"
                >
                  Nombre Completo *
                </label>
                <input
                  id="client-name"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 bg-white/45 backdrop-blur-md border border-white/70 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6f2f3a]/20 focus:border-[#6f2f3a]/35"
                />
              </div>
              <div>
                <label
                  htmlFor="client-phone"
                  className="block text-xs font-medium text-stone-700 mb-1"
                >
                  Teléfono / WhatsApp *
                </label>
                <input
                  id="client-phone"
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-white/45 backdrop-blur-md border border-white/70 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6f2f3a]/20 focus:border-[#6f2f3a]/35"
                />
              </div>
              <div>
                <label
                  htmlFor="client-email"
                  className="block text-xs font-medium text-stone-700 mb-1"
                >
                  Correo electrónico
                </label>
                <input
                  id="client-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-white/45 backdrop-blur-md border border-white/70 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6f2f3a]/20 focus:border-[#6f2f3a]/35"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Ruler size={14} className="text-stone-500" />
                  <label className="block text-xs font-medium text-stone-700">
                    Medidas del cliente (cm)
                  </label>
                </div>
                {measurementDefs.length === 0 ? (
                  <p className="text-xs text-stone-400">No hay medidas configuradas en Ajustes.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {measurementDefs.map((def) => (
                      <div key={def.id}>
                        <label
                          htmlFor={`client-measure-${def.id}`}
                          className="block text-[11px] font-medium text-stone-600 mb-1"
                        >
                          {def.name || def.label}
                        </label>
                        <input
                          id={`client-measure-${def.id}`}
                          type="number"
                          min="0"
                          step="0.5"
                          value={measurements[def.key] ?? ''}
                          onChange={(e) => handleMeasurementChange(def.key, e.target.value)}
                          className="w-full px-3 py-2 bg-white/45 backdrop-blur-md border border-white/70 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6f2f3a]/20 focus:border-[#6f2f3a]/35"
                          placeholder="cm"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label
                  htmlFor="client-notes"
                  className="block text-xs font-medium text-stone-700 mb-1"
                >
                  Observaciones
                </label>
                <textarea
                  id="client-notes"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-white/45 backdrop-blur-md border border-white/70 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#6f2f3a]/20 focus:border-[#6f2f3a]/35"
                />
              </div>
              <div className="flex justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm text-stone-600 hover:bg-stone-100 rounded-lg font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm bg-[#6f2f3a] hover:bg-[#582430] text-[#fffaf5] rounded-lg font-medium shadow-sm"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {historyCustomer && (
        <div
          ref={historyRef}
          tabIndex={-1}
          className="fixed inset-0 z-50 bg-[#252220]/35 backdrop-blur-md flex items-center justify-center p-4 outline-none"
          role="dialog"
          aria-modal="true"
        >
          <div className="glass-panel-strong rounded-2xl max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-stone-800">Historial de pedidos</h3>
                <p className="text-sm text-stone-500">{historyCustomer.fullName}</p>
              </div>
              <button
                onClick={() => {
                  setHistoryCustomer(null);
                  setCustomerOrders([]);
                }}
                className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg"
                aria-label="Cerrar historial"
              >
                <X size={18} />
              </button>
            </div>

            {customerOrders.length === 0 ? (
              <p className="text-sm text-stone-500">Este cliente no tiene pedidos registrados.</p>
            ) : (
              <div className="overflow-x-auto border border-stone-200 rounded-xl">
                <table className="glass-table">
                  <thead className="bg-stone-50 text-stone-500 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="text-left px-3 py-2">Fecha</th>
                      <th className="text-left px-3 py-2">Entrega</th>
                      <th className="text-left px-3 py-2">Estado</th>
                      <th className="text-right px-3 py-2">Total</th>
                      <th className="text-right px-3 py-2">Saldo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/35">
                    {customerOrders.map((order) => {
                      const labels: Record<string, string> = {
                        pending: 'Pendiente',
                        in_progress: 'En confección',
                        ready: 'Listo',
                        delivered: 'Entregado',
                        cancelled: 'Cancelado'
                      };
                      const total = Math.max(0, order.financials?.totalPrice ?? 0);
                      const pending = calculatePendingBalance(
                        total,
                        Math.max(0, order.financials?.advancePayment ?? 0)
                      );
                      return (
                        <tr key={order.id}>
                          <td className="px-3 py-2 text-stone-600">
                            {formatDate(order.createdAt)}
                          </td>
                          <td className="px-3 py-2 text-stone-600">
                            {formatDate(order.deliveryDate)}
                          </td>
                          <td className="px-3 py-2 text-stone-700">
                            {labels[order.status] ?? order.status}
                          </td>
                          <td className="px-3 py-2 text-right font-medium text-stone-800">
                            {formatCurrency(total)}
                          </td>
                          <td className="px-3 py-2 text-right text-stone-600">
                            {formatCurrency(pending)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
