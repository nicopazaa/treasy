import type { ThemeMode } from '../types';

export type TreasyThemeId = 'darkBlue' | 'calmLight';

export type TreasyThemeTokens = {
  id: TreasyThemeId;
  bg: string;
  surface: string;
  surfaceAlt: string;
  stroke: string;
  text: string;
  textMuted: string;
  accent: string;
  link: string;
  chip: string;
  iconMuted: string;
  momentumDown: string;
  success: string;
  neutral: string;
  textOnAccent: string;
};

export const DEFAULT_THEME_ID: TreasyThemeId = 'darkBlue';

const THEMES: Record<TreasyThemeId, TreasyThemeTokens> = {
  darkBlue: {
    id: 'darkBlue',
    bg: '#061126',
    surface: '#111C32',
    surfaceAlt: '#1A2942',
    stroke: '#2E415A',
    text: '#EAF1FF',
    textMuted: '#9FB0C8',
    accent: '#4F8EE8',
    link: '#5C91DB',
    chip: '#203A5E',
    iconMuted: '#7F91AB',
    momentumDown: '#F4A424',
    success: '#22C55E',
    neutral: '#8FA1BC',
    textOnAccent: '#F8FBFF',
  },
  calmLight: {
    id: 'calmLight',
    bg: '#F5F2EC',
    surface: '#F4F0EA',
    surfaceAlt: '#E6EEF8',
    stroke: '#D8D1C5',
    text: '#1F2D3D',
    textMuted: '#6E7480',
    accent: '#4F8EE8',
    link: '#2F6FBC',
    chip: '#E3ECF8',
    iconMuted: '#9AA3AF',
    momentumDown: '#D08E26',
    success: '#2E9F62',
    neutral: '#89919C',
    textOnAccent: '#FFFFFF',
  },
};

export function normalizeThemeMode(mode: ThemeMode | null | undefined): TreasyThemeId {
  if (mode === 'calmLight' || mode === 'light') return 'calmLight';
  return 'darkBlue';
}

export function resolveThemeTokens(mode: ThemeMode | null | undefined): TreasyThemeTokens {
  return THEMES[normalizeThemeMode(mode)];
}

export function toggleThemeMode(mode: ThemeMode | null | undefined): TreasyThemeId {
  return normalizeThemeMode(mode) === 'darkBlue' ? 'calmLight' : 'darkBlue';
}
