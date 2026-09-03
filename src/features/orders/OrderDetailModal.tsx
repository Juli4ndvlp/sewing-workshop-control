import React, { useState, useEffect } from 'react';
import { 
  X, 
  DollarSign, 
  Calendar, 
  User, 
  Scissors, 
  CheckCircle2, 
  Clock, 
  CreditCard,
  Printer 
} from 'lucide-react';
import { db } from '../../repositories/dexie/db';
import { Order, Customer, GarmentType, AppConfig } from '../../models/types';
import { printOrderTicket } from '../../services/pdfService';

interface OrderDetailModalProps {
  order: Order | null;
  onClose: () => void;
  onOrderUpdated: () => void;
}

export const OrderDetailModal: React.FC<OrderDetailModalProps> = ({
  order,
  onClose,
  onOrderUpdated,
}) => {
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [garment, setGarment] = useState<GarmentType | null>(null);

  // Cargar información relacionada (Cliente y Prenda) para el PDF
  useEffect(() => {
    const loadRelatedData = async () => {
      if (!order) return;
      try {
        if (order.customerId) {
          const cust = await db.customers.get(order.customerId);
          setCustomer(cust || null);
        }
        if (order.garmentTypeId) {
          const garm = await db.garmentTypes.get(order.garmentTypeId);
          setGarment(garm || null);
        }
      } catch (err) {
        console.error('Error al cargar datos relacionados del pedido:', err);
      }
    };
    loadRelatedData();
  }, [order]);

  if (!order) return null;

  // Cambio directo del estado de la orden
  const handleStatusChange = async (newStatus: Order['status']) => {
    try {
      await db.orders.update(order.id, {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
      onOrderUpdated();
    } catch (error) {
      console.error('Error al actualizar el estado:', error);
    }
  };

  // Registro de abono al saldo pendiente
  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(paymentAmount);
    if (!amount || amount <= 0) return;

    setIsSubmitting(true);
    try {
      const currentAdvance = order.financials?.advancePayment || 0;
      const totalPrice = order.financials?.totalPrice || 0;

      const newAdvance = currentAdvance + amount;
      const newPending = Math.max(0, totalPrice - newAdvance);

      await db.orders.update(order.id, {
        financials: {
          ...order.financials,
          advancePayment: newAdvance,
          pendingBalance: newPending,
        },
        updatedAt: new Date().toISOString()
      });

      setPaymentAmount('');
      onOrderUpdated();
    } catch (error) {
      console.error('Error al registrar el pago:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Función para imprimir el recibo PDF
  const handlePrintPDF = () => {
    const appConfig: AppConfig = {
      id: 'default',
      profitMargin: 30,
      currency: 'COP',
      businessName: 'Edna Atelier',
      logoDataUrl: '/edna-logo.svg',
    };

    const defaultCustomer: Customer = customer || {
      id: order.customerId || 'unknown',
      fullName: 'Cliente General',
      phone: 'Sin teléfono',
      createdAt: new Date().toISOString()
    };

    const defaultGarment: GarmentType = garment || {
      id: order.garmentTypeId || 'unknown',
      name: `Prenda #${order.garmentTypeId?.slice(0, 8) || 'Personalizada'}`,
      active: true
    };

    void printOrderTicket(order, defaultCustomer, defaultGarment, appConfig);
  };

  const statusOptions: { value: Order['status']; label: string; color: string }[] = [
    { value: 'pending', label: 'Pendiente', color: 'bg-amber-100 text-amber-800' },
    { value: 'in_progress', label: 'En Confección', color: 'bg-blue-100 text-blue-800' },
    { value: 'ready', label: 'Listo para Entrega', color: 'bg-purple-100 text-purple-800' },
    { value: 'delivered', label: 'Entregado', color: 'bg-emerald-100 text-emerald-800' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl border border-slate-200 overflow-hidden my-8">
        
        {/* Cabecera de la Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Orden #{order.id?.slice(0, 8)}
            </span>
            <h3 className="text-lg font-bold text-slate-800">
              {garment ? garment.name : `Prenda #${order.garmentTypeId?.slice(0, 8)}`}
            </h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          
          {/* Selector de Estado */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Clock size={14} /> Estado Actual del Pedido
            </label>
            <div className="flex flex-wrap gap-2">
              {statusOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleStatusChange(opt.value)}
                  className={`text-xs font-medium px-3 py-1.5 rounded-xl border transition-all ${
                    order.status === opt.value 
                      ? `${opt.color} border-transparent ring-2 ring-indigo-600/20 font-semibold shadow-sm` 
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Información General y Fechas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100 text-sm">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-lg shadow-sm text-slate-500">
                <User size={18} />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium">Cliente</p>
                <p className="font-semibold text-slate-700">
                  {customer ? customer.fullName : (order.customerId || 'Sin registrar')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-lg shadow-sm text-slate-500">
                <Calendar size={18} />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-medium">Fecha de Entrega</p>
                <p className="font-semibold text-slate-700">
                  {order.deliveryDate
                    ? new Date(order.deliveryDate).toLocaleDateString() 
                    : 'No programada'}
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl text-sm text-indigo-800 font-medium">
            Talla: <span className="font-bold">{order.size || 'No especificada'}</span>
          </div>

          {/* Desglose Financiero y Pagos */}
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <DollarSign size={14} /> Estado Financiero
            </h4>

            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-center">
                <span className="text-xs text-slate-400 font-medium block">Total</span>
                <span className="text-base font-bold text-slate-900">
                  ${order.financials?.totalPrice?.toLocaleString() || 0}
                </span>
              </div>
              <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100 text-center">
                <span className="text-xs text-emerald-600 font-medium block">Abonado</span>
                <span className="text-base font-bold text-emerald-700">
                  ${order.financials?.advancePayment?.toLocaleString() || 0}
                </span>
              </div>
              <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-100 text-center">
                <span className="text-xs text-amber-600 font-medium block">Pendiente</span>
                <span className="text-base font-bold text-amber-600">
                  ${order.financials?.pendingBalance?.toLocaleString() || 0}
                </span>
              </div>
            </div>

            {/* Formulario de Abono */}
            {order.financials?.pendingBalance > 0 ? (
              <form onSubmit={handleAddPayment} className="mt-3 p-4 border border-slate-200 rounded-xl bg-slate-50/30 flex items-end gap-3">
                <div className="flex-1 space-y-1">
                  <label className="text-xs font-medium text-slate-600">Registrar Nuevo Abono</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                    <input
                      type="number"
                      min="1"
                      max={order.financials.pendingBalance}
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value ? Number(e.target.value) : '')}
                      placeholder="Monto a abonar"
                      className="w-full pl-7 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting || !paymentAmount}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors flex items-center gap-1.5"
                >
                  <CreditCard size={15} />
                  Abonar
                </button>
              </form>
            ) : (
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-700 text-xs font-medium flex items-center justify-center gap-2">
                <CheckCircle2 size={16} /> Pago completado en su totalidad.
              </div>
            )}
          </div>

        </div>

        {/* Pie de la Modal */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <button
            type="button"
            onClick={handlePrintPDF}
            className="px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-sm font-medium rounded-xl transition-colors flex items-center gap-1.5 border border-indigo-200 shadow-sm"
          >
            <Printer size={16} /> Descargar Factura PDF
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-medium rounded-xl transition-colors"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};