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

