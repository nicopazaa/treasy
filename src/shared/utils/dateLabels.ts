import { AppLanguage } from '../types';

const WEEKDAYS: Record<AppLanguage, string[]> = {
  nb: ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  es: ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'],
};

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dayDiff(a: Date, b: Date): number {
  const ms = startOfDay(a).getTime() - startOfDay(b).getTime();
  return Math.round(ms / 86400000);
}

export function formatWeekday(date: Date, language: AppLanguage = 'nb'): string {
  return WEEKDAYS[language]?.[date.getDay()] ?? '';
}

export function formatDate(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yy = String(date.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

export function formatShortDate(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}`;
}

export function formatRelativeDayLabel(
  date: Date,
  now: Date = new Date(),
  language: AppLanguage = 'nb'
): string | null {
  const diff = dayDiff(now, date);
  if (diff === 0) return language === 'en' ? 'Today' : language === 'es' ? 'Hoy' : 'I dag';
  if (diff === 1) return language === 'en' ? 'Yesterday' : language === 'es' ? 'Ayer' : 'I går';
  if (diff > 1 && diff < 7) {
    const weekday = formatWeekday(date, language);
    if (!weekday) return null;
    if (language === 'en') return `Last ${weekday}`;
    if (language === 'es') return `El ${weekday} pasado`;
    return `Forrige ${weekday}`;
  }
  return null;
}

function localeForLanguage(language: AppLanguage): string {
  if (language === 'nb') return 'nb-NO';
  if (language === 'es') return 'es-ES';
  return 'en-US';
}

export function formatRelativeDateTime(
  date: Date,
  now: Date = new Date(),
  language: AppLanguage = 'nb'
): string {
  const label = formatRelativeDayLabel(date, now, language);
  const time = date.toLocaleTimeString(localeForLanguage(language), {
    hour: '2-digit',
    minute: '2-digit',
  });
  if (label) return `${label} ${time}`;
  return `${formatDate(date)} ${time}`;
}
