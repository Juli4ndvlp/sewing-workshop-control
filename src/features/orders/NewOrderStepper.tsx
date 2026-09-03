import React, { useState, useEffect } from 'react';
import { Check, ArrowRight, ArrowLeft, DollarSign, Ruler, User, Shirt } from 'lucide-react';
import { Customer, GarmentType, Fabric, MeasurementDefinition } from '../../models/types';
import { db } from '../../repositories/dexie/db';
import { DexieOrderRepository } from '../../repositories/dexie/DexieOrderRepository';

const orderRepo = new DexieOrderRepository();

interface NewOrderStepperProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export const NewOrderStepper: React.FC<NewOrderStepperProps> = ({ onSuccess, onCancel }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Catálogos
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [garments, setGarments] = useState<GarmentType[]>([]);
  const [fabrics, setFabrics] = useState<Fabric[]>([]);
  const [measurementDefs, setMeasurementDefs] = useState<MeasurementDefinition[]>([]);

  // Estado del Formulario
  const [customerId, setCustomerId] = useState('');
  const [garmentTypeId, setGarmentTypeId] = useState('');
  const [fabricId, setFabricId] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [measurements, setMeasurements] = useState<Record<string, number>>({});
  
  // Cotizador y Dinero
  const [materialCost, setMaterialCost] = useState<number>(0);
  const [laborCost, setLaborCost] = useState<number>(0);
  const [desiredProfitMargin, setDesiredProfitMargin] = useState<number>(30); // 30% por defecto
  const [advancePayment, setAdvancePayment] = useState<number>(0);

  useEffect(() => {
    const loadData = async () => {
      setCustomers(await db.customers.toArray());
      setGarments(await db.garmentTypes.where('active').equals(1).toArray());
      setFabrics(await db.fabrics.where('active').equals(1).toArray());
      setMeasurementDefs(await db.measurementDefinitions.where('active').equals(1).toArray());
    };
    loadData();
  }, []);

  // Cálculos dinámicos
  const totalCost = (Number(materialCost) || 0) + (Number(laborCost) || 0);
  const calculatedPrice = totalCost > 0 
    ? Math.round(totalCost * (1 + (desiredProfitMargin / 100))) 
    : 0;
  const netProfit = calculatedPrice - totalCost;
  const pendingBalance = calculatedPrice - (Number(advancePayment) || 0);

  const handleMeasurementChange = (key: string, value: string) => {
    const num = parseFloat(value) || 0;
    setMeasurements((prev) => ({ ...prev, [key]: num }));
  };

  const handleSubmit = async () => {
    if (!customerId || !garmentTypeId || !deliveryDate) return;

    await orderRepo.create({
      customerId,
      garmentTypeId,
      fabricId: fabricId || undefined,
      status: 'pending',
      deliveryDate,
      measurements,
      financials: {
        materialCost: Number(materialCost) || 0,
        laborCost: Number(laborCost) || 0,
        totalCost,
        profitMargin: desiredProfitMargin,
        totalPrice: calculatedPrice,
        advancePayment: Number(advancePayment) || 0,
        pendingBalance: Math.max(0, pendingBalance)
      }
    });

    onSuccess();
  };

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl p-6 space-y-6 shadow-sm max-w-3xl mx-auto">
      {/* Stepper Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center space-x-3">
          <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${step >= 1 ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'}`}>1</span>
          <span className="text-sm font-medium text-slate-800">Cliente & Prenda</span>
        </div>
        <div className="h-px w-12 bg-slate-200" />
        <div className="flex items-center space-x-3">
          <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${step >= 2 ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'}`}>2</span>
          <span className="text-sm font-medium text-slate-800">Medidas</span>
        </div>
        <div className="h-px w-12 bg-slate-200" />
        <div className="flex items-center space-x-3">
          <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${step === 3 ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-400'}`}>3</span>
          <span className="text-sm font-medium text-slate-800">Cotización</span>
        </div>
      </div>

      {/* PASO 1: Selección de Cliente y Prenda */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Cliente *</label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
            >
              <option value="">Selecciona un cliente...</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.fullName} - {c.phone}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Tipo de Prenda *</label>
              <select
                value={garmentTypeId}
                onChange={(e) => setGarmentTypeId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              >
                <option value="">Selecciona tipo de prenda...</option>
                {garments.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Tela (Opcional)</label>
              <select
                value={fabricId}
                onChange={(e) => setFabricId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              >
                <option value="">Selecciona tela...</option>
                {fabrics.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Fecha Estimada de Entrega *</label>
            <input
              type="date"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
            />
          </div>
        </div>
      )}

      {/* PASO 2: Toma de Medidas Dinámicas */}
      {step === 2 && (
        <div className="space-y-4">
          <p className="text-xs text-slate-500">Ingresa las medidas corporales en centímetros (cm):</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {measurementDefs.map((def) => (
              <div key={def.id}>
                <label className="block text-xs font-medium text-slate-700 mb-1">{def.label}</label>
                <input
                  type="number"
                  step="0.5"
                  placeholder="0.0"
                  value={measurements[def.key] || ''}
                  onChange={(e) => handleMeasurementChange(def.key, e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PASO 3: Cotizador de Ganancia Automática y Abono */}
      {step === 3 && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Costo de Materiales ($)</label>
              <input
                type="number"
                value={materialCost || ''}
                onChange={(e) => setMaterialCost(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Costo Mano de Obra ($)</label>
              <input
                type="number"
                value={laborCost || ''}
                onChange={(e) => setLaborCost(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">% Márgen de Ganancia Deseado</label>
              <input
                type="number"
                value={desiredProfitMargin}
                onChange={(e) => setDesiredProfitMargin(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Abono Inicial / Anticipo ($)</label>
              <input
                type="number"
                value={advancePayment || ''}
                onChange={(e) => setAdvancePayment(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
            </div>
          </div>

          {/* Desglose en Tiempo Real */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Costo Total Producción:</span>
              <span className="font-semibold text-slate-800">${totalCost.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-emerald-700 font-medium">
              <span>Ganancia estimada:</span>
              <span>+${netProfit.toLocaleString()} ({desiredProfitMargin}%)</span>
            </div>
            <div className="flex justify-between text-slate-900 font-semibold text-sm pt-2 border-t border-slate-200">
              <span>Precio Final Sugerido:</span>
              <span>${calculatedPrice.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Saldo Pendiente:</span>
              <span className="font-semibold text-amber-600">${Math.max(0, pendingBalance).toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      {/* Botones de Navegación */}
      <div className="flex justify-between pt-4 border-t border-slate-100">
        <button
          onClick={step === 1 ? onCancel : () => setStep((s) => (s - 1) as 1 | 2)}
          className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition flex items-center space-x-1"
        >
          <ArrowLeft size={14} />
          <span>{step === 1 ? 'Cancelar' : 'Anterior'}</span>
        </button>

        {step < 3 ? (
          <button
            disabled={step === 1 && (!customerId || !garmentTypeId || !deliveryDate)}
            onClick={() => setStep((s) => (s + 1) as 2 | 3)}
            className="px-4 py-2 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white rounded-xl transition disabled:opacity-50 flex items-center space-x-1 shadow-sm"
          >
            <span>Siguiente</span>
            <ArrowRight size={14} />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            className="px-4 py-2 text-xs font-medium bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl transition flex items-center space-x-1 shadow-sm"
          >
            <Check size={14} />
            <span>Guardar Pedido</span>
          </button>
        )}
      </div>
    </div>
  );
};