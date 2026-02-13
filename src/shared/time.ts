import { t } from './i18n/i18n';
import type { AppLanguage } from './types';

export function now(): number {
  return Date.now();
}

// YYYY-MM-DD in local time.
export function dayKey(ts: number): string {
  const dt = new Date(ts);
  const yyyy = String(dt.getFullYear());
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function localeForLanguage(language: AppLanguage): string {
  if (language === 'nb') return 'nb-NO';
  if (language === 'es') return 'es-ES';
  return 'en-US';
}

export function relativeDayLabel(
  language: AppLanguage,
  isoOrTimestamp: string | number
): { kind: 'today' | 'yesterday' | 'other'; label: string } {
  const parsedMs = typeof isoOrTimestamp === 'number' ? isoOrTimestamp : Date.parse(isoOrTimestamp);
  if (!Number.isFinite(parsedMs)) {
    return { kind: 'other', label: '' };
  }

  const todayKey = dayKey(now());
  const targetKey = dayKey(parsedMs);
  if (targetKey === todayKey) {
    return { kind: 'today', label: t(language, 'common.today') };
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = dayKey(yesterday.getTime());
  if (targetKey === yesterdayKey) {
    return { kind: 'yesterday', label: t(language, 'common.yesterday') };
  }

  const date = new Date(parsedMs);
  return {
    kind: 'other',
    label: date.toLocaleDateString(localeForLanguage(language), {
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
    }),
  };
}
