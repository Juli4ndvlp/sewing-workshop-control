import React from 'react';
import { X, Printer, Scissors, CheckCircle2 } from 'lucide-react';
import { Order, Customer, GarmentType, AppConfig } from '../../models/types';
import { printOrderTicket } from '../../services/pdfService';

interface OrderReceiptModalProps {
  order: Order | null;
  onClose: () => void;
}

export const OrderReceiptModal: React.FC<OrderReceiptModalProps> = ({ order, onClose }) => {
  if (!order) return null;

  const handlePrint = () => {
    const appConfig: AppConfig = {
      id: 'default',
      profitMargin: 30,
      currency: 'COP',
      businessName: 'Edna Atelier',
      logoDataUrl: '/edna-logo.svg',
    };

    const customer: Customer = {
      id: 'customer-default',
      fullName: 'Cliente General',
      phone: 'Sin teléfono',
      createdAt: new Date().toISOString(),
    };

    const garment: GarmentType = {
      id: order.garmentTypeId || 'garment-default',
      name: order.garmentType || 'Prenda en encargo',
      active: true,
    };

    void printOrderTicket(order, customer, garment, appConfig);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-xl border border-slate-200 overflow-hidden my-8 flex flex-col max-h-[90vh]">
        
        {/* Barra superior (No se imprime) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50 print:hidden">
          <h3 className="text-sm font-semibold text-slate-800">Comprobante de Encargo</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg transition-colors"
            >
              <Printer size={14} /> Descargar PDF
            </button>
            <button 
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Contenido del Recibo (Optimizado para impresión) */}
        <div className="p-8 space-y-6 overflow-y-auto print:p-2 print:space-y-4 text-slate-800 font-sans">
          
          {/* Encabezado del Atelier */}
          <div className="text-center space-y-1 border-b border-slate-200 pb-6">
            <div className="inline-flex p-2 bg-slate-900 text-white rounded-xl mb-1">
              <Scissors size={20} />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">Edna Atelier</h2>
            <p className="text-xs text-slate-500">Alta Costura y Confección a Medida</p>
            <p className="text-xs text-slate-400 mt-2">Orden de Trabajo #{order.id?.slice(0, 8).toUpperCase()}</p>
          </div>

          {/* Fechas e Info Básica */}
          <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div>
              <span className="text-slate-400 block font-medium">Fecha de Emisión</span>
              <span className="font-semibold text-slate-700">
                {order.dates?.createdAt ? new Date(order.dates.createdAt).toLocaleDateString() : new Date().toLocaleDateString()}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block font-medium">Fecha de Entrega Estimada</span>
              <span className="font-semibold text-slate-700">
                {order.dates?.deliveryDate ? new Date(order.dates.deliveryDate).toLocaleDateString() : 'Por coordinar'}
              </span>
            </div>
          </div>

          {/* Detalle de la Prenda */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Especificación de la Prenda</h4>
            <div className="p-4 border border-slate-200 rounded-xl space-y-2">
              <div className="flex justify-between items-center font-bold text-sm">
                <span>{order.garmentType || 'Prenda en encargo'}</span>
                <span className="text-xs px-2.5 py-1 bg-slate-100 rounded-full font-medium uppercase">{order.status}</span>
              </div>
              <p className="text-xs text-slate-600 whitespace-pre-line leading-relaxed">
                {order.notes || order.description || 'Sin observaciones detalladas.'}
              </p>
            </div>
          </div>

          {/* Resumen Financiero */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Resumen Financiero</h4>
            <div className="border border-slate-200 rounded-xl overflow-hidden text-sm divide-y divide-slate-100">
              <div className="flex justify-between p-3 bg-slate-50/50">
                <span className="text-slate-600">Valor Total de la Prenda</span>
                <span className="font-bold text-slate-900">${order.financials?.totalPrice?.toLocaleString() || 0}</span>
              </div>
              <div className="flex justify-between p-3">
                <span className="text-emerald-700 font-medium">Anticipo / Abono Realizado</span>
                <span className="font-bold text-emerald-700">-${order.financials?.advancePayment?.toLocaleString() || 0}</span>
              </div>
              <div className="flex justify-between p-3 bg-amber-50/50">
                <span className="text-amber-800 font-semibold">Saldo Pendiente por Cancelar</span>
                <span className="font-bold text-amber-600">${order.financials?.pendingBalance?.toLocaleString() || 0}</span>
              </div>
            </div>
          </div>

          {/* Firma / Nota de Cierre */}
          <div className="pt-6 text-center text-xs text-slate-400 border-t border-slate-100 space-y-4">
            <p>Gracias por confiar en nuestros servicios de alta costura.</p>
            <div className="pt-8 flex justify-around">
              <div className="border-t border-slate-300 w-40 pt-1 text-slate-500 font-medium">Firma del Taller</div>
              <div className="border-t border-slate-300 w-40 pt-1 text-slate-500 font-medium">Firma del Cliente</div>
            </div>
          </div>

        </div>

        {/* Pie de modal (No se imprime) */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-end print:hidden">
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