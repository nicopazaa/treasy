import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Platform,
  Image,
  ImageSourcePropType,
  TextInput,
  Animated,
  Easing,
  AccessibilityInfo,
  Modal,
  Pressable,
  useWindowDimensions,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
  type LayoutChangeEvent,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavigationContext } from '@react-navigation/native';
import type { AppState, TrainingBlock, TrainingBlockId } from '../features/workouts';
import type { NoteEntry } from '../domain/workouts/types';
import { getBlockTone, getDotColor } from '../shared/theme/blockTone';
import {
  SPACING,
  RADIUS,
  SCREEN_PADDING,
  COLORS,
} from '../shared/theme/tokens';
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
import type { VolumeByMuscleRow } from '../features/analytics/ui/VolumeCard';
import { progressiveOverloadSummary } from '../shared/utils/progressiveOverloadSummary';
import { QuickActionsMenu, type QuickActionsMenuItem } from '../shared/ui/QuickActionsMenu';
import { relativeDayLabel } from '../shared/time';
import { listNotes } from '../features/notes';
import { styles } from './HomeScreen.styles';
import { QuickLogCard } from './HomeScreen/sections/QuickLogCard';
import { MuscleGroupGrid } from './HomeScreen/sections/MuscleGroupGrid';
import { PreviousWorkoutCard, type PreviousWorkoutCardDisplay } from './HomeScreen/sections/PreviousWorkoutCard';
import { AnalysisSection } from './HomeScreen/sections/AnalysisSection';

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
const MAX_MUSCLE_CHIPS = 4;
const TILE_PRESS_SCALE = 0.985;
const TILE_PRESS_IN_MS = 110;
const TILE_PRESS_OUT_MS = 110;
const TILE_ICON_ACTIVE_OPACITY = 0.24;
const GROUP_ICON_DARK_BLUE = '#1E3A8A';
const TWO_COLUMN_MIN_WIDTH = 640;
const NAV_CHEVRON = '\u203A';
const HOME_SURFACE_DARK_BORDER = '#2E415A';
const NOTERT_PREVIEW_ROWS = 3;
const STICKY_WORDMARK_MIN_TRANSLATE_Y = -6;
const QUICKLOG_HERO_CYAN = '#00E5FF';
const QUICKLOG_HERO_TEAL = '#0D9488';
const WORDMARK_MAIN_CYAN = '#8CF7FF';
const LAST_WORKOUT_TITLE_UNDERLINE_DARK = '#457DCC';

const MUSCLE_GROUP_GRID_STYLES = {
  groupsColumn: styles.groupsColumn,
  groupsTitle: styles.groupsTitle,
  groupsList: styles.groupsList,
  groupRow: styles.groupRow,
  groupDotSmall: styles.groupDotSmall,
  groupRowText: styles.groupRowText,
  groupRowTextTight: styles.groupRowTextTight,
  groupAction: styles.groupAction,
  groupActionText: styles.groupActionText,
  groupIconWrap: styles.groupIconWrap,
};

const PREVIOUS_WORKOUT_CARD_STYLES = {
  lastWorkoutCard: styles.lastWorkoutCard,
  lastWorkoutEmpty: styles.lastWorkoutEmpty,
  lastWorkoutDate: styles.lastWorkoutDate,
  lastWorkoutTitle: styles.lastWorkoutTitle,
  lastWorkoutChips: styles.lastWorkoutChips,
  previousWorkoutChipsReserved: styles.previousWorkoutChipsReserved,
  muscleChip: styles.muscleChip,
  muscleChipDot: styles.muscleChipDot,
  muscleChipText: styles.muscleChipText,
  previousWorkoutChipCompact: styles.previousWorkoutChipCompact,
  previousWorkoutChipTwoColumn: styles.previousWorkoutChipTwoColumn,
  previousWorkoutChipDotCompact: styles.previousWorkoutChipDotCompact,
  previousWorkoutChipTextCompact: styles.previousWorkoutChipTextCompact,
  previousWorkoutChipOverflowCompact: styles.previousWorkoutChipOverflowCompact,
  lastWorkoutTotalStack: styles.lastWorkoutTotalStack,
  lastWorkoutTotalLabel: styles.lastWorkoutTotalLabel,
  lastWorkoutTotalValue: styles.lastWorkoutTotalValue,
  lastWorkoutMetricNumber: styles.lastWorkoutMetricNumber,
  lastWorkoutMetricUnit: styles.lastWorkoutMetricUnit,
  lastWorkoutMetricSeparator: styles.lastWorkoutMetricSeparator,
  lastWorkoutDivider: styles.lastWorkoutDivider,
  lastWorkoutExampleBlock: styles.lastWorkoutExampleBlock,
  lastWorkoutExampleName: styles.lastWorkoutExampleName,
  lastWorkoutExampleDetail: styles.lastWorkoutExampleDetail,
  lastWorkoutLink: styles.lastWorkoutLink,
};

const ANALYSIS_SECTION_STYLES = {
  analysisWrapper: styles.analysisWrapper,
  analysisCards: styles.analysisCards,
  analysisCardsPlain: styles.analysisCardsPlain,
  volumeCard: styles.volumeCard,
  volumeTitle: styles.volumeTitle,
  volumeTopRow: styles.volumeTopRow,
  volumeLabel: styles.volumeLabel,
  volumeDeltaChip: styles.volumeDeltaChip,
  volumeDeltaText: styles.volumeDeltaText,
  volumeValue: styles.volumeValue,
  volumeToggleRow: styles.volumeToggleRow,
  volumeToggleText: styles.volumeToggleText,
  volumeToggleChevron: styles.volumeToggleChevron,
  volumeListWrapper: styles.volumeListWrapper,
  volumeEmptyText: styles.volumeEmptyText,
  volumeList: styles.volumeList,
  volumeRow: styles.volumeRow,
  volumeRowLabel: styles.volumeRowLabel,
  volumeRowRight: styles.volumeRowRight,
  volumeRowChange: styles.volumeRowChange,
  volumeRowValue: styles.volumeRowValue,
  analysisCard: styles.analysisCard,
  cardTitle: styles.cardTitle,
  cardText: styles.cardText,
};

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
  const isDarkTheme = themeTokens.id === 'darkBlue';
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
  const [allNotes, setAllNotes] = useState<NoteEntry[]>([]);
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);
  const [analysisAnchorY, setAnalysisAnchorY] = useState<number | null>(null);
  const [layoutWidth, setLayoutWidth] = useState<number | null>(null);
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
  const scrollY = useRef(new Animated.Value(0)).current;
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
  const useFluidPreviousWorkoutChips = Platform.OS === 'ios' && !isTwoColumn;

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

  const handleLastWorkoutCardLayout = useCallback(
    ({ nativeEvent }: LayoutChangeEvent) => {
      const nextHeight = Math.round(nativeEvent.layout.height);
      if (!Number.isFinite(nextHeight) || nextHeight <= 0) return;
      setLastWorkoutCardHeight((prev) => (prev == null ? nextHeight : prev));
    },
    []
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
  const lastWorkoutCardHeightStyle = isTwoColumn && lastWorkoutCardHeight ? { height: lastWorkoutCardHeight } : null;
  const themeSurfaceStyle = useMemo(
    () => ({ backgroundColor: themeTokens.surface, borderColor: themeTokens.stroke }),
    [themeTokens.surface, themeTokens.stroke]
  );
  const analysisSectionTheme = useMemo(
    () => (isDarkTheme ? { ...themeTokens, surface: 'transparent' } : themeTokens),
    [isDarkTheme, themeTokens]
  );
  const progressiveOverloadTheme = useMemo(
    () => ({
      surface: analysisSectionTheme.surface,
      stroke: analysisSectionTheme.stroke,
      accent: analysisSectionTheme.accent,
      text: analysisSectionTheme.text,
      success: analysisSectionTheme.success,
    }),
    [
      analysisSectionTheme.accent,
      analysisSectionTheme.success,
      analysisSectionTheme.stroke,
      analysisSectionTheme.surface,
      analysisSectionTheme.text,
    ]
  );
  const previousWorkoutsTheme = useMemo(
    () => ({
      surface: analysisSectionTheme.surface,
      stroke: analysisSectionTheme.stroke,
      accent: analysisSectionTheme.accent,
      textMuted: analysisSectionTheme.textMuted,
      text: analysisSectionTheme.text,
    }),
    [
      analysisSectionTheme.accent,
      analysisSectionTheme.stroke,
      analysisSectionTheme.surface,
      analysisSectionTheme.text,
      analysisSectionTheme.textMuted,
    ]
  );
  const analysisSectionSurfaceStyle = useMemo(
    () => ({ backgroundColor: analysisSectionTheme.surface, borderColor: analysisSectionTheme.stroke }),
    [analysisSectionTheme.surface, analysisSectionTheme.stroke]
  );
  const analysisSectionBorderlessStyle = isDarkTheme ? styles.analysisSectionBorderless : null;
  const analysisSectionVolumeListStyle = useMemo(
    () => (isDarkTheme ? styles.volumeListWrapperBorderless : { borderTopColor: analysisSectionTheme.stroke }),
    [isDarkTheme, analysisSectionTheme.stroke]
  );
  const analysisSectionTextStyle = useMemo(() => ({ color: analysisSectionTheme.text }), [analysisSectionTheme.text]);
  const analysisSectionTextMutedStyle = useMemo(
    () => ({ color: analysisSectionTheme.textMuted }),
    [analysisSectionTheme.textMuted]
  );
  const analysisSectionAccentTextStyle = useMemo(
    () => ({ color: analysisSectionTheme.accent }),
    [analysisSectionTheme.accent]
  );
  const analysisSectionLinkTextStyle = useMemo(
    () => ({ color: analysisSectionTheme.link }),
    [analysisSectionTheme.link]
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
  const lastWorkoutTitleToneStyle = useMemo(
    () =>
      themeTokens.id === 'darkBlue'
        ? {
            color: '#F8FAFC',
            borderBottomColor: LAST_WORKOUT_TITLE_UNDERLINE_DARK,
            textShadowColor: 'rgba(2, 6, 23, 0.36)',
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 1,
            letterSpacing: 0.15,
          }
        : {
            color: themeTokens.text,
            borderBottomColor: themeTokens.accent,
          },
    [themeTokens.accent, themeTokens.id, themeTokens.text]
  );
  const quickLogHeroTitleColor = useMemo(() => (themeTokens.id === 'calmLight' ? '#111827' : '#F8FAFC'), [themeTokens.id]);
  const quickLogTitleToneStyle = useMemo(
    () =>
      themeTokens.id === 'calmLight'
        ? {
            color: quickLogHeroTitleColor,
            textShadowColor: 'rgba(255, 255, 255, 0.34)',
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 1,
            letterSpacing: 0.14,
          }
        : {
            color: quickLogHeroTitleColor,
            textShadowColor: 'rgba(2, 6, 23, 0.32)',
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 1,
            letterSpacing: 0.14,
          },
    [quickLogHeroTitleColor, themeTokens.id]
  );
  const quickLogExampleToneStyle = useMemo(
    () => ({ color: themeTokens.id === 'darkBlue' ? '#8FA1BC' : '#5F6B7A' }),
    [themeTokens.id]
  );
  const wordmarkMainToneStyle = useMemo(
    () => ({ color: themeTokens.id === 'calmLight' ? themeTokens.link : WORDMARK_MAIN_CYAN }),
    [themeTokens.id, themeTokens.link]
  );
  const stickyWordmarkOpacity = useMemo(
    () =>
      scrollY.interpolate({
        inputRange: [0, 120, 360],
        outputRange: [1, 0.84, 0.72],
        extrapolate: 'clamp',
      }),
    [scrollY]
  );
  const stickyWordmarkTranslateY = useMemo(
    () =>
      scrollY.interpolate({
        inputRange: [0, 120, 360],
        outputRange: [0, -3, STICKY_WORDMARK_MIN_TRANSLATE_Y],
        extrapolate: 'clamp',
      }),
    [scrollY]
  );
  const handleMainScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollY.setValue(event.nativeEvent.contentOffset.y);
    },
    [scrollY]
  );
  const quickLogCardToneStyle = useMemo(
    () =>
      themeTokens.id === 'darkBlue'
        ? {
            backgroundColor: '#08172F',
            borderColor: HOME_SURFACE_DARK_BORDER,
            ...Platform.select({
              web: {
                boxShadow: '0 0 0 1px rgba(148, 163, 184, 0.08), 0 8px 18px rgba(2, 6, 23, 0.3)',
              },
              default: {
                shadowColor: '#020617',
                shadowOpacity: 0.2,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 4 },
                elevation: 2,
              },
            }),
          }
        : {
            backgroundColor: '#E9EDF2',
            borderColor: '#C8D0DA',
            ...Platform.select({
              web: {
                boxShadow: '0 0 0 1px rgba(148, 163, 184, 0.16), 0 10px 20px rgba(15, 23, 42, 0.08)',
              },
              default: {
                shadowColor: '#334155',
                shadowOpacity: 0.07,
                shadowRadius: 9,
                shadowOffset: { width: 0, height: 4 },
                elevation: 2,
              },
            }),
          },
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
      backgroundColor: toRgba(themeTokens.accent, themeTokens.id === 'darkBlue' ? 0.2 : 0.16),
      borderColor: toRgba(themeTokens.stroke, themeTokens.id === 'darkBlue' ? 0.86 : 0.92),
    }),
    [themeTokens.accent, themeTokens.id, themeTokens.stroke]
  );
  const wordmarkDotGlowStyle = themeTokens.id === 'darkBlue' ? styles.wordmarkDotGlow : null;
  const refreshRecentNotes = useCallback(async () => {
    try {
      const notes = await listNotes();
      if (!isMountedRef.current) return;
      setAllNotes(notes);
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
  const analysisVolumeRows = useMemo(
    () =>
      volumeCardProps.rows.map((row) => {
        const rowTrend = trendFromPct(row.pctChange);
        const rowColor = colorForVolumeTrend(rowTrend);
        const rowChangeText = formatVolumeChangeText(language, row.pctChange);
        const rowVolumeText = `${formatVolumeNumber(fromKg(row.volume7d, massUnit))} ${unitLabel}`;
        return {
          id: row.id,
          label: row.label,
          changeText: rowChangeText,
          changeColor: rowColor,
          volumeText: rowVolumeText,
        };
      }),
    [formatVolumeNumber, language, massUnit, unitLabel, volumeCardProps.rows]
  );
  const toggleVolumeExpanded = useCallback(() => {
    setVolumeExpanded((prev) => !prev);
  }, []);

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
      toValue: 0.46,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: shouldUseNativeDriver,
    });
    tickerAnimationRef.current = fadeOut;
    fadeOut.start(({ finished }) => {
      if (!finished) {
        tickerAnimatingRef.current = false;
        return;
      }

      setExampleIndex((idx) => (idx + 1) % quickLogExamples.length);
      exampleAnim.setValue(0.46);

      const fadeIn = Animated.timing(exampleAnim, {
        toValue: 1,
        duration: 420,
        easing: Easing.out(Easing.cubic),
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
    tickerIntervalRef.current = setInterval(runTickerCycle, 4400);
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
  const resolveBlockColor = useCallback((blockId: string): string => getDotColor(blockId), []);

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

  const lastWorkoutDisplay = useMemo<PreviousWorkoutCardDisplay>(() => {
    if (lastWorkout.status !== 'ready') {
      return { status: 'empty', message: lastWorkout.message };
    }

    const exampleText = lastWorkoutExamples.length ? lastWorkoutExamples[lastExampleIndex % lastWorkoutExamples.length] : '';
    const muscleGroups = lastWorkout.muscleGroups ?? [];
    const hasOverflow = !useFluidPreviousWorkoutChips && muscleGroups.length > MAX_MUSCLE_CHIPS;
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
    const setLineUnitLabel = setLineMatch
      ? `${setLineMatch[2].slice(0, 1).toUpperCase()}${setLineMatch[2].slice(1).toLowerCase()}`
      : null;

    return {
      status: 'ready',
      dateLabel: lastWorkout.dateLabel,
      titleText: lastWorkoutTitle(language),
      muscleGroups: visibleGroups.map((blockId) => ({
        id: blockId,
        label: blockLabel(blockId, language),
        dotColor: getDotColor(blockId),
      })),
      hiddenCount,
      totalVolumeTitleText,
      totalVolumeNumber,
      totalVolumeUnitLabel,
      hasExamples: lastWorkoutExamples.length > 0,
      exampleName,
      exampleSetLine,
      parsedSetLine:
        setLineMatch && setLineUnitLabel
          ? {
              weight: setLineMatch[1],
              unitLabel: setLineUnitLabel,
              reps: setLineMatch[3],
            }
          : null,
    };
  }, [language, lastExampleIndex, lastWorkout, lastWorkoutExamples, useFluidPreviousWorkoutChips]);
  const lastWorkoutOpenLogLabel = openLogLabel(language);

  const lastWorkoutCard = (
    <PressScale
      onLongPress={openLastWorkoutPreview}
      onPressOut={closeLastWorkoutPreview}
      delayLongPress={220}
      style={styles.lastWorkoutPressWrap}
    >
      <PreviousWorkoutCard
        styles={PREVIOUS_WORKOUT_CARD_STYLES}
        display={lastWorkoutDisplay}
        wrapInCard
        cardStyle={[
          themeSurfaceStyle,
          lastWorkoutPreviewVisible ? styles.lastWorkoutCardHidden : null,
          lastWorkoutCardHeightStyle,
        ]}
        cardRef={lastWorkoutCardRef}
        onCardLayout={handleLastWorkoutCardLayout}
        themeTextStyle={themeTextStyle}
        themeTextMutedStyle={themeTextMutedStyle}
        themeAccentTextStyle={themeAccentTextStyle}
        themeLinkTextStyle={themeLinkTextStyle}
        themeChipStyle={themeChipStyle}
        lastWorkoutTitleToneStyle={lastWorkoutTitleToneStyle}
        dividerColor={themeTokens.stroke}
        overflowChipDotColor={themeTokens.iconMuted}
        reduceMotionEnabled={reduceMotionEnabled}
        expanded={false}
        exampleAnim={lastExampleAnim}
        openLogLabel={lastWorkoutOpenLogLabel}
        openLogAction="button"
        onOpenHistory={onOpenHistory}
        useFluidChipLayout={useFluidPreviousWorkoutChips}
      />
    </PressScale>
  );

  const hasNoteText = noteText.trim().length > 0;
  const noteDraftCount = hasNoteText ? noteText.trim().length : 0;
  const notertTitle = language === 'nb' ? 'Notert' : language === 'es' ? 'Notas' : 'Notes';
  const notertEmpty = t(language, 'home.notes.empty');
  const recentNoteLines = useMemo(
    () => recentNotes.map((note) => note.text.trim()).filter((text) => text.length > 0),
    [recentNotes]
  );
  const totalRecentNotesCount = useMemo(
    () => allNotes.reduce((count, note) => (note.text.trim().length > 0 ? count + 1 : count), 0),
    [allNotes]
  );
  const notertOverflowCount = Math.max(0, totalRecentNotesCount - NOTERT_PREVIEW_ROWS);
  const timelineNotesByDate = useMemo(() => {
    const byDate: Record<string, string> = {};
    const sorted = allNotes
      .filter((note) => note.text.trim().length > 0 && typeof note.createdAt === 'string' && note.createdAt.length >= 10)
      .slice()
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    for (const note of sorted) {
      const dateKey = note.createdAt.slice(0, 10);
      if (!byDate[dateKey]) {
        byDate[dateKey] = note.text.trim();
      }
    }
    return byDate;
  }, [allNotes]);

  const renderRecentNotesList = ({
    lines,
    emptyLabel,
    containerStyle,
    itemTextStyle,
    emptyTextStyle,
    maxRows,
    reserveRows,
    overflowCount,
    overflowTextStyle,
  }: {
    lines: string[];
    emptyLabel: string;
    containerStyle?: StyleProp<ViewStyle>;
    itemTextStyle: StyleProp<TextStyle>;
    emptyTextStyle: StyleProp<TextStyle>;
    maxRows?: number;
    reserveRows?: number;
    overflowCount?: number;
    overflowTextStyle?: StyleProp<TextStyle>;
  }) => {
    const visibleLines = maxRows != null && maxRows > 0 ? lines.slice(0, maxRows) : lines;
    const visibleCount = visibleLines.length > 0 ? visibleLines.length : 1;

    return (
      <View style={containerStyle}>
        {visibleLines.length ? (
          visibleLines.map((line, index) => (
            <View key={`${index}-${line.slice(0, 24)}`} style={styles.notePreviewRow}>
              <View style={styles.notePreviewDot} />
              <Text style={[styles.notePreviewText, itemTextStyle]} numberOfLines={1} ellipsizeMode="tail">
                {line}
              </Text>
            </View>
          ))
        ) : (
          <Text style={emptyTextStyle}>{emptyLabel}</Text>
        )}
        {reserveRows != null && reserveRows > 0
          ? Array.from({
              length: Math.max(0, reserveRows - visibleCount),
            }).map((_, index) => (
              <View key={`placeholder-${index}`} style={styles.notePreviewRow}>
                <View style={[styles.notePreviewDot, styles.notePreviewDotPlaceholder]} />
                <Text style={[styles.notePreviewText, itemTextStyle, styles.notePreviewPlaceholder]}>{'placeholder'}</Text>
              </View>
            ))
          : null}
        {overflowCount != null && overflowCount > 0 ? <Text style={overflowTextStyle}>{`+${overflowCount}`}</Text> : null}
      </View>
    );
  };

  const notesCard = (
    <View style={[styles.notesCard, themeSurfaceStyle, notesCardFillStyle]}>
      <View style={styles.notesHeaderRow}>
        <Text style={[styles.notesTitle, themeTextStyle]}>{language === 'nb' ? 'Notater' : 'Notes'}</Text>
        <View style={styles.notesHeaderAffordance}>
          <View style={[styles.notertCountChip, { borderColor: themeTokens.stroke, backgroundColor: themeTokens.chip }]}>
            <Text style={[styles.notertCountText, themeTextMutedStyle]}>{noteDraftCount}</Text>
          </View>
        </View>
      </View>
      <View
        style={[
          styles.notesInputSurface,
          notesInputFillStyle,
          {
            borderColor: notesFocused ? themeTokens.accent : themeTokens.stroke,
            backgroundColor: toRgba(themeTokens.chip, themeTokens.id === 'darkBlue' ? 0.48 : 0.78),
          },
        ]}
      >
        <TextInput
          style={[styles.notesInput, styles.notesInputNudged, { color: themeTokens.text }]}
          placeholder={notesFocused ? '' : t(language, 'home.notes.placeholder')}
          placeholderTextColor={themeTokens.textMuted}
          value={noteText}
          onChangeText={setNoteText}
          onFocus={() => setNotesFocused(true)}
          onBlur={() => setNotesFocused(false)}
          multiline
          scrollEnabled
        />
      </View>
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
        <Text style={[styles.notesButtonText, { color: hasNoteText ? themeTokens.textOnAccent : themeTokens.textMuted }]}>
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
  const todayCompletedMetricToneStyle = themeTokens.id === 'calmLight' ? styles.todayWorkoutMetricValueCompletedLight : null;
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
              <PreviousWorkoutCard
                styles={PREVIOUS_WORKOUT_CARD_STYLES}
                display={lastWorkoutDisplay}
                wrapInCard={false}
                themeTextStyle={themeTextStyle}
                themeTextMutedStyle={themeTextMutedStyle}
                themeAccentTextStyle={themeAccentTextStyle}
                themeLinkTextStyle={themeLinkTextStyle}
                themeChipStyle={themeChipStyle}
                lastWorkoutTitleToneStyle={lastWorkoutTitleToneStyle}
                dividerColor={themeTokens.stroke}
                overflowChipDotColor={themeTokens.iconMuted}
                reduceMotionEnabled={reduceMotionEnabled}
                expanded
                exampleAnim={lastExampleAnim}
                openLogLabel={lastWorkoutOpenLogLabel}
                openLogAction="text"
                useFluidChipLayout={useFluidPreviousWorkoutChips}
              />
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
      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.stickyWordmarkWrap,
          {
            top: headerTopPadding,
            opacity: stickyWordmarkOpacity,
            transform: [{ translateY: stickyWordmarkTranslateY }],
          },
        ]}
      >
        <Pressable
          onPress={handlePressWordmark}
          onLongPress={() => setCompassOpen(true)}
          hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
          accessibilityRole="button"
          accessibilityLabel="Treasy"
          style={({ pressed }) => [styles.wordmarkButton, styles.stickyWordmarkButton, pressed ? styles.wordmarkPressed : null]}
        >
          <Text style={styles.wordmarkText}>
            <Text style={[styles.wordmarkTextMain, wordmarkMainToneStyle]}>Treasy</Text>
            <Text style={[styles.wordmarkDot, wordmarkDotGlowStyle]}>{'\u00B7'}</Text>
          </Text>
        </Pressable>
      </Animated.View>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        onScroll={handleMainScroll}
        scrollEventThrottle={16}
        bounces
        scrollEnabled={!lastWorkoutPreviewVisible && !todayPanelVisible}
      >
        <View
          style={[
            styles.headerRow,
            { paddingTop: headerTopPadding, paddingBottom: headerBottomPadding, marginBottom: headerToQuickLogGap },
          ]}
        >
          <View style={styles.headerWordmarkSpacer} />
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

        <QuickLogCard
          styles={styles}
          themeSurfaceStyle={themeSurfaceStyle}
          quickLogCardToneStyle={quickLogCardToneStyle}
          onOpenQuickLog={onOpenQuickLog}
          quickLogTitleToneStyle={quickLogTitleToneStyle}
          quickLogTitleText={t(language, 'quickLogTitle')}
          themeTextStyle={themeTextStyle}
          reduceMotionEnabled={reduceMotionEnabled}
          quickLogExampleToneStyle={quickLogExampleToneStyle}
          language={language}
          quickLogExamples={quickLogExamples}
          exampleIndex={exampleIndex}
          exampleAnim={exampleAnim}
          themeLinkTextStyle={themeLinkTextStyle}
          momentumColor={momentumColor}
          momentumTrend={analytics.momentum}
          momentumMain={momentumMain}
          momentumBasedOn={momentumBasedOn}
          themeTextMutedStyle={themeTextMutedStyle}
          scrollToAnalysis={scrollToAnalysis}
        />

        <View style={styles.groupsWrapper}>
          <View style={[styles.twoColumnRow, styles.twoColumnRowStretch]} onLayout={handleColumnsLayout}>
            <View style={styles.leftColumn}>
              <MuscleGroupGrid
                styles={MUSCLE_GROUP_GRID_STYLES}
                title={t(language, 'muscleGroups')}
                showList
                blocks={primaryBlocks}
                themeTextStyle={themeTextStyle}
                themeSurfaceStyle={themeSurfaceStyle}
                groupIconWrapStyle={groupIconWrapStyle}
                groupIconTintColor={groupIconTintColor}
                groupIconActiveTintColor={groupIconActiveTintColor}
                onSelectBlock={onSelectBlock}
                onStartCardio={onStartCardio}
                showCardioStartAction
                labelForBlock={labelForBlock}
                resolveBlockIcon={resolveBlockIcon}
                resolveDotColor={getDotColor}
                HomeTileButton={HomeTileButton}
                HomeTileIcon={HomeTileIcon}
              />

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
                        <Text
                          style={[
                            styles.todayWorkoutMetricValue,
                            themeTextStyle,
                            todayWorkoutLifecycleState === 'finished' ? styles.todayWorkoutMetricValueCompleted : null,
                            todayWorkoutLifecycleState === 'finished' ? todayCompletedMetricToneStyle : null,
                          ]}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
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
                          <View style={styles.notesHeaderAffordance}>
                            <View style={[styles.notertCountChip, { borderColor: themeTokens.stroke, backgroundColor: themeTokens.chip }]}>
                              <Text style={[styles.notertCountText, themeTextMutedStyle]}>{totalRecentNotesCount}</Text>
                            </View>
                            <Text style={[styles.notesHeaderChevron, themeAccentTextStyle]}>{NAV_CHEVRON}</Text>
                          </View>
                        </View>
                        <View style={[styles.notertContentDivider, { backgroundColor: themeTokens.stroke }]} />
                        {renderRecentNotesList({
                          lines: recentNoteLines,
                          emptyLabel: notertEmpty,
                          containerStyle: styles.notertPreviewList,
                          itemTextStyle: [styles.notertLineText, themeTextStyle],
                          emptyTextStyle: [styles.notertEmptyText, themeTextMutedStyle],
                          maxRows: NOTERT_PREVIEW_ROWS,
                          reserveRows: NOTERT_PREVIEW_ROWS,
                          overflowCount: notertOverflowCount,
                          overflowTextStyle: [styles.notertOverflowText, themeTextMutedStyle],
                        })}
                      </View>
                    </PressScale>
                  </View>
                </View>
              </View>
            </View>

            <View style={[styles.sideColumn, styles.rightColumn]}>
              {/* Andre stays on the right so Cardio aligns with Bryst in the grid. */}
              <MuscleGroupGrid
                styles={MUSCLE_GROUP_GRID_STYLES}
                title={otherBlocks.length > 0 ? t(language, 'otherSectionTitle') : null}
                showList={otherBlocks.length > 0}
                blocks={otherBlocks}
                themeTextStyle={themeTextStyle}
                themeSurfaceStyle={themeSurfaceStyle}
                groupIconWrapStyle={groupIconWrapStyle}
                groupIconTintColor={groupIconTintColor}
                groupIconActiveTintColor={groupIconActiveTintColor}
                onSelectBlock={onSelectBlock}
                showCardioStartAction={false}
                labelForBlock={labelForBlock}
                resolveBlockIcon={resolveBlockIcon}
                resolveDotColor={getDotColor}
                HomeTileButton={HomeTileButton}
                HomeTileIcon={HomeTileIcon}
              />
              {otherBlocks.length > 0 ? <View style={styles.lowerGap} /> : null}
              {lastWorkoutCard}
              <View style={styles.lastWorkoutToNotesGap} />
              <View style={notesCardHeightStyle}>{notesCard}</View>
            </View>
          </View>
        </View>

        {isDarkTheme ? <View style={[styles.notesToAnalysisDivider, { backgroundColor: themeTokens.stroke }]} /> : null}

        <AnalysisSection
          styles={ANALYSIS_SECTION_STYLES}
          onLayout={({ nativeEvent }) => setAnalysisAnchorY(nativeEvent.layout.y)}
          progressiveOverload={{
            summary: overload.label,
            deltaText: overloadDeltaText,
            onPress: onOpenProgress,
            theme: progressiveOverloadTheme,
            borderless: isDarkTheme,
          }}
          volume={{
            title: t(language, 'analysis.volume.title'),
            totalLabel: volumeCardProps.totalLabel,
            changeText: volumeChangeText,
            changeColor: volumeChangeColor,
            deltaToneStyle: volumeDeltaTone,
            valueText: analytics.hasData ? volumeCardProps.volumeLabel : t(language, 'analysis.empty'),
            toggleLabel: t(language, 'analysis.volume.byMuscle.toggle'),
            toggleChevron: volumeExpanded ? 'v' : '>',
            expanded: volumeExpanded,
            hasData: analytics.hasData,
            emptyText: t(language, 'analysis.empty'),
            rows: analysisVolumeRows,
            onToggleExpanded: toggleVolumeExpanded,
          }}
          timeline={{
            language,
            massUnit,
            items: analytics.timeline,
            resolveBlockLabel,
            resolveBlockColor,
            notesByDate: timelineNotesByDate,
            onPressDay: openHistoryForDate,
            theme: previousWorkoutsTheme,
            borderless: isDarkTheme,
          }}
          bestLifts={{
            title: t(language, 'analysis.bestLifts.title'),
            subtitle: t(language, 'analysis.bestLifts.subtitle'),
            onPress: onOpenRepMax,
          }}
          sectionSurfaceStyle={analysisSectionSurfaceStyle}
          sectionBorderlessStyle={analysisSectionBorderlessStyle}
          sectionAccentTextStyle={analysisSectionAccentTextStyle}
          sectionTextStyle={analysisSectionTextStyle}
          sectionTextMutedStyle={analysisSectionTextMutedStyle}
          sectionLinkTextStyle={analysisSectionLinkTextStyle}
          volumeListStyle={analysisSectionVolumeListStyle}
        />

        <View style={{ height: Platform.OS === 'web' ? 32 : 48 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

