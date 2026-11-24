import { describe, expect, it } from 'vitest';
import { calculatePendingBalance, formatCurrency } from './money';

describe('formatCurrency', () => {
  it('formatea COP en es-CO sin decimales', () => {
    const formatted = formatCurrency(125000, 'COP');

    // es-CO COP usa símbolo $ y separadores; verificamos partes estables
    expect(formatted).toContain('125');
    expect(formatted).toContain('000');
    expect(formatted).toMatch(/\$/);
  });

  it('formatea cero como valor monetario válido', () => {
    const formatted = formatCurrency(0, 'COP');
    expect(formatted).toContain('0');
  });

  it('usa 0 cuando el valor no es finito', () => {
    expect(formatCurrency(Number.NaN, 'COP')).toBe(formatCurrency(0, 'COP'));
    expect(formatCurrency(Number.POSITIVE_INFINITY, 'COP')).toBe(formatCurrency(0, 'COP'));
  });
});

describe('calculatePendingBalance', () => {
  it('calcula saldo pendiente como total - abono', () => {
    expect(calculatePendingBalance(100000, 40000)).toBe(60000);
  });

  it('hace clamp a 0 cuando el abono supera el total', () => {
    expect(calculatePendingBalance(50000, 80000)).toBe(0);
  });

  it('trata valores inválidos como 0', () => {
    expect(calculatePendingBalance(Number.NaN, 1000)).toBe(0);
    expect(calculatePendingBalance(1000, Number.NaN)).toBe(1000);
  });
});
