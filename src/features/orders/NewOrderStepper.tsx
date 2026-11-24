import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  DollarSign,
  FileText,
  Ruler,
  Shirt,
  User,
  X
} from 'lucide-react';
import {
  AppConfig,
  Customer,
  Fabric,
  GarmentType,
  InventoryItem,
  MeasurementDefinition,
  Order,
  OrderConsumption
} from '../../models/types';
import { db } from '../../repositories/dexie/db';
import { settingsRepository } from '../../repositories/dexie/settingsRepository';
import { saveOrderWithConsumptions } from '../../services/orderService';
import { toDateOnly } from '../../utils/dates';
import { calculatePendingBalance, formatCurrency } from '../../utils/money';
import { useDialogA11y } from '../../hooks/useDialogA11y';
import { useToast } from '../../components/ToastProvider';

const CUSTOM_GARMENT = '__custom__';
const DEFAULT_CONFIG: AppConfig = {
  id: 'default',
  profitMargin: 30,
  currency: 'COP',
  businessName: 'Edna Atelier',
  logoDataUrl: '/edna-logo.jpg'
};

interface NewOrderStepperProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  orderToEdit?: Order | null;
}

type Step = 1 | 2 | 3;

export const NewOrderStepper: React.FC<NewOrderStepperProps> = ({
  isOpen,
  onClose,
  onSuccess,
  orderToEdit
}) => {
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [garments, setGarments] = useState<GarmentType[]>([]);
  const [fabrics, setFabrics] = useState<Fabric[]>([]);
  const [measurementDefs, setMeasurementDefs] = useState<MeasurementDefinition[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);

  const [customerId, setCustomerId] = useState('');
  const [garmentTypeId, setGarmentTypeId] = useState(CUSTOM_GARMENT);
  const [customGarmentType, setCustomGarmentType] = useState('');
  const [fabricId, setFabricId] = useState('');
  const [size, setSize] = useState<Order['size']>('M');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [measurements, setMeasurements] = useState<Record<string, number>>({});
  const [consumptions, setConsumptions] = useState<OrderConsumption[]>([]);

  const [materialCost, setMaterialCost] = useState<number | ''>('');
  const [laborCost, setLaborCost] = useState<number | ''>('');
  const [desiredProfitMargin, setDesiredProfitMargin] = useState<number>(30);
  const [advancePayment, setAdvancePayment] = useState<number | ''>('');
  const [customTotalPrice, setCustomTotalPrice] = useState<number | ''>('');
  const [isPriceCustom, setIsPriceCustom] = useState(false);
  const [hasPaymentHistory, setHasPaymentHistory] = useState(false);
  const { showToast } = useToast();

  const selectedCustomer = useMemo(
    () => customers.find((customer) => customer.id === customerId) ?? null,
    [customers, customerId]
  );

  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      setLoadingData(true);
      setError(null);
      try {
        const [
          fetchedCustomers,
          fetchedGarments,
          fetchedFabrics,
          fetchedMeasurements,
          loadedConfig,
          fetchedInventory
        ] = await Promise.all([
          db.customers.toArray(),
          db.garmentTypes.toArray(),
          db.fabrics.toArray(),
          db.measurementDefinitions.toArray(),
          settingsRepository.getConfig(),
          db.inventory.toArray()
        ]);

        const activeGarments = fetchedGarments.filter((garment) => garment.active);
        const activeFabrics = fetchedFabrics.filter((fabric) => fabric.active);
        const activeMeasurements = fetchedMeasurements.filter((measurement) => measurement.active);

        setCustomers(fetchedCustomers);
        setGarments(activeGarments);
        setFabrics(activeFabrics);
        setMeasurementDefs(activeMeasurements);
        setInventory(fetchedInventory);
        setConfig(loadedConfig);

        setStep(1);

        const existingPaymentsCount = orderToEdit
          ? await db.payments.where('orderId').equals(orderToEdit.id).count()
          : 0;

        if (orderToEdit) {
          const isKnownGarment = activeGarments.some((g) => g.id === orderToEdit.garmentTypeId);
          setCustomerId(orderToEdit.customerId || fetchedCustomers[0]?.id || '');
          setGarmentTypeId(isKnownGarment ? orderToEdit.garmentTypeId : CUSTOM_GARMENT);
          setCustomGarmentType(isKnownGarment ? '' : orderToEdit.garmentType || '');
          setFabricId(orderToEdit.fabricId || '');
          setSize(orderToEdit.size || 'M');
          setDeliveryDate(orderToEdit.deliveryDate || '');
          setDescription(orderToEdit.description || '');
          setNotes(orderToEdit.notes || '');
          setMeasurements(orderToEdit.measurements || {});
          setConsumptions(orderToEdit.consumptions ?? []);
          setMaterialCost(orderToEdit.financials?.materialCost ?? '');
          setLaborCost(orderToEdit.financials?.laborCost ?? '');
          setDesiredProfitMargin(
            orderToEdit.financials?.profitMargin ?? loadedConfig.profitMargin ?? 30
          );
          setAdvancePayment(orderToEdit.financials?.advancePayment ?? '');
          setCustomTotalPrice(orderToEdit.financials?.totalPrice ?? '');
          setIsPriceCustom(true);
          setHasPaymentHistory(existingPaymentsCount > 0);
        } else {
          setCustomerId(fetchedCustomers[0]?.id ?? '');
          setGarmentTypeId(activeGarments[0]?.id ?? CUSTOM_GARMENT);
          setCustomGarmentType('');
          setFabricId('');
          setSize('M');
          setDeliveryDate('');
          setDescription('');
          setNotes('');
          setMeasurements({});
          setConsumptions([]);
          setMaterialCost('');
          setLaborCost('');
          setDesiredProfitMargin(loadedConfig.profitMargin ?? 30);
          setAdvancePayment('');
          setCustomTotalPrice('');
          setIsPriceCustom(false);
          setHasPaymentHistory(false);
        }
      } catch (err) {
        console.error('Error al cargar datos del pedido:', err);
        setError('No se pudieron cargar los datos necesarios para el pedido.');
      } finally {
        setLoadingData(false);
      }
    };

    void loadData();
  }, [isOpen, orderToEdit?.id]);

  useEffect(() => {
    if (!selectedCustomer) {
      setMeasurements({});
      return;
    }
    if (orderToEdit && selectedCustomer.id === orderToEdit.customerId) {
      setMeasurements(orderToEdit.measurements ?? selectedCustomer.measurements ?? {});
      return;
    }
    setMeasurements(selectedCustomer.measurements ?? {});
  }, [selectedCustomer?.id, orderToEdit?.id]);

  const dialogRef = useDialogA11y(isOpen, onClose);

  if (!isOpen) return null;

  const numericMaterial = typeof materialCost === 'number' ? Math.max(0, materialCost) : 0;
  const numericLabor = typeof laborCost === 'number' ? Math.max(0, laborCost) : 0;
  const numericAdvance = typeof advancePayment === 'number' ? Math.max(0, advancePayment) : 0;
  const totalCost = numericMaterial + numericLabor;
  const calculatedPrice =
    totalCost > 0 ? Math.round(totalCost * (1 + desiredProfitMargin / 100)) : 0;
  const effectiveTotalPrice =
    isPriceCustom && typeof customTotalPrice === 'number'
      ? Math.max(0, customTotalPrice)
      : calculatedPrice;
  const netProfit = effectiveTotalPrice - totalCost;
  const pendingBalance = calculatePendingBalance(effectiveTotalPrice, numericAdvance);
  const isCustomGarment = garmentTypeId === CUSTOM_GARMENT || garments.length === 0;
  const today = toDateOnly(new Date());

  const selectedGarmentName = isCustomGarment
    ? customGarmentType.trim()
    : (garments.find((garment) => garment.id === garmentTypeId)?.name ?? '');

  const handleMeasurementChange = (key: string, value: string) => {
    const parsed = Number.parseFloat(value);
    setMeasurements((prev) => {
      const next = { ...prev };
      if (Number.isFinite(parsed) && parsed > 0) next[key] = parsed;
      else delete next[key];
      return next;
    });
  };

  const addConsumption = () => {
    const first = inventory[0];
    if (!first) return;
    setConsumptions((prev) => [...prev, { inventoryItemId: first.id, quantity: 1 }]);
  };

  const updateConsumption = (index: number, patch: Partial<OrderConsumption>) => {
    setConsumptions((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  };

  const removeConsumption = (index: number) => {
    setConsumptions((prev) => prev.filter((_, i) => i !== index));
  };

  const validateStep = (currentStep: Step): string | null => {
    if (currentStep === 1) {
      if (!customerId) return 'Selecciona un cliente para continuar.';
      if (!deliveryDate) return 'Selecciona la fecha acordada de entrega.';
      if (!orderToEdit && deliveryDate < today)
        return 'La fecha acordada de entrega no puede ser anterior a hoy.';
      if (isCustomGarment && !customGarmentType.trim()) return 'Escribe el tipo de prenda.';
    }
    if (currentStep === 3) {
      if (effectiveTotalPrice <= 0)
        return 'Indica los costos o ingresa un precio final acordado para el pedido.';
      if (numericAdvance > effectiveTotalPrice)
        return 'El abono no puede superar el precio total del pedido.';
    }
    return null;
  };

  const goNext = () => {
    const validationError = validateStep(step);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setStep((current) => (current < 3 ? ((current + 1) as Step) : current));
  };

  const goBack = () => {
    setError(null);
    setStep((current) => (current > 1 ? ((current - 1) as Step) : current));
  };

  const handleSubmit = async () => {
    const step1Error = validateStep(1);
    const step3Error = validateStep(3);
    const validationError = step1Error || step3Error;
    if (validationError) {
      setError(validationError);
      if (step1Error) setStep(1);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      let resolvedGarmentId = garmentTypeId;
      let resolvedGarmentName =
        garments.find((garment) => garment.id === garmentTypeId)?.name ?? '';

      if (isCustomGarment) {
        const name = customGarmentType.trim();
        resolvedGarmentId = await settingsRepository.addGarmentType(name);
        resolvedGarmentName = name;
      }

      await saveOrderWithConsumptions(
        {
          customerId,
          garmentTypeId: resolvedGarmentId,
          garmentType: resolvedGarmentName,
          fabricId: fabricId || undefined,
          size,
          deliveryDate,
          measurements,
          description: description.trim() || undefined,
          notes: notes.trim() || undefined,
          consumptions,
          financials: {
            materialCost: numericMaterial,
            laborCost: numericLabor,
            totalCost,
            profitMargin:
              totalCost > 0
                ? Math.round(((effectiveTotalPrice - totalCost) / totalCost) * 100)
                : desiredProfitMargin,
            totalPrice: effectiveTotalPrice,
            advancePayment: numericAdvance,
            pendingBalance
          }
        },
        orderToEdit ? { id: orderToEdit.id } : null
      );

      showToast(orderToEdit ? 'Pedido actualizado.' : 'Pedido creado.', 'success');
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error al guardar el pedido:', err);
      const message = err instanceof Error ? err.message : '';
      const known =
        /stock insuficiente|abonos registrados superan|ya no existe|insumo seleccionado/i.test(
          message
        );
      const msg = known
        ? message
        : orderToEdit
          ? 'No se pudo actualizar el pedido. Intenta de nuevo.'
          : 'No se pudo crear el pedido. Intenta de nuevo.';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/30 backdrop-blur-md outline-none"
      role="dialog"
      aria-modal="true"
    >
      <div className="glass-panel-strong rounded-3xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col border border-white/70 shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/50 bg-white/20">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">
              {orderToEdit ? 'Editar pedido' : 'Nuevo pedido'}
            </p>
            <h2 className="text-lg font-semibold text-stone-900">
              {orderToEdit ? 'Actualizar encargo' : 'Registrar encargo'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="p-2 text-stone-400 hover:text-stone-600 hover:bg-white/50 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-3.5 border-b border-white/50 bg-white/10">
          <div className="grid grid-cols-3 gap-3">
            {[
              { id: 1 as Step, label: 'Cliente y prenda', icon: User },
              { id: 2 as Step, label: 'Medidas', icon: Ruler },
              { id: 3 as Step, label: 'Costos y pago', icon: DollarSign }
            ].map(({ id, label, icon: Icon }) => {
              const active = step === id;
              const done = step > id;
              return (
                <div
                  key={id}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm ${
                    active
                      ? 'bg-stone-900 text-white border-stone-900'
                      : done
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-white text-stone-500 border-stone-200'
                  }`}
                >
                  <span
                    className={`w-7 h-7 rounded-lg flex items-center justify-center ${active ? 'bg-white/15' : done ? 'bg-emerald-100' : 'bg-stone-100'}`}
                  >
                    {done ? <Check size={14} /> : <Icon size={14} />}
                  </span>
                  <span className="font-medium">{label}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {error && (
            <div
              role="alert"
              className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700"
            >
              {error}
            </div>
          )}

          {loadingData ? (
            <div className="py-16 text-center text-sm text-stone-400">Cargando datos...</div>
          ) : (
            <>
              {step === 1 && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="step-customer"
                        className="block text-xs font-medium text-stone-700 mb-1"
                      >
                        Cliente *
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                        <select
                          id="step-customer"
                          value={customerId}
                          onChange={(e) => setCustomerId(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 border border-stone-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-300/45 focus:border-amber-300/70"
                        >
                          {customers.length === 0 ? (
                            <option value="">No hay clientes registrados</option>
                          ) : (
                            customers.map((customer) => (
                              <option key={customer.id} value={customer.id}>
                                {customer.fullName} {customer.phone ? `(${customer.phone})` : ''}
                              </option>
                            ))
                          )}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="step-delivery"
                        className="block text-xs font-medium text-stone-700 mb-1"
                      >
                        Fecha de entrega *
                      </label>
                      <div className="relative">
                        <Calendar className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                        <input
                          id="step-delivery"
                          type="date"
                          min={today}
                          value={deliveryDate}
                          onChange={(e) => setDeliveryDate(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-300/45 focus:border-amber-300/70"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="step-garment"
                        className="block text-xs font-medium text-stone-700 mb-1"
                      >
                        Tipo de prenda *
                      </label>
                      <div className="relative">
                        <Shirt className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                        <select
                          id="step-garment"
                          value={garmentTypeId}
                          onChange={(e) => setGarmentTypeId(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 border border-stone-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-300/45 focus:border-amber-300/70"
                        >
                          {garments.map((garment) => (
                            <option key={garment.id} value={garment.id}>
                              {garment.name}
                            </option>
                          ))}
                          <option value={CUSTOM_GARMENT}>Otra prenda (escribir)</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="step-fabric"
                        className="block text-xs font-medium text-stone-700 mb-1"
                      >
                        Tela (opcional)
                      </label>
                      <select
                        id="step-fabric"
                        value={fabricId}
                        onChange={(e) => setFabricId(e.target.value)}
                        className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-300/45 focus:border-amber-300/70"
                      >
                        <option value="">Sin tela seleccionada</option>
                        {fabrics.map((fabric) => (
                          <option key={fabric.id} value={fabric.id}>
                            {fabric.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {isCustomGarment && (
                    <div>
                      <label
                        htmlFor="step-custom-garment"
                        className="block text-xs font-medium text-stone-700 mb-1"
                      >
                        Nombre del tipo de prenda *
                      </label>
                      <input
                        id="step-custom-garment"
                        type="text"
                        value={customGarmentType}
                        onChange={(e) => setCustomGarmentType(e.target.value)}
                        placeholder="Ej. Vestido de gala"
                        className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-300/45 focus:border-amber-300/70"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="step-size"
                        className="block text-xs font-medium text-stone-700 mb-1"
                      >
                        Talla
                      </label>
                      <select
                        id="step-size"
                        value={size}
                        onChange={(e) => setSize(e.target.value)}
                        className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-300/45 focus:border-amber-300/70"
                      >
                        {['XS', 'S', 'M', 'L', 'XL', 'XXL'].map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="step-description"
                        className="block text-xs font-medium text-stone-700 mb-1"
                      >
                        Descripción del encargo
                      </label>
                      <div className="relative">
                        <FileText className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                        <input
                          id="step-description"
                          type="text"
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder="Color, tela, detalles especiales..."
                          className="w-full pl-9 pr-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-300/45 focus:border-amber-300/70"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="step-notes"
                      className="block text-xs font-medium text-stone-700 mb-1"
                    >
                      Observaciones
                    </label>
                    <textarea
                      id="step-notes"
                      rows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Ajustes, fechas internas, indicaciones de confección..."
                      className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-300/45 focus:border-amber-300/70 resize-none"
                    />
                  </div>

                  <div className="border border-stone-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-stone-800">
                          Insumos del inventario (opcional)
                        </p>
                        <p className="text-xs text-stone-500">
                          Se descuentan automáticamente al guardar; puedes ajustar el stock
                          manualmente en Inventario si hace falta.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={addConsumption}
                        disabled={inventory.length === 0}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-stone-200 hover:bg-stone-50 disabled:opacity-50"
                      >
                        Agregar insumo
                      </button>
                    </div>
                    {consumptions.length === 0 ? (
                      <p className="text-xs text-stone-400">
                        {inventory.length === 0
                          ? 'No hay insumos registrados en inventario.'
                          : 'Sin insumos asociados a este pedido.'}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {consumptions.map((c, index) => {
                          const item = inventory.find((i) => i.id === c.inventoryItemId);
                          return (
                            <div
                              key={`${c.inventoryItemId}-${index}`}
                              className="grid grid-cols-1 sm:grid-cols-[1fr_120px_auto] gap-2 items-center"
                            >
                              <select
                                value={c.inventoryItemId}
                                onChange={(e) =>
                                  updateConsumption(index, { inventoryItemId: e.target.value })
                                }
                                className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-white"
                              >
                                {inventory.map((inv) => (
                                  <option key={inv.id} value={inv.id}>
                                    {inv.name} ({inv.stock} {inv.unit})
                                  </option>
                                ))}
                              </select>
                              <input
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={c.quantity}
                                onChange={(e) =>
                                  updateConsumption(index, { quantity: Number(e.target.value) })
                                }
                                className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm"
                                aria-label="Cantidad a descontar"
                              />
                              <button
                                type="button"
                                onClick={() => removeConsumption(index)}
                                className="px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 rounded-lg"
                              >
                                Quitar
                              </button>
                              {item && c.quantity > item.stock && !orderToEdit && (
                                <p className="sm:col-span-3 text-[11px] text-amber-600">
                                  Stock disponible: {item.stock} {item.unit}. Se permitirá guardar,
                                  pero revisa el inventario.
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-stone-800">Medidas del encargo</h3>
                      <p className="text-xs text-stone-500">
                        {selectedCustomer?.measurements
                          ? 'Se precargaron las medidas guardadas del cliente. Puedes ajustarlas para este pedido.'
                          : 'Registra las medidas en centímetros. Solo se guardan las que ingreses.'}
                      </p>
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded-full bg-stone-100 text-stone-600">
                      {measurementDefs.length} campos
                    </span>
                  </div>

                  {measurementDefs.length === 0 ? (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                      No hay medidas configuradas. Puedes continuar y agregar medidas después en
                      Configuración.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {measurementDefs.map((def) => (
                        <div key={def.id}>
                          <label
                            htmlFor={`measure-${def.id}`}
                            className="block text-xs font-medium text-stone-700 mb-1"
                          >
                            {def.name || def.label}
                          </label>
                          <input
                            id={`measure-${def.id}`}
                            type="number"
                            step="0.5"
                            min="0"
                            value={measurements[def.key] ?? ''}
                            onChange={(e) => handleMeasurementChange(def.key, e.target.value)}
                            placeholder="cm"
                            className="w-full px-3 py-2 bg-white/55 backdrop-blur-md border border-white/70 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-300/45 focus:border-amber-300/70"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {step === 3 && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="step-material"
                        className="block text-xs font-medium text-stone-700 mb-1"
                      >
                        Costo de materiales ({config.currency})
                      </label>
                      <input
                        id="step-material"
                        type="number"
                        min="0"
                        value={materialCost}
                        onChange={(e) =>
                          setMaterialCost(e.target.value === '' ? '' : Number(e.target.value))
                        }
                        className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-300/45 focus:border-amber-300/70"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="step-labor"
                        className="block text-xs font-medium text-stone-700 mb-1"
                      >
                        Mano de obra ({config.currency})
                      </label>
                      <input
                        id="step-labor"
                        type="number"
                        min="0"
                        value={laborCost}
                        onChange={(e) =>
                          setLaborCost(e.target.value === '' ? '' : Number(e.target.value))
                        }
                        className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-300/45 focus:border-amber-300/70"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="step-margin"
                        className="block text-xs font-medium text-stone-700 mb-1"
                      >
                        Margen de ganancia (%)
                      </label>
                      <input
                        id="step-margin"
                        type="number"
                        min="0"
                        max="1000"
                        value={desiredProfitMargin}
                        onChange={(e) => setDesiredProfitMargin(Number(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-300/45 focus:border-amber-300/70"
                      />
                      <p className="text-[11px] text-stone-400 mt-1">
                        Por defecto desde Configuración: {config.profitMargin}%
                      </p>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label
                          htmlFor="step-final-price"
                          className="block text-xs font-medium text-stone-700"
                        >
                          Precio final acordado ({config.currency}) *
                        </label>
                        {isPriceCustom && calculatedPrice > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsPriceCustom(false);
                              setCustomTotalPrice('');
                            }}
                            className="text-[11px] text-amber-800 hover:underline"
                          >
                            Usar sugerido ({formatCurrency(calculatedPrice, config.currency)})
                          </button>
                        )}
                      </div>
                      <input
                        id="step-final-price"
                        type="number"
                        min="0"
                        placeholder={
                          calculatedPrice > 0 ? String(calculatedPrice) : 'Ingresa precio total'
                        }
                        value={isPriceCustom ? customTotalPrice : calculatedPrice || ''}
                        onChange={(e) => {
                          setIsPriceCustom(true);
                          setCustomTotalPrice(e.target.value === '' ? '' : Number(e.target.value));
                        }}
                        className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm font-semibold text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-300/45 focus:border-amber-300/70"
                      />
                      <p className="text-[11px] text-stone-400 mt-1">
                        {calculatedPrice > 0
                          ? `Sugerido por costos: ${formatCurrency(calculatedPrice, config.currency)}`
                          : 'Puedes fijar un precio directo sin desglosar costos.'}
                      </p>
                    </div>
                    <div>
                      <label
                        htmlFor="step-advance"
                        className="block text-xs font-medium text-stone-700 mb-1"
                      >
                        Abono inicial ({config.currency})
                      </label>
                      <input
                        id="step-advance"
                        type="number"
                        min="0"
                        max={effectiveTotalPrice}
                        value={advancePayment}
                        onChange={(e) =>
                          setAdvancePayment(e.target.value === '' ? '' : Number(e.target.value))
                        }
                        disabled={hasPaymentHistory}
                        className="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-300/45 focus:border-amber-300/70 disabled:bg-stone-100 disabled:text-stone-500"
                      />
                      {hasPaymentHistory && (
                        <p className="text-[11px] text-stone-500 mt-1">
                          Este pedido ya tiene historial de abonos; el saldo se calcula desde ese
                          historial.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="bg-white/45 backdrop-blur-md border border-white/70 rounded-xl p-4 space-y-3">
                    <div className="flex justify-between text-sm text-stone-600">
                      <span>Costo total</span>
                      <span className="font-medium text-stone-900">
                        {formatCurrency(totalCost, config.currency)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm text-emerald-700">
                      <span>Ganancia estimada</span>
                      <span className="font-medium">
                        +{formatCurrency(netProfit, config.currency)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm text-stone-900 font-semibold pt-3 border-t border-stone-200">
                      <span>Precio total del pedido</span>
                      <span>{formatCurrency(effectiveTotalPrice, config.currency)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-stone-600">Saldo pendiente</span>
                      <span className="font-semibold text-amber-600">
                        {formatCurrency(pendingBalance, config.currency)}
                      </span>
                    </div>
                    {effectiveTotalPrice > 0 && totalCost === 0 && (
                      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        Pedido registrado sin desglose de costos (sin costear).
                      </p>
                    )}
                    {effectiveTotalPrice === 0 && (
                      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        Este pedido no tiene precio definido. Ingresa los costos o escribe el precio
                        acordado.
                      </p>
                    )}
                  </div>

                  <div className="text-xs text-stone-500 bg-white/55 backdrop-blur-md border border-white/70 rounded-xl p-3">
                    <p>
                      <span className="font-medium text-stone-700">Resumen:</span>{' '}
                      {selectedCustomer?.fullName || 'Cliente'} · {selectedGarmentName || 'Prenda'}{' '}
                      · entrega {deliveryDate || 'sin fecha'}
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-white/50 bg-white/20 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={step === 1 ? onClose : goBack}
            className="glass-btn-secondary !py-2 text-xs"
          >
            <ArrowLeft size={16} />
            {step === 1 ? 'Cancelar' : 'Anterior'}
          </button>

          {step < 3 ? (
            <button
              type="button"
              onClick={goNext}
              disabled={loadingData}
              className="glass-btn-primary !py-2 text-xs"
            >
              Siguiente
              <ArrowRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading || loadingData || customers.length === 0}
              className="glass-btn-primary !py-2 text-xs !bg-emerald-700 hover:!bg-emerald-800"
            >
              <Check size={16} />
              {loading ? 'Guardando...' : orderToEdit ? 'Guardar cambios' : 'Guardar pedido'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
