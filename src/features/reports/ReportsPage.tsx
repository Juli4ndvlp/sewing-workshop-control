import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  CalendarRange,
  Wallet,
  TrendingUp,
  Receipt,
  PiggyBank,
  Download
} from 'lucide-react';
import { db } from '../../repositories/dexie/db';
import type { Order, Payment } from '../../models/types';
import { formatCurrency } from '../../utils/money';

function toDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const ReportsPage: React.FC = () => {
  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  const [from, setFrom] = useState(toDateOnly(firstDay));
  const [to, setTo] = useState(toDateOnly(now));
  const [dateCriterion, setDateCriterion] = useState<'createdAt' | 'deliveryDate'>('createdAt');
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [o, p] = await Promise.all([db.orders.toArray(), db.payments.toArray()]);
        setOrders(o);
        setPayments(p);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const report = useMemo(() => {
    const fromDate = from;
    const toDate = to;
    const inRange = (date: string | undefined) => !!date && date >= fromDate && date <= toDate;

    const activeOrders = orders.filter((o) => o.status !== 'cancelled');
    const ordersInRange = activeOrders.filter((o) => {
      const targetDate =
        dateCriterion === 'createdAt'
          ? o.createdAt
            ? toDateOnly(new Date(o.createdAt))
            : undefined
          : o.deliveryDate;
      return inRange(targetDate);
    });
    const paymentsInRange = payments.filter((p) => inRange(p.date));

    const billed = ordersInRange.reduce(
      (sum, o) => sum + Math.max(0, o.financials?.totalPrice ?? 0),
      0
    );
    const cost = ordersInRange.reduce(
      (sum, o) => sum + Math.max(0, o.financials?.totalCost ?? 0),
      0
    );
    const collected = paymentsInRange.reduce((sum, p) => sum + Math.max(0, p.amount ?? 0), 0);
    const realMargin = billed - cost;
    const uncostedCount = ordersInRange.filter(
      (o) => (o.financials?.totalCost ?? 0) === 0 && (o.financials?.totalPrice ?? 0) > 0
    ).length;
    const receivables = activeOrders.reduce((sum, o) => {
      const total = Math.max(0, o.financials?.totalPrice ?? 0);
      const advance = Math.max(0, o.financials?.advancePayment ?? 0);
      return sum + Math.max(0, total - advance);
    }, 0);

    return {
      billed,
      cost,
      collected,
      realMargin,
      receivables,
      uncostedCount,
      orderCount: ordersInRange.length,
      paymentCount: paymentsInRange.length
    };
  }, [orders, payments, from, to, dateCriterion]);

  const cards = [
    {
      label: 'Facturado',
      value: report.billed,
      icon: Receipt,
      note: `${report.orderCount} pedidos en rango`
    },
    {
      label: 'Cobrado',
      value: report.collected,
      icon: Wallet,
      note: `${report.paymentCount} abonos en rango`
    },
    { label: 'Costo', value: report.cost, icon: PiggyBank, note: 'Costos de pedidos en rango' },
    {
      label: 'Margen real',
      value: report.realMargin,
      icon: TrendingUp,
      note:
        report.uncostedCount > 0
          ? `Facturado - costo (${report.uncostedCount} sin costear)`
          : 'Facturado - costo'
    },
    {
      label: 'Cartera',
      value: report.receivables,
      icon: BarChart3,
      note: 'Saldo pendiente activo (global)'
    }
  ];

  const exportCsv = () => {
    try {
      const rows = [
        ['Métrica', 'Valor', 'Nota'],
        ...cards.map((c) => [c.label, String(c.value), c.note]),
        ['Periodo desde', from, ''],
        ['Periodo hasta', to, '']
      ];
      const csv = rows
        .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
        .join('\n');
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reporte-edna-${from}-a-${to}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Error exportando CSV', e);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
            Finanzas
          </p>
          <h1 className="text-3xl font-semibold text-stone-900">Reportes</h1>
          <p className="text-sm text-stone-500 mt-1">
            Resumen por período. Los cancelados se excluyen de facturación y cartera.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="glass-panel rounded-2xl p-1.5 flex flex-wrap items-center gap-2 border border-white/60">
            <select
              value={dateCriterion}
              onChange={(e) => setDateCriterion(e.target.value as 'createdAt' | 'deliveryDate')}
              className="text-xs font-medium border border-white/70 rounded-xl px-2.5 py-2 bg-white/50 backdrop-blur-md text-stone-700 focus:outline-none"
              aria-label="Criterio de fecha para pedidos"
            >
              <option value="createdAt">Por fecha de encargo</option>
              <option value="deliveryDate">Por fecha de entrega</option>
            </select>
            <div className="flex items-center gap-2 bg-white/40 backdrop-blur-md border border-white/70 rounded-xl px-2 py-1">
              <CalendarRange size={15} className="text-stone-400" />
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="text-xs bg-transparent border-0 rounded-lg px-1.5 py-1 text-stone-700 focus:outline-none"
                aria-label="Desde"
              />
              <span className="text-stone-400 text-xs">a</span>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="text-xs bg-transparent border-0 rounded-lg px-1.5 py-1 text-stone-700 focus:outline-none"
                aria-label="Hasta"
              />
            </div>
            <button
              type="button"
              onClick={exportCsv}
              disabled={loading}
              className="glass-btn-secondary text-xs px-3 py-1.5"
            >
              <Download size={14} /> Exportar CSV
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-stone-500">Cargando reporte...</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <div key={c.label} className="glass-panel rounded-2xl p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                    {c.label}
                  </p>
                  <Icon size={16} className="text-stone-400" />
                </div>
                <p
                  className={`text-2xl font-semibold mt-2 ${c.label === 'Margen real' && c.value < 0 ? 'text-rose-600' : 'text-stone-900'}`}
                >
                  {formatCurrency(c.value)}
                </p>
                <p className="text-xs text-stone-500 mt-1">{c.note}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
