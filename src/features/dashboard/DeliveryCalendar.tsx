import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Phone, User, Calendar } from 'lucide-react';
import type { Customer, Order } from '../../models/types';
import { daysUntil, formatDate, toDateOnly } from '../../utils/dates';
import { formatCurrency } from '../../utils/money';

interface Props {
  orders: Order[];
  customersById: Record<string, Customer>;
  onSelectOrder?: (order: Order) => void;
}

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const STATUS_LABEL: Record<Order['status'], string> = {
  pending: 'Pendiente',
  in_progress: 'En confección',
  ready: 'Listo',
  delivered: 'Entregado',
  cancelled: 'Cancelado'
};

function statusPriority(status: Order['status']) {
  if (status === 'ready') return 0;
  if (status === 'in_progress') return 1;
  if (status === 'pending') return 2;
  return 3;
}

function importanceScore(order: Order, today: string) {
  const days = daysUntil(order.deliveryDate);
  const overdue = days !== null && days < 0 ? 1000 : 0;
  const dueSoon = days !== null && days >= 0 && days <= 3 ? 500 - days * 10 : 0;
  const status = 100 - statusPriority(order.status) * 10;
  const pending =
    Math.max(0, (order.financials?.totalPrice || 0) - (order.financials?.advancePayment || 0)) > 0
      ? 20
      : 0;
  const todayBoost = order.deliveryDate === today ? 200 : 0;
  return overdue + dueSoon + status + pending + todayBoost;
}

export const DeliveryCalendar: React.FC<Props> = ({ orders, customersById, onSelectOrder }) => {
  const today = toDateOnly(new Date());
  const initial = new Date();
  const [month, setMonth] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState<string>(today);

  const deliverable = useMemo(
    () =>
      orders.filter((o) => o.status !== 'delivered' && o.status !== 'cancelled' && o.deliveryDate),
    [orders]
  );

  const byDate = useMemo(() => {
    const map = new Map<string, Order[]>();
    for (const o of deliverable) {
      const list = map.get(o.deliveryDate) ?? [];
      list.push(o);
      map.set(o.deliveryDate, list);
    }
    for (const [k, list] of map) {
      list.sort(
        (a, b) =>
          importanceScore(b, today) - importanceScore(a, today) ||
          a.deliveryDate.localeCompare(b.deliveryDate)
      );
      map.set(k, list);
    }
    return map;
  }, [deliverable, today]);

  const monthLabel = month.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
  const year = month.getFullYear();
  const m = month.getMonth();
  const first = new Date(year, m, 1);
  const last = new Date(year, m + 1, 0);
  // Monday=0
  const startPad = (first.getDay() + 6) % 7;
  const daysInMonth = last.getDate();
  const cells: Array<{ date: string | null; day?: number }> = [];
  for (let i = 0; i < startPad; i++) cells.push({ date: null });
  for (let d = 1; d <= daysInMonth; d++) {
    const date = toDateOnly(new Date(year, m, d));
    cells.push({ date, day: d });
  }
  while (cells.length % 7 !== 0) cells.push({ date: null });

  const selectedOrders = (selectedDate ? (byDate.get(selectedDate) ?? []) : [])
    .slice()
    .sort((a, b) => importanceScore(b, today) - importanceScore(a, today));

  return (
    <div className="glass-panel rounded-2xl p-6 shadow-sm shadow-stone-900/5">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <div>
          <h3 className="text-base font-semibold text-stone-800 flex items-center gap-2">
            Calendario de entregas
          </h3>
          <p className="text-xs text-stone-500">
            Pedidos por entregar, ordenados por importancia (vencidos, próximos, estado y saldo).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMonth(new Date(year, m - 1, 1))}
            className="p-2 rounded-lg border border-stone-200 hover:bg-stone-50"
            aria-label="Mes anterior"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="text-sm font-medium text-stone-700 min-w-40 text-center capitalize">
            {monthLabel}
          </div>
          <button
            type="button"
            onClick={() => setMonth(new Date(year, m + 1, 1))}
            className="p-2 rounded-lg border border-stone-200 hover:bg-stone-50"
            aria-label="Mes siguiente"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAYS.map((d) => (
              <div key={d} className="text-[11px] font-semibold text-stone-400 text-center py-1">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((cell, idx) => {
              if (!cell.date)
                return (
                  <div
                    key={`e-${idx}`}
                    className="h-24 rounded-lg bg-stone-50/40 border border-transparent"
                  />
                );
              const dayOrders = byDate.get(cell.date) ?? [];
              const isToday = cell.date === today;
              const isSelected = cell.date === selectedDate;
              const hasOverdue = dayOrders.some((o) => (daysUntil(o.deliveryDate) ?? 0) < 0);
              return (
                <button
                  key={cell.date}
                  type="button"
                  onClick={() => setSelectedDate(cell.date!)}
                  className={`h-24 rounded-lg border p-1.5 text-left transition-colors ${isSelected ? 'border-[#6f2f3a] bg-stone-50' : 'border-stone-100 hover:border-stone-300 bg-white'} ${isToday ? 'ring-1 ring-amber-300' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-medium ${isToday ? 'text-[#7a6843]' : 'text-stone-600'}`}
                    >
                      {cell.day}
                    </span>
                    {dayOrders.length > 0 && (
                      <span
                        className={`text-[10px] px-1.5 rounded-full ${hasOverdue ? 'bg-rose-100 text-[#6f2f3a]' : 'bg-stone-100 text-stone-600'}`}
                      >
                        {dayOrders.length}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 space-y-1">
                    {dayOrders.slice(0, 2).map((o) => {
                      const c = customersById[o.customerId];
                      return (
                        <div
                          key={o.id}
                          className="text-[10px] truncate text-stone-600 bg-stone-50 rounded px-1 py-0.5"
                        >
                          {c?.fullName ?? 'Cliente'}
                        </div>
                      );
                    })}
                    {dayOrders.length > 2 && (
                      <div className="text-[10px] text-stone-400">+{dayOrders.length - 2} más</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-white/60 p-4 bg-white/40 backdrop-blur-md shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
            Detalle del día
          </p>
          <p className="text-sm font-medium text-stone-800 mt-1">
            {selectedDate ? formatDate(selectedDate) : 'Selecciona un día'}
          </p>
          <div className="mt-3 space-y-2 max-h-[360px] overflow-y-auto">
            {selectedOrders.length === 0 ? (
              <div className="py-8 px-4 text-center rounded-xl bg-white/30 border border-dashed border-white/60 flex flex-col items-center justify-center">
                <Calendar size={22} className="text-stone-400 mb-1.5" />
                <p className="text-xs font-medium text-stone-600">Sin entregas para este día</p>
                <p className="text-[11px] text-stone-400 mt-0.5">
                  Selecciona otra fecha en el calendario.
                </p>
              </div>
            ) : (
              selectedOrders.map((o) => {
                const c = customersById[o.customerId];
                const days = daysUntil(o.deliveryDate);
                const pending = Math.max(
                  0,
                  (o.financials?.totalPrice || 0) - (o.financials?.advancePayment || 0)
                );
                const urgent = days !== null && days < 0;
                return (
                  <button
                    type="button"
                    key={o.id}
                    onClick={() => onSelectOrder?.(o)}
                    className={`w-full text-left rounded-lg border p-3 transition-colors hover:border-stone-300 ${urgent ? 'border-rose-200 bg-rose-50/40' : 'border-stone-100 bg-stone-50/40'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-stone-800">
                          {o.garmentType || 'Prenda'}
                        </p>
                        <p className="text-xs text-stone-500 flex items-center gap-1">
                          <User size={12} /> {c?.fullName ?? 'Cliente no encontrado'}
                        </p>
                        {c?.phone && (
                          <p className="text-xs text-stone-500 flex items-center gap-1">
                            <Phone size={12} /> {c.phone}
                          </p>
                        )}
                      </div>
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full border ${o.status === 'ready' ? 'bg-[#5f6b4d]/12 text-[#4c5640] border-[#5f6b4d]/25' : o.status === 'in_progress' ? 'bg-stone-200/50 text-stone-700 border-stone-300/60' : 'bg-amber-50 text-[#7a6843] border-amber-200'}`}
                      >
                        {STATUS_LABEL[o.status]}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-stone-500">
                      <span>Entrega: {formatDate(o.deliveryDate)}</span>
                      {pending > 0 && <span>Saldo: {formatCurrency(pending)}</span>}
                      {urgent && <span className="text-rose-600 font-medium">Vencido</span>}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
