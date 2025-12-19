export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const SCREEN_PADDING = SPACING.lg;

export const TEXT = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
  title: 32,
};

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
};

export const COLORS = {
  blue1: '#60A5FA',
  blue2: '#3B82F6',
  blue3: '#2563EB',
  blue4: '#1D4ED8',
  blue5: '#1E40AF',
  blue6: '#0B2F6B',

  success: '#22C55E',
  warning: '#F59E0B',
  neutral: '#94A3B8',
} as const;

export const MUSCLE_ACCENT = {
  chest: COLORS.blue2,
  shoulders: COLORS.blue1,
  back: COLORS.blue3,
  arms: COLORS.blue4,
  core: COLORS.blue5,
  legs: COLORS.blue6,
} as const;
