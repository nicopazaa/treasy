import type { AppLanguage } from '../types';

export type MassUnit = 'kg' | 'lb';

export const KG_PER_LB = 0.45359237;

export function toKg(value: number, unit: MassUnit): number {
  if (!Number.isFinite(value)) return NaN;
  return unit === 'lb' ? value * KG_PER_LB : value;
}

export function fromKg(valueKg: number, unit: MassUnit): number {
  if (!Number.isFinite(valueKg)) return NaN;
  return unit === 'lb' ? valueKg / KG_PER_LB : valueKg;
}

function roundToStep(value: number, step: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(step) || step <= 0) return NaN;
  const rounded = Math.round(value / step) * step;
  // Avoid "-0" after rounding.
  return Object.is(rounded, -0) ? 0 : rounded;
}

/**
 * Display rounding rules:
 * - `kg`: round to nearest 0.5
 * - `lb`: round to nearest 1
 */
export function roundForDisplay(value: number, unit: MassUnit): number {
  const step = unit === 'lb' ? 1 : 0.5;
  return roundToStep(value, step);
}

function localeForLanguage(language: AppLanguage): string {
  if (language === 'nb') return 'nb-NO';
  if (language === 'es') return 'es-ES';
  return 'en-US';
}

function formatNumber(language: AppLanguage, value: number, unit: MassUnit): string {
  if (!Number.isFinite(value)) return '';
  const maximumFractionDigits = unit === 'lb' ? 0 : 1;
  try {
    const nf = new Intl.NumberFormat(localeForLanguage(language), {
      maximumFractionDigits,
      minimumFractionDigits: 0,
    });
    return nf.format(value);
  } catch {
    const raw = maximumFractionDigits === 0 ? String(Math.round(value)) : String(value);
    if (language === 'nb' || language === 'es') return raw.replace('.', ',');
    return raw;
  }
}

export function formatWeight(valueKg: number, unit: MassUnit, language: AppLanguage): string {
  const raw = fromKg(valueKg, unit);
  const rounded = roundForDisplay(raw, unit);
  const formatted = formatNumber(language, rounded, unit);
  return formatted ? `${formatted} ${unit}` : `0 ${unit}`;
}

