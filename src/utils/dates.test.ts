import { describe, expect, it } from 'vitest';
import { daysUntil, formatDate, parseDateOnly, toDateOnly } from './dates';

describe('parseDateOnly', () => {
  it('convierte YYYY-MM-DD a fecha local sin desfase de día', () => {
    const date = parseDateOnly('2026-11-23');

    expect(date).not.toBeNull();
    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(10); // noviembre = 10
    expect(date?.getDate()).toBe(23);
  });

  it('parsea un ISO con hora usando el parser estándar', () => {
    const date = parseDateOnly('2026-11-23T15:30:00.000Z');

    expect(date).not.toBeNull();
    expect(date?.toISOString()).toBe('2026-11-23T15:30:00.000Z');
  });

  it('retorna null para valores nulos, vacíos o inválidos', () => {
    expect(parseDateOnly(null)).toBeNull();
    expect(parseDateOnly(undefined)).toBeNull();
    expect(parseDateOnly('')).toBeNull();
    expect(parseDateOnly('fecha-invalida')).toBeNull();
  });
});

describe('toDateOnly', () => {
  it('formatea una fecha local como YYYY-MM-DD con padding', () => {
    expect(toDateOnly(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('formatDate', () => {
  it('formatea una fecha date-only en locale es-CO', () => {
    const formatted = formatDate('2026-11-23', 'es-CO');

    expect(formatted).toContain('2026');
    expect(formatted).toMatch(/23/);
  });

  it('retorna "Sin fecha" cuando el valor es inválido', () => {
    expect(formatDate(null)).toBe('Sin fecha');
    expect(formatDate('no-es-fecha')).toBe('Sin fecha');
  });
});

describe('daysUntil', () => {
  it('calcula días calendario positivos desde la fecha de referencia', () => {
    const from = new Date(2026, 10, 20); // 20 nov local
    expect(daysUntil('2026-11-23', from)).toBe(3);
  });

  it('retorna negativo cuando la fecha ya venció', () => {
    const from = new Date(2026, 10, 25);
    expect(daysUntil('2026-11-23', from)).toBe(-2);
  });

  it('retorna null cuando no hay fecha válida', () => {
    expect(daysUntil(null)).toBeNull();
    expect(daysUntil('invalida')).toBeNull();
  });
});
