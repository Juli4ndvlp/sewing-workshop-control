import React, { useState, useEffect } from 'react';
import {
  X,
  DollarSign,
  Calendar,
  User,
  CheckCircle2,
  Clock,
  CreditCard,
  Printer
} from 'lucide-react';
import { db } from '../../repositories/dexie/db';
import { settingsRepository } from '../../repositories/dexie/settingsRepository';
import {
  AppConfig,
  Customer,
  GarmentType,
  Order,
  OrderStatusHistory,
  Payment
} from '../../models/types';
// PDF cargado bajo demanda para no inflar el bundle inicial.
import { formatDate, toDateOnly } from '../../utils/dates';
import { calculatePendingBalance, formatCurrency } from '../../utils/money';
import {
  canTransitionOrderStatus,
  changeOrderStatus,
  registerOrderPayment
} from '../../services/orderService';
import { useDialogA11y } from '../../hooks/useDialogA11y';
import { useToast } from '../../components/ToastProvider';
import { NewOrderStepper } from './NewOrderStepper';

interface OrderDetailModalProps {
  order: Order | null;
  onClose: () => void;
  onOrderUpdated: (order: Order) => void;
}

export const OrderDetailModal: React.FC<OrderDetailModalProps> = ({
  order,
  onClose,
  onOrderUpdated
}) => {
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [paymentDate, setPaymentDate] = useState<string>(toDateOnly(new Date()));
  const [payments, setPayments] = useState<Payment[]>([]);
  const [statusHistory, setStatusHistory] = useState<OrderStatusHistory[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [garment, setGarment] = useState<GarmentType | null>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [showCancelReason, setShowCancelReason] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isEditOpen, setIsEditOpen] = useState(false);
  const { showToast } = useToast();

  // Cargar información relacionada (Cliente, Prenda y Configuración) para el PDF
  useEffect(() => {
    if (!order) return;

    let cancelled = false;
    const loadRelatedData = async () => {
      try {
        const [cust, garm, loadedConfig, orderPayments, history] = await Promise.all([
          order.customerId ? db.customers.get(order.customerId) : Promise.resolve(undefined),
          order.garmentTypeId
            ? db.garmentTypes.get(order.garmentTypeId)
            : Promise.resolve(undefined),
          settingsRepository.getConfig(),
          db.payments.where('orderId').equals(order.id).sortBy('date'),
          db.orderStatusHistory.where('orderId').equals(order.id).sortBy('createdAt')
        ]);

        if (cancelled) return;
        setCustomer(cust ?? null);
        setGarment(garm ?? null);
        setConfig(loadedConfig);
        setPayments(orderPayments.reverse());
        setStatusHistory(history.reverse());
        setPaymentDate(toDateOnly(new Date()));
      } catch (err) {
        console.error('Error al cargar datos relacionados del pedido:', err);
      }
    };

    void loadRelatedData();
    return () => {
      cancelled = true;
    };
  }, [order]);

  const dialogRef = useDialogA11y(!!order, onClose);

  if (!order) return null;

  const totalPrice = Math.max(0, order.financials?.totalPrice ?? 0);
  const advancePayment = Math.max(0, order.financials?.advancePayment ?? 0);
  const pendingBalance = calculatePendingBalance(totalPrice, advancePayment);

  const canTransition = (from: Order['status'], to: Order['status']) =>
    canTransitionOrderStatus(from, to);

  const updateStatus = async (newStatus: Order['status'], cancellationReason?: string) => {
    setError(null);
    setIsUpdatingStatus(true);
    try {
      const updated = await changeOrderStatus(order.id, newStatus, cancellationReason);
      onOrderUpdated(updated);
      const history = await db.orderStatusHistory
        .where('orderId')
        .equals(order.id)
        .sortBy('createdAt');
      setStatusHistory(history.reverse());
      setShowCancelReason(false);
      setCancelReason('');
      showToast(newStatus === 'cancelled' ? 'Pedido cancelado.' : 'Estado actualizado.', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo actualizar el estado.';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Cambio directo del estado de la orden
  const handleStatusChange = async (newStatus: Order['status']) => {
    if (!canTransition(order.status, newStatus)) {
      setError('Esta transición de estado no está permitida.');
      return;
    }
    if (newStatus === 'cancelled') {
      setError(null);
      setShowCancelReason(true);
      return;
    }
    await updateStatus(newStatus);
  };

  const handleCancelOrder = async () => {
    const reason = cancelReason.trim();
    if (!reason) {
      setError('Indica el motivo de cancelación.');
      return;
    }
    await updateStatus('cancelled', reason);
  };

  // Registro de abono al saldo pendiente
  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(paymentAmount);
    setError(null);

    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Ingresa un monto de abono válido.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) {
      setError('Ingresa una fecha de abono válida.');
      return;
    }

    setIsSubmitting(true);
    try {
      const updated = await registerOrderPayment(order.id, amount, paymentDate);
      setPaymentAmount('');
      setPaymentDate(toDateOnly(new Date()));
      const refreshedPayments = await db.payments.where('orderId').equals(order.id).sortBy('date');
      setPayments(refreshedPayments.reverse());
      onOrderUpdated(updated);
      showToast('Abono registrado.', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo registrar el abono.';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSuccess = async () => {
    const fresh = await db.orders.get(order.id);
    if (fresh) onOrderUpdated(fresh);
  };

  // Función para imprimir el recibo PDF
  const handlePrintPDF = async () => {
    const appConfig: AppConfig = config ?? {
      id: 'default',
      profitMargin: 30,
      currency: 'COP',
      businessName: 'Edna Atelier',
      logoDataUrl: '/edna-logo.jpg'
    };

    const defaultCustomer: Customer = customer || {
      id: order.customerId || 'unknown',
      fullName: 'Cliente no registrado',
      createdAt: new Date().toISOString()
    };

    const defaultGarment: GarmentType = garment || {
      id: order.garmentTypeId || 'unknown',
      name: order.garmentType || 'Prenda personalizada',
      active: true
    };

    const { printOrderTicket } = await import('../../services/pdfService');
    await printOrderTicket(order, defaultCustomer, defaultGarment, appConfig);
  };

  const statusOptions: { value: Order['status']; label: string; color: string }[] = [
    { value: 'pending', label: 'Pendiente', color: 'bg-amber-100 text-[#6b5a38]' },
    { value: 'in_progress', label: 'En confección', color: 'bg-blue-100 text-blue-800' },
    { value: 'ready', label: 'Listo para entrega', color: 'bg-purple-100 text-purple-800' },
    { value: 'delivered', label: 'Entregado', color: 'bg-emerald-100 text-emerald-800' },
    { value: 'cancelled', label: 'Cancelado', color: 'bg-rose-100 text-[#582430]' }
  ];

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#252220]/35 backdrop-blur-md p-4 overflow-y-auto outline-none"
      role="dialog"
      aria-modal="true"
    >
      <div className="glass-panel-strong w-full max-w-2xl rounded-3xl overflow-hidden my-8 border border-white/70 shadow-2xl">
        {/* Cabecera de la Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/50 bg-white/20">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">
              Orden #{order.id?.slice(0, 8)}
            </span>
            <h3 className="text-lg font-bold text-stone-800">
              {garment ? garment.name : `Prenda #${order.garmentTypeId?.slice(0, 8)}`}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Selector de Estado */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-stone-500 uppercase tracking-wider flex items-center gap-1.5">
              <Clock size={14} /> Estado Actual del Pedido
            </label>
            <div className="flex flex-wrap gap-2">
              {statusOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleStatusChange(opt.value)}
                  disabled={isUpdatingStatus || !canTransition(order.status, opt.value)}
                  className={`text-xs font-medium px-3 py-1.5 rounded-xl border transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                    order.status === opt.value
                      ? `${opt.color} border-transparent ring-2 ring-stone-400/30 font-semibold shadow-sm`
                      : canTransition(order.status, opt.value)
                        ? 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                        : 'bg-stone-50 text-stone-400 border-stone-100'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {showCancelReason && order.status !== 'cancelled' && (
              <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
                <label htmlFor="cancel-reason" className="text-xs font-medium text-[#582430] block">
                  Motivo de cancelación *
                </label>
                <textarea
                  id="cancel-reason"
                  rows={2}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Ej. Cliente desistió, no aprobó materiales..."
                  className="w-full px-3 py-2 text-sm border border-rose-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-400 resize-none"
                />
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCancelReason(false);
                      setCancelReason('');
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-white rounded-lg"
                  >
                    Volver
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelOrder}
                    disabled={isUpdatingStatus}
                    className="px-3 py-1.5 text-xs font-medium bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50"
                  >
                    Confirmar cancelación
                  </button>
                </div>
              </div>
            )}

            {order.status === 'cancelled' && (
              <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-[#6f2f3a]">
                <span className="font-medium">Pedido cancelado.</span>{' '}
                {order.cancellationReason
                  ? `Motivo: ${order.cancellationReason}`
                  : 'Sin motivo registrado.'}
              </div>
            )}
          </div>

          {/* Información General y Fechas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-stone-50 rounded-xl border border-stone-100 text-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-lg shadow-sm text-stone-500">
                <User size={18} />
              </div>
              <div>
                <p className="text-xs text-stone-400 font-medium">Cliente</p>
                <p className="font-semibold text-stone-700">
                  {customer ? customer.fullName : order.customerId || 'Sin registrar'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-lg shadow-sm text-stone-500">
                <Calendar size={18} />
              </div>
              <div>
                <p className="text-xs text-stone-400 font-medium">Fecha de Entrega</p>
                <p className="font-semibold text-stone-700">
                  {order.deliveryDate ? formatDate(order.deliveryDate) : 'No programada'}
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-stone-100 border border-stone-200 rounded-xl text-sm text-stone-800 font-medium">
            Talla: <span className="font-bold">{order.size || 'No especificada'}</span>
          </div>

          {error && (
            <div
              role="alert"
              className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-[#6f2f3a]"
            >
              {error}
            </div>
          )}

          {/* Desglose Financiero y Pagos */}
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-semibold text-stone-500 uppercase tracking-wider flex items-center gap-1.5">
              <DollarSign size={14} /> Estado Financiero
            </h4>

            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-100 text-center">
                <span className="text-xs text-stone-400 font-medium block">Total</span>
                <span className="text-base font-bold text-stone-800">
                  {formatCurrency(totalPrice)}
                </span>
              </div>
              <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100 text-center">
                <span className="text-xs text-emerald-600 font-medium block">Abonado</span>
                <span className="text-base font-bold text-emerald-700">
                  {formatCurrency(advancePayment)}
                </span>
              </div>
              <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-100 text-center">
                <span className="text-xs text-amber-600 font-medium block">Pendiente</span>
                <span className="text-base font-bold text-amber-600">
                  {formatCurrency(pendingBalance)}
                </span>
              </div>
            </div>

            {/* Formulario de Abono */}
            {pendingBalance > 0 ? (
              <form
                onSubmit={handleAddPayment}
                className="mt-3 p-4 border border-stone-200 rounded-xl bg-stone-50/30 space-y-3"
              >
                <p className="text-xs font-medium text-stone-600">Registrar nuevo abono</p>
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px_auto] gap-3 items-end">
                  <div className="space-y-1">
                    <label htmlFor="payment-amount" className="text-[11px] text-stone-500">
                      Monto
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm">
                        $
                      </span>
                      <input
                        id="payment-amount"
                        type="number"
                        min="1"
                        max={pendingBalance}
                        value={paymentAmount}
                        onChange={(e) =>
                          setPaymentAmount(e.target.value ? Number(e.target.value) : '')
                        }
                        placeholder="Monto a abonar"
                        className="w-full pl-7 pr-3 py-2 text-sm bg-white/55 backdrop-blur-md border border-white/70 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6f2f3a]/20 focus:border-[#6f2f3a]/35"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="payment-date" className="text-[11px] text-stone-500">
                      Fecha
                    </label>
                    <input
                      id="payment-date"
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white/55 backdrop-blur-md border border-white/70 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6f2f3a]/20 focus:border-[#6f2f3a]/35"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSubmitting || !paymentAmount}
                    className="px-4 py-2 bg-[#6f2f3a] hover:bg-[#582430] text-[#fffaf5] text-sm font-medium rounded-lg disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <CreditCard size={15} />
                    Abonar
                  </button>
                </div>
              </form>
            ) : (
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-700 text-xs font-medium flex items-center justify-center gap-2">
                <CheckCircle2 size={16} /> Pago completado en su totalidad.
              </div>
            )}

            <div className="mt-3 border border-stone-200 rounded-xl overflow-hidden">
              <div className="px-3 py-2 bg-stone-50 border-b border-stone-200 text-xs font-medium text-stone-600 flex justify-between">
                <span>Historial de abonos</span>
                <span>
                  {payments.length} registro{payments.length === 1 ? '' : 's'}
                </span>
              </div>
              {payments.length === 0 ? (
                <p className="px-3 py-3 text-xs text-stone-400">No hay abonos registrados.</p>
              ) : (
                <ul className="divide-y divide-stone-100 max-h-40 overflow-y-auto">
                  {payments.map((payment) => (
                    <li
                      key={payment.id}
                      className="px-3 py-2 text-sm flex items-center justify-between gap-3"
                    >
                      <span className="text-stone-500">{formatDate(payment.date)}</span>
                      <span className="font-medium text-stone-800">
                        {formatCurrency(payment.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-3 border border-stone-200 rounded-xl overflow-hidden">
              <div className="px-3 py-2 bg-stone-50 border-b border-stone-200 text-xs font-medium text-stone-600 flex justify-between">
                <span>Historial de estados</span>
                <span>
                  {statusHistory.length} registro{statusHistory.length === 1 ? '' : 's'}
                </span>
              </div>
              {statusHistory.length === 0 ? (
                <p className="px-3 py-3 text-xs text-stone-400">
                  Sin cambios de estado registrados.
                </p>
              ) : (
                <ul className="divide-y divide-stone-100 max-h-40 overflow-y-auto">
                  {statusHistory.map((entry) => {
                    const labels: Record<string, string> = {
                      pending: 'Pendiente',
                      in_progress: 'En confección',
                      ready: 'Listo',
                      delivered: 'Entregado',
                      cancelled: 'Cancelado'
                    };
                    return (
                      <li
                        key={entry.id}
                        className="px-3 py-2 text-sm flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-stone-700 font-medium truncate">
                            {entry.fromStatus
                              ? `${labels[entry.fromStatus] ?? entry.fromStatus} → ${labels[entry.toStatus] ?? entry.toStatus}`
                              : (labels[entry.toStatus] ?? entry.toStatus)}
                          </p>
                          {entry.note && (
                            <p className="text-[11px] text-stone-400 truncate">{entry.note}</p>
                          )}
                        </div>
                        <span className="text-stone-500 text-xs whitespace-nowrap">
                          {new Date(entry.createdAt).toLocaleString('es-CO', {
                            dateStyle: 'short',
                            timeStyle: 'short'
                          })}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Pie de la Modal */}
        <div className="px-6 py-4 border-t border-white/50 bg-white/20 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrintPDF}
              className="glass-btn-secondary !py-2 text-xs flex items-center gap-1.5"
            >
              <Printer size={16} /> PDF
            </button>
            {order.status !== 'cancelled' && (
              <button
                type="button"
                onClick={() => setIsEditOpen(true)}
                className="glass-btn-primary !py-2 text-xs"
              >
                Editar pedido
              </button>
            )}
          </div>

          <button onClick={onClose} className="glass-btn-secondary !py-2 text-xs">
            Cerrar
          </button>
        </div>
      </div>

      <NewOrderStepper
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onSuccess={handleEditSuccess}
        orderToEdit={order}
      />
    </div>
  );
};
