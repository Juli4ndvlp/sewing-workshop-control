import React, { useState, useEffect } from 'react';
import { Customer, Order } from '../../models/types';
import { DexieOrderRepository } from '../../repositories/dexie/DexieOrderRepository';
import { DexieCustomerRepository } from '../../repositories/dexie/DexieCustomerRepository';
import { X, Save, User, Calendar, DollarSign, FileText } from 'lucide-react';

const orderRepo = new DexieOrderRepository();
const customerRepo = new DexieCustomerRepository();

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const OrderFormModal: React.FC<Props> = ({ isOpen, onClose, onSuccess }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [garmentType, setGarmentType] = useState('');
  const [selectedSize, setSelectedSize] = useState<Order['size']>('M');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [totalPrice, setTotalPrice] = useState<number | ''>('');
  const [advancePayment, setAdvancePayment] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const loadCustomers = async () => {
      try {
        const fetchedCustomers = await customerRepo.getAll();
        setCustomers(fetchedCustomers);
        if (fetchedCustomers.length > 0) {
          setSelectedCustomerId(fetchedCustomers[0].id || '');
        }
      } catch (err) {
        console.error('Error al cargar clientes:', err);
      }
    };

    loadCustomers();
    // Resetear formulario
    setGarmentType('');
    setSelectedSize('M');
    setDeliveryDate('');
    setTotalPrice('');
    setAdvancePayment('');
    setNotes('');
  }, [isOpen]);

  if (!isOpen) return null;

  // Cálculo automático del saldo pendiente
  const numericTotal = typeof totalPrice === 'number' ? totalPrice : 0;
  const numericAdvance = typeof advancePayment === 'number' ? advancePayment : 0;
  const pendingBalance = Math.max(0, numericTotal - numericAdvance);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || !garmentType.trim()) return;

    setLoading(true);
    try {
      const orderData = {
        customerId: selectedCustomerId,
        garmentTypeId: garmentType.trim(),
        garmentType: garmentType.trim(),
        size: selectedSize,
        status: 'pending' as const,
        deliveryDate: deliveryDate || new Date().toISOString(),
        measurements: {},
        financials: {
          materialCost: 0,
          laborCost: 0,
          totalPrice: numericTotal,
          totalCost: 0,
          profitMargin: 0,
          advancePayment: numericAdvance,
          pendingBalance: pendingBalance,
        },
        notes: notes.trim() || undefined,
      };

      await orderRepo.create(orderData);
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error al crear el pedido:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">Nuevo Pedido</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body / Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Selección de Cliente */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Cliente *
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <select
                required
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              >
                {customers.length === 0 ? (
                  <option value="">No hay clientes registrados</option>
                ) : (
                  customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName} {c.phone ? `(${c.phone})` : ''}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {/* Tipo de Prenda / Descripción */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Descripción de la Prenda / Encargo *
            </label>
            <div className="relative">
              <FileText className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                required
                placeholder="Ej. Vestido de gala con ajuste de talle"
                value={garmentType}
                onChange={(e) => setGarmentType(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Talla */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Talla
            </label>
            <select
              value={selectedSize}
              onChange={(e) => setSelectedSize(e.target.value as Order['size'])}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            >
              <option value="XS">XS</option>
              <option value="S">S</option>
              <option value="M">M</option>
              <option value="L">L</option>
              <option value="XL">XL</option>
              <option value="XXL">XXL</option>
            </select>
          </div>

          {/* Fecha de Entrega */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Fecha Acordada de Entrega
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="date"
                value={deliveryDate}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Valores / Pagos */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Precio Total ($)
              </label>
              <div className="relative">
                <DollarSign className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={totalPrice}
                  onChange={(e) => setTotalPrice(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Abono / Anticipo ($)
              </label>
              <div className="relative">
                <DollarSign className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={advancePayment}
                  onChange={(e) => setAdvancePayment(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Saldo Calculado en Tiempo Real */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-sm">
            <span className="text-slate-500 font-medium">Saldo Pendiente Resultante:</span>
            <span className="font-bold text-amber-600">${pendingBalance.toLocaleString()}</span>
          </div>

          {/* Notas Adicionales */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Observaciones o Detalles
            </label>
            <textarea
              rows={2}
              placeholder="Especificaciones de tela, color de hilo, detalles especiales..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
            />
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || customers.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors shadow-sm disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {loading ? 'Creando...' : 'Crear Pedido'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};