import { COLORS, MUSCLE_ACCENT } from './tokens';

export type BlockTone = {
  accent: string;
  soft: string;
};

const makeTone = (accent: string): BlockTone => ({
  accent,
  soft: hexToRgba(accent, 0.16),
});

const KNOWN_TONES: Record<string, BlockTone> = {
  chest: makeTone(MUSCLE_ACCENT.chest),
  shoulders: makeTone(MUSCLE_ACCENT.shoulders),
  back: makeTone(MUSCLE_ACCENT.back),
  arms: makeTone(MUSCLE_ACCENT.arms),
  core: makeTone(MUSCLE_ACCENT.core),
  legs: makeTone(MUSCLE_ACCENT.legs),
  cardio: makeTone(COLORS.blue2),
  other: makeTone(COLORS.warning),
};

const NAME_TO_ID: Record<string, string> = {
  bryst: 'chest',
  skuldre: 'shoulders',
  rygg: 'back',
  armer: 'arms',
  core: 'core',
  bein: 'legs',
  cardio: 'cardio',
  annet: 'other',
};

const FALLBACK_ACCENTS = [
  COLORS.blue1,
  COLORS.blue2,
  COLORS.blue3,
  COLORS.blue4,
  COLORS.blue5,
  COLORS.blue6,
];
const NEUTRAL_TONE = makeTone(COLORS.neutral);

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
    return NEUTRAL_TONE;
  }
  const resolved = resolveKey(key);
  const known = KNOWN_TONES[resolved];
  if (known) return known;

  const idx = hashString(resolved) % FALLBACK_ACCENTS.length;
  const accent = FALLBACK_ACCENTS[idx];
  return { accent, soft: hexToRgba(accent, 0.16) };
}
