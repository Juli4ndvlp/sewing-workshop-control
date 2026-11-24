// src/utils/dates.ts

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Convierte una fecha `YYYY-MM-DD` a un Date en hora local.
 * Evita el desfase de un día que produce `new Date('YYYY-MM-DD')` en zonas UTC negativas.
 */
export const parseDateOnly = (value?: string | null): Date | null => {
  if (!value) return null;

  if (DATE_ONLY_PATTERN.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const toDateOnly = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const formatDate = (value?: string | null, locale = 'es-CO'): string => {
  const date = parseDateOnly(value);
  return date ? date.toLocaleDateString(locale) : 'Sin fecha';
};

/** Días calendario entre hoy y la fecha indicada. Negativo si ya venció. */
export const daysUntil = (value?: string | null, from = new Date()): number | null => {
  const target = parseDateOnly(value);
  if (!target) return null;

  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
};
