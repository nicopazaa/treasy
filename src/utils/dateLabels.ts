const WEEKDAYS = [
  'sondag',
  'mandag',
  'tirsdag',
  'onsdag',
  'torsdag',
  'fredag',
  'lordag',
];

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dayDiff(a: Date, b: Date): number {
  const ms = startOfDay(a).getTime() - startOfDay(b).getTime();
  return Math.round(ms / 86400000);
}

export function formatWeekday(date: Date): string {
  return WEEKDAYS[date.getDay()] ?? '';
}

export function formatDate(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

export function formatShortDate(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}`;
}

export function formatRelativeDayLabel(date: Date, now: Date = new Date()): string | null {
  const diff = dayDiff(now, date);
  if (diff === 0) return 'I dag';
  if (diff === 1) return 'I gar';
  if (diff > 1 && diff < 7) {
    const weekday = formatWeekday(date);
    return weekday ? `Forrige ${weekday}` : null;
  }
  return null;
}

export function formatRelativeDateTime(date: Date, now: Date = new Date()): string {
  const label = formatRelativeDayLabel(date, now);
  const time = date.toLocaleTimeString('nb-NO', {
    hour: '2-digit',
    minute: '2-digit',
  });
  if (label) return `${label} ${time}`;
  return `${formatDate(date)} ${time}`;
}
