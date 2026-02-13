import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Image,
  ImageSourcePropType,
  TextInput,
  Animated,
  AccessibilityInfo,
  Modal,
  Pressable,
  useWindowDimensions,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
  type LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavigationContext } from '@react-navigation/native';
import type { AppState, TrainingBlock, TrainingBlockId } from '../features/workouts';
import type { NoteEntry } from '../domain/workouts/types';
import { getBlockTone, getDotColor } from '../shared/theme/blockTone';
import { SPACING, TEXT, RADIUS, SCREEN_PADDING, COLORS, PALETTE } from '../shared/theme/tokens';
import { resolveThemeTokens } from '../shared/theme/themes';
import { STAT_NUMBER_STYLE } from '../shared/theme/typography';
import { blockLabel, t } from '../shared/i18n/i18n';
import { formatExerciseLabel } from '../shared/utils/exerciseLabel';
import { getWorkoutDates, getDailyWorkout, groupDailySets, type GroupedDailySetView } from '../features/workouts';
import { fromKg, formatWeight } from '../shared/utils/units';
import { BLOCK_ICON_SOURCES } from '../shared/ui/blockIcons';
import {
  buildWorkoutTimeline,
  calcPctChange,
  calcTotalVolume,
  calcVolumeByMuscle,
  countSessions,
  getLastDaysRangesUtc,
  getMomentumStatus,
  getWorkoutsInRange,
} from '../domain/analytics/insights';
import { ProgressiveOverloadCard } from '../features/analytics/ui/ProgressiveOverloadCard';
import { PreviousWorkoutsTimeline } from '../features/analytics/ui/PreviousWorkoutsTimeline';
import type { VolumeByMuscleRow } from '../features/analytics/ui/VolumeCard';
import { progressiveOverloadSummary } from '../shared/utils/progressiveOverloadSummary';
import { QuickActionsMenu, type QuickActionsMenuItem } from '../shared/ui/QuickActionsMenu';
import { relativeDayLabel } from '../shared/time';
import { listNotes } from '../features/notes';

type Props = {
  appState: AppState;
  onSelectBlock: (blockId: string) => void;
  onOpenAI: () => void;
  onOpenQuickLog: () => void;
  onOpenHistory: () => void;
  onOpenHistoryForDate?: (dateKey: string) => void;
  onOpenProgress: () => void;
  onOpenRepMax: () => void;
  onOpenAnalysis: () => void;
  onOpenSettings: () => void;
  onStartCardio: () => void;
  onOpenNotert: () => void;
  onAddNote: (text: string) => Promise<{ kind: 'note' | 'workout' }>;
  onFinishWorkout: () => void;
  onSetTheme: (theme: AppState['theme']) => void;
};

const ORDER: TrainingBlockId[] = ['chest', 'shoulders', 'back', 'arms', 'core', 'legs'];
const LAST_WORKOUT_GROUP_ORDER: TrainingBlockId[] = [...ORDER, 'cardio', 'bodyweight'];
const LAST_WORKOUT_GROUP_SET = new Set<TrainingBlockId>(LAST_WORKOUT_GROUP_ORDER);
const EMPTY_EXAMPLES: string[] = [];
const MAX_MUSCLE_CHIPS = 5;
const TILE_PRESS_SCALE = 0.985;
const TILE_PRESS_IN_MS = 110;
const TILE_PRESS_OUT_MS = 110;
const TILE_ICON_WEIGHT_OPACITY = 0.35;
const TILE_ICON_ACTIVE_OPACITY = 0.3;
const GROUP_ICON_DARK_BLUE = '#1E3A8A';
const TWO_COLUMN_MIN_WIDTH = 640;
const NAV_CHEVRON = '\u203A';
const HOME_SURFACE_DARK = '#162539';
const HOME_SURFACE_DARK_BORDER = '#2E415A';
const HOME_SURFACE_MUTED = HOME_SURFACE_DARK;
const HOME_SURFACE_MUTED_BORDER = HOME_SURFACE_DARK_BORDER;
const NOTERT_PREVIEW_ROWS = 3;

function getLatestPreviewNotes(notes: NoteEntry[]): NoteEntry[] {
  return notes
    .filter((note) => note.text.trim().length > 0)
    .slice()
    .sort((a, b) => {
      const aCreatedAt = a.createdAt ?? '';
      const bCreatedAt = b.createdAt ?? '';
      if (aCreatedAt === bCreatedAt) {
        if (a.id === b.id) return 0;
        return a.id < b.id ? 1 : -1;
      }
      return aCreatedAt < bCreatedAt ? 1 : -1;
    })
    .slice(0, 3);
}

type HomeTileInteraction = {
  pressed: boolean;
  hovered: boolean;
};

type PressScaleProps = {
  onPress?: () => void;
  onLongPress?: () => void;
  onPressOut?: () => void;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode | ((interaction: HomeTileInteraction) => React.ReactNode);
  disabled?: boolean;
  hitSlop?: number | { top: number; right: number; bottom: number; left: number };
  delayLongPress?: number;
  accessibilityRole?: 'button';
  accessibilityLabel?: string;
};

const PressScale: React.FC<PressScaleProps> = ({
  onPress,
  onLongPress,
  onPressOut,
  style,
  children,
  disabled,
  hitSlop,
  delayLongPress,
  accessibilityRole,
  accessibilityLabel,
}) => {
  const scale = useRef(new Animated.Value(1)).current;
  const [hovered, setHovered] = useState(false);

  const handlePressIn = () => {
    Animated.timing(scale, {
      toValue: TILE_PRESS_SCALE,
      duration: TILE_PRESS_IN_MS,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  };

  const handlePressOut = () => {
    Animated.timing(scale, {
      toValue: 1,
      duration: TILE_PRESS_OUT_MS,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
    onPressOut?.();
  };

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      disabled={disabled}
      hitSlop={hitSlop}
      delayLongPress={delayLongPress}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
    >
      {({ pressed }) => (
        <Animated.View style={[style, { transform: [{ scale }] }]}>
          {typeof children === 'function' ? children({ pressed, hovered }) : children}
        </Animated.View>
      )}
    </Pressable>
  );
};

type HomeTileButtonProps = {
  onPress: () => void;
  style: StyleProp<ViewStyle>;
  children: (interaction: HomeTileInteraction) => React.ReactNode;
};

const HomeTileButton: React.FC<HomeTileButtonProps> = ({ onPress, style, children }) => (
  <PressScale onPress={onPress} style={style}>
    {children}
  </PressScale>
);

type HomeTileIconProps = {
  source: ImageSourcePropType | null;
  active: boolean;
  tintColor: string;
  activeTintColor: string;
};

const HomeTileIcon: React.FC<HomeTileIconProps> = ({ source, active, tintColor, activeTintColor }) => {
  if (!source) {
    return <View style={[styles.groupDot, { backgroundColor: tintColor }]} />;
  }

  return (
    <View style={styles.groupIconStack}>
      <Image source={source} style={styles.groupIcon} resizeMode="contain" tintColor={tintColor} />
      <Image
        source={source}
        style={[styles.groupIcon, styles.groupIconOverlay, { opacity: TILE_ICON_WEIGHT_OPACITY }]}
        resizeMode="contain"
        tintColor={tintColor}
      />
      {active ? (
        <Image
          source={source}
          style={[styles.groupIcon, styles.groupIconOverlay, { opacity: TILE_ICON_ACTIVE_OPACITY }]}
          resizeMode="contain"
          tintColor={activeTintColor}
        />
      ) : null}
    </View>
  );
};

type LastWorkoutState =
  | { status: 'empty'; message: string }
  | {
      status: 'ready';
      dateLabel: string;
      muscleGroups: TrainingBlockId[];
      exerciseCount: number;
      totalVolumeLabel: string;
      examples: string[];
      exercise: {
        id: string;
        name: string;
        volumeLabel: string;
        setsLabel: string | null;
        tone: ReturnType<typeof getBlockTone>;
      };
    };

const lastWorkoutTitle = (language: AppState['language']): string => {
  if (language === 'nb') return 'Forrige \u00F8kt';
  if (language === 'es') return 'Sesi\u00F3n anterior';
  return 'Previous session';
};

const lastWorkoutTotalTitle = (language: AppState['language']): string => {
  if (language === 'nb') return 'Total volum';
  if (language === 'es') return 'Volumen total';
  return 'Total volume';
};

const openLogLabel = (language: AppState['language']): string => {
  if (language === 'nb') return 'Se tidligere \u00F8kter';
  if (language === 'es') return 'Ver sesiones previas';
  return 'See previous sessions';
};

const formatLastWorkoutDate = (dateKey: string, language: AppState['language']): string => {
  const safeDate = new Date(`${dateKey}T12:00:00`);
  const locale = language === 'nb' ? 'nb-NO' : language === 'es' ? 'es-ES' : 'en-US';
  return safeDate.toLocaleDateString(locale, {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });
};

const selectMainExercise = (groups: GroupedDailySetView[]): GroupedDailySetView | null => {
  if (!groups.length) return null;
  // Deterministic rule: keep the first exercise in the session order (groupDailySets preserves chronological order).
  return groups[0];
};

function isKnownLastWorkoutGroupId(value: unknown): value is TrainingBlockId {
  return typeof value === 'string' && LAST_WORKOUT_GROUP_SET.has(value as TrainingBlockId);
}

const calculateGroupVolume = (group: GroupedDailySetView): number => {
  // Per-exercise volume: sum weight*reps, treating missing/bodyweight weight as 0 to stay consistent with the existing set model.
  return group.sets.reduce((total, set) => {
    if (set.setType === 'cardio') return total;
    if (!Number.isFinite(set.reps) || set.reps <= 0) return total;
    const weight = Number.isFinite(set.weight) && set.weight >= 0 ? set.weight : 0;
    return total + weight * set.reps;
  }, 0);
};

const formatVolumeLabel = (language: AppState['language'], volumeKg: number, massUnit: 'kg' | 'lb'): string => {
  const locale = language === 'nb' ? 'nb-NO' : language === 'es' ? 'es-ES' : 'en-US';
  const formatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const unit = t(language ?? 'en', massUnit === 'lb' ? 'units.lb' : 'units.kg');
  const converted = fromKg(volumeKg, massUnit);
  return `${t(language ?? 'en', 'analysis.volume.title')}: ${formatter.format(Math.round(converted))} ${unit}`;
};

const formatSetsLabel = (
  language: AppState['language'],
  sets: GroupedDailySetView['sets']
): string | null => {
  const repSets = sets.filter((s) => s.setType !== 'cardio' && Number.isFinite(s.reps) && s.reps > 0);
  if (!repSets.length) return null;

  const reps = repSets.map((s) => s.reps);
  const setCount = reps.length;
  const allEqual = reps.every((r) => r === reps[0]);
  if (allEqual) return `${setCount} x ${reps[0]}`;

  const totalReps = reps.reduce((acc, cur) => acc + cur, 0);
  const setLabel = language === 'nb' ? 'sett' : language === 'es' ? 'series' : 'sets';
  return `${setCount} ${setLabel} - ${totalReps} reps`;
};

type VolumeTrend = 'up' | 'down' | 'stable';

const trendFromPct = (pctChange: number): VolumeTrend => {
  if (pctChange >= 5) return 'up';
  if (pctChange <= -5) return 'down';
  return 'stable';
};

const colorForVolumeTrend = (trend: VolumeTrend): string => {
  if (trend === 'up') return COLORS.success;
  if (trend === 'down') return COLORS.warning;
  return COLORS.neutral;
};

const formatVolumeChangeText = (language: AppState['language'], pctChange: number): string => {
  const rounded = Math.round(pctChange);
  if (Math.abs(rounded) < 1) return t(language ?? 'en', 'analysis.volume.changeFlat');
  if (rounded > 0) return t(language ?? 'en', 'analysis.volume.changeUp', { pct: Math.abs(rounded) });
  return t(language ?? 'en', 'analysis.volume.changeDown', { pct: Math.abs(rounded) });
};

const toWorkoutDateKey = (iso: string): string => iso.slice(0, 10);

const formatElapsedClock = (elapsedSeconds: number): string => {
  const safeSeconds = Number.isFinite(elapsedSeconds) && elapsedSeconds > 0 ? Math.floor(elapsedSeconds) : 0;
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const formatDurationForTodayCard = (language: AppState['language'], totalSeconds: number): string => {
  const safeSeconds = Number.isFinite(totalSeconds) && totalSeconds > 0 ? Math.floor(totalSeconds) : 0;
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const roundedMinutes = hours > 0 ? minutes : Math.max(1, Math.floor(safeSeconds / 60));

  if (language === 'nb') {
    if (hours > 0) return `${hours} ${hours === 1 ? 'time' : 'timer'} ${minutes} min`;
    return `${roundedMinutes} ${roundedMinutes === 1 ? 'minutt' : 'minutter'}`;
  }

  if (language === 'es') {
    if (hours > 0) return `${hours} h ${minutes} min`;
    return `${roundedMinutes} min`;
  }

  if (hours > 0) return `${hours} h ${minutes} min`;
  return `${roundedMinutes} min`;
};

const HOME_WORKOUT_ACCENT_FALLBACK = COLORS.blue2;

const parseHexColor = (color: string): [number, number, number] | null => {
  const trimmed = color.trim();
  const clean = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed;
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16)];
};

const toRgba = (color: string, alpha: number): string => {
  const safeAlpha = Number.isFinite(alpha) ? Math.max(0, Math.min(1, alpha)) : 1;
  const rgb = parseHexColor(color) ?? parseHexColor(HOME_WORKOUT_ACCENT_FALLBACK);
  if (!rgb) return `rgba(59, 130, 246, ${safeAlpha})`;
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${safeAlpha})`;
};

const resolveTodayWorkoutAccent = (muscleGroups: readonly TrainingBlockId[] | null | undefined): string => {
  if (!Array.isArray(muscleGroups) || muscleGroups.length === 0) return HOME_WORKOUT_ACCENT_FALLBACK;
  const firstGroup = muscleGroups[0];
  if (typeof firstGroup !== 'string' || firstGroup.length === 0) return HOME_WORKOUT_ACCENT_FALLBACK;
  const mappedColor = getDotColor(firstGroup);
  return typeof mappedColor === 'string' && mappedColor.trim().length > 0 ? mappedColor : HOME_WORKOUT_ACCENT_FALLBACK;
};

type TodaySetView = {
  id: string;
  createdAt: string;
  setLine: string;
};

type TodayExerciseGroup = {
  id: string;
  exerciseLabel: string;
  blockId: TrainingBlockId | null;
  firstCreatedAt: string;
  timeLabel: string;
  volumeKg: number;
  volumeLabel: string;
  sets: TodaySetView[];
};

type TodayWorkoutSummary = {
  dateKey: string;
  dateLabel: string;
  hasWorkout: boolean;
  startTimeIso: string | null;
  startTimeMs: number | null;
  sessionStartedAtIso: string | null;
  sessionStartedAtMs: number | null;
  sessionFinishedAtIso: string | null;
  sessionFinishedAtMs: number | null;
  sessionIsActive: boolean;
  sessionDurationSeconds: number | null;
  totalSets: number;
  totalExercises: number;
  totalVolumeKg: number;
  totalVolumeLabel: string;
  topExercise: string | null;
  muscleGroups: TrainingBlockId[];
  groups: TodayExerciseGroup[];
};

export const HomeScreen: React.FC<Props> = ({
  appState,
  onSelectBlock,
  onOpenAI,
  onOpenQuickLog,
  onOpenHistory,
  onOpenHistoryForDate,
  onOpenProgress,
  onOpenRepMax,
  onOpenAnalysis,
  onOpenSettings,
  onStartCardio,
  onOpenNotert,
  onAddNote,
  onFinishWorkout,
}) => {
  const language = appState.language ?? 'en';
  const massUnit = appState.massUnit ?? 'kg';
  const themeTokens = useMemo(() => resolveThemeTokens(appState.theme), [appState.theme]);
  const unitLabel = massUnit === 'lb' ? t(language, 'units.lb') : t(language, 'units.kg');
  const insets = useSafeAreaInsets();
  const { height: viewportHeight } = useWindowDimensions();
  const headerTopPadding = insets.top + 2; // headerTopPadding: safe area inset plus compact offset
  const headerBottomPadding = 6; // headerBottomPadding: compact space inside header below content
  const headerToQuickLogGap = 6; // gap between header and the QuickLog card
  const [noteText, setNoteText] = useState('');
  const [notesFocused, setNotesFocused] = useState(false);
  const [notesButtonHovered, setNotesButtonHovered] = useState(false);
  const [notesNotice, setNotesNotice] = useState<string | null>(null);
  const [volumeExpanded, setVolumeExpanded] = useState(false);
  const [recentNotes, setRecentNotes] = useState<NoteEntry[]>([]);
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);
  const [analysisAnchorY, setAnalysisAnchorY] = useState<number | null>(null);
  const [layoutWidth, setLayoutWidth] = useState<number | null>(null);
  const [chipRowHeight, setChipRowHeight] = useState<number | null>(null);
  const [lastWorkoutCardHeight, setLastWorkoutCardHeight] = useState<number | null>(null);
  const [compassOpen, setCompassOpen] = useState(false);
  const [lastWorkoutPreviewVisible, setLastWorkoutPreviewVisible] = useState(false);
  const [todayPanelVisible, setTodayPanelVisible] = useState(false);
  const [lastWorkoutPreviewLayout, setLastWorkoutPreviewLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [todayTimerNowMs, setTodayTimerNowMs] = useState(() => Date.now());
  const [exampleIndex, setExampleIndex] = useState(0);
  const exampleAnim = useMemo(() => new Animated.Value(1), []);
  const [lastExampleIndex, setLastExampleIndex] = useState(0);
  const lastExampleAnim = useMemo(() => new Animated.Value(1), []);
  const scrollRef = useRef<ScrollView | null>(null);
  const lastWorkoutCardRef = useRef<View | null>(null);
  const lastWorkoutPreviewAnim = useRef(new Animated.Value(0)).current;
  const todayPanelAnim = useRef(new Animated.Value(0)).current;
  const tickerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickerAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const tickerAnimatingRef = useRef(false);
  const lastExampleIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastExampleAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const lastExampleAnimatingRef = useRef(false);
  const notesNoticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const todayTimerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);
  const navigationContext = useContext(NavigationContext);
  const isTwoColumn = layoutWidth != null && layoutWidth >= TWO_COLUMN_MIN_WIDTH;

  const handlePressWordmark = useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);

  const clearTickerInterval = useCallback(() => {
    if (tickerIntervalRef.current) {
      clearInterval(tickerIntervalRef.current);
      tickerIntervalRef.current = null;
    }
  }, []);
  const stopTickerAnimation = useCallback(() => {
    if (tickerAnimationRef.current) {
      tickerAnimationRef.current.stop();
      tickerAnimationRef.current = null;
    }
  }, []);
  const resetTicker = useCallback(() => {
    stopTickerAnimation();
    tickerAnimatingRef.current = false;
    exampleAnim.stopAnimation(() => exampleAnim.setValue(1));
  }, [exampleAnim, stopTickerAnimation]);
  const clearLastExampleInterval = useCallback(() => {
    if (lastExampleIntervalRef.current) {
      clearInterval(lastExampleIntervalRef.current);
      lastExampleIntervalRef.current = null;
    }
  }, []);
  const stopLastExampleAnimation = useCallback(() => {
    if (lastExampleAnimationRef.current) {
      lastExampleAnimationRef.current.stop();
      lastExampleAnimationRef.current = null;
    }
  }, []);
  const resetLastExample = useCallback(() => {
    stopLastExampleAnimation();
    lastExampleAnimatingRef.current = false;
    lastExampleAnim.stopAnimation(() => lastExampleAnim.setValue(1));
  }, [lastExampleAnim, stopLastExampleAnimation]);

  const flashNotesNotice = useCallback((message: string) => {
    if (notesNoticeTimeoutRef.current) {
      clearTimeout(notesNoticeTimeoutRef.current);
      notesNoticeTimeoutRef.current = null;
    }
    setNotesNotice(message);
    notesNoticeTimeoutRef.current = setTimeout(() => {
      setNotesNotice(null);
      notesNoticeTimeoutRef.current = null;
    }, 1600);
  }, []);

  const handleColumnsLayout = useCallback(({ nativeEvent }: LayoutChangeEvent) => {
    const nextWidth = Math.round(nativeEvent.layout.width);
    if (!Number.isFinite(nextWidth) || nextWidth <= 0) return;
    setLayoutWidth((prev) => (prev === nextWidth ? prev : nextWidth));
  }, []);

  const handleChipLayout = useCallback(({ nativeEvent }: LayoutChangeEvent) => {
    const nextHeight = Math.round(nativeEvent.layout.height);
    if (!Number.isFinite(nextHeight) || nextHeight <= 0) return;
    setChipRowHeight((prev) => (prev ?? nextHeight));
  }, []);

  const handleLastWorkoutCardLayout = useCallback(
    ({ nativeEvent }: LayoutChangeEvent) => {
      if (lastWorkoutCardHeight != null || chipRowHeight == null) return;
      const nextHeight = Math.round(nativeEvent.layout.height);
      if (!Number.isFinite(nextHeight) || nextHeight <= 0) return;
      setLastWorkoutCardHeight(nextHeight);
    },
    [chipRowHeight, lastWorkoutCardHeight]
  );

  useEffect(() => {
    return () => {
      if (notesNoticeTimeoutRef.current) {
        clearTimeout(notesNoticeTimeoutRef.current);
      }
      if (todayTimerIntervalRef.current) {
        clearInterval(todayTimerIntervalRef.current);
        todayTimerIntervalRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  const analysisStretchStyle = isTwoColumn ? styles.analysisAlignStretch : null;
  const notesCardHeightStyle = isTwoColumn ? styles.notesCardStretchWrap : null;
  const notesCardFillStyle = notesCardHeightStyle ? styles.notesCardFill : null;
  const notesInputFillStyle = notesCardHeightStyle ? styles.notesInputFill : null;
  const chipListMaxHeightStyle = chipRowHeight ? { maxHeight: chipRowHeight } : null;
  const lastWorkoutCardHeightStyle = lastWorkoutCardHeight ? { height: lastWorkoutCardHeight } : null;
  const themeSurfaceStyle = useMemo(
    () => ({ backgroundColor: themeTokens.surface, borderColor: themeTokens.stroke }),
    [themeTokens.surface, themeTokens.stroke]
  );
  const themeSurfaceAltStyle = useMemo(
    () => ({ backgroundColor: themeTokens.surfaceAlt, borderColor: themeTokens.stroke }),
    [themeTokens.surfaceAlt, themeTokens.stroke]
  );
  const groupIconWrapStyle = useMemo(
    () =>
      themeTokens.id === 'calmLight'
        ? { backgroundColor: '#DCE6F3', borderColor: toRgba(GROUP_ICON_DARK_BLUE, 0.22) }
        : { backgroundColor: themeTokens.surfaceAlt, borderColor: themeTokens.stroke },
    [themeTokens.id, themeTokens.surfaceAlt, themeTokens.stroke]
  );
  const groupIconTintColor = useMemo(
    () => (themeTokens.id === 'darkBlue' ? themeTokens.text : GROUP_ICON_DARK_BLUE),
    [themeTokens.id, themeTokens.text]
  );
  const groupIconActiveTintColor = themeTokens.accent;
  const themeTextStyle = useMemo(() => ({ color: themeTokens.text }), [themeTokens.text]);
  const themeTextMutedStyle = useMemo(() => ({ color: themeTokens.textMuted }), [themeTokens.textMuted]);
  const themeAccentTextStyle = useMemo(() => ({ color: themeTokens.accent }), [themeTokens.accent]);
  const themeLinkTextStyle = useMemo(() => ({ color: themeTokens.link }), [themeTokens.link]);
  const quickLogTitleToneStyle = useMemo(
    () => ({ color: themeTokens.id === 'darkBlue' ? '#FDE68A' : '#A16207' }),
    [themeTokens.id]
  );
  const quickLogCardToneStyle = useMemo(
    () =>
      themeTokens.id === 'darkBlue'
        ? { backgroundColor: '#0B1730', borderColor: 'rgba(245, 199, 79, 0.52)' }
        : { backgroundColor: '#FFFCF2', borderColor: '#D4A74D' },
    [themeTokens.id]
  );
  const themeChipStyle = useMemo(
    () => ({ backgroundColor: themeTokens.chip, borderColor: themeTokens.stroke }),
    [themeTokens.chip, themeTokens.stroke]
  );
  const notesButtonBaseStyle = useMemo(() => ({ backgroundColor: '#0D9488', borderColor: '#14B8A6' }), []);
  const notesButtonHoverStyle = useMemo(() => ({ backgroundColor: '#14B8A6' }), []);
  const notesButtonPressedStyle = useMemo(() => ({ backgroundColor: '#0F766E' }), []);
  const notesButtonDisabledStyle = useMemo(
    () => ({
      backgroundColor: '#0B5A57',
      borderColor: '#0E6E69',
    }),
    []
  );
  const wordmarkDotGlowStyle = themeTokens.id === 'darkBlue' ? styles.wordmarkDotGlow : null;
  const refreshRecentNotes = useCallback(async () => {
    try {
      const notes = await listNotes();
      if (!isMountedRef.current) return;
      const newest = getLatestPreviewNotes(notes);
      setRecentNotes(newest);
    } catch (e) {
      console.warn('Failed to load notes preview', e);
    }
  }, []);

  useEffect(() => {
    refreshRecentNotes();
    if (!navigationContext?.addListener) return;
    const unsubscribe = navigationContext.addListener('focus', () => {
      refreshRecentNotes();
    });
    return () => {
      unsubscribe?.();
    };
  }, [navigationContext, refreshRecentNotes]);

  const handleNotesSave = useCallback(async () => {
    const trimmed = noteText.trim();
    if (!trimmed) return;
    try {
      const result = await onAddNote(trimmed);
      setNoteText('');
      const noticeKey = result.kind === 'workout' ? 'workoutLogged' : 'noteSaved';
      flashNotesNotice(t(language, noticeKey));
      if (result.kind === 'note') {
        refreshRecentNotes();
      }
    } catch (e) {
      console.warn('Failed to save note', e);
    }
  }, [flashNotesNotice, language, noteText, onAddNote, refreshRecentNotes]);

  const { primaryBlocks, otherBlocks } = useMemo(() => {
    const byId: Record<string, TrainingBlock> = {};
    for (const b of appState.blocks) byId[b.id] = b;

    const ordered: TrainingBlock[] = [];
    for (const id of ORDER) {
      const block = byId[id];
      if (block) ordered.push(block);
    }

    const other = appState.blocks.filter((b) => ['cardio', 'bodyweight'].includes(b.id));
    return { primaryBlocks: ordered, otherBlocks: other };
  }, [appState.blocks]);

  const quickLogExamples = useMemo(() => ['Benkpress 80x5, 90x3', 'Mark\u00F8ft 100x5'], []);
  const formatWeightCompact = useCallback(
    (weightKg: number): string => {
      if (!Number.isFinite(weightKg)) return `0${unitLabel}`;
      const formatted = formatWeight(weightKg, massUnit, language);
      const lastSpace = formatted.lastIndexOf(' ');
      if (lastSpace <= 0) return formatted;
      return `${formatted.slice(0, lastSpace)}${formatted.slice(lastSpace + 1)}`;
    },
    [language, massUnit, unitLabel]
  );

  const labelForBlock = (block: TrainingBlock): string => {
    const id = block.id as TrainingBlockId;
    const known = [...ORDER, 'cardio', 'bodyweight'] as TrainingBlockId[];
    return known.includes(id) ? blockLabel(id, language) : block.name;
  };

  const overload = useMemo(
    () =>
      progressiveOverloadSummary({
        language,
        massUnit,
        exercises: appState.exercises,
        sets: appState.sets,
      }),
    [appState.exercises, appState.sets, language, massUnit]
  );

  const overloadDeltaText = useMemo(() => {
    if (overload.deltaKg == null || !Number.isFinite(overload.deltaKg) || overload.deltaKg <= 0) return null;
    return `+${formatWeight(overload.deltaKg, massUnit, language)}`;
  }, [language, massUnit, overload.deltaKg]);

  const analytics = useMemo(() => {
    const { current, previous } = getLastDaysRangesUtc(7, new Date());
    const sets7d = getWorkoutsInRange(appState, current.start, current.end);
    const setsPrev7d = getWorkoutsInRange(appState, previous.start, previous.end);

    const sessions7d = countSessions(sets7d);
    const sessionsPrev7d = countSessions(setsPrev7d);

    const volume7d = calcTotalVolume(sets7d);
    const volumePrev7d = calcTotalVolume(setsPrev7d);

    const hasData = sessions7d > 0 || sessionsPrev7d > 0;
    const momentum = getMomentumStatus({ sessions7d, sessionsPrev7d, volume7d, volumePrev7d });
    const pctChange = calcPctChange(volume7d, volumePrev7d, { clampAbs: 999 });

    const muscleIds = ORDER as unknown as string[];
    const volumeByMuscle7d = calcVolumeByMuscle(appState, sets7d, muscleIds);
    const volumeByMusclePrev7d = calcVolumeByMuscle(appState, setsPrev7d, muscleIds);

    const timeline = buildWorkoutTimeline(appState, { limit: 5 });

    return {
      hasData,
      momentum,
      volume7d,
      pctChange,
      volumeByMuscle7d,
      volumeByMusclePrev7d,
      timeline,
    };
  }, [appState]);

  const volumeCardProps = useMemo(() => {
    const locale = language === 'nb' ? 'nb-NO' : language === 'es' ? 'es-ES' : 'en-US';
    const formatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
    const converted = fromKg(analytics.volume7d, massUnit);
    const volumeLabel = `${formatter.format(Math.round(converted))} ${unitLabel}`;

    const rows: VolumeByMuscleRow[] = ORDER.map((id) => {
      const label = blockLabel(id, language);
      const current = analytics.volumeByMuscle7d[id] ?? 0;
      const prev = analytics.volumeByMusclePrev7d[id] ?? 0;
      const pct = calcPctChange(current, prev, { clampAbs: 999 });
      return { id, label, volume7d: current, pctChange: pct };
    });

    return {
      totalLabel: t(language, 'analysis.volume.total7d'),
      changePct: analytics.pctChange,
      volumeLabel,
      rows,
    };
  }, [analytics, language, massUnit, unitLabel]);

  const todayDateKey = new Date().toISOString().slice(0, 10);
  const todayWorkout = useMemo<TodayWorkoutSummary>(() => {
    const locale = language === 'nb' ? 'nb-NO' : language === 'es' ? 'es-ES' : 'en-US';
    const formatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
    const emptySummary: TodayWorkoutSummary = {
      dateKey: todayDateKey,
      dateLabel: formatLastWorkoutDate(todayDateKey, language),
      hasWorkout: false,
      startTimeIso: null,
      startTimeMs: null,
      sessionStartedAtIso: null,
      sessionStartedAtMs: null,
      sessionFinishedAtIso: null,
      sessionFinishedAtMs: null,
      sessionIsActive: false,
      sessionDurationSeconds: null,
      totalSets: 0,
      totalExercises: 0,
      totalVolumeKg: 0,
      totalVolumeLabel: `0 ${unitLabel}`,
      topExercise: null,
      muscleGroups: [],
      groups: [],
    };

    const setsToday = appState.sets
      .filter(
        (set) =>
          typeof set.createdAt === 'string' &&
          set.createdAt.length >= 10 &&
          toWorkoutDateKey(set.createdAt) === todayDateKey
      )
      .slice()
      .sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1));
    if (!setsToday.length) return emptySummary;

    const exercisesById = new Map(appState.exercises.map((ex) => [ex.id, ex] as const));
    const groupMap = new Map<string, Omit<TodayExerciseGroup, 'volumeLabel'>>();

    for (const set of setsToday) {
      const exercise = exercisesById.get(set.exerciseId);
      const exerciseLabel = exercise
        ? formatExerciseLabel(exercise)
        : language === 'nb'
          ? 'Ukjent \u00F8velse'
          : language === 'es'
            ? 'Ejercicio desconocido'
            : 'Unknown exercise';
      const maybeBlockId = exercise?.blockId;
      const blockId = isKnownLastWorkoutGroupId(maybeBlockId) ? maybeBlockId : null;
      const groupKey = `${set.exerciseId}__${blockId ?? ''}`;

      if (!groupMap.has(groupKey)) {
        const firstTimeLabel = new Date(set.createdAt).toLocaleTimeString(locale, {
          hour: '2-digit',
          minute: '2-digit',
        });
        groupMap.set(groupKey, {
          id: groupKey,
          exerciseLabel,
          blockId,
          firstCreatedAt: set.createdAt,
          timeLabel: firstTimeLabel,
          volumeKg: 0,
          sets: [],
        });
      }

      const group = groupMap.get(groupKey);
      if (!group) continue;

      if (set.createdAt < group.firstCreatedAt) {
        group.firstCreatedAt = set.createdAt;
        group.timeLabel = new Date(set.createdAt).toLocaleTimeString(locale, {
          hour: '2-digit',
          minute: '2-digit',
        });
      }

      const reps = Number.isFinite(set.reps) && set.reps > 0 ? Math.round(set.reps) : 0;
      const isBodyweightSet =
        set.isBodyweight === true ||
        set.setType === 'bodyweight' ||
        (Number.isFinite(set.weight) && set.weight === 0 && set.setType !== 'cardio');
      const setLine = (() => {
        if (set.setType === 'cardio') {
          const cardioParts: string[] = [];
          if (Number.isFinite(set.distanceKm) && (set.distanceKm ?? 0) > 0) {
            cardioParts.push(`${set.distanceKm} km`);
          }
          if (Number.isFinite(set.durationMin) && (set.durationMin ?? 0) > 0) {
            cardioParts.push(`${set.durationMin} min`);
          }
          if (Number.isFinite(set.pauseSec) && (set.pauseSec ?? 0) > 0) {
            cardioParts.push(`${set.pauseSec}s pause`);
          }
          if (cardioParts.length > 0) return cardioParts.join(' - ');
          return language === 'nb' ? 'Cardio' : language === 'es' ? 'Cardio' : 'Cardio';
        }

        if (isBodyweightSet) {
          return reps > 0 ? `BW x ${reps}` : 'BW';
        }

        const safeWeight = Number.isFinite(set.weight) && set.weight >= 0 ? set.weight : 0;
        const weightText = formatWeight(safeWeight, massUnit, language);
        return reps > 0 ? `${weightText} x ${reps}` : weightText;
      })();

      group.sets.push({
        id: set.id,
        createdAt: set.createdAt,
        setLine,
      });

      if (set.setType !== 'cardio' && Number.isFinite(set.reps) && set.reps > 0) {
        const safeWeight = Number.isFinite(set.weight) && set.weight >= 0 ? set.weight : 0;
        group.volumeKg += safeWeight * set.reps;
      }
    }

    const groups = Array.from(groupMap.values())
      .map((group) => {
        const converted = fromKg(group.volumeKg, massUnit);
        const volumeLabel = `${formatter.format(Math.round(converted))} ${unitLabel}`;
        return {
          ...group,
          sets: group.sets.slice().sort((a, b) => (a.createdAt > b.createdAt ? 1 : -1)),
          volumeLabel,
        };
      })
      .sort((a, b) => (a.firstCreatedAt > b.firstCreatedAt ? 1 : -1));

    const totalVolumeKg = groups.reduce((sum, group) => sum + group.volumeKg, 0);
    const totalVolumeConverted = fromKg(totalVolumeKg, massUnit);
    const totalVolumeLabel = `${formatter.format(Math.round(totalVolumeConverted))} ${unitLabel}`;

    const topExerciseGroup = groups.reduce<TodayExerciseGroup | null>((best, group) => {
      if (!best) return group;
      return group.volumeKg > best.volumeKg ? group : best;
    }, null);
    const topExercise = topExerciseGroup && topExerciseGroup.volumeKg > 0 ? topExerciseGroup.exerciseLabel : null;

    const seenGroups = new Set<TrainingBlockId>();
    for (const group of groups) {
      if (group.blockId) seenGroups.add(group.blockId);
    }
    const muscleGroups = LAST_WORKOUT_GROUP_ORDER.filter((id) => seenGroups.has(id));
    const startTimeIso =
      setsToday.find((set) => Number.isFinite(new Date(set.createdAt).getTime()))?.createdAt ?? null;
    const startTimeMs = startTimeIso ? new Date(startTimeIso).getTime() : null;
    const persistedSession = appState.activeWorkout;
    const persistedStartedAtIso =
      typeof persistedSession?.startedAtISO === 'string' &&
      persistedSession.startedAtISO.length >= 10 &&
      toWorkoutDateKey(persistedSession.startedAtISO) === todayDateKey &&
      Number.isFinite(new Date(persistedSession.startedAtISO).getTime())
        ? persistedSession.startedAtISO
        : null;
    const sessionStartedAtIso = persistedStartedAtIso ?? startTimeIso;
    const sessionStartedAtMs =
      sessionStartedAtIso != null && Number.isFinite(new Date(sessionStartedAtIso).getTime())
        ? new Date(sessionStartedAtIso).getTime()
        : null;
    const persistedFinishedAtIso =
      typeof persistedSession?.finishedAtISO === 'string' &&
      Number.isFinite(new Date(persistedSession.finishedAtISO).getTime())
        ? persistedSession.finishedAtISO
        : null;
    const sessionFinishedAtMs =
      persistedFinishedAtIso != null && sessionStartedAtMs != null
        ? Math.max(new Date(persistedFinishedAtIso).getTime(), sessionStartedAtMs)
        : null;
    const sessionFinishedAtIso =
      sessionFinishedAtMs != null ? new Date(sessionFinishedAtMs).toISOString() : null;
    const sessionIsActive = groups.length > 0 && sessionStartedAtMs != null && sessionFinishedAtMs == null;
    const sessionDurationSeconds =
      sessionStartedAtMs != null && sessionFinishedAtMs != null
        ? Math.max(0, Math.floor((sessionFinishedAtMs - sessionStartedAtMs) / 1000))
        : null;

    return {
      dateKey: todayDateKey,
      dateLabel: formatLastWorkoutDate(todayDateKey, language),
      hasWorkout: groups.length > 0,
      startTimeIso,
      startTimeMs: Number.isFinite(startTimeMs) ? startTimeMs : null,
      sessionStartedAtIso,
      sessionStartedAtMs,
      sessionFinishedAtIso,
      sessionFinishedAtMs,
      sessionIsActive,
      sessionDurationSeconds,
      totalSets: setsToday.length,
      totalExercises: groups.length,
      totalVolumeKg,
      totalVolumeLabel,
      topExercise,
      muscleGroups,
      groups,
    };
  }, [appState.activeWorkout, appState.exercises, appState.sets, language, massUnit, todayDateKey, unitLabel]);

  const volumeNumberFormatter = useMemo(() => {
    const locale = language === 'nb' ? 'nb-NO' : language === 'es' ? 'es-ES' : 'en-US';
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  }, [language]);
  const formatVolumeNumber = useCallback(
    (value: number) => volumeNumberFormatter.format(Math.round(value)),
    [volumeNumberFormatter]
  );

  const volumeTrend = analytics.hasData ? trendFromPct(volumeCardProps.changePct) : 'stable';
  const volumeChangeColor = analytics.hasData ? colorForVolumeTrend(volumeTrend) : COLORS.neutral;
  const volumeChangeText = analytics.hasData
    ? formatVolumeChangeText(language, volumeCardProps.changePct)
    : t(language, 'analysis.empty');
  const volumeDeltaTone = analytics.hasData
    ? volumeTrend === 'up'
      ? {
          backgroundColor: toRgba(themeTokens.success, 0.16),
          borderColor: toRgba(themeTokens.success, 0.4),
        }
      : volumeTrend === 'down'
        ? {
            backgroundColor: toRgba(themeTokens.momentumDown, 0.16),
            borderColor: toRgba(themeTokens.momentumDown, 0.4),
          }
        : {
            backgroundColor: toRgba(themeTokens.neutral, 0.16),
            borderColor: toRgba(themeTokens.neutral, 0.38),
          }
    : {
        backgroundColor: toRgba(themeTokens.neutral, 0.12),
        borderColor: toRgba(themeTokens.neutral, 0.3),
      };

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (!cancelled) setReduceMotionEnabled(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (enabled) => {
      setReduceMotionEnabled(enabled);
    });
    return () => {
      cancelled = true;
      subscription?.remove?.();
    };
  }, []);

  const shouldUseNativeDriver = Platform.OS !== 'web' && !reduceMotionEnabled;

  const momentumTitle = t(language, 'analysis.momentum.title');
  const momentumBasedOn = t(language, 'analysis.momentum.basedOn7d');
  const momentumMain = !analytics.hasData
    ? t(language, 'analysis.empty')
    : analytics.momentum === 'up'
      ? t(language, 'analysis.momentum.up')
      : analytics.momentum === 'down'
        ? t(language, 'analysis.momentum.down')
        : t(language, 'analysis.momentum.stable');
  const momentumColor = !analytics.hasData
    ? themeTokens.neutral
    : analytics.momentum === 'up'
      ? themeTokens.success
      : analytics.momentum === 'down'
        ? themeTokens.momentumDown
        : themeTokens.neutral;

  const scrollToAnalysis = useCallback(() => {
    if (analysisAnchorY == null) return;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: Math.max(analysisAnchorY - 12, 0), animated: true });
    });
  }, [analysisAnchorY]);

  const openLastWorkoutPreview = useCallback(() => {
    if (lastWorkoutPreviewVisible) return;
    if (!lastWorkoutCardRef.current) return;
    lastWorkoutCardRef.current.measureInWindow((x, y, width, height) => {
      setLastWorkoutPreviewLayout({ x, y, width, height });
      setLastWorkoutPreviewVisible(true);
      lastWorkoutPreviewAnim.setValue(0);
      Animated.spring(lastWorkoutPreviewAnim, {
        toValue: 1,
        friction: 8,
        tension: 80,
        useNativeDriver: true,
      }).start();
    });
  }, [lastWorkoutPreviewAnim, lastWorkoutPreviewVisible]);

  const closeLastWorkoutPreview = useCallback(() => {
    if (!lastWorkoutPreviewVisible) return;
    Animated.timing(lastWorkoutPreviewAnim, {
      toValue: 0,
      duration: 140,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setLastWorkoutPreviewVisible(false);
    });
  }, [lastWorkoutPreviewAnim, lastWorkoutPreviewVisible]);

  const openTodayPanel = useCallback(() => {
    setTodayTimerNowMs(Date.now());
    setTodayPanelVisible(true);
  }, []);

  const closeTodayPanel = useCallback(() => {
    if (todayTimerIntervalRef.current) {
      clearInterval(todayTimerIntervalRef.current);
      todayTimerIntervalRef.current = null;
    }
    Animated.timing(todayPanelAnim, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      setTodayPanelVisible(false);
    });
  }, [todayPanelAnim]);

  const closeCompass = useCallback(() => setCompassOpen(false), []);

  useEffect(() => {
    if (!todayPanelVisible) return;

    setTodayTimerNowMs(Date.now());
    todayPanelAnim.stopAnimation();
    todayPanelAnim.setValue(0);
    Animated.timing(todayPanelAnim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();

    if (todayTimerIntervalRef.current) {
      clearInterval(todayTimerIntervalRef.current);
      todayTimerIntervalRef.current = null;
    }
    todayTimerIntervalRef.current = setInterval(() => {
      setTodayTimerNowMs(Date.now());
    }, 1000);

    return () => {
      if (todayTimerIntervalRef.current) {
        clearInterval(todayTimerIntervalRef.current);
        todayTimerIntervalRef.current = null;
      }
    };
  }, [todayPanelAnim, todayPanelVisible]);

  const compassActions = useMemo<QuickActionsMenuItem[]>(
    () => [
      {
        id: 'progress',
        icon: '\uD83D\uDCC8',
        label: language === 'nb' ? '\u00C5pne utvikling' : language === 'es' ? 'Abrir progreso' : 'Open progress',
        subtitle:
          language === 'nb'
            ? 'Se progresjon og trender'
            : language === 'es'
              ? 'Ver progreso y tendencias'
              : 'See progress and trends',
        onPress: onOpenProgress,
      },
      {
        id: 'repMax',
        icon: '\uD83C\uDFCB\uFE0F',
        label:
          language === 'nb'
            ? '\u00C5pne beste l\u00F8ft'
            : language === 'es'
              ? 'Abrir mejores levantamientos'
              : 'Open best lifts',
        subtitle:
          language === 'nb'
            ? 'Dine topp-sett'
            : language === 'es'
              ? 'Tus mejores series'
              : 'Your top sets',
        onPress: onOpenRepMax,
      },
      {
        id: 'appa',
        icon: '\uD83E\uDD16',
        label: language === 'nb' ? '\u00C5pne Appa-AI' : language === 'es' ? 'Abrir Appa-AI' : 'Open Appa-AI',
        subtitle:
          language === 'nb'
            ? 'Sp\u00F8r om trening og logging'
            : language === 'es'
              ? 'Preguntar sobre entrenamiento y registro'
              : 'Ask about training and logging',
        onPress: onOpenAI,
      },
      {
        id: 'analysis',
        icon: '\uD83D\uDD0D',
        label:
          language === 'nb'
            ? 'G\u00E5 til analyseseksjonen'
            : language === 'es'
              ? 'Ir a la secci\u00F3n de an\u00E1lisis'
              : 'Go to analysis section',
        subtitle:
          language === 'nb'
            ? 'Mer detaljer og grafer'
            : language === 'es'
              ? 'M\u00E1s detalles y gr\u00E1ficas'
              : 'More details and charts',
        onPress: scrollToAnalysis,
      },
    ],
    [language, onOpenAI, onOpenProgress, onOpenRepMax, scrollToAnalysis]
  );

  const runTickerCycle = useCallback(() => {
    if (reduceMotionEnabled) return;
    if (tickerAnimatingRef.current) return;
    tickerAnimatingRef.current = true;

    stopTickerAnimation();
    const fadeOut = Animated.timing(exampleAnim, {
      toValue: 0,
      duration: 180,
      useNativeDriver: shouldUseNativeDriver,
    });
    tickerAnimationRef.current = fadeOut;
    fadeOut.start(({ finished }) => {
      if (!finished) {
        tickerAnimatingRef.current = false;
        return;
      }

      setExampleIndex((idx) => (idx + 1) % quickLogExamples.length);
      exampleAnim.setValue(0);

      const fadeIn = Animated.timing(exampleAnim, {
        toValue: 1,
        duration: 180,
        useNativeDriver: shouldUseNativeDriver,
      });
      tickerAnimationRef.current = fadeIn;
      fadeIn.start(({ finished: finishedIn }) => {
        tickerAnimatingRef.current = false;
        if (finishedIn) {
          tickerAnimationRef.current = null;
        }
      });
    });
  }, [exampleAnim, quickLogExamples.length, reduceMotionEnabled, shouldUseNativeDriver, stopTickerAnimation]);

  const startTicker = useCallback(() => {
    clearTickerInterval();
    resetTicker();
    if (reduceMotionEnabled) return;
    runTickerCycle();
    tickerIntervalRef.current = setInterval(runTickerCycle, 3200);
  }, [clearTickerInterval, resetTicker, reduceMotionEnabled, runTickerCycle]);

  const stopTicker = useCallback(() => {
    clearTickerInterval();
    resetTicker();
  }, [clearTickerInterval, resetTicker]);

  useEffect(() => {
    if (navigationContext?.addListener) {
      const unsubscribeFocus = navigationContext.addListener('focus', startTicker);
      const unsubscribeBlur = navigationContext.addListener('blur', stopTicker);
      startTicker();
      return () => {
        unsubscribeFocus?.();
        unsubscribeBlur?.();
        stopTicker();
      };
    }

    startTicker();
    return () => {
      stopTicker();
    };
  }, [navigationContext, startTicker, stopTicker]);

  const resolveBlockLabel = useMemo(() => {
    const known = new Set<string>([...ORDER, 'cardio', 'bodyweight']);
    const byId = new Map(appState.blocks.map((b) => [b.id, b.name] as const));
    return (blockId: string | null): string | null => {
      if (!blockId) return null;
      if (known.has(blockId)) return blockLabel(blockId as any, language);
      return byId.get(blockId) ?? null;
    };
  }, [appState.blocks, language]);

  const openHistoryForDate = (dateKey: string) => {
    if (onOpenHistoryForDate) {
      onOpenHistoryForDate(dateKey);
      return;
    }
    onOpenHistory();
  };

  const resolveBlockIcon = (blockId: string): ImageSourcePropType | null => {
    const id = blockId as TrainingBlockId;
    return BLOCK_ICON_SOURCES[id] ?? null;
  };

  

  const lastWorkout = useMemo<LastWorkoutState>(() => {
    const noWorkouts: LastWorkoutState = {
      status: 'empty',
      message: 'Ingen \u00F8kter registrert enn\u00E5.',
    };

    const dates = getWorkoutDates(appState);
    if (dates.length === 0) return noWorkouts;

    const dateKey = dates[0];
    const grouped = groupDailySets(getDailyWorkout(appState, dateKey));
    if (!grouped.length) {
      return { status: 'empty', message: 'Ingen \u00F8velser registrert p\u00E5 denne \u00F8kten.' };
    }

    const mainExercise = selectMainExercise(grouped);
    if (!mainExercise) {
      return { status: 'empty', message: 'Ingen \u00F8velser registrert p\u00E5 denne \u00F8kten.' };
    }

    const tone = getBlockTone(mainExercise.blockId ?? 'other');
    const name = mainExercise.exerciseLabel || mainExercise.exerciseName;
    const volume = calculateGroupVolume(mainExercise);
    const setsLabel = formatSetsLabel(language, mainExercise.sets);
    const totalVolume = grouped.reduce((sum, g) => sum + calculateGroupVolume(g), 0);
    const totalVolumeLabel = (() => {
      const locale = language === 'nb' ? 'nb-NO' : language === 'es' ? 'es-ES' : 'en-US';
      const formatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
      const title = lastWorkoutTotalTitle(language);
      const converted = fromKg(totalVolume, massUnit);
      return `${title}: ${formatter.format(Math.round(converted))} ${unitLabel}`;
    })();

    const seenGroups = new Set<TrainingBlockId>();
    for (const group of grouped) {
      if (isKnownLastWorkoutGroupId(group.blockId)) {
        seenGroups.add(group.blockId);
      }
    }
    const muscleGroups = LAST_WORKOUT_GROUP_ORDER.filter((id) => seenGroups.has(id));
    let lastWorkoutTimestamp: string | number = `${dateKey}T12:00:00`;
    let lastWorkoutTimestampMs = Number.NEGATIVE_INFINITY;
    for (const set of appState.sets) {
      if (typeof set?.createdAt !== 'string') continue;
      if (!set.createdAt.startsWith(dateKey)) continue;
      const parsedMs = Date.parse(set.createdAt);
      if (!Number.isFinite(parsedMs) || parsedMs <= lastWorkoutTimestampMs) continue;
      lastWorkoutTimestampMs = parsedMs;
      lastWorkoutTimestamp = set.createdAt;
    }
    const relativeLastWorkoutDay = relativeDayLabel(language ?? 'en', lastWorkoutTimestamp);

    const examples = grouped
      .map((g) => {
        const title = g.exerciseLabel || g.exerciseName;
        const primarySet =
          g.sets.find(
            (s) =>
              s.setType !== 'cardio' && Number.isFinite(s.reps) && s.reps > 0 && Number.isFinite(s.weight)
          ) ||
          g.sets.find((s) => s.setType !== 'cardio' && Number.isFinite(s.reps) && s.reps > 0) ||
          null;
        if (primarySet && Number.isFinite(primarySet.weight) && primarySet.reps) {
          const weight = formatWeightCompact(primarySet.weight ?? 0);
          const reps = primarySet.reps;
          return `${title}: ${weight} x ${reps}r`;
        }
        if (primarySet && primarySet.reps) {
          return `${title}: ${primarySet.reps}r`;
        }
        return title || null;
      })
      .filter((v): v is string => Boolean(v));

    return {
      status: 'ready',
      dateLabel: relativeLastWorkoutDay.label || formatLastWorkoutDate(dateKey, language),
      muscleGroups,
      exerciseCount: grouped.length,
      totalVolumeLabel,
      examples,
      exercise: {
        id: mainExercise.id,
        name,
        volumeLabel: formatVolumeLabel(language, volume, massUnit),
        setsLabel,
        tone,
      },
    };
  }, [appState, formatWeightCompact, language, massUnit, unitLabel]);
  const lastWorkoutExamples = lastWorkout.status === 'ready' ? lastWorkout.examples : EMPTY_EXAMPLES;

  useEffect(() => {
    clearLastExampleInterval();
    resetLastExample();
    setLastExampleIndex(0);

    if (reduceMotionEnabled) return;
    if (lastWorkout.status !== 'ready') return;
    const items = lastWorkoutExamples;
    if (!items.length) return;

    const runCycle = () => {
      if (lastExampleAnimatingRef.current) return;
      lastExampleAnimatingRef.current = true;

      stopLastExampleAnimation();
      const fadeOut = Animated.timing(lastExampleAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: shouldUseNativeDriver,
      });
      lastExampleAnimationRef.current = fadeOut;
      fadeOut.start(({ finished }) => {
        if (!finished) {
          lastExampleAnimatingRef.current = false;
          return;
        }
        setLastExampleIndex((idx) => (idx + 1) % items.length);
        lastExampleAnim.setValue(0);

        const fadeIn = Animated.timing(lastExampleAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: shouldUseNativeDriver,
        });
        lastExampleAnimationRef.current = fadeIn;
        fadeIn.start(({ finished: finishedIn }) => {
          lastExampleAnimatingRef.current = false;
          if (finishedIn) {
            lastExampleAnimationRef.current = null;
          }
        });
      });
    };

    runCycle();
    if (items.length > 1) {
      lastExampleIntervalRef.current = setInterval(runCycle, 3200);
    }

    return () => {
      clearLastExampleInterval();
      resetLastExample();
    };
  }, [
    clearLastExampleInterval,
    lastExampleAnim,
    lastWorkoutExamples,
    lastWorkout.status,
    reduceMotionEnabled,
    resetLastExample,
    shouldUseNativeDriver,
    stopLastExampleAnimation,
  ]);

  const renderLastWorkoutBody = (expanded: boolean) => {
    if (lastWorkout.status !== 'ready') {
      return <Text style={[styles.lastWorkoutEmpty, themeTextMutedStyle]}>{lastWorkout.message}</Text>;
    }
    const exampleText = lastWorkoutExamples.length
      ? lastWorkoutExamples[lastExampleIndex % lastWorkoutExamples.length]
      : '';
    const muscleGroups = lastWorkout.muscleGroups ?? [];
    const hasOverflow = muscleGroups.length > MAX_MUSCLE_CHIPS;
    const visibleGroups = hasOverflow ? muscleGroups.slice(0, MAX_MUSCLE_CHIPS - 1) : muscleGroups;
    const hiddenCount = hasOverflow ? muscleGroups.length - visibleGroups.length : 0;
    const totalVolumeTitleText = `${lastWorkoutTotalTitle(language)}:`;
    const totalVolumeValue = lastWorkout.totalVolumeLabel.startsWith(totalVolumeTitleText)
      ? lastWorkout.totalVolumeLabel.slice(totalVolumeTitleText.length).trim()
      : lastWorkout.totalVolumeLabel;
    const exampleSeparatorIdx = exampleText.indexOf(':');
    const exampleName = exampleSeparatorIdx >= 0 ? exampleText.slice(0, exampleSeparatorIdx).trim() : exampleText;
    const exampleSetLine = exampleSeparatorIdx >= 0 ? exampleText.slice(exampleSeparatorIdx + 1).trim() : '';
    const totalVolumeMatch = totalVolumeValue.match(/^(.+?)\s*([a-zA-Z]+)$/);
    const totalVolumeNumber = totalVolumeMatch ? totalVolumeMatch[1].trim() : totalVolumeValue;
    const totalVolumeUnit = totalVolumeMatch ? totalVolumeMatch[2].trim() : '';
    const totalVolumeUnitLabel = totalVolumeUnit
      ? `${totalVolumeUnit.slice(0, 1).toUpperCase()}${totalVolumeUnit.slice(1).toLowerCase()}`
      : '';
    const setLineMatch = exampleSetLine.match(/^(\d+(?:[.,]\d+)?)\s*([a-zA-Z]+)\s*x\s*(\d+)\s*r$/i);
    const setLineWeight = setLineMatch ? setLineMatch[1] : null;
    const setLineUnit = setLineMatch ? setLineMatch[2] : null;
    const setLineReps = setLineMatch ? setLineMatch[3] : null;
    const setLineUnitLabel = setLineUnit ? `${setLineUnit.slice(0, 1).toUpperCase()}${setLineUnit.slice(1).toLowerCase()}` : null;
    return (
      <>
        <Text style={[styles.lastWorkoutDate, themeLinkTextStyle, STAT_NUMBER_STYLE]}>{lastWorkout.dateLabel}</Text>
        <Text style={[styles.lastWorkoutTitle, themeTextStyle, { borderBottomColor: themeTokens.accent }]}>
          {lastWorkoutTitle(language)}
        </Text>
        {visibleGroups.length ? (
          <>
            <Text style={[styles.lastWorkoutSectionLabel, themeTextMutedStyle]}>{t(language, 'muscleGroups')}</Text>
            <ScrollView
              style={[styles.lastWorkoutChipScroll, chipListMaxHeightStyle ?? undefined]}
              contentContainerStyle={styles.lastWorkoutChips}
            >
              {visibleGroups.map((blockId, index) => (
                <View
                  key={blockId}
                  style={[styles.muscleChip, themeChipStyle]}
                  onLayout={index === 0 ? handleChipLayout : undefined}
                >
                  <View style={[styles.muscleChipDot, { backgroundColor: getDotColor(blockId) }]} />
                  <Text style={[styles.muscleChipText, themeTextStyle]}>{blockLabel(blockId, language)}</Text>
                </View>
              ))}
              {hiddenCount > 0 ? (
                <View style={[styles.muscleChip, themeChipStyle]}>
                  <View style={[styles.muscleChipDot, { backgroundColor: themeTokens.iconMuted }]} />
                  <Text style={[styles.muscleChipText, themeTextStyle]}>{`+${hiddenCount}`}</Text>
                </View>
              ) : null}
            </ScrollView>
            <View style={[styles.lastWorkoutDivider, { backgroundColor: themeTokens.stroke }]} />
          </>
        ) : null}
        <View style={styles.lastWorkoutTotalStack}>
          <Text style={[styles.lastWorkoutTotalLabel, themeTextMutedStyle]}>{totalVolumeTitleText}</Text>
          <Text style={[styles.lastWorkoutTotalValue, themeTextStyle, STAT_NUMBER_STYLE]}>
            <Text style={[styles.lastWorkoutMetricNumber, themeTextStyle]}>{totalVolumeNumber}</Text>
            {totalVolumeUnitLabel ? <Text style={[styles.lastWorkoutMetricUnit, themeAccentTextStyle]}>{` ${totalVolumeUnitLabel}`}</Text> : null}
          </Text>
        </View>
        {lastWorkoutExamples.length ? (
          reduceMotionEnabled || expanded ? (
            <View style={styles.lastWorkoutExampleBlock}>
              <Text
                style={[styles.lastWorkoutExampleName, themeTextMutedStyle, STAT_NUMBER_STYLE]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {exampleName}
              </Text>
              {exampleSetLine ? (
                setLineWeight && setLineUnitLabel && setLineReps ? (
                  <Text
                    style={[styles.lastWorkoutExampleDetail, themeTextStyle, STAT_NUMBER_STYLE]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    <Text style={[styles.lastWorkoutMetricNumber, themeTextStyle]}>{setLineWeight}</Text>
                    <Text style={[styles.lastWorkoutMetricUnit, themeAccentTextStyle]}>{` ${setLineUnitLabel}`}</Text>
                    <Text style={[styles.lastWorkoutMetricSeparator, themeTextStyle]}> x </Text>
                    <Text style={[styles.lastWorkoutMetricNumber, themeTextStyle]}>{setLineReps}</Text>
                    <Text style={[styles.lastWorkoutMetricUnit, themeAccentTextStyle]}> reps</Text>
                  </Text>
                ) : (
                  <Text
                    style={[styles.lastWorkoutExampleDetail, themeTextStyle, STAT_NUMBER_STYLE]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {exampleSetLine}
                  </Text>
                )
              ) : null}
            </View>
          ) : (
            <Animated.View
              style={[
                styles.lastWorkoutExampleBlock,
                {
                  opacity: lastExampleAnim,
                  transform: [
                    { translateY: lastExampleAnim.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) },
                  ],
                },
              ]}
            >
              <Text
                style={[styles.lastWorkoutExampleName, themeTextMutedStyle, STAT_NUMBER_STYLE]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {exampleName}
              </Text>
              {exampleSetLine ? (
                setLineWeight && setLineUnitLabel && setLineReps ? (
                  <Text
                    style={[styles.lastWorkoutExampleDetail, themeTextStyle, STAT_NUMBER_STYLE]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    <Text style={[styles.lastWorkoutMetricNumber, themeTextStyle]}>{setLineWeight}</Text>
                    <Text style={[styles.lastWorkoutMetricUnit, themeAccentTextStyle]}>{` ${setLineUnitLabel}`}</Text>
                    <Text style={[styles.lastWorkoutMetricSeparator, themeTextStyle]}> x </Text>
                    <Text style={[styles.lastWorkoutMetricNumber, themeTextStyle]}>{setLineReps}</Text>
                    <Text style={[styles.lastWorkoutMetricUnit, themeAccentTextStyle]}> reps</Text>
                  </Text>
                ) : (
                  <Text
                    style={[styles.lastWorkoutExampleDetail, themeTextStyle, STAT_NUMBER_STYLE]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {exampleSetLine}
                  </Text>
                )
              ) : null}
            </Animated.View>
          )
        ) : null}
      </>
    );
  };

  const lastWorkoutCard = (
    <PressScale
      onLongPress={openLastWorkoutPreview}
      onPressOut={closeLastWorkoutPreview}
      delayLongPress={220}
      style={styles.lastWorkoutPressWrap}
    >
      <View
        ref={lastWorkoutCardRef}
        onLayout={handleLastWorkoutCardLayout}
        style={[
          styles.lastWorkoutCard,
          themeSurfaceStyle,
          lastWorkoutPreviewVisible ? styles.lastWorkoutCardHidden : null,
          lastWorkoutCardHeightStyle,
        ]}
      >
        {renderLastWorkoutBody(false)}
        <TouchableOpacity onPress={onOpenHistory} activeOpacity={0.85} hitSlop={8}>
          <Text style={[styles.lastWorkoutLink, themeLinkTextStyle]}>{openLogLabel(language)}</Text>
        </TouchableOpacity>
      </View>
    </PressScale>
  );

  const hasNoteText = noteText.trim().length > 0;
  const notertTitle = language === 'nb' ? 'Notert' : language === 'es' ? 'Notas' : 'Notes';
  const notertEmpty = t(language, 'home.notes.empty');
  const recentNoteLines = useMemo(
    () => recentNotes.map((note) => note.text.trim()).filter((text) => text.length > 0),
    [recentNotes]
  );

  const renderRecentNotesList = ({
    lines,
    emptyLabel,
    containerStyle,
    itemTextStyle,
    emptyTextStyle,
    reserveRows,
  }: {
    lines: string[];
    emptyLabel: string;
    containerStyle?: StyleProp<ViewStyle>;
    itemTextStyle: StyleProp<TextStyle>;
    emptyTextStyle: StyleProp<TextStyle>;
    reserveRows?: number;
  }) => (
    <View style={containerStyle}>
      {lines.length ? (
        lines.map((line, index) => (
          <View key={`${index}-${line.slice(0, 24)}`} style={styles.notePreviewRow}>
            <Text style={[styles.notePreviewBullet, itemTextStyle]}>{'\u2022 '}</Text>
            <Text style={[styles.notePreviewText, itemTextStyle]}>{line}</Text>
          </View>
        ))
      ) : (
        <Text style={emptyTextStyle}>{emptyLabel}</Text>
      )}
      {reserveRows != null && reserveRows > 0
        ? Array.from({
            length: Math.max(0, reserveRows - (lines.length > 0 ? lines.length : 1)),
          }).map((_, index) => (
            <View key={`placeholder-${index}`} style={styles.notePreviewRow}>
              <Text style={[styles.notePreviewBullet, itemTextStyle, styles.notePreviewPlaceholder]}>{'\u2022 '}</Text>
              <Text style={[styles.notePreviewText, itemTextStyle, styles.notePreviewPlaceholder]}>{'placeholder'}</Text>
            </View>
          ))
        : null}
    </View>
  );

  const notesCard = (
    <View style={[styles.notesCard, themeSurfaceStyle, notesCardFillStyle]}>
      <View style={styles.notesHeaderRow}>
        <Text style={[styles.notesTitle, themeTextStyle]}>{language === 'nb' ? 'Notater' : 'Notes'}</Text>
      </View>
      <TextInput
        style={[
          styles.notesInput,
          styles.notesInputNudged,
          notesInputFillStyle,
          { color: themeTokens.text },
          notesFocused ? [styles.notesInputFocused, { backgroundColor: toRgba(themeTokens.accent, 0.06) }] : null,
        ]}
        placeholder={notesFocused ? '' : t(language, 'home.notes.placeholder')}
        placeholderTextColor={themeTokens.textMuted}
        value={noteText}
        onChangeText={setNoteText}
        onFocus={() => setNotesFocused(true)}
        onBlur={() => setNotesFocused(false)}
        multiline
        scrollEnabled
      />
      <Pressable
        style={({ pressed }) => [
          styles.notesButton,
          styles.notesButtonNudged,
          notesButtonBaseStyle,
          hasNoteText ? null : [styles.notesButtonDisabled, notesButtonDisabledStyle],
          notesButtonHovered && hasNoteText ? [styles.notesButtonHover, notesButtonHoverStyle] : null,
          pressed && hasNoteText ? [styles.notesButtonPressed, notesButtonPressedStyle] : null,
        ]}
        onPress={handleNotesSave}
        onHoverIn={() => setNotesButtonHovered(true)}
        onHoverOut={() => setNotesButtonHovered(false)}
        accessibilityRole="button"
        disabled={!hasNoteText}
      >
        <Text style={[styles.notesButtonText, { color: themeTokens.textOnAccent }]}>
          {language === 'nb' ? 'Lagre' : 'Save'}
        </Text>
      </Pressable>
      <Text style={[styles.notesNotice, !notesNotice ? styles.notesNoticeHidden : null]}>{notesNotice ?? ' '}</Text>
    </View>
  );

  const overloadWindowDays = 30;
  const analyseFallback =
    language === 'nb'
      ? 'Se progresjon og volum'
      : language === 'es'
        ? 'Ver progreso y volumen'
        : 'See progress & volume';
  const analyseMetricValue = overloadDeltaText && overload.exerciseName ? overloadDeltaText : null;
  const analyseMetricContext =
    analyseMetricValue && overload.exerciseName
      ? language === 'nb'
        ? `${overload.exerciseName} (${overloadWindowDays} dager)`
        : language === 'es'
          ? `${overload.exerciseName} (${overloadWindowDays} d\u00EDas)`
          : `${overload.exerciseName} (${overloadWindowDays} days)`
      : null;
  const analyseSubtitle = analyseMetricContext ?? analyseFallback;
  const todayPanelHeight = Math.max(360, Math.round(viewportHeight * 0.8));
  const timerReferenceMs = todayPanelVisible ? todayTimerNowMs : Date.now();
  const todayElapsedSeconds =
    todayWorkout.sessionStartedAtMs != null
      ? Math.max(0, Math.floor((timerReferenceMs - todayWorkout.sessionStartedAtMs) / 1000))
      : 0;
  const todayElapsedLabel = formatElapsedClock(todayElapsedSeconds);
  const todayDurationLabel =
    todayWorkout.sessionDurationSeconds != null
      ? formatElapsedClock(todayWorkout.sessionDurationSeconds)
      : null;
  const todayAccentColor = resolveTodayWorkoutAccent(todayWorkout.muscleGroups);
  const todayLiveBadgeBorderColor = toRgba(todayAccentColor, 0.56);
  const todayLiveBadgeFillColor = toRgba(todayAccentColor, 0.14);
  const todayLiveBadgeTextColor = toRgba(todayAccentColor, 0.88);
  const todayPanelAccentLineColor = toRgba(todayAccentColor, 0.42);
  const todayPanelTimerTintColor = toRgba(todayAccentColor, 0.1);
  const todayPanelTimerBorderColor = toRgba(todayAccentColor, 0.32);
  const todayWorkoutLifecycleState: 'idle' | 'active' | 'finished' = todayWorkout.sessionIsActive
    ? 'active'
    : todayWorkout.sessionDurationSeconds != null
      ? 'finished'
      : 'idle';
  const todayPrimaryMetric =
    todayWorkoutLifecycleState === 'active'
      ? language === 'nb'
        ? 'Fullf\u00F8r \u00F8kten'
        : language === 'es'
          ? 'Completa el entrenamiento'
          : 'Finish workout'
      : todayWorkoutLifecycleState === 'finished'
        ? language === 'nb'
          ? '\u00D8kt fullf\u00F8rt'
          : language === 'es'
            ? 'Entreno completado'
            : 'Workout completed'
        : language === 'nb'
          ? 'Start en \u00F8kt'
          : language === 'es'
            ? 'Inicia un entreno'
            : 'Start a workout';
  const todaySecondaryText = todayWorkout.hasWorkout
    ? todayWorkout.topExercise ??
      (language === 'nb'
        ? 'Ingen topp\u00F8velse enn\u00E5'
        : language === 'es'
          ? 'A\u00FAn sin ejercicio principal'
          : 'No top exercise yet')
    : language === 'nb'
      ? 'Trykk for \u00E5 \u00E5pne dagens detaljer'
      : language === 'es'
        ? 'Pulsa para abrir detalles de hoy'
        : 'Tap to open today details';
  const todayCardTitle = language === 'nb' ? 'I dag' : language === 'es' ? 'Hoy' : 'Today';
  const todayCardDurationText =
    !todayWorkout.sessionIsActive && todayWorkout.sessionDurationSeconds != null
      ? formatDurationForTodayCard(language, todayWorkout.sessionDurationSeconds)
      : null;
  const todayTimerHelpText = todayWorkout.sessionIsActive
    ? language === 'nb'
      ? 'Tid siden \u00F8kten startet'
      : language === 'es'
        ? 'Tiempo desde el inicio'
        : 'Time since workout started'
    : todayDurationLabel != null
      ? language === 'nb'
        ? '\u00D8kten er avsluttet'
        : language === 'es'
          ? 'Entreno finalizado'
          : 'Workout finished'
      : language === 'nb'
        ? 'Startes n\u00E5r du logger f\u00F8rste sett i dag'
        : language === 'es'
          ? 'Empieza al registrar la primera serie'
          : 'Starts when you log your first set today';

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: themeTokens.bg }]} edges={['left', 'right', 'bottom']}>
      <QuickActionsMenu
        visible={compassOpen}
        title={language === 'nb' ? 'Hurtigvalg' : language === 'es' ? 'Atajos' : 'Shortcuts'}
        items={compassActions}
        onClose={closeCompass}
      />
      {lastWorkoutPreviewVisible && lastWorkoutPreviewLayout ? (
        <Modal transparent animationType="none" visible onRequestClose={closeLastWorkoutPreview}>
          <Pressable style={styles.lastWorkoutPreviewBackdrop} onPress={closeLastWorkoutPreview}>
            <Animated.View
              style={[
                styles.lastWorkoutPreviewDim,
                {
                  opacity: lastWorkoutPreviewAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.6] }),
                },
              ]}
            />
            <Animated.View
              pointerEvents="none"
              style={[
                styles.lastWorkoutPreviewCard,
                {
                  left: lastWorkoutPreviewLayout.x,
                  top: lastWorkoutPreviewLayout.y,
                  width: lastWorkoutPreviewLayout.width,
                  transform: [
                    {
                      scale: lastWorkoutPreviewAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.3] }),
                    },
                  ],
                },
              ]}
            >
              {renderLastWorkoutBody(true)}
              <Text style={[styles.lastWorkoutLink, themeLinkTextStyle]}>{openLogLabel(language)}</Text>
            </Animated.View>
          </Pressable>
        </Modal>
      ) : null}
      {todayPanelVisible ? (
        <Modal transparent animationType="none" visible onRequestClose={closeTodayPanel}>
          <View style={styles.todayPanelOverlay}>
            <Pressable style={styles.todayPanelBackdrop} onPress={closeTodayPanel}>
              <Animated.View
                style={[
                  styles.todayPanelBackdropDim,
                  {
                    backgroundColor: themeTokens.id === 'calmLight' ? 'rgba(15, 23, 42, 0.34)' : 'rgba(2, 6, 23, 0.72)',
                    opacity: todayPanelAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.62] }),
                  },
                ]}
              />
            </Pressable>
            <Animated.View
              style={[
                styles.todayPanelSheet,
                themeSurfaceStyle,
                {
                  height: todayPanelHeight,
                  paddingBottom: Math.max(insets.bottom + SPACING.sm, SPACING.lg),
                  transform: [
                    {
                      translateY: todayPanelAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [todayPanelHeight, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <View style={[styles.todayPanelHandle, { backgroundColor: themeTokens.iconMuted }]} />
              <View style={styles.todayPanelHeaderRow}>
                <View style={styles.todayPanelHeaderTextWrap}>
                  <View style={styles.todayPanelTitleRow}>
                    <Text style={[styles.todayPanelTitle, themeTextMutedStyle]}>{t(language, 'home.todayWorkout.title')}</Text>
                    {todayWorkout.sessionIsActive ? (
                      <View
                        style={[
                          styles.todayPanelLiveBadge,
                          {
                            borderColor: todayLiveBadgeBorderColor,
                            backgroundColor: todayLiveBadgeFillColor,
                          },
                        ]}
                      >
                        <Text style={[styles.todayPanelLiveBadgeText, { color: todayLiveBadgeTextColor }]}>
                          {t(language, 'home.todayWorkout.live')}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={[styles.todayPanelDateText, themeTextMutedStyle]}>{todayWorkout.dateLabel}</Text>
                </View>
                <View style={styles.todayPanelHeaderActions}>
                  {todayWorkout.sessionIsActive ? (
                    <TouchableOpacity
                      onPress={onFinishWorkout}
                      activeOpacity={0.85}
                      style={styles.todayFinishButton}
                      accessibilityRole="button"
                      accessibilityLabel={t(language, 'home.todayWorkout.finish')}
                    >
                      <Text style={styles.todayFinishButtonText}>{t(language, 'home.todayWorkout.finish')}</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity
                    onPress={closeTodayPanel}
                    hitSlop={8}
                    activeOpacity={0.85}
                    style={[styles.todayPanelCloseButton, themeSurfaceAltStyle]}
                    accessibilityRole="button"
                    accessibilityLabel={
                      language === 'nb'
                        ? 'Lukk dagens \u00F8kt'
                        : language === 'es'
                          ? 'Cerrar entrenamiento de hoy'
                          : "Close today's workout"
                    }
                  >
                    <Text style={[styles.todayPanelCloseText, themeTextStyle]}>X</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={[styles.todayPanelHeaderAccent, { backgroundColor: todayPanelAccentLineColor }]} />

              <ScrollView style={styles.todayPanelScroll} contentContainerStyle={styles.todayPanelScrollContent}>
                <View style={[styles.todayTimerCard, themeSurfaceAltStyle, { borderColor: todayPanelTimerBorderColor }]}>
                  <View style={[styles.todayTimerTintLayer, { backgroundColor: todayPanelTimerTintColor }]} />
                  <Text style={[styles.todayTimerValue, styles.todayTimerForeground, themeTextStyle, STAT_NUMBER_STYLE]}>
                    {todayWorkout.sessionIsActive ? todayElapsedLabel : todayDurationLabel ?? '--:--:--'}
                  </Text>
                  <Text style={[styles.todayTimerHelp, styles.todayTimerForeground, themeTextMutedStyle]}>{todayTimerHelpText}</Text>
                </View>

                <View style={styles.todaySummaryRow}>
                  <View style={[styles.todaySummaryCard, themeSurfaceAltStyle]}>
                    <Text style={[styles.todaySummaryLabel, themeTextMutedStyle]}>Sett</Text>
                    <Text style={[styles.todaySummaryValue, themeTextStyle, STAT_NUMBER_STYLE]}>{todayWorkout.totalSets}</Text>
                  </View>
                  <View style={[styles.todaySummaryCard, themeSurfaceAltStyle]}>
                    <Text style={[styles.todaySummaryLabel, themeTextMutedStyle]}>{'\u00D8velser'}</Text>
                    <Text style={[styles.todaySummaryValue, themeTextStyle, STAT_NUMBER_STYLE]}>{todayWorkout.totalExercises}</Text>
                  </View>
                  <View style={[styles.todaySummaryCard, themeSurfaceAltStyle]}>
                    <Text style={[styles.todaySummaryLabel, themeTextMutedStyle]}>Total volum</Text>
                    <Text style={[styles.todaySummaryValue, themeTextStyle, STAT_NUMBER_STYLE]}>{todayWorkout.totalVolumeLabel}</Text>
                  </View>
                  <View style={[styles.todaySummaryCard, themeSurfaceAltStyle]}>
                    <Text style={[styles.todaySummaryLabel, themeTextMutedStyle]}>{'Topp \u00F8velse'}</Text>
                    <Text style={[styles.todaySummaryValue, styles.todaySummaryTopValue, themeAccentTextStyle]} numberOfLines={1}>
                      {todayWorkout.topExercise ?? '-'}
                    </Text>
                  </View>
                </View>

                {todayWorkout.muscleGroups.length ? (
                  <View style={styles.todayMuscleRow}>
                    {todayWorkout.muscleGroups.map((blockId) => (
                      <View key={blockId} style={[styles.todayMuscleChip, themeChipStyle]}>
                        <View style={[styles.todayMuscleDot, { backgroundColor: getDotColor(blockId) }]} />
                        <Text style={[styles.todayMuscleText, themeTextStyle]}>{blockLabel(blockId, language)}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                {todayWorkout.hasWorkout ? (
                  <View style={styles.todayTimelineList}>
                    {todayWorkout.groups.map((group, index) => (
                      <View key={group.id} style={styles.todayExerciseRow}>
                        <View style={styles.todayTimelineRail}>
                          <View style={[styles.todayTimelineDot, { backgroundColor: todayAccentColor }]} />
                          {index < todayWorkout.groups.length - 1 ? <View style={[styles.todayTimelineLine, { backgroundColor: themeTokens.stroke }]} /> : null}
                        </View>
                        <View style={[styles.todayExerciseCard, themeSurfaceAltStyle]}>
                          <View style={styles.todayExerciseHeaderRow}>
                            <Text style={[styles.todayExerciseTitle, themeTextStyle]}>{group.exerciseLabel}</Text>
                            <View style={styles.todayExerciseMetaRight}>
                              <Text style={[styles.todayExerciseTime, themeTextMutedStyle]}>{group.timeLabel}</Text>
                              <Text style={[styles.todayExerciseVolume, themeLinkTextStyle, STAT_NUMBER_STYLE]}>{group.volumeLabel}</Text>
                            </View>
                          </View>
                          {group.sets.map((set) => (
                            <Text key={set.id} style={[styles.todayExerciseSetLine, themeTextStyle]}>
                              {set.setLine}
                            </Text>
                          ))}
                        </View>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={[styles.todayEmptyCard, themeSurfaceAltStyle]}>
                    <Text style={[styles.todayEmptyIcon, themeAccentTextStyle]}>{'\u23F1'}</Text>
                    <Text style={[styles.todayEmptyTitle, themeTextStyle]}>{'Ingen \u00F8kt logget i dag'}</Text>
                    <Text style={[styles.todayEmptyHint, themeTextMutedStyle]}>
                      {'Start med Hurtiglogg \u00F8verst. N\u00E5r f\u00F8rste sett logges, starter dagens timer automatisk.'}
                    </Text>
                  </View>
                )}
              </ScrollView>
            </Animated.View>
          </View>
        </Modal>
      ) : null}
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        bounces
        scrollEnabled={!lastWorkoutPreviewVisible && !todayPanelVisible}
      >
        <View
          style={[
            styles.headerRow,
            { paddingTop: headerTopPadding, paddingBottom: headerBottomPadding, marginBottom: headerToQuickLogGap },
          ]}
        >
          <Pressable
            onPress={handlePressWordmark}
            onLongPress={() => setCompassOpen(true)}
            hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
            accessibilityRole="button"
            accessibilityLabel="Treasy"
            style={({ pressed }) => [styles.wordmarkButton, pressed ? styles.wordmarkPressed : null]}
          >
            <Text style={styles.wordmarkText}>
              <Text style={[styles.wordmarkTextMain, themeAccentTextStyle]}>Treasy</Text>
              <Text style={[styles.wordmarkDot, wordmarkDotGlowStyle]}>{'\u00B7'}</Text>
            </Text>
          </Pressable>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={onOpenSettings}
              hitSlop={8}
              style={styles.settingsButton}
              activeOpacity={0.85}
              accessibilityLabel={t(language, 'settings.title')}
            >
              <Text style={[styles.settingsIcon, { color: themeTokens.text }]}>{'\u2699\uFE0F'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.quickLogCard, themeSurfaceStyle, quickLogCardToneStyle]}
          onPress={onOpenQuickLog}
          activeOpacity={0.9}
        >
          <View style={styles.quickLogTopSection}>
            <View style={styles.quickLogTitleRow}>
              <View style={styles.quickLogTitleCluster}>
                <Text style={[styles.quickLogTitle, quickLogTitleToneStyle]}>{t(language, 'quickLogTitle')}</Text>
              </View>
              <Text style={[styles.quickLogEmoji, themeTextStyle]}>{'\uD83D\uDCDD'}</Text>
            </View>
            <Text style={[styles.quickLogSubtitle, themeTextMutedStyle]}>
              {language === 'nb' ? 'Trykk her for \u00E5 komme i gang' : 'Press here to start'}
            </Text>
            <View style={styles.quickLogExampleRow}>
              {reduceMotionEnabled ? (
                <Text style={[styles.quickLogExampleText, themeTextStyle]}>
                  {(language === 'nb' ? 'Skriv: ' : language === 'es' ? 'Escribe: ' : 'Type: ') + quickLogExamples[exampleIndex]}
                </Text>
              ) : (
                <Animated.Text
                  style={[
                    styles.quickLogExampleText,
                    themeTextStyle,
                    {
                      opacity: exampleAnim,
                      transform: [
                        {
                          translateY: exampleAnim.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }),
                        },
                      ],
                    },
                  ]}
                >
                  {(language === 'nb' ? 'Skriv: ' : language === 'es' ? 'Escribe: ' : 'Type: ') + quickLogExamples[exampleIndex]}
                </Animated.Text>
              )}
            </View>
          </View>

          <View style={styles.quickLogMomentum}>
            <Text style={[styles.quickLogMomentumMain, { color: momentumColor }]}>
              {analytics.momentum === 'up' ? '\u2191 ' : analytics.momentum === 'down' ? '\u2193 ' : ''}
              {momentumMain}
            </Text>
            <Text style={[styles.quickLogMomentumSub, themeTextMutedStyle]}>{momentumBasedOn}</Text>
            <TouchableOpacity onPress={scrollToAnalysis} hitSlop={8} activeOpacity={0.8}>
              <Text style={[styles.quickLogMomentumLink, themeLinkTextStyle]}>
                {language === 'nb' ? 'Mer detaljer' : 'More details'}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>

        <View style={styles.groupsWrapper}>
          <View style={[styles.twoColumnRow, styles.twoColumnRowStretch]} onLayout={handleColumnsLayout}>
            <View style={styles.leftColumn}>
              <View style={styles.groupsColumn}>
                <Text style={[styles.groupsTitle, themeTextStyle]}>{t(language, 'muscleGroups')}</Text>
                <View style={styles.groupsList}>
                  {primaryBlocks.map((block) => {
                    const tone = getBlockTone(block.id);
                    const icon = resolveBlockIcon(block.id);
                    return (
                      <HomeTileButton
                        key={block.id}
                        style={[styles.groupRow, themeSurfaceStyle]}
                        onPress={() => onSelectBlock(block.id)}
                      >
                        {({ pressed, hovered }) => (
                          <>
                            <View style={[styles.groupDotSmall, { backgroundColor: getDotColor(block.id) }]} />
                            <Text style={[styles.groupRowText, themeTextStyle]} numberOfLines={1} ellipsizeMode="tail">
                              {labelForBlock(block)}
                            </Text>
                            {block.id === 'cardio' ? (
                  <TouchableOpacity
                                onPress={(e) => {
                                  e.stopPropagation();
                                  onStartCardio();
                                }}
                                style={[styles.groupAction, { backgroundColor: tone.accent }]}
                                activeOpacity={0.9}
                              >
                                <Text style={styles.groupActionText}>Start</Text>
                              </TouchableOpacity>
                            ) : null}
                            <View
                              style={[styles.groupIconWrap, groupIconWrapStyle]}
                            >
                              <HomeTileIcon
                                source={icon}
                                active={pressed || hovered}
                                tintColor={groupIconTintColor}
                                activeTintColor={groupIconActiveTintColor}
                              />
                            </View>
                          </>
                        )}
                      </HomeTileButton>
                    );
                  })}
                </View>
              </View>

              <View style={styles.lowerGap} />
              <View style={styles.lowerSection}>
                <View style={styles.notertFill}>
                  <TouchableOpacity
                    style={[
                      styles.analysisNavRow,
                      styles.largeNavTile,
                      styles.statusNavTile,
                      styles.todayWorkoutTile,
                      styles.todayWorkoutCardSurface,
                      themeSurfaceStyle,
                    ]}
                    onPress={openTodayPanel}
                    activeOpacity={0.9}
                  >
                    <View
                      style={[styles.todayWorkoutAccentTint, { backgroundColor: toRgba(themeTokens.accent, 0.08) }]}
                      pointerEvents="none"
                    />
                    <View style={[styles.todayWorkoutAccentStripe, { backgroundColor: themeTokens.accent }]} pointerEvents="none" />
                    <View style={[styles.navTileLeft, styles.todayWorkoutForeground]}>
                      <View style={styles.navTileTextStack}>
                        <View style={styles.todayWorkoutTitleRow}>
                          <Text style={[styles.todayWorkoutTitleText, themeTextMutedStyle]}>{todayCardTitle}</Text>
                          <View
                            style={[
                              styles.todayLiveBadge,
                              todayWorkout.sessionIsActive
                                ? styles.todayLiveBadgeActive
                                : [styles.todayLiveBadgeIdle, themeChipStyle],
                            ]}
                          >
                            {todayWorkout.sessionIsActive ? (
                              <Text style={styles.todayLiveBadgeText}>{t(language, 'home.todayWorkout.live')}</Text>
                            ) : null}
                          </View>
                        </View>
                        <Text style={[styles.todayWorkoutMetricValue, themeTextStyle]} numberOfLines={1} ellipsizeMode="tail">
                          {todayPrimaryMetric}
                          {todayWorkoutLifecycleState === 'finished' ? (
                            <Text style={styles.todayWorkoutMetricCheckmark}>{' \u2713'}</Text>
                          ) : null}
                        </Text>
                        <Text style={[styles.todayWorkoutSecondaryText, themeTextMutedStyle]} numberOfLines={1} ellipsizeMode="tail">
                          {todaySecondaryText}
                        </Text>
                        {todayCardDurationText ? (
                          <Text style={[styles.todayWorkoutMetaText, themeTextMutedStyle]} numberOfLines={1} ellipsizeMode="tail">
                            {todayCardDurationText}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  </TouchableOpacity>
                </View>
                <View style={styles.lowerGap} />
                <View style={[styles.analysisAlignWrap, analysisStretchStyle]}>
                  <TouchableOpacity
                    style={[
                      styles.analysisNavRow,
                      styles.largeNavTile,
                      styles.statusNavTile,
                      styles.analysisTallTile,
                      styles.analysisCardSurface,
                      themeSurfaceStyle,
                    ]}
                    onPress={onOpenAnalysis}
                    activeOpacity={0.9}
                  >
                    <View
                      style={[styles.analysisCardAccentTint, { backgroundColor: toRgba(themeTokens.accent, 0.08) }]}
                      pointerEvents="none"
                    />
                    <View style={[styles.analysisCardAccentStripe, { backgroundColor: themeTokens.accent }]} pointerEvents="none" />
                    <View style={[styles.navTileLeft, styles.analysisCardForeground]}>
                      <View style={styles.navTileTextStack}>
                        <Text
                          style={[
                            styles.analysisNavText,
                            styles.navTileTitleCompact,
                            styles.analysisCardTitleText,
                            themeAccentTextStyle,
                          ]}
                        >
                          {language === 'nb' ? 'Analyse' : language === 'es' ? 'An\u00E1lisis' : 'Analysis'}
                        </Text>
                        {analyseMetricValue ? (
                          <>
                            <Text
                              style={[styles.navTileMetricValue, styles.analysisCardMetricValue, { color: themeTokens.success }]}
                              numberOfLines={1}
                              ellipsizeMode="tail"
                            >
                              {analyseMetricValue}
                            </Text>
                            <Text
                              style={[styles.navTileMetricContext, styles.analysisCardMetricContext, themeTextMutedStyle]}
                              numberOfLines={1}
                              ellipsizeMode="tail"
                            >
                              {analyseSubtitle}
                            </Text>
                          </>
                        ) : (
                          <Text
                            style={[styles.navTileSubText, styles.analysisCardSubText, themeTextMutedStyle]}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {analyseSubtitle}
                          </Text>
                        )}
                      </View>
                    </View>
                    <Text
                      style={[
                        styles.analysisNavChevron,
                        styles.analysisCardForeground,
                        styles.analysisCardChevron,
                        themeAccentTextStyle,
                      ]}
                    >
                      {NAV_CHEVRON}
                    </Text>
                  </TouchableOpacity>
                  <View style={styles.lowerGap} />
                  <View style={styles.notertMeasure}>
                    <PressScale
                      style={[
                        styles.analysisNavRow,
                        styles.largeNavTile,
                        styles.statusNavTile,
                        styles.notertTallTile,
                        styles.notertCardSurface,
                        themeSurfaceStyle,
                      ]}
                      onPress={onOpenNotert}
                    >
                      <View style={[styles.navTileLeft, styles.notertTileLeft]}>
                        <View style={styles.notertHeaderRow}>
                          <Text style={[styles.notertHeaderText, themeAccentTextStyle]}>{notertTitle}</Text>
                          {recentNoteLines.length ? (
                            <View style={[styles.notertCountChip, { borderColor: themeTokens.stroke, backgroundColor: themeTokens.chip }]}>
                              <Text style={[styles.notertCountText, themeTextMutedStyle]}>{recentNoteLines.length}</Text>
                            </View>
                          ) : null}
                        </View>
                        <View style={[styles.notertContentDivider, { backgroundColor: themeTokens.stroke }]} />
                        {renderRecentNotesList({
                          lines: recentNoteLines,
                          emptyLabel: notertEmpty,
                          containerStyle: styles.notertPreviewList,
                          itemTextStyle: [styles.notertLineText, themeTextStyle],
                          emptyTextStyle: [styles.notertEmptyText, themeTextMutedStyle],
                          reserveRows: NOTERT_PREVIEW_ROWS,
                        })}
                      </View>
                      <Text style={[styles.analysisNavChevron, styles.analysisCardChevron, themeAccentTextStyle]}>{'>'}</Text>
                    </PressScale>
                  </View>
                </View>
              </View>
            </View>

            <View style={[styles.sideColumn, styles.rightColumn]}>
              <View style={styles.groupsColumn}>
                {/* Andre stays on the right so Cardio aligns with Bryst in the grid. */}
                {otherBlocks.length > 0 ? (
                  <Text style={[styles.groupsTitle, themeTextStyle]}>{t(language, 'otherSectionTitle')}</Text>
                ) : null}
                {otherBlocks.length > 0 ? (
                  <View style={styles.groupsList}>
                    {otherBlocks.map((block) => {
                      const icon = resolveBlockIcon(block.id);
                      return (
                        <HomeTileButton
                          key={block.id}
                          style={[styles.groupRow, themeSurfaceStyle]}
                          onPress={() => onSelectBlock(block.id)}
                        >
                          {({ pressed, hovered }) => (
                            <>
                              <View style={[styles.groupDotSmall, { backgroundColor: getDotColor(block.id) }]} />
                              <Text style={[styles.groupRowText, themeTextStyle]} numberOfLines={1} ellipsizeMode="tail">
                                {labelForBlock(block)}
                              </Text>
                              <View style={[styles.groupIconWrap, groupIconWrapStyle]}>
                                <HomeTileIcon
                                  source={icon}
                                  active={pressed || hovered}
                                  tintColor={groupIconTintColor}
                                  activeTintColor={groupIconActiveTintColor}
                                />
                              </View>
                            </>
                          )}
                        </HomeTileButton>
                      );
                    })}
                  </View>
                ) : null}
              </View>
              {otherBlocks.length > 0 ? <View style={styles.lowerGap} /> : null}
              {lastWorkoutCard}
              <View style={styles.lastWorkoutToNotesGap} />
              <View style={notesCardHeightStyle}>{notesCard}</View>
            </View>
          </View>
        </View>

        <View style={styles.analysisWrapper} onLayout={({ nativeEvent }) => setAnalysisAnchorY(nativeEvent.layout.y)}>
          <View style={[styles.analysisCards, themeSurfaceStyle]}>
            <ProgressiveOverloadCard
              summary={overload.label}
              deltaText={overloadDeltaText}
              onPress={onOpenProgress}
              theme={themeTokens}
            />

            <View style={[styles.volumeCard, themeSurfaceStyle]}>
              <Text style={[styles.volumeTitle, themeAccentTextStyle]}>{t(language, 'analysis.volume.title')}</Text>
              <View style={styles.volumeTopRow}>
                <Text style={[styles.volumeLabel, themeTextMutedStyle]}>{volumeCardProps.totalLabel}</Text>
                <View style={[styles.volumeDeltaChip, volumeDeltaTone]}>
                  <Text style={[styles.volumeDeltaText, { color: volumeChangeColor }]}>{volumeChangeText}</Text>
                </View>
              </View>
              <Text style={[styles.volumeValue, themeTextStyle, STAT_NUMBER_STYLE]}>
                {analytics.hasData ? volumeCardProps.volumeLabel : t(language, 'analysis.empty')}
              </Text>
              <TouchableOpacity
                onPress={() => setVolumeExpanded((prev) => !prev)}
                activeOpacity={0.85}
                style={styles.volumeToggleRow}
                hitSlop={8}
              >
                <Text style={[styles.volumeToggleText, themeLinkTextStyle]}>{t(language, 'analysis.volume.byMuscle.toggle')}</Text>
                <Text style={[styles.volumeToggleChevron, themeTextMutedStyle]}>{volumeExpanded ? 'v' : '>'}</Text>
              </TouchableOpacity>
              {volumeExpanded ? (
                <View style={[styles.volumeListWrapper, { borderTopColor: themeTokens.stroke }]}>
                  {!analytics.hasData ? (
                    <Text style={[styles.volumeEmptyText, themeTextMutedStyle]}>{t(language, 'analysis.empty')}</Text>
                  ) : (
                    <View style={styles.volumeList}>
                      {volumeCardProps.rows.map((row) => {
                        const rowTrend = trendFromPct(row.pctChange);
                        const rowColor = colorForVolumeTrend(rowTrend);
                        const rowChangeText = formatVolumeChangeText(language, row.pctChange);
                        const rowVolumeText = `${formatVolumeNumber(fromKg(row.volume7d, massUnit))} ${unitLabel}`;
                        return (
                          <View key={row.id} style={styles.volumeRow}>
                            <Text style={[styles.volumeRowLabel, themeTextStyle]} numberOfLines={1}>
                              {row.label}
                            </Text>
                            <View style={styles.volumeRowRight}>
                              <Text style={[styles.volumeRowChange, STAT_NUMBER_STYLE, { color: rowColor }]}>
                                {rowChangeText}
                              </Text>
                              <Text style={[styles.volumeRowValue, themeTextMutedStyle, STAT_NUMBER_STYLE]}>{rowVolumeText}</Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              ) : null}
            </View>

            <PreviousWorkoutsTimeline
              language={language}
              items={analytics.timeline}
              resolveBlockLabel={resolveBlockLabel}
              onPressDay={openHistoryForDate}
              theme={themeTokens}
            />

            <TouchableOpacity style={[styles.analysisCard, themeSurfaceStyle]} onPress={onOpenRepMax} activeOpacity={0.9}>
              <Text style={[styles.cardTitle, themeAccentTextStyle]}>{t(language, 'analysis.bestLifts.title')}</Text>
              <Text style={[styles.cardText, themeTextMutedStyle]}>{t(language, 'analysis.bestLifts.subtitle')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: Platform.OS === 'web' ? 32 : 48 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#020617',
    ...Platform.select({
      web: { width: '100%', maxWidth: 720, alignSelf: 'center' },
    }),
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 0,
  },
  wordmarkButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingRight: SPACING.sm,
    alignSelf: 'stretch',
    flexShrink: 1,
    transform: [{ translateY: 4 }],
  },
  wordmarkPressed: {
    opacity: 0.72,
  },
  wordmarkText: {
    fontSize: Platform.OS === 'web' ? 26 : 26,
    letterSpacing: -0.2,
    fontWeight: '600',
  },
  wordmarkTextMain: {
    color: COLORS.blue1,
    ...Platform.select({ web: { fontWeight: '600' } }),
  },
  wordmarkDot: {
    color: '#2DD4BF',
    ...Platform.select({ web: { fontWeight: '600' } }),
  },
  wordmarkDotGlow: {
    textShadowColor: 'rgba(45, 212, 191, 0.35)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  compassSheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  compassSheetCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#0A111F',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#1E293B',
    paddingBottom: SPACING.xs,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  compassSheetHeader: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1E293B',
  },
  compassSheetTitle: {
    color: '#E5E7EB',
    fontSize: TEXT.md,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  compassAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  compassActionDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#1E293B',
  },
  compassActionPressed: {
    backgroundColor: 'rgba(96, 165, 250, 0.08)',
  },
  compassActionText: {
    color: '#E2E8F0',
    fontSize: TEXT.sm,
    fontWeight: '600',
  },
  compassActionChevron: {
    color: '#64748B',
    fontSize: TEXT.sm,
    fontWeight: '700',
  },
  headerActions: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  settingsButton: {
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIcon: {
    fontSize: TEXT.md + 2,
    lineHeight: TEXT.md + 2,
  },
  sectionTitle: {
    color: '#E5E7EB',
    fontSize: TEXT.sm,
    fontWeight: '700',
    marginBottom: SPACING.sm,
  },
  section: {
    gap: SPACING.md,
    marginBottom: SPACING.xxl,
  },
  quickLogCard: {
    backgroundColor: '#0B1220',
    borderRadius: RADIUS.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm,
    paddingHorizontal: SPACING.md,
    flexDirection: 'column',
    alignItems: 'stretch',
    borderWidth: 1,
    marginBottom: SPACING.xl,
    ...Platform.select({
      web: { minHeight: 120 },
    }),
  },
  quickLogTopSection: {
    flexGrow: 1,
    gap: SPACING.xs,
  },
  quickLogTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: SPACING.md,
    marginTop: 0,
    marginBottom: SPACING.xs,
  },
  quickLogTitleCluster: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    alignSelf: 'flex-start',
  },
  quickLogMomentum: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    marginTop: SPACING.sm,
    marginBottom: 4,
    width: '100%',
  },
  quickLogMomentumMain: {
    color: '#22C55E',
    fontSize: TEXT.sm,
    fontWeight: '700',
  },
  quickLogMomentumSub: {
    color: '#9CA3AF',
    fontSize: TEXT.xs,
    fontWeight: '600',
  },
  quickLogMomentumLink: {
    color: '#60A5FA',
    fontSize: TEXT.xs,
    fontWeight: '700',
    marginTop: 6,
    textDecorationLine: 'underline',
  },
  quickLogTitle: {
    color: '#F9FAFB',
    fontSize: TEXT.lg,
    fontWeight: '800',
    letterSpacing: 0.2,
    textShadowColor: 'rgba(2, 6, 23, 0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    marginBottom: 0,
  },
  quickLogEmoji: {
    alignSelf: 'flex-start',
    fontSize: TEXT.lg,
    color: '#F9FAFB',
  },
  quickLogSubtitle: {
    color: '#6B7280',
    fontSize: TEXT.sm,
    marginBottom: SPACING.xs,
  },
  quickLogExampleRow: {
    marginTop: SPACING.xs,
    minHeight: 24,
  },
  quickLogExampleText: {
    color: '#CBD5E1',
    fontSize: TEXT.sm,
    fontWeight: '700',
  },
  blockButton: {
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    justifyContent: 'center',
    borderWidth: 1,
    minHeight: 52,
  },
  blockLabel: {
    fontSize: TEXT.lg,
    fontWeight: '600',
  },
  groupsWrapper: {
    marginBottom: SPACING.sm,
  },
  twoColumnRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    columnGap: SPACING.lg,
    rowGap: SPACING.lg,
    width: '100%',
  },
  twoColumnRowStretch: {
    alignItems: 'stretch',
  },
  twoColumnRowSectionGap: {
    marginTop: SPACING.xs,
  },
  lowerSection: {
    width: '100%',
  },
  lowerRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    columnGap: SPACING.lg,
    width: '100%',
    height: '100%',
  },
  leftCol: {
    flex: 1,
    height: '100%',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    minWidth: 0,
  },
  rightCol: {
    flex: 1,
    height: '100%',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    minWidth: 0,
  },
  notertFill: {
    flex: 1,
    alignSelf: 'stretch',
  },
  notertMeasure: {
    alignSelf: 'stretch',
  },
  lowerGap: {
    height: SPACING.sm,
  },
  lastWorkoutToNotesGap: {
    height: SPACING.md,
  },
  groupsColumn: {
    gap: SPACING.md,
  },
  leftColumn: {
    flex: 1,
    minWidth: 0,
    alignItems: 'stretch',
    justifyContent: 'flex-start',
  },
  sideColumn: {
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'stretch',
  },
  rightColumn: {
    flex: 1,
    minWidth: 0,
    alignSelf: 'stretch',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
  },
  groupsTitle: {
    color: '#E5E7EB',
    fontSize: TEXT.sm,
    fontWeight: '700',
    marginBottom: SPACING.sm,
  },
  groupsList: {
    gap: SPACING.sm,
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: '#DBEAFE',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: HOME_SURFACE_DARK_BORDER,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    minHeight: 48,
    width: '100%',
    alignSelf: 'stretch',
  },
  groupIconWrap: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
    borderWidth: 1,
  },
  groupIconStack: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupIcon: {
    width: 24,
    height: 24,
  },
  groupIconOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  groupDotSmall: {
    width: 10,
    height: 10,
    borderRadius: 999,
    opacity: 0.7,
  },
  groupDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  groupRowText: {
    flex: 1,
    color: COLORS.blue1,
    fontSize: TEXT.md,
    fontWeight: '700',
    marginHorizontal: SPACING.xs,
    minWidth: 0,
  },
  groupAction: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.md,
    marginRight: SPACING.sm,
  },
  groupActionText: {
    color: '#0B1220',
    fontWeight: '800',
    fontSize: TEXT.sm,
  },
  analysisNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: HOME_SURFACE_DARK,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: HOME_SURFACE_DARK_BORDER,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    minHeight: 48,
    width: '100%',
  },
  largeNavTile: {
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.lg,
  },
  statusNavTile: {
    height: 100,
    paddingVertical: SPACING.lg,
  },
  notertTallTile: {
    height: 112,
    alignSelf: 'stretch',
  },
  notertCardSurface: {
    backgroundColor: HOME_SURFACE_MUTED,
    borderColor: HOME_SURFACE_MUTED_BORDER,
    overflow: 'hidden',
  },
  analysisTallTile: {
    minHeight: 100,
  },
  analysisCardSurface: {
    backgroundColor: HOME_SURFACE_MUTED,
    borderColor: HOME_SURFACE_MUTED_BORDER,
    position: 'relative',
    overflow: 'hidden',
  },
  analysisCardAccentTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(75, 85, 99, 0.06)',
  },
  analysisCardAccentStripe: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: '#4B5563',
  },
  analysisCardForeground: {
    position: 'relative',
    zIndex: 1,
  },
  todayWorkoutTile: {
    minHeight: 100,
    justifyContent: 'space-between',
    position: 'relative',
    overflow: 'hidden',
  },
  todayWorkoutCardSurface: {
    backgroundColor: HOME_SURFACE_MUTED,
    borderColor: HOME_SURFACE_MUTED_BORDER,
  },
  todayWorkoutAccentTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(107, 114, 128, 0.05)',
  },
  todayWorkoutAccentStripe: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: '#4B5563',
  },
  todayWorkoutForeground: {
    position: 'relative',
    zIndex: 1,
  },
  todayWorkoutTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 22,
    gap: SPACING.sm,
  },
  todayWorkoutTitleText: {
    color: '#A3B3C8',
    fontSize: TEXT.xs,
    fontWeight: '600',
    flexShrink: 1,
  },
  todayLiveBadge: {
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    width: 56,
    minHeight: 20,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayLiveBadgeActive: {
    borderColor: '#22C55E',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
  },
  todayLiveBadgeIdle: {
    borderColor: '#4B5563',
    backgroundColor: 'rgba(75, 85, 99, 0.06)',
  },
  todayLiveBadgeText: {
    color: '#22C55E',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  analysisAlignWrap: {
    flexDirection: 'column',
    alignItems: 'stretch',
    justifyContent: 'flex-end',
    width: '100%',
  },
  analysisAlignStretch: {
    flexGrow: 1,
    alignSelf: 'stretch',
  },
  analysisNavText: {
    color: '#93C5FD',
    fontSize: TEXT.sm,
    fontWeight: '700',
  },
  analysisCardTitleText: {
    color: '#60A5FA',
  },
  navTileTitleCompact: {
    color: '#BFDBFE',
    fontSize: TEXT.xs,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  largeNavText: {
    fontSize: TEXT.lg,
    fontWeight: '800',
  },
  navTileTitleSoft: {
    color: '#BFDBFE',
    fontWeight: '800',
  },
  navTileLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    minWidth: 0,
  },
  notertTileLeft: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: SPACING.xs,
    justifyContent: 'center',
  },
  notertHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  notertHeaderText: {
    color: '#93C5FD',
    fontSize: TEXT.xs,
    fontWeight: '800',
    letterSpacing: 0.2,
    flex: 1,
  },
  notertCountChip: {
    minWidth: 24,
    minHeight: 20,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xs,
  },
  notertCountText: {
    fontSize: TEXT.xs,
    fontWeight: '700',
  },
  notertContentDivider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
  notertPreviewList: {
    gap: SPACING.xs,
  },
  notertLineText: {
    color: '#E2E8F0',
    fontSize: TEXT.xs,
    fontWeight: '700',
  },
  notertEmptyText: {
    color: '#94A3B8',
    fontSize: TEXT.xs,
    fontWeight: '600',
  },
  notePreviewRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.xs,
    width: '100%',
  },
  notePreviewBullet: {
    flexShrink: 0,
  },
  notePreviewText: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  notePreviewPlaceholder: {
    color: 'transparent',
  },
  navTileIconWrap: {
    width: 30,
    height: 30,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginTop: 1,
  },
  navTileIconWrapNote: {
    backgroundColor: 'rgba(96, 165, 250, 0.14)',
    borderColor: 'rgba(96, 165, 250, 0.28)',
  },
  navTileIconWrapAnalysis: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
    borderColor: 'rgba(34, 197, 94, 0.22)',
  },
  todayWorkoutIconWrap: {
    backgroundColor: 'rgba(56, 189, 248, 0.14)',
    borderColor: 'rgba(56, 189, 248, 0.28)',
  },
  navTileIconText: {
    color: '#93C5FD',
    fontSize: TEXT.sm,
    fontWeight: '900',
  },
  navTileTextStack: {
    flex: 1,
    justifyContent: 'flex-start',
    minWidth: 0,
  },
  navTileSubText: {
    marginTop: 6,
    color: '#A3B3C8',
    fontSize: TEXT.xs,
    fontWeight: '700',
  },
  navTileMetricValue: {
    marginTop: 4,
    color: '#F8FAFC',
    fontSize: TEXT.xl,
    fontWeight: '900',
  },
  analysisCardMetricValue: {
    color: '#22C55E',
  },
  navTileMetricContext: {
    marginTop: 3,
    color: '#94A3B8',
    fontSize: TEXT.xs,
    fontWeight: '600',
  },
  analysisCardMetricContext: {
    color: '#94A3B8',
  },
  todayWorkoutMetricValue: {
    marginTop: 4,
    color: '#60A5FA',
    fontSize: TEXT.lg,
    fontWeight: '800',
  },
  todayWorkoutMetricCheckmark: {
    color: '#22C55E',
  },
  todayWorkoutSecondaryText: {
    marginTop: 3,
    color: '#94A3B8',
    fontSize: TEXT.xs,
    fontWeight: '600',
  },
  todayWorkoutMetaText: {
    marginTop: 6,
    color: '#94A3B8',
    fontSize: TEXT.xs,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    ...Platform.select({
      web: { fontFeatureSettings: '"tnum"' },
    }),
  },
  navTileSubLabel: {
    color: '#94A3B8',
    fontWeight: '700',
  },
  navTileSubValue: {
    color: '#E2E8F0',
    fontWeight: '700',
  },
  navTileSubEmpty: {
    color: '#94A3B8',
    fontWeight: '600',
  },
  analysisCardSubText: {
    color: '#94A3B8',
  },
  analysisNavChevron: {
    marginLeft: 'auto',
    color: '#93C5FD',
    fontSize: TEXT.xl,
    fontWeight: '700',
    lineHeight: TEXT.xl,
  },
  analysisCardChevron: {
    color: '#93C5FD',
  },
  lastWorkoutCard: {
    backgroundColor: HOME_SURFACE_DARK,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: HOME_SURFACE_DARK_BORDER,
    padding: SPACING.xl,
    gap: SPACING.md,
    width: '100%',
    alignItems: 'center',
  },
  lastWorkoutPressWrap: {
    width: '100%',
  },
  lastWorkoutCardHidden: {
    opacity: 0,
  },
  lastWorkoutTitle: {
    color: '#E2E8F0',
    fontSize: TEXT.md,
    fontWeight: '800',
    borderBottomWidth: 1,
    borderBottomColor: '#60A5FA',
    paddingBottom: 4,
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  lastWorkoutSectionLabel: {
    color: '#64748B',
    fontSize: TEXT.xs,
    fontWeight: '600',
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  lastWorkoutChipScroll: {
    width: '100%',
  },
  lastWorkoutChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
    justifyContent: 'center',
  },
  muscleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: '#1F2937',
    backgroundColor: '#0F172A',
  },
  muscleChipDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  muscleChipText: {
    color: '#CBD5E1',
    fontSize: TEXT.xs,
    fontWeight: '700',
  },
  lastWorkoutDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#1F2937',
    width: '100%',
  },
  lastWorkoutDate: {
    color: '#93C5FD',
    fontSize: TEXT.xs,
    fontWeight: '700',
    textAlign: 'center',
  },
  lastWorkoutList: {
    gap: SPACING.sm,
  },
  lastWorkoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  lastDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  lastWorkoutName: {
    color: '#F9FAFB',
    fontWeight: '700',
    fontSize: TEXT.sm,
  },
  lastWorkoutDetail: {
    color: '#9CA3AF',
    fontSize: TEXT.xs,
    marginTop: 2,
  },
  lastWorkoutTotalStack: {
    alignItems: 'center',
    marginBottom: SPACING.xs,
    gap: 2,
  },
  lastWorkoutTotalLabel: {
    color: '#94A3B8',
    fontSize: TEXT.sm,
    fontWeight: '600',
    textAlign: 'center',
  },
  lastWorkoutTotalValue: {
    color: '#CBD5E1',
    fontSize: TEXT.md,
    fontWeight: '900',
    textAlign: 'center',
  },
  lastWorkoutMetricNumber: {
    color: '#FFFFFF',
  },
  lastWorkoutMetricUnit: {
    color: '#1E3A8A',
  },
  lastWorkoutMetricSeparator: {
    color: '#CBD5E1',
  },
  lastWorkoutExampleBlock: {
    alignItems: 'center',
    gap: 2,
    marginBottom: SPACING.xs,
  },
  lastWorkoutExampleName: {
    color: '#CBD5E1',
    fontSize: TEXT.sm,
    fontWeight: '700',
    textAlign: 'center',
  },
  lastWorkoutExampleDetail: {
    color: '#CBD5E1',
    fontSize: TEXT.sm,
    fontWeight: '600',
    textAlign: 'center',
  },
  lastWorkoutEmpty: {
    color: '#9CA3AF',
    fontSize: TEXT.xs,
    fontWeight: '600',
    textAlign: 'center',
  },
  lastWorkoutLink: {
    color: '#93C5FD',
    fontSize: TEXT.sm,
    fontWeight: '800',
    textAlign: 'center',
  },
  lastWorkoutPreviewBackdrop: {
    flex: 1,
  },
  lastWorkoutPreviewDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#020617',
  },
  lastWorkoutPreviewCard: {
    position: 'absolute',
    zIndex: 2,
  },
  todayPanelOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  todayPanelBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  todayPanelBackdropDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#020617',
  },
  todayPanelSheet: {
    backgroundColor: '#081224',
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#1F2A44',
    borderBottomWidth: 0,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    overflow: 'hidden',
    ...Platform.select({
      web: { boxShadow: '0 -10px 30px rgba(2, 6, 23, 0.55)' },
      default: {
        shadowColor: '#020617',
        shadowOpacity: 0.45,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: -6 },
      },
    }),
  },
  todayPanelHandle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: RADIUS.pill,
    backgroundColor: '#334155',
    marginBottom: SPACING.sm,
  },
  todayPanelHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  todayPanelHeaderTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  todayPanelTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  todayPanelHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  todayPanelTitle: {
    color: '#A3B3C8',
    fontSize: TEXT.xs,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  todayPanelDateText: {
    marginTop: 4,
    color: '#94A3B8',
    fontSize: TEXT.xs,
    fontWeight: '600',
  },
  todayPanelLiveBadge: {
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayPanelLiveBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  todayPanelHeaderAccent: {
    height: 1,
    borderRadius: RADIUS.pill,
    marginBottom: SPACING.md,
  },
  todayFinishButton: {
    minHeight: 36,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.45)',
    backgroundColor: 'rgba(34, 197, 94, 0.16)',
    paddingHorizontal: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayFinishButtonText: {
    color: '#DCFCE7',
    fontSize: TEXT.xs,
    fontWeight: '800',
  },
  todayPanelCloseButton: {
    minWidth: 36,
    minHeight: 36,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayPanelCloseText: {
    color: '#CBD5E1',
    fontSize: TEXT.sm,
    fontWeight: '900',
  },
  todayPanelScroll: {
    flex: 1,
  },
  todayPanelScrollContent: {
    paddingBottom: SPACING.md,
    gap: SPACING.md,
  },
  todayTimerCard: {
    backgroundColor: '#0B1220',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#1F2937',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    position: 'relative',
    overflow: 'hidden',
  },
  todayTimerTintLayer: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: RADIUS.lg,
  },
  todayTimerForeground: {
    position: 'relative',
    zIndex: 1,
  },
  todayTimerValue: {
    color: '#F8FAFC',
    fontSize: TEXT.xxl,
    fontWeight: '900',
    letterSpacing: 0.25,
  },
  todayTimerHelp: {
    marginTop: 4,
    color: '#94A3B8',
    fontSize: TEXT.xs,
    fontWeight: '600',
  },
  todaySummaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  todaySummaryCard: {
    flexGrow: 1,
    minWidth: 124,
    backgroundColor: '#0B1220',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#1F2937',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  todaySummaryLabel: {
    color: '#94A3B8',
    fontSize: TEXT.xs,
    fontWeight: '600',
  },
  todaySummaryValue: {
    marginTop: 4,
    color: '#F8FAFC',
    fontSize: TEXT.md,
    fontWeight: '900',
  },
  todaySummaryTopValue: {
    color: '#BFDBFE',
    fontSize: TEXT.sm,
  },
  todayMuscleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  todayMuscleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: '#1F2937',
    backgroundColor: '#0F172A',
  },
  todayMuscleDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  todayMuscleText: {
    color: '#CBD5E1',
    fontSize: TEXT.xs,
    fontWeight: '700',
  },
  todayTimelineList: {
    gap: SPACING.xs,
    marginTop: SPACING.xs,
  },
  todayExerciseRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  todayTimelineRail: {
    width: 16,
    alignItems: 'center',
    paddingTop: SPACING.sm,
  },
  todayTimelineDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#60A5FA',
  },
  todayTimelineLine: {
    flex: 1,
    width: 1,
    backgroundColor: '#1F2A44',
    marginTop: 2,
    marginBottom: -2,
  },
  todayExerciseCard: {
    flex: 1,
    backgroundColor: '#0B1220',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#1F2937',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  todayExerciseHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  todayExerciseMetaRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  todayExerciseTitle: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: TEXT.sm,
    fontWeight: '800',
  },
  todayExerciseTime: {
    color: '#64748B',
    fontSize: TEXT.xs,
    fontWeight: '700',
  },
  todayExerciseVolume: {
    color: '#93C5FD',
    fontSize: TEXT.xs,
    fontWeight: '800',
  },
  todayExerciseSetLine: {
    color: '#CBD5E1',
    fontSize: TEXT.xs,
    fontWeight: '600',
    marginTop: 2,
  },
  todayEmptyCard: {
    backgroundColor: '#0B1220',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#1F2937',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xl,
    alignItems: 'center',
  },
  todayEmptyIcon: {
    fontSize: 28,
    color: '#93C5FD',
    marginBottom: SPACING.sm,
  },
  todayEmptyTitle: {
    color: '#E2E8F0',
    fontSize: TEXT.md,
    fontWeight: '800',
    textAlign: 'center',
  },
  todayEmptyHint: {
    marginTop: SPACING.sm,
    color: '#94A3B8',
    fontSize: TEXT.sm,
    fontWeight: '600',
    textAlign: 'center',
  },
  notesCard: {
    backgroundColor: HOME_SURFACE_MUTED,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: HOME_SURFACE_MUTED_BORDER,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xl,
    gap: SPACING.sm,
    width: '100%',
    minHeight: 194,
  },
  notesHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 22,
  },
  notesCardFill: {
    flex: 1,
  },
  notesCardStretchWrap: {
    flex: 0,
    alignSelf: 'stretch',
    minHeight: 194,
  },
  notesTitle: {
    color: '#60A5FA',
    fontSize: TEXT.md,
    fontWeight: '800',
    textAlign: 'center',
    width: '100%',
  },
  notesInput: {
    backgroundColor: 'transparent',
    borderRadius: RADIUS.md,
    borderWidth: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
    color: '#E5E7EB',
    minHeight: 76,
    textAlignVertical: 'top',
    fontSize: TEXT.sm,
    lineHeight: 20,
  },
  notesInputNudged: {
    transform: [{ translateY: 4 }],
  },
  notesInputFill: {
    flex: 1,
  },
  notesInputFocused: {
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.xs,
    paddingVertical: SPACING.xs,
  },
  notesButton: {
    backgroundColor: '#0D9488',
    borderWidth: 1,
    borderColor: '#14B8A6',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    minHeight: 48,
    ...Platform.select({
      web: { boxShadow: '0 8px 16px rgba(19, 32, 51, 0.32)' },
      default: {
        shadowColor: HOME_SURFACE_DARK,
        shadowOpacity: 0.24,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 3,
      },
    }),
  },
  notesButtonNudged: {
    transform: [{ translateY: 8 }],
  },
  notesButtonHover: {
    backgroundColor: '#14B8A6',
  },
  notesButtonPressed: {
    backgroundColor: '#0F766E',
  },
  notesButtonDisabled: {
    backgroundColor: '#0B5A57',
    opacity: 0.5,
    ...Platform.select({
      web: { boxShadow: 'none' },
      default: { shadowOpacity: 0, elevation: 0 },
    }),
  },
  notesButtonText: {
    color: '#F9FAFB',
    fontWeight: '800',
    fontSize: TEXT.md,
  },
  notesNotice: {
    color: '#86EFAC',
    fontSize: TEXT.xs,
    fontWeight: '700',
    textAlign: 'center',
    minHeight: 16,
  },
  notesNoticeHidden: {
    color: 'transparent',
  },
  cardioCard: {
    backgroundColor: '#0A1A33',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#113268',
    padding: SPACING.lg,
    gap: SPACING.sm,
    width: '100%',
  },
  cardioTitle: {
    color: '#E5E7EB',
    fontSize: TEXT.md,
    fontWeight: '700',
  },
  cardioSubtitle: {
    color: '#9CA3AF',
    fontSize: TEXT.sm,
    fontWeight: '600',
  },
  cardioButton: {
    backgroundColor: '#2E7CF6',
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  cardioButtonText: {
    color: '#F9FAFB',
    fontSize: TEXT.md,
    fontWeight: '700',
  },
  cardioHint: {
    color: '#9CA3AF',
    fontSize: TEXT.xs,
  },
  analysisWrapper: {
    marginTop: 0,
    marginBottom: SPACING.xxl,
  },
  analysisCards: {
    gap: SPACING.md,
    backgroundColor: '#0A1023',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#1F2A44',
    padding: SPACING.md,
    ...Platform.select({
      web: { boxShadow: '0 8px 12px rgba(11, 18, 32, 0.35)' },
      default: {
        shadowColor: '#0B1220',
        shadowOpacity: 0.35,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 8 },
      },
    }),
  },
  volumeCard: {
    backgroundColor: '#0B1220',
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  volumeTitle: {
    color: COLORS.blue1,
    fontSize: TEXT.sm,
    fontWeight: '800',
    marginBottom: SPACING.sm,
  },
  volumeTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  volumeLabel: {
    flex: 1,
    color: '#94A3B8',
    fontSize: TEXT.xs,
    fontWeight: '600',
  },
  volumeDeltaChip: {
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  volumeDeltaText: {
    fontSize: TEXT.xs,
    fontWeight: '800',
  },
  volumeValue: {
    marginTop: 4,
    color: '#F8FAFC',
    fontSize: TEXT.xl,
    fontWeight: '900',
  },
  volumeToggleRow: {
    marginTop: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingVertical: SPACING.xs,
  },
  volumeToggleText: {
    color: '#93C5FD',
    fontSize: TEXT.sm,
    fontWeight: '700',
  },
  volumeToggleChevron: {
    color: '#9CA3AF',
    fontSize: TEXT.md,
    fontWeight: '800',
  },
  volumeListWrapper: {
    marginTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: '#111827',
    paddingTop: SPACING.sm,
  },
  volumeList: {
    gap: SPACING.xs,
  },
  volumeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingVertical: SPACING.xs,
  },
  volumeRowLabel: {
    flex: 1,
    paddingRight: SPACING.md,
    color: '#E5E7EB',
    fontSize: TEXT.sm,
    fontWeight: '700',
  },
  volumeRowRight: {
    alignItems: 'flex-end',
  },
  volumeRowChange: {
    fontSize: TEXT.xs,
    fontWeight: '800',
  },
  volumeRowValue: {
    marginTop: 2,
    color: '#E2E8F0',
    fontSize: TEXT.xs,
    fontWeight: '700',
  },
  volumeEmptyText: {
    color: '#9CA3AF',
    fontSize: TEXT.sm,
    fontWeight: '600',
    paddingVertical: SPACING.xs,
  },
  analysisCard: {
    backgroundColor: '#0B1220',
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderWidth: 1,
    borderColor: '#1F2937',
    minHeight: 72,
  },
  cardTitle: {
    fontSize: TEXT.md,
    fontWeight: '700',
    color: COLORS.blue1,
    marginBottom: SPACING.xs,
  },
  cardText: {
    fontSize: TEXT.xs,
    color: '#9CA3AF',
  },
});
