import type { SetEntry } from '../../domain/workouts/types';
import type { AppLanguage } from '../types';
import { t } from '../i18n/i18n';
import { fromKg, formatWeight, roundForDisplay, type MassUnit } from './units';

export function formatCardioSet(language: AppLanguage, set: SetEntry): string {
  const parts: string[] = [];
  if (set.distanceKm != null) parts.push(`${set.distanceKm} km`);
  if (set.durationMin != null) parts.push(`${set.durationMin} min`);
  if (set.pauseSec != null) parts.push(`${t(language, 'pauseShort')} ${set.pauseSec}s`);
  return parts.length ? parts.join(' / ') : `${set.weight} x ${set.reps}`;
}

export function formatSetSummary(language: AppLanguage, set: SetEntry, massUnit: MassUnit): string {
  if (set.setType === 'cardio') return formatCardioSet(language, set);
  if (set.isBodyweight || set.setType === 'bodyweight' || set.weight === 0) return `BW x ${set.reps}`;
  return `${formatWeight(set.weight, massUnit, language)} x ${set.reps}`;
}

export function formatSetListLabel(language: AppLanguage, set: SetEntry, massUnit: MassUnit): string {
  if (set.setType === 'cardio') return formatCardioSet(language, set);
  if (set.isBodyweight || set.setType === 'bodyweight' || set.weight === 0) {
    return `BW x ${set.reps} ${t(language, 'reps').toLowerCase()}`;
  }
  return `${formatWeight(set.weight, massUnit, language)} x ${set.reps} ${t(language, 'reps').toLowerCase()}`;
}

export function formatInputWeight(valueKg: number, massUnit: MassUnit, language: AppLanguage): string {
  if (!Number.isFinite(valueKg) || valueKg < 0) return '';
  const converted = fromKg(valueKg, massUnit);
  const rounded = roundForDisplay(converted, massUnit);
  const raw = massUnit === 'lb' ? String(Math.round(rounded)) : String(rounded);
  return language === 'nb' || language === 'es' ? raw.replace('.', ',') : raw;
}

