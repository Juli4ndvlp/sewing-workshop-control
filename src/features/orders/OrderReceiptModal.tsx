import React, { useEffect, useState } from 'react';
import { X, Printer, Scissors } from 'lucide-react';
import { AppConfig, Customer, GarmentType, Order, OrderStatus } from '../../models/types';
import { db } from '../../repositories/dexie/db';
import { settingsRepository } from '../../repositories/dexie/settingsRepository';
// PDF cargado bajo demanda.
import { formatDate } from '../../utils/dates';
import { calculatePendingBalance, formatCurrency } from '../../utils/money';
import { useDialogA11y } from '../../hooks/useDialogA11y';

interface OrderReceiptModalProps {
  order: Order | null;
  onClose: () => void;
}

const statusLabels: Record<OrderStatus, string> = {
  pending: 'Pendiente',
  in_progress: 'En confección',
  ready: 'Listo para entrega',
  delivered: 'Entregado',
  cancelled: 'Cancelado'
};

const defaultConfig: AppConfig = {
  id: 'default',
  profitMargin: 30,
  currency: 'COP',
  businessName: 'Edna Atelier',
  logoDataUrl: '/edna-logo.jpg'
};

export const OrderReceiptModal: React.FC<OrderReceiptModalProps> = ({ order, onClose }) => {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [garment, setGarment] = useState<GarmentType | null>(null);
  const [config, setConfig] = useState<AppConfig>(defaultConfig);

  useEffect(() => {
    if (!order) return;

    let cancelled = false;
    const loadData = async () => {
      try {
        const [loadedCustomer, loadedGarment, loadedConfig] = await Promise.all([
          order.customerId ? db.customers.get(order.customerId) : Promise.resolve(undefined),
          order.garmentTypeId
            ? db.garmentTypes.get(order.garmentTypeId)
            : Promise.resolve(undefined),
          settingsRepository.getConfig()
        ]);

        if (cancelled) return;
        setCustomer(loadedCustomer ?? null);
        setGarment(loadedGarment ?? null);
        setConfig(loadedConfig);
      } catch (error) {
        console.error('Error al cargar datos del comprobante:', error);
      }
    };

    void loadData();
    return () => {
      cancelled = true;
    };
  }, [order]);

  const dialogRef = useDialogA11y(!!order, onClose);

  if (!order) return null;

  const totalPrice = Math.max(0, order.financials?.totalPrice ?? 0);
  const advancePayment = Math.max(0, order.financials?.advancePayment ?? 0);
  const pendingBalance = calculatePendingBalance(totalPrice, advancePayment);
  const isPaid = pendingBalance <= 0 && totalPrice > 0;
  const customerName = customer?.fullName || 'Cliente no registrado';
  const garmentName = garment?.name || order.garmentType || 'Prenda personalizada';

  const handlePrint = async () => {
    const fallbackCustomer: Customer = customer || {
      id: order.customerId || 'unknown',
      fullName: 'Cliente no registrado',
      createdAt: new Date().toISOString()
    };
    const fallbackGarment: GarmentType = garment || {
      id: order.garmentTypeId || 'unknown',
      name: garmentName,
      active: true
    };

    const { printOrderTicket } = await import('../../services/pdfService');
    await printOrderTicket(order, fallbackCustomer, fallbackGarment, config);
  };

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#252220]/35 backdrop-blur-md p-4 overflow-y-auto outline-none"
      role="dialog"
      aria-modal="true"
    >
      <div className="glass-panel-strong w-full max-w-2xl rounded-3xl overflow-hidden my-8 flex flex-col max-h-[90vh] border border-white/70 shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/50 bg-white/20 print:hidden">
          <div>
            <h3 className="text-sm font-semibold text-stone-800">Comprobante de pedido</h3>
            <p className="text-xs text-stone-500">Vista previa antes de descargar el PDF</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint} className="glass-btn-primary !px-3 !py-1.5 text-xs">
              <Printer size={14} /> Descargar PDF
            </button>
            <button
              onClick={onClose}
              aria-label="Cerrar comprobante"
              className="p-1.5 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-8 space-y-6 overflow-y-auto text-stone-800">
          <div className="rounded-2xl bg-gradient-to-br from-[#6f2f3a] to-[#582430] text-[#fffaf5] p-6 md:p-7 relative overflow-hidden shadow-lg shadow-[#6f2f3a]/20">
            <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-[#a08a63]/40 via-[#a08a63]/80 to-[#a08a63]/40" />
            <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full bg-white/5 blur-2xl" />
            <div className="flex items-start justify-between gap-4 relative">
              <div className="flex items-center gap-3.5">
                {config.logoDataUrl ? (
                  <div className="h-14 w-auto max-w-[180px] rounded-xl overflow-hidden ring-1 ring-white/20 shadow-md bg-[#45131e] flex items-center justify-center p-0.5 flex-shrink-0">
                    <img
                      src={config.logoDataUrl}
                      alt={config.businessName || 'Edna Atelier'}
                      className="h-full w-auto object-contain rounded-lg"
                    />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center backdrop-blur-sm flex-shrink-0">
                    <Scissors size={22} />
                  </div>
                )}
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-[#e8dcc8]/80">
                    Comprobante
                  </p>
                  <h2 className="text-xl font-bold tracking-tight">
                    {config.businessName || 'Edna Atelier'}
                  </h2>
                  <p className="text-xs text-stone-300">Alta costura y confección a medida</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-stone-300">N° {order.id.slice(0, 8).toUpperCase()}</p>
                <p className="text-sm font-semibold">{formatDate(order.createdAt)}</p>
                <span
                  className={`inline-flex mt-2 text-[11px] font-semibold px-2.5 py-1 rounded-full ${isPaid ? 'bg-emerald-500/20 text-emerald-200' : 'bg-amber-500/20 text-amber-200'}`}
                >
                  {isPaid ? 'PAGADO' : 'SALDO PENDIENTE'}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="p-4 rounded-xl border border-stone-200 bg-stone-50/60">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 mb-2">
                Cliente
              </p>
              <p className="font-semibold text-stone-800">{customerName}</p>
              <p className="text-stone-500 text-xs mt-1">{customer?.phone || 'Sin teléfono'}</p>
              {customer?.email && <p className="text-stone-500 text-xs">{customer.email}</p>}
            </div>
            <div className="p-4 rounded-xl border border-stone-200 bg-stone-50/60">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 mb-2">
                Pedido
              </p>
              <p className="text-stone-700">
                <span className="text-stone-400">Entrega:</span>{' '}
                {order.deliveryDate ? formatDate(order.deliveryDate) : 'Por coordinar'}
              </p>
              <p className="text-stone-700">
                <span className="text-stone-400">Estado:</span> {statusLabels[order.status]}
              </p>
              <p className="text-stone-700">
                <span className="text-stone-400">Talla:</span> {order.size || 'No especificada'}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-400">
              Detalle del encargo
            </h4>
            <div className="border border-stone-200 rounded-xl overflow-hidden">
              <div className="grid grid-cols-[1fr_auto] gap-4 px-4 py-3 bg-stone-50 text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                <span>Descripción</span>
                <span>Valor</span>
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-4 px-4 py-4 items-start">
                <div>
                  <p className="font-semibold text-stone-800">{garmentName}</p>
                  <p className="text-xs text-stone-500 mt-1 whitespace-pre-line">
                    {order.description || order.notes || 'Sin observaciones adicionales.'}
                  </p>
                </div>
                <p className="font-semibold text-stone-800">
                  {formatCurrency(totalPrice, config.currency)}
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <div className="w-full sm:w-72 border border-stone-200 rounded-xl overflow-hidden text-sm">
              <div className="flex justify-between px-4 py-3 bg-white">
                <span className="text-stone-500">Total</span>
                <span className="font-medium text-stone-800">
                  {formatCurrency(totalPrice, config.currency)}
                </span>
              </div>
              <div className="flex justify-between px-4 py-3 bg-white border-t border-stone-100">
                <span className="text-stone-500">Abono</span>
                <span className="font-medium text-emerald-700">
                  -{formatCurrency(advancePayment, config.currency)}
                </span>
              </div>
              <div
                className={`flex justify-between px-4 py-3 border-t border-stone-100 ${isPaid ? 'bg-emerald-50' : 'bg-amber-50'}`}
              >
                <span className={`font-semibold ${isPaid ? 'text-emerald-800' : 'text-[#6b5a38]'}`}>
                  {isPaid ? 'Pagado' : 'Saldo pendiente'}
                </span>
                <span className={`font-bold ${isPaid ? 'text-emerald-700' : 'text-[#7a6843]'}`}>
                  {isPaid
                    ? formatCurrency(0, config.currency)
                    : formatCurrency(pendingBalance, config.currency)}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-stone-100 text-xs text-stone-400 flex items-end justify-between gap-6">
            <p>Gracias por confiar en {config.businessName || 'Edna Atelier'}.</p>
            <div className="flex gap-8">
              <div className="w-32 border-t border-stone-300 pt-1 text-center">Taller</div>
              <div className="w-32 border-t border-stone-300 pt-1 text-center">Cliente</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
