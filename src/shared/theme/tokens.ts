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

export const PALETTE = {
  BLUE_DEEP: '#1D4ED8',
  BLUE_MED: '#3B82F6',
  BLUE_LIGHT: '#60A5FA',
  GREEN_POSITIVE: '#22C55E',
  ORANGE_SOFT: '#F59E0B',
  DOT_CHEST: '#FBBF24',
  DOT_SHOULDERS: '#FB923C',
  DOT_BACK: '#38BDF8',
  DOT_ARMS: '#60A5FA',
  DOT_CORE: '#2DD4BF',
  DOT_CARDIO: '#F59E0B',
} as const;

export const COLORS = {
  blue1: PALETTE.BLUE_LIGHT,
  blue2: PALETTE.BLUE_MED,
  blue3: PALETTE.BLUE_DEEP,
  blue4: '#2D7FF6',
  blue5: '#1B5FCC',
  blue6: '#13479B',

  success: PALETTE.GREEN_POSITIVE,
  warning: PALETTE.ORANGE_SOFT,
  neutral: '#94A3B8',
  actionSecondary: '#8FB5FF',
} as const;

export const MUSCLE_ACCENT = {
  chest: PALETTE.BLUE_DEEP,
  shoulders: PALETTE.BLUE_DEEP,
  back: PALETTE.BLUE_DEEP,
  arms: PALETTE.BLUE_DEEP,
  core: PALETTE.BLUE_MED,
  legs: PALETTE.BLUE_LIGHT,
} as const;
