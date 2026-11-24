// src/utils/money.ts

export const formatCurrency = (value: number, currency = 'COP'): string =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0
  }).format(Number.isFinite(value) ? value : 0);

export const calculatePendingBalance = (totalPrice: number, advancePayment: number): number =>
  Math.max(0, (Number(totalPrice) || 0) - (Number(advancePayment) || 0));
