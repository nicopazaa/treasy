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
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavigationContext } from '@react-navigation/native';
import { AppState, TrainingBlock, TrainingBlockId } from '../features/workouts/model/types';
import { getBlockTone, getDotColor } from '../shared/theme/blockTone';
import { SPACING, TEXT, RADIUS, SCREEN_PADDING } from '../shared/theme/tokens';
import { blockLabel, t } from '../shared/i18n/i18n';
import { formatRelativeDateTime } from '../shared/utils/dateLabels';
import { formatExerciseLabel } from '../shared/utils/exerciseLabel';
import { getWorkoutDates, getDailyWorkout, groupDailySets, GroupedDailySetView } from '../features/workouts/model/workoutService';
import { fromKg, formatWeight } from '../shared/utils/units';
import {
  buildWorkoutTimeline,
  calcPctChange,
  calcTotalVolume,
  calcVolumeByMuscle,
  countSessions,
  getLastDaysRangesUtc,
  getMomentumStatus,
  getWorkoutsInRange,
} from '../features/analytics/model/insights';
import { MomentumCard } from '../features/analytics/ui/MomentumCard';
import { PreviousWorkoutsTimeline } from '../features/analytics/ui/PreviousWorkoutsTimeline';
import { VolumeCard, type VolumeByMuscleRow } from '../features/analytics/ui/VolumeCard';

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
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  onStartCardio: () => void;
  onAddNote: (text: string) => void;
};

const ORDER: TrainingBlockId[] = ['chest', 'shoulders', 'back', 'arms', 'core', 'legs'];
const BLOCK_ICONS: Partial<Record<TrainingBlockId, ImageSourcePropType>> = {
  chest: require('../assets/chest.png'),
  shoulders: require('../assets/shoulder.png'),
  back: require('../assets/back.png'),
  arms: require('../assets/arms.png'),
  core: require('../assets/core.png'),
  legs: require('../assets/leggs.png'),
  cardio: require('../assets/cardio.png'),
  bodyweight: require('../assets/bodyweight.png'),
};
const EMPTY_EXAMPLES: string[] = [];

type LastWorkoutState =
  | { status: 'empty'; message: string }
  | {
      status: 'ready';
      dateLabel: string;
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

type LogSearchHit = {
  id: string;
  exerciseLabel: string;
  blockId: string | null;
  weight: number;
  reps: number;
  createdAt: string;
};

const lastWorkoutTitle = (language: AppState['language']): string => {
  if (language === 'nb') return 'Forrige økt';
  if (language === 'es') return 'Sesión anterior';
  return 'Previous session';
};

const lastWorkoutTotalTitle = (language: AppState['language']): string => {
  if (language === 'nb') return 'Total volum';
  if (language === 'es') return 'Volumen total';
  return 'Total volume';
};

const openLogLabel = (language: AppState['language']): string => {
  if (language === 'nb') return 'Se tidligere økter';
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
  if (allEqual) return `${setCount} × ${reps[0]}`;

  const totalReps = reps.reduce((acc, cur) => acc + cur, 0);
  const setLabel = language === 'nb' ? 'sett' : language === 'es' ? 'series' : 'sets';
  return `${setCount} ${setLabel} • ${totalReps} reps`;
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
  onOpenProfile,
  onOpenSettings,
  onStartCardio,
  onAddNote,
}) => {
  const language = appState.language ?? 'en';
  const massUnit = appState.massUnit ?? 'kg';
  const unitLabel = massUnit === 'lb' ? t(language, 'units.lb') : t(language, 'units.kg');
  const insets = useSafeAreaInsets();
  const headerTopPadding = insets.top + 4; // headerTopPadding: safe area inset plus small offset
  const headerBottomPadding = 8; // headerBottomPadding: space inside header below content
  const headerToQuickLogGap = 8; // gap between header and the QuickLog card
  const [noteText, setNoteText] = useState('');
  const [notesFocused, setNotesFocused] = useState(false);
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);
  const [analysisAnchorY, setAnalysisAnchorY] = useState<number | null>(null);
  const [compassOpen, setCompassOpen] = useState(false);
  const [lastWorkoutPreviewVisible, setLastWorkoutPreviewVisible] = useState(false);
  const [lastWorkoutPreviewLayout, setLastWorkoutPreviewLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [exampleIndex, setExampleIndex] = useState(0);
  const exampleAnim = useMemo(() => new Animated.Value(1), []);
  const [lastExampleIndex, setLastExampleIndex] = useState(0);
  const lastExampleAnim = useMemo(() => new Animated.Value(1), []);
  const scrollRef = useRef<ScrollView | null>(null);
  const lastWorkoutCardRef = useRef<View | null>(null);
  const lastWorkoutPreviewAnim = useRef(new Animated.Value(0)).current;
  const tickerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickerAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const tickerAnimatingRef = useRef(false);
  const lastExampleIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastExampleAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const lastExampleAnimatingRef = useRef(false);
  const navigationContext = useContext(NavigationContext);
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
  const notesPlaceholder =
    language === 'nb'
      ? 'F.eks: logg en øvelse, systemet parser for deg.\nDips 30x10, 30x8'
      : language === 'es'
        ? 'Ej.: registra un ejercicio, el sistema lo interpreta.\nFondos 30x10, 30x8'
        : 'E.g.: log a lift, the system parses it.\nDips 30x10, 30x8';

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

  const nickname = appState.nickname?.trim() ?? '';
  const quickLogExamples = useMemo(() => ['Benkpress 80x5, 90x3', 'Markløft 100x5'], []);
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

  const logSearchHits = useMemo<LogSearchHit[]>(() => {
    const rawQuery = logSearchQuery.trim();
    if (!rawQuery) return [];

    const normalizedNumeric = rawQuery.replace(',', '.');
    const numericQuery = Number(normalizedNumeric);
    const isNumericQuery = normalizedNumeric !== '' && Number.isFinite(numericQuery);
    const lowered = rawQuery.toLowerCase();

    const exercisesById = new Map(appState.exercises.map((ex) => [ex.id, ex] as const));

    const matchesNumber = (value: number): boolean => {
      if (!Number.isFinite(value)) return false;
      return Math.abs(value - numericQuery) < 1e-6;
    };

    const hits: LogSearchHit[] = [];
    for (const set of appState.sets) {
      if (set.setType === 'cardio') continue;

      const exercise = exercisesById.get(set.exerciseId) ?? null;
      const exerciseLabel = exercise
        ? formatExerciseLabel(exercise)
        : language === 'nb'
          ? 'Ukjent øvelse'
          : 'Unknown exercise';
      const blockId = exercise?.blockId ?? null;
      const weightInUnit = fromKg(set.weight, massUnit);

      const matches = isNumericQuery
        ? matchesNumber(weightInUnit) || matchesNumber(set.reps)
        : exerciseLabel.toLowerCase().includes(lowered) ||
          formatWeightCompact(set.weight).toLowerCase().includes(lowered) ||
          String(set.reps).includes(lowered);

      if (!matches) continue;

      hits.push({
        id: set.id,
        exerciseLabel,
        blockId,
        weight: set.weight,
        reps: set.reps,
        createdAt: set.createdAt,
      });
    }

    hits.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return hits;
  }, [appState.exercises, appState.sets, formatWeightCompact, logSearchQuery, massUnit]);

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
    ? '#9CA3AF'
    : analytics.momentum === 'up'
      ? '#22C55E'
      : analytics.momentum === 'down'
        ? '#F97316'
        : '#9CA3AF';

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

  const closeCompass = useCallback(() => setCompassOpen(false), []);

  const compassActions = useMemo(
    () => [
      {
        id: 'progress',
        label: language === 'nb' ? 'Åpne utvikling' : language === 'es' ? 'Abrir progreso' : 'Open progress',
        onPress: onOpenProgress,
      },
      {
        id: 'repMax',
        label: language === 'nb' ? 'Åpne beste løft' : language === 'es' ? 'Abrir mejores levantamientos' : 'Open best lifts',
        onPress: onOpenRepMax,
      },
      {
        id: 'appa',
        label: language === 'nb' ? 'Åpne Appa-AI' : language === 'es' ? 'Abrir Appa-AI' : 'Open Appa-AI',
        onPress: onOpenAI,
      },
      {
        id: 'analysis',
        label:
          language === 'nb'
            ? 'Gå til analyseseksjonen'
            : language === 'es'
              ? 'Ir a la sección de análisis'
              : 'Go to analysis section',
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
    return BLOCK_ICONS[id] ?? null;
  };

  

  const lastWorkout = useMemo<LastWorkoutState>(() => {
    const noWorkouts: LastWorkoutState = {
      status: 'empty',
      message: 'Ingen økter registrert ennå.',
    };

    const dates = getWorkoutDates(appState);
    if (dates.length === 0) return noWorkouts;

    const dateKey = dates[0];
    const grouped = groupDailySets(getDailyWorkout(appState, dateKey));
    if (!grouped.length) {
      return { status: 'empty', message: 'Ingen øvelser registrert på denne økten.' };
    }

    const mainExercise = selectMainExercise(grouped);
    if (!mainExercise) {
      return { status: 'empty', message: 'Ingen øvelser registrert på denne økten.' };
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
      dateLabel: formatLastWorkoutDate(dateKey, language),
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
      return <Text style={styles.lastWorkoutEmpty}>{lastWorkout.message}</Text>;
    }
    const exampleText = lastWorkoutExamples.length
      ? lastWorkoutExamples[lastExampleIndex % lastWorkoutExamples.length]
      : '';
    return (
      <>
        <Text style={styles.lastWorkoutDate}>{lastWorkout.dateLabel}</Text>
        <Text style={styles.lastWorkoutTitle}>{lastWorkoutTitle(language)}</Text>
        <Text
          style={styles.lastWorkoutTotal}
          numberOfLines={expanded ? undefined : 1}
          ellipsizeMode={expanded ? undefined : 'tail'}
        >
          {lastWorkout.totalVolumeLabel}
        </Text>
        {lastWorkoutExamples.length ? (
          reduceMotionEnabled || expanded ? (
            <Text
              style={styles.lastWorkoutExample}
              numberOfLines={expanded ? undefined : 1}
              ellipsizeMode={expanded ? undefined : 'tail'}
            >
              {exampleText}
            </Text>
          ) : (
            <Animated.Text
              style={[
                styles.lastWorkoutExample,
                {
                  opacity: lastExampleAnim,
                  transform: [
                    { translateY: lastExampleAnim.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) },
                  ],
                },
              ]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {exampleText}
            </Animated.Text>
          )
        ) : null}
      </>
    );
  };

  const lastWorkoutCard = (
    <Pressable onLongPress={openLastWorkoutPreview} onPressOut={closeLastWorkoutPreview} delayLongPress={220}>
      <View
        ref={lastWorkoutCardRef}
        style={[styles.lastWorkoutCard, lastWorkoutPreviewVisible ? styles.lastWorkoutCardHidden : null]}
      >
        {renderLastWorkoutBody(false)}
        <TouchableOpacity onPress={onOpenHistory} activeOpacity={0.85} hitSlop={8}>
          <Text style={styles.lastWorkoutLink}>{openLogLabel(language)}</Text>
        </TouchableOpacity>
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.root} edges={['left', 'right', 'bottom']}>
      <Modal visible={compassOpen} transparent animationType="fade" onRequestClose={closeCompass}>
        <Pressable style={styles.compassSheetBackdrop} onPress={closeCompass}>
          <Pressable style={styles.compassSheetCard} onPress={() => {}}>
            <View style={styles.compassSheetHeader}>
              <Text style={styles.compassSheetTitle}>
                {language === 'nb' ? 'Hurtigvalg' : language === 'es' ? 'Atajos' : 'Shortcuts'}
              </Text>
            </View>
            {compassActions.map((action, index) => (
              <Pressable
                key={action.id}
                style={({ pressed }) => [
                  styles.compassAction,
                  index > 0 ? styles.compassActionDivider : null,
                  pressed ? styles.compassActionPressed : null,
                ]}
                onPress={() => {
                  closeCompass();
                  action.onPress();
                }}
              >
                <Text style={styles.compassActionText}>{action.label}</Text>
                <Text style={styles.compassActionChevron}>{'>'}</Text>
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
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
              <Text style={styles.lastWorkoutLink}>{openLogLabel(language)}</Text>
            </Animated.View>
          </Pressable>
        </Modal>
      ) : null}
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        bounces
        scrollEnabled={!lastWorkoutPreviewVisible}
      >
        <View
          style={[
            styles.headerRow,
            { paddingTop: headerTopPadding, paddingBottom: headerBottomPadding, marginBottom: headerToQuickLogGap },
          ]}
        >
          <Image
            source={require('../assets/treasy-logo.png')}
            style={styles.heroLogo}
            resizeMode="contain"
            accessibilityLabel="Treasy"
          />
          <TouchableOpacity
            onPress={() => setCompassOpen(true)}
            style={styles.compassButton}
            activeOpacity={0.85}
            accessibilityLabel="Compass shortcuts"
          >
            <Image
              source={require('../assets/compass.png')}
              style={styles.compassIcon}
              resizeMode="contain"
            />
          </TouchableOpacity>
          <View style={styles.profileColumn}>
            <View style={styles.headerButtonsRow}>
              <TouchableOpacity onPress={onOpenProfile} hitSlop={8} style={styles.profileButton}>
                <Text style={styles.profileLink}>{t(language, 'profile')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onOpenSettings}
                hitSlop={8}
                style={styles.settingsButton}
                activeOpacity={0.85}
                accessibilityLabel={t(language, 'settings.title')}
              >
                <Text style={styles.settingsIcon}>⚙️</Text>
              </TouchableOpacity>
            </View>
            {nickname ? <Text style={styles.nickname}>{nickname}</Text> : null}
          </View>
        </View>

        <TouchableOpacity style={styles.quickLogCard} onPress={onOpenQuickLog} activeOpacity={0.9}>
          <View style={styles.quickLogTopSection}>
            <View style={styles.quickLogTitleRow}>
              <View style={styles.quickLogTitleCluster}>
                {language === 'nb' ? (
                  <Text style={styles.quickLogTitle}>
                    <Text style={styles.quickLogTitleYellow}>Hurtig</Text>
                    <Text style={styles.quickLogTitleBlue}>logg</Text>
                  </Text>
                ) : (
                  <Text style={styles.quickLogTitle}>{t(language, 'quickLogTitle')}</Text>
                )}
                <View style={styles.quickLogBrandInline}>
                  <Text style={styles.quickLogBrandSubtitle}>{t(language, 'homeSubtitle')}</Text>
                  <Image
                    source={require('../assets/treasy-logo.png')}
                    style={styles.quickLogBrandLogo}
                    resizeMode="contain"
                    accessibilityLabel="Treasy"
                  />
                </View>
              </View>
              <Text style={styles.quickLogEmoji}>{'📌'}</Text>
            </View>
            <View style={styles.quickLogHint}>
              <Text style={styles.quickLogSubtitle}>
                {language === 'nb' ? 'Trykk her for å komme i gang' : 'Press here to start'}
              </Text>
              {reduceMotionEnabled ? (
                <Text style={styles.quickLogText}>
                  {(language === 'nb' ? 'Skriv: ' : language === 'es' ? 'Escribe: ' : 'Type: ') +
                    quickLogExamples[exampleIndex]}
                </Text>
              ) : (
                <Animated.Text
                  style={[
                    styles.quickLogText,
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
                  {(language === 'nb' ? 'Skriv: ' : language === 'es' ? 'Escribe: ' : 'Type: ') +
                    quickLogExamples[exampleIndex]}
                </Animated.Text>
              )}
            </View>
          </View>

          <View style={styles.quickLogMomentum}>
            <Text style={styles.quickLogMomentumTitle}>{momentumTitle}</Text>
            <Text style={[styles.quickLogMomentumMain, { color: momentumColor }]}>
              {analytics.momentum === 'up' ? '↑ ' : analytics.momentum === 'down' ? '↓ ' : ''}
              {momentumMain}
            </Text>
            <Text style={styles.quickLogMomentumSub}>{momentumBasedOn}</Text>
            <TouchableOpacity onPress={scrollToAnalysis} hitSlop={8} activeOpacity={0.8}>
              <Text style={styles.quickLogMomentumLink}>
                {language === 'nb' ? 'Mer detaljer' : 'More details'}
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>

        <View style={styles.groupsWrapper}>
          <View style={styles.twoColumnRow}>
            <View style={[styles.groupsColumn, styles.leftColumn]}>
              <Text style={styles.groupsTitle}>{t(language, 'muscleGroups')}</Text>
            </View>

            <View style={[styles.groupsColumn, styles.rightColumn]}>
              {/* Andre stays on the right so Cardio aligns with Bryst in the grid. */}
              {otherBlocks.length > 0 ? (
                <Text style={styles.groupsTitle}>{t(language, 'otherSectionTitle')}</Text>
              ) : null}
            </View>
          </View>

          <View style={styles.twoColumnRow}>
            <View style={[styles.groupsColumn, styles.leftColumn]}>
              <View style={styles.groupsList}>
                {primaryBlocks.map((block) => {
                  const tone = getBlockTone(block.id);
                  const icon = resolveBlockIcon(block.id);
                  return (
                    <TouchableOpacity
                      key={block.id}
                      style={styles.groupRow}
                      onPress={() => onSelectBlock(block.id)}
                      activeOpacity={0.9}
                    >
                      <View style={[styles.groupDotSmall, { backgroundColor: getDotColor(block.id) }]} />
                      <Text style={styles.groupRowText} numberOfLines={1} ellipsizeMode="tail">
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
                        style={[styles.groupIconWrap, { borderColor: '#1F2937', backgroundColor: '#0F172A' }]}
                      >
                        {icon ? (
                          <Image
                            source={icon}
                            style={styles.groupIcon}
                            resizeMode="contain"
                            tintColor="#3B82F6"
                          />
                        ) : (
                          <View style={[styles.groupDot, { backgroundColor: '#3B82F6' }]} />
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.logSearchCard}>
                <Text style={styles.logSearchTitle}>
                  {language === 'nb' ? 'Søk i loggen' : language === 'es' ? 'Buscar en registro' : 'Search log'}
                </Text>
                <TextInput
                  style={styles.logSearchInput}
                  placeholder={
                    language === 'nb'
                      ? 'Søk etter vekt, reps eller øvelse…'
                      : language === 'es'
                        ? 'Busca por peso, reps o ejercicio…'
                        : 'Search by weight, reps, or exercise…'
                  }
                  placeholderTextColor="#4B5563"
                  value={logSearchQuery}
                  onChangeText={setLogSearchQuery}
                  autoCorrect={false}
                  autoCapitalize="none"
                />

                {logSearchQuery.trim() ? (
                  logSearchHits.length > 0 ? (
                    <View style={styles.logSearchResults}>
                      <Text style={styles.logSearchCount}>
                        {language === 'nb'
                          ? `${logSearchHits.length} treff`
                          : language === 'es'
                            ? `${logSearchHits.length} resultados`
                            : `${logSearchHits.length} matches`}
                      </Text>

                      {logSearchHits.map((hit) => {
                        const date = new Date(hit.createdAt);
                        const dateLabel = Number.isFinite(date.getTime())
                          ? formatRelativeDateTime(date, new Date(), language)
                          : null;
                        const weightLabel = Number.isFinite(hit.weight) ? formatWeightCompact(hit.weight) : `0${unitLabel}`;
                        const repsLabel = Number.isFinite(hit.reps) ? String(hit.reps) : '0';
                        const repsUnit = language === 'nb' ? 'r' : 'reps';
                        const setLabel =
                          language === 'nb'
                            ? `${weightLabel} x ${repsLabel}${repsUnit}`
                            : `${weightLabel} x ${repsLabel} ${repsUnit}`;
                        const metaLabel = dateLabel ? `${dateLabel} • ${setLabel}` : setLabel;

                        return (
                          <View key={hit.id} style={styles.logSearchRow}>
                            <View
                              style={[
                                styles.groupDotSmall,
                                { backgroundColor: getDotColor(hit.blockId ?? 'other') },
                              ]}
                            />
                            <View style={styles.logSearchRowText}>
                              <Text style={styles.logSearchRowTitle} numberOfLines={1} ellipsizeMode="tail">
                                {hit.exerciseLabel}
                              </Text>
                              <Text style={styles.logSearchRowMeta} numberOfLines={1} ellipsizeMode="tail">
                                {metaLabel}
                              </Text>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  ) : (
                    <Text style={styles.logSearchEmpty}>
                      {language === 'nb' ? 'Ingen treff.' : language === 'es' ? 'Sin resultados.' : 'No matches.'}
                    </Text>
                  )
                ) : (
                  <Text style={styles.logSearchEmpty}>
                    {language === 'nb'
                      ? 'Søk etter et tall (f.eks. 90) eller en øvelse.'
                      : language === 'es'
                        ? 'Escribe un número (p. ej. 90) o un ejercicio.'
                        : 'Type a number (e.g. 90) or an exercise.'}
                  </Text>
                )}
              </View>

            </View>

            <View style={[styles.sideColumn, styles.rightColumn]}>
              {otherBlocks.length > 0 ? (
                <View style={styles.groupsList}>
                  {otherBlocks.map((block) => {
                    const icon = resolveBlockIcon(block.id);
                    return (
                      <TouchableOpacity
                        key={block.id}
                        style={styles.groupRow}
                        onPress={() => onSelectBlock(block.id)}
                        activeOpacity={0.9}
                      >
                        <View style={[styles.groupDotSmall, { backgroundColor: getDotColor(block.id) }]} />
                        <Text style={styles.groupRowText} numberOfLines={1} ellipsizeMode="tail">
                          {labelForBlock(block)}
                        </Text>
                        <View style={[styles.groupIconWrap, { borderColor: '#1F2937', backgroundColor: '#0F172A' }]}
                        >
                          {icon ? (
                            <Image
                              source={icon}
                              style={styles.groupIcon}
                              resizeMode="contain"
                              tintColor="#3B82F6"
                            />
                          ) : (
                            <View style={[styles.groupDot, { backgroundColor: '#3B82F6' }]} />
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : null}

              {lastWorkoutCard}
            </View>
          </View>

          <View style={[styles.twoColumnRow, styles.twoColumnRowSectionGap]}>
            <View style={[styles.groupsColumn, styles.leftColumn]}>
              <TouchableOpacity style={styles.analysisNavRow} onPress={onOpenAnalysis} activeOpacity={0.9}>
                <Text style={styles.analysisNavText}>
                  {language === 'nb' ? 'Analyse' : language === 'es' ? 'Análisis' : 'Analysis'}
                </Text>
                <Text style={styles.analysisNavChevron}>{'>'}</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.sideColumn, styles.rightColumn, styles.notesColumn]}>
              <View style={styles.notesCard}>
                <Text style={styles.notesTitle}>{language === 'nb' ? 'Notater' : 'Notes'}</Text>
                <TextInput
                  style={styles.notesInput}
                  placeholder={notesFocused ? '' : notesPlaceholder}
                  placeholderTextColor="#4B5563"
                  value={noteText}
                  onChangeText={setNoteText}
                  onFocus={() => setNotesFocused(true)}
                  onBlur={() => setNotesFocused(false)}
                  multiline
                />
                <TouchableOpacity
                  style={[styles.notesButton, noteText.trim() ? null : styles.notesButtonDisabled]}
                  onPress={() => {
                    if (!noteText.trim()) return;
                    onAddNote(noteText.trim());
                    setNoteText('');
                  }}
                  activeOpacity={0.9}
                >
                  <Text style={styles.notesButtonText}>{language === 'nb' ? 'Lagre' : 'Save'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.analysisWrapper} onLayout={({ nativeEvent }) => setAnalysisAnchorY(nativeEvent.layout.y)}>
          <View style={styles.analysisCards}>
            <MomentumCard
              language={language}
              hasData={analytics.hasData}
              status={analytics.momentum}
              onPress={onOpenProgress}
            />

            <VolumeCard
              language={language}
              massUnit={massUnit}
              hasData={analytics.hasData}
              totalLabel={volumeCardProps.totalLabel}
              changePct={volumeCardProps.changePct}
              volumeLabel={volumeCardProps.volumeLabel}
              rows={volumeCardProps.rows}
            />

            <PreviousWorkoutsTimeline
              language={language}
              items={analytics.timeline}
              resolveBlockLabel={resolveBlockLabel}
              onPressDay={openHistoryForDate}
            />

            <TouchableOpacity style={styles.analysisCard} onPress={onOpenRepMax} activeOpacity={0.9}>
              <Text style={styles.cardTitle}>{t(language, 'analysis.bestLifts.title')}</Text>
              <Text style={styles.cardText}>{t(language, 'analysis.bestLifts.subtitle')}</Text>
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
  heroLogo: {
    width: 80,
    height: 80,
    marginTop: 4,
    flexShrink: 0,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  compassButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: '#1F2937',
    backgroundColor: '#0B1220',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  compassIcon: {
    width: 52,
    height: 52,
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
  brandColumn: {
    flex: 1,
    paddingRight: SPACING.lg,
  },
  logo: {
    height: 28,
    width: 120,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: TEXT.sm,
    color: '#9CA3AF',
  },
  profileColumn: {
    alignItems: 'flex-end',
  },
  headerButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  profileButton: {
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 0,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  profileLink: {
    fontSize: TEXT.sm,
    color: '#60A5FA',
    fontWeight: '600',
    lineHeight: TEXT.sm + 2,
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
  nickname: {
    marginTop: 2,
    color: '#9CA3AF',
    fontSize: TEXT.xs,
    fontWeight: '600',
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
    paddingTop: Platform.OS === 'web' ? 6 : 8,
    paddingBottom: Platform.OS === 'web' ? 6 : SPACING.sm,
    paddingHorizontal: SPACING.lg,
    flexDirection: 'column',
    alignItems: 'stretch',
    borderWidth: 1.25,
    borderColor: 'rgba(234, 179, 8, 0.45)',
    marginBottom: SPACING.xxl,
    ...Platform.select({
      web: { minHeight: 140 },
    }),
  },
  quickLogTopSection: {
    flexGrow: 1,
  },
  quickLogHint: {
    marginTop: 'auto',
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
    alignItems: 'center',
    gap: SPACING.sm,
    alignSelf: 'flex-start',
  },
  quickLogBrandInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  quickLogBrandLogo: {
    width: 24,
    height: 24,
  },
  quickLogBrandSubtitle: {
    fontSize: TEXT.sm,
    color: '#6B7280',
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 0,
  },
  quickLogMomentum: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    marginTop: 'auto',
    marginBottom: 10,
  },
  quickLogMomentumTitle: {
    color: '#E5E7EB',
    fontSize: TEXT.xs,
    fontWeight: '800',
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
  quickLogTitleYellow: {
    color: '#2563EB',
  },
  quickLogTitleBlue: {
    color: '#2563EB',
  },
  quickLogTitle: {
    color: '#F9FAFB',
    fontSize: TEXT.lg,
    fontWeight: '700',
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
  quickLogText: {
    color: '#6B7280',
    fontSize: TEXT.sm,
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
  twoColumnRowSectionGap: {
    marginTop: SPACING.md,
  },
  groupsColumn: {
    gap: SPACING.md,
  },
  leftColumn: {
    flex: 1.2,
    maxWidth: 180,
    minWidth: 0,
  },
  sideColumn: {
    gap: SPACING.md,
  },
  rightColumn: {
    flex: 1.4,
    minWidth: 0,
  },
  notesColumn: {
    height: 48,
    justifyContent: 'flex-end',
    overflow: 'visible',
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
    backgroundColor: '#0B1220',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#1F2937',
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
  groupIcon: {
    width: 24,
    height: 24,
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
    color: '#F9FAFB',
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
  logSearchCard: {
    backgroundColor: '#0B1220',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: SPACING.sm,
    gap: SPACING.xs,
    width: '100%',
  },
  logSearchTitle: {
    color: '#60A5FA',
    fontSize: TEXT.sm,
    fontWeight: '800',
  },
  logSearchInput: {
    backgroundColor: '#0F172A',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#1F2937',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    color: '#F9FAFB',
    minHeight: 40,
  },
  logSearchResults: {
    gap: SPACING.xs,
  },
  logSearchCount: {
    color: '#9CA3AF',
    fontSize: TEXT.xs,
    fontWeight: '700',
  },
  logSearchRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  logSearchRowText: {
    flex: 1,
    minWidth: 0,
  },
  logSearchRowTitle: {
    color: '#F9FAFB',
    fontSize: TEXT.sm,
    fontWeight: '700',
  },
  logSearchRowMeta: {
    color: '#9CA3AF',
    fontSize: TEXT.xs,
    fontWeight: '600',
    marginTop: 2,
  },
  logSearchEmpty: {
    color: '#6B7280',
    fontSize: TEXT.xs,
    fontWeight: '600',
  },
  analysisNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0B1220',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#1F2937',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    minHeight: 48,
    width: '100%',
  },
  analysisNavText: {
    color: '#60A5FA',
    fontSize: TEXT.md,
    fontWeight: '800',
  },
  analysisNavChevron: {
    marginLeft: 'auto',
    color: '#64748B',
    fontSize: TEXT.md,
    fontWeight: '800',
  },
  lastWorkoutCard: {
    backgroundColor: '#0B1220',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: SPACING.lg,
    gap: SPACING.sm,
    width: '100%',
  },
  lastWorkoutCardHidden: {
    opacity: 0,
  },
  lastWorkoutTitle: {
    color: '#60A5FA',
    fontSize: TEXT.md,
    fontWeight: '700',
    borderBottomWidth: 1,
    borderBottomColor: '#60A5FA',
    paddingBottom: 4,
    marginBottom: SPACING.xs,
  },
  lastWorkoutDate: {
    color: '#60A5FA',
    fontSize: TEXT.sm,
    fontWeight: '600',
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
  lastWorkoutTotal: {
    color: '#E5E7EB',
    fontSize: TEXT.sm,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  lastWorkoutExample: {
    color: '#9CA3AF',
    fontSize: TEXT.sm,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  lastWorkoutEmpty: {
    color: '#9CA3AF',
    fontSize: TEXT.xs,
    fontWeight: '600',
  },
  lastWorkoutLink: {
    color: '#60A5FA',
    fontSize: TEXT.sm,
    fontWeight: '700',
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
  notesCard: {
    backgroundColor: '#0B1220',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#1F2937',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xl,
    gap: SPACING.sm,
    width: '100%',
    minHeight: 180,
  },
  notesTitle: {
    color: '#60A5FA',
    fontSize: TEXT.md,
    fontWeight: '700',
  },
  notesInput: {
    backgroundColor: '#0F172A',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#1F2937',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    color: '#F9FAFB',
    minHeight: 96,
    textAlignVertical: 'top',
  },
  notesButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  notesButtonDisabled: {
    opacity: 0.5,
  },
  notesButtonText: {
    color: '#F9FAFB',
    fontWeight: '800',
    fontSize: TEXT.md,
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
    color: '#F9FAFB',
    marginBottom: SPACING.xs,
  },
  cardText: {
    fontSize: TEXT.xs,
    color: '#9CA3AF',
  },
});
