export type BlockTone = {
  accent: string;
  soft: string;
};

const KNOWN_TONES: Record<string, BlockTone> = {
  chest: { accent: '#F87171', soft: 'rgba(248, 113, 113, 0.16)' },
  shoulders: { accent: '#F59E0B', soft: 'rgba(245, 158, 11, 0.16)' },
  back: { accent: '#10B981', soft: 'rgba(16, 185, 129, 0.16)' },
  arms: { accent: '#38BDF8', soft: 'rgba(56, 189, 248, 0.16)' },
  core: { accent: '#A3E635', soft: 'rgba(163, 230, 53, 0.16)' },
  legs: { accent: '#6366F1', soft: 'rgba(99, 102, 241, 0.16)' },
  cardio: { accent: '#F43F5E', soft: 'rgba(244, 63, 94, 0.16)' },
};

const NAME_TO_ID: Record<string, string> = {
  bryst: 'chest',
  skuldre: 'shoulders',
  rygg: 'back',
  armer: 'arms',
  core: 'core',
  bein: 'legs',
  cardio: 'cardio',
};

const FALLBACK_ACCENTS = [
  '#0EA5E9',
  '#F97316',
  '#22C55E',
  '#E11D48',
  '#14B8A6',
  '#F59E0B',
];

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function resolveKey(key: string): string {
  const normalized = key.trim().toLowerCase();
  return NAME_TO_ID[normalized] ?? normalized;
}

export function getBlockTone(key: string): BlockTone {
  if (!key) {
    return { accent: '#94A3B8', soft: 'rgba(148, 163, 184, 0.16)' };
  }
  const resolved = resolveKey(key);
  const known = KNOWN_TONES[resolved];
  if (known) return known;

  const idx = hashString(resolved) % FALLBACK_ACCENTS.length;
  const accent = FALLBACK_ACCENTS[idx];
  return { accent, soft: hexToRgba(accent, 0.16) };
}
