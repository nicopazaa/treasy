/**
 * Deterministic, locale-safe normalization for exercise name matching.
 *
 * Rules:
 * - trim
 * - collapse whitespace
 * - lowercase
 * - remove diacritics (unicode normalize)
 * - normalize common separators ('-' '_' -> space)
 * - remove punctuation (keep letters/numbers/spaces only)
 */
export function normalizeExerciseName(input: string): string {
  const raw = String(input ?? '').trim();
  if (!raw) return '';

  // Treat common separators as whitespace so "bench-press" matches "bench press".
  let value = raw.replace(/[-_]+/g, ' ');

  // Use compatibility decomposition to handle ligatures (e.g. "Æ" -> "AE") consistently.
  // Remove combining marks afterwards to strip diacritics.
  value = value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');

  value = value.toLowerCase();

  // Keep a-z/0-9/spaces only. After NFKD, most latin characters become ASCII.
  value = value.replace(/[^a-z0-9\s]/g, ' ');

  // Collapse whitespace.
  value = value.replace(/\s+/g, ' ').trim();

  return value;
}

