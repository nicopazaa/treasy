import { COLORS, MUSCLE_ACCENT, PALETTE } from './tokens';

export type BlockTone = {
  accent: string;
  soft: string;
};

const makeTone = (accent: string): BlockTone => ({
  accent,
  soft: hexToRgba(accent, 0.16),
});

const KNOWN_TONES: Record<string, BlockTone> = {
  chest: makeTone(MUSCLE_ACCENT.back),
  shoulders: makeTone(MUSCLE_ACCENT.shoulders),
  back: makeTone(MUSCLE_ACCENT.chest),
  arms: makeTone(MUSCLE_ACCENT.arms),
  core: makeTone(MUSCLE_ACCENT.core),
  legs: makeTone(MUSCLE_ACCENT.legs),
  cardio: makeTone(COLORS.warning),
  other: makeTone(PALETTE.BLUE_MED),
  bodyweight: makeTone(PALETTE.BLUE_MED),
};

const NAME_TO_ID: Record<string, string> = {
  bryst: 'chest',
  skuldre: 'shoulders',
  rygg: 'back',
  armer: 'arms',
  core: 'core',
  bein: 'legs',
  cardio: 'cardio',
  annet: 'bodyweight',
  kroppsvekt: 'bodyweight',
};

const FALLBACK_ACCENTS = [MUSCLE_ACCENT.chest, MUSCLE_ACCENT.core, MUSCLE_ACCENT.legs];
const NEUTRAL_TONE = makeTone(COLORS.neutral);

const DOT_MAP: Record<string, string> = {
  chest: PALETTE.DOT_BACK,
  shoulders: PALETTE.DOT_SHOULDERS,
  back: PALETTE.DOT_CHEST,
  arms: PALETTE.DOT_ARMS,
  core: PALETTE.DOT_CORE,
  legs: MUSCLE_ACCENT.legs,
  cardio: PALETTE.DOT_CARDIO,
  bodyweight: MUSCLE_ACCENT.core,
  other: MUSCLE_ACCENT.core,
};

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

export function getDotColor(key: string): string {
  const resolved = resolveKey(key);
  return DOT_MAP[resolved] ?? MUSCLE_ACCENT.core;
}
