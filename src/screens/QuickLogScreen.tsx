import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Pressable,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppLanguage } from '../shared/types';
import type { AppState, Exercise, LogEntry, SetEntry, TrainingBlock, TrainingBlockId } from '../features/workouts';
import { QuickKeypad } from '../shared/ui/QuickKeypad';
import { getBlockTone, getDotColor } from '../shared/theme/blockTone';
import { SPACING, TEXT, RADIUS, SCREEN_PADDING, COLORS } from '../shared/theme/tokens';
import { resolveThemeTokens, type TreasyThemeTokens } from '../shared/theme/themes';
import { blockLabel, t } from '../shared/i18n/i18n';
import { useKeyboardInset } from '../shared/hooks/useKeyboardInset';
import { formatExerciseLabel } from '../shared/utils/exerciseLabel';
import { formatWeight, toKg } from '../shared/utils/units';
import { formatInputWeight, formatSetListLabel } from '../shared/utils/setFormatting';
import { parseInputToAction } from '../domain/quicklog/parseInputToAction';
import { ExerciseLabelText } from '../shared/ui/ExerciseLabelText';

type Props = {
  appState: AppState;
  onBack: () => void;
  onSave: (text: string, options?: { blockId?: string | null }) => Promise<{
    kind: 'note' | 'workout';
    newExerciseId?: string;
    newExerciseName?: string;
  }>;
  onLogSet: (
    exerciseId: string,
    weight: number,
    reps: number,
    options?: { bodyweight?: boolean; distanceKm?: number | null; durationMin?: number | null; pauseSec?: number | null }
  ) => void;
  onUpdateSet: (
    setId: string,
    weight: number,
    reps: number,
    options?: { isBodyweight?: boolean; distanceKm?: number | null; durationMin?: number | null; pauseSec?: number | null }
  ) => void;
  onCategorizeExercise: (exerciseId: string, blockId: TrainingBlockId) => void;
  showLocalOnlyNotice?: boolean;
};

const MUSCLE_GROUP_ORDER: TrainingBlockId[] = ['chest', 'shoulders', 'back', 'arms', 'core', 'legs'];
const BACKSPACE_KEY = '\u232B';
const CLEAR_KEY = 'C';

const WEIGHT_KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  [',', '0', BACKSPACE_KEY],
];

const REPS_KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  [CLEAR_KEY, '0', BACKSPACE_KEY],
];

const HEADER_SIDE_WIDTH = 96;
const EDITABLE_LOG_WINDOW_MS = 2000;

type LiveLogItem = {
  entry: LogEntry;
  linkedSet: SetEntry | null;
  displayText: string;
  editable: boolean;
};

type DurationUnit = 'seconds' | 'minutes' | 'hours';

type QuickLogPalette = {
  isLightTheme: boolean;
  screenBg: string;
  headerTitle: string;
  backText: string;
  noticeText: string;
  cardBg: string;
  cardBgAlt: string;
  cardBorder: string;
  shadowColor: string;
  webShadow: string;
  inputText: string;
  inputBg: string;
  placeholderText: string;
  savedText: string;
  primaryActionBg: string;
  primaryActionDisabledBg: string;
  primaryActionText: string;
  primaryActionDisabledText: string;
  linkText: string;
  rowDivider: string;
  liveRowTime: string;
  textStrong: string;
  textBase: string;
  textMuted: string;
  parseOk: string;
  parseHint: string;
  helperText: string;
  chipBackground: string;
  chipBorder: string;
  chipText: string;
  chevron: string;
  chevronDisabled: string;
  listBorderTop: string;
  selectRowBg: string;
  selectRowSelectedBg: string;
  dialogBackdrop: string;
  dialogCardBg: string;
  dialogCardBorder: string;
  dialogInputBg: string;
  dialogInputBorder: string;
  dialogInputText: string;
  errorText: string;
  secondaryBtnBg: string;
  secondaryBtnBorder: string;
  secondaryBtnText: string;
  primarySmallBg: string;
  primarySmallText: string;
  sheetBackdrop: string;
  sheetCardBg: string;
  sheetCardBorder: string;
  selectionColor: string;
};

function parseHexColor(color: string): [number, number, number] | null {
  const clean = color.trim().replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16)];
}

function toRgba(color: string, alpha: number): string {
  const safeAlpha = Number.isFinite(alpha) ? Math.max(0, Math.min(1, alpha)) : 1;
  const rgb = parseHexColor(color) ?? [79, 142, 232];
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${safeAlpha})`;
}

function inferDurationUnit(durationMin: number | null | undefined): DurationUnit {
  if (!Number.isFinite(durationMin) || (durationMin ?? 0) <= 0) return 'minutes';
  if ((durationMin ?? 0) < 1) return 'seconds';
  if ((durationMin ?? 0) >= 60 && Math.abs((durationMin ?? 0) % 60) < 0.0001) return 'hours';
  return 'minutes';
}

function trimNumericString(value: number): string {
  if (!Number.isFinite(value)) return '0';
  const rounded = Math.round(value * 100) / 100;
  return `${rounded}`.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
}

function formatDurationInputValue(language: AppLanguage, durationMin: number, unit: DurationUnit): string {
  if (!Number.isFinite(durationMin) || durationMin <= 0) return '';
  const rawValue =
    unit === 'seconds' ? durationMin * 60 :
    unit === 'hours' ? durationMin / 60 :
    durationMin;
  const normalized = trimNumericString(rawValue);
  return language === 'nb' || language === 'es' ? normalized.replace('.', ',') : normalized;
}

function convertDurationToMinutes(value: number, unit: DurationUnit): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (unit === 'seconds') return value / 60;
  if (unit === 'hours') return value * 60;
  return value;
}

function createQuickLogPalette(themeTokens: TreasyThemeTokens): QuickLogPalette {
  const isLightTheme = themeTokens.id === 'calmLight';

  return {
    isLightTheme,
    screenBg: isLightTheme ? '#F5F6FA' : '#020617',
    headerTitle: isLightTheme ? '#1F2D3D' : '#F9FAFB',
    backText: isLightTheme ? '#2F6FBC' : '#93C5FD',
    noticeText: isLightTheme ? '#64748B' : '#9CA3AF',
    cardBg: isLightTheme ? '#FFFFFF' : '#0B1220',
    cardBgAlt: isLightTheme ? '#F8FBFF' : '#0A1224',
    cardBorder: isLightTheme ? '#D6DFEA' : '#1E293B',
    shadowColor: isLightTheme ? '#0F172A' : '#020617',
    webShadow: isLightTheme ? '0 10px 22px rgba(15, 23, 42, 0.1)' : '0 12px 24px rgba(2, 6, 23, 0.3)',
    inputText: isLightTheme ? '#1E293B' : '#E2E8F0',
    inputBg: isLightTheme ? '#EFF4FB' : 'rgba(255, 255, 255, 0.03)',
    placeholderText: isLightTheme ? '#64748B' : '#94A3B8',
    savedText: isLightTheme ? '#15803D' : '#86EFAC',
    primaryActionBg: isLightTheme ? '#1D4ED8' : COLORS.blue2,
    primaryActionDisabledBg: isLightTheme ? '#CBD5E1' : '#1E293B',
    primaryActionText: '#FFFFFF',
    primaryActionDisabledText: isLightTheme ? '#64748B' : '#94A3B8',
    linkText: isLightTheme ? '#2563EB' : '#60A5FA',
    rowDivider: isLightTheme ? '#D6DFEA' : '#1E293B',
    liveRowTime: isLightTheme ? '#64748B' : '#94A3B8',
    textStrong: isLightTheme ? '#1E293B' : '#F9FAFB',
    textBase: isLightTheme ? '#334155' : '#E5E7EB',
    textMuted: isLightTheme ? '#64748B' : '#9CA3AF',
    parseOk: isLightTheme ? '#15803D' : '#86EFAC',
    parseHint: isLightTheme ? '#64748B' : '#94A3B8',
    helperText: isLightTheme ? '#8B9CB1' : '#64748B',
    chipBackground: isLightTheme ? '#F8FBFF' : '#0B1220',
    chipBorder: isLightTheme ? '#C7D5E8' : '#1F2937',
    chipText: isLightTheme ? '#1F2D3D' : '#E5E7EB',
    chevron: isLightTheme ? themeTokens.link : COLORS.actionSecondary,
    chevronDisabled: isLightTheme ? '#94A3B8' : '#374151',
    listBorderTop: isLightTheme ? '#D6DFEA' : '#111827',
    selectRowBg: isLightTheme ? '#FFFFFF' : '#020617',
    selectRowSelectedBg: isLightTheme ? '#EEF4FF' : '#0B1220',
    dialogBackdrop: isLightTheme ? 'rgba(15, 23, 42, 0.34)' : 'rgba(2, 6, 23, 0.72)',
    dialogCardBg: isLightTheme ? '#FFFFFF' : '#020617',
    dialogCardBorder: isLightTheme ? '#D6DFEA' : '#1F2937',
    dialogInputBg: isLightTheme ? '#F8FBFF' : '#0B1220',
    dialogInputBorder: isLightTheme ? '#CBD5E1' : '#1F2937',
    dialogInputText: isLightTheme ? '#1E293B' : '#F9FAFB',
    errorText: isLightTheme ? '#DC2626' : '#F97373',
    secondaryBtnBg: isLightTheme ? '#EEF4FF' : '#111827',
    secondaryBtnBorder: isLightTheme ? '#C7D5E8' : '#374151',
    secondaryBtnText: isLightTheme ? '#334155' : '#9CA3AF',
    primarySmallBg: isLightTheme ? '#2563EB' : '#3B82F6',
    primarySmallText: '#F9FAFB',
    sheetBackdrop: isLightTheme ? 'rgba(15, 23, 42, 0.34)' : 'rgba(2, 6, 23, 0.72)',
    sheetCardBg: isLightTheme ? '#FFFFFF' : '#020617',
    sheetCardBorder: isLightTheme ? '#D6DFEA' : '#111827',
    selectionColor: isLightTheme ? '#2F6FBC' : COLORS.blue3,
  };
}

export const QuickLogScreen: React.FC<Props> = ({
  appState,
  onBack,
  onSave,
  onLogSet,
  onUpdateSet,
  onCategorizeExercise,
  showLocalOnlyNotice = false,
}) => {
  const language = appState.language ?? 'en';
  const themeTokens = useMemo(() => resolveThemeTokens(appState.theme), [appState.theme]);
  const palette = useMemo(() => createQuickLogPalette(themeTokens), [themeTokens]);
  const styles = useMemo(() => createStyles(palette), [palette]);
  const massUnit = appState.massUnit ?? 'kg';
  const unitLabel = massUnit === 'lb' ? t(language, 'units.lb') : t(language, 'units.kg');
  const durationUnitOptions = useMemo(
    () => [
      { id: 'seconds' as const, label: t(language, 'durationUnit.secondsShort') },
      { id: 'minutes' as const, label: t(language, 'durationUnit.minutesShort') },
      { id: 'hours' as const, label: t(language, 'durationUnit.hoursShort') },
    ],
    [language]
  );
  const keypadVariant = palette.isLightTheme ? 'light' : 'dark';
  const [input, setInput] = useState('');
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [pendingExercise, setPendingExercise] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const inputRef = useRef<TextInput | null>(null);

  const [isExerciseOpen, setIsExerciseOpen] = useState(false);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [weightModalOpen, setWeightModalOpen] = useState(false);
  const [repsModalOpen, setRepsModalOpen] = useState(false);
  const [weightText, setWeightText] = useState('');
  const [repsText, setRepsText] = useState('');
  const [bodyweightMode, setBodyweightMode] = useState(false);
  const [cardioModalOpen, setCardioModalOpen] = useState(false);
  const [distanceText, setDistanceText] = useState('');
  const [durationText, setDurationText] = useState('');
  const [pauseText, setPauseText] = useState('');
  const [cardioDurationUnit, setCardioDurationUnit] = useState<DurationUnit>('minutes');
  const [setError, setSetError] = useState<string | null>(null);
  const [suggestionsOpen, setSuggestionsOpen] = useState(true);
  const [showAllLogs, setShowAllLogs] = useState(false);
  const placeholderOpacity = useRef(new Animated.Value(1)).current;
  const [isFocused, setIsFocused] = useState(false);
  const [editingSet, setEditingSet] = useState<SetEntry | null>(null);
  const [editWeightText, setEditWeightText] = useState('');
  const [editRepsText, setEditRepsText] = useState('');
  const [editDistanceText, setEditDistanceText] = useState('');
  const [editDurationText, setEditDurationText] = useState('');
  const [editPauseText, setEditPauseText] = useState('');
  const [editDurationUnit, setEditDurationUnit] = useState<DurationUnit>('minutes');
  const [editError, setEditError] = useState<string | null>(null);
  const { keyboardHeight, isKeyboardVisible } = useKeyboardInset();

  const placeholderText = t(language, 'quicklog.placeholder.start');

  useEffect(() => {
    const target = input.length === 0 && !isFocused ? 1 : 0;
    Animated.timing(placeholderOpacity, {
      toValue: target,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [input, isFocused, placeholderOpacity]);

  const muscleGroupBlocks = useMemo(() => {
    const byId: Record<string, TrainingBlock> = {};
    for (const b of appState.blocks) byId[b.id] = b;

    const ordered: TrainingBlock[] = [];
    for (const id of MUSCLE_GROUP_ORDER) {
      const block = byId[id];
      if (block) ordered.push(block);
    }

    return ordered;
  }, [appState.blocks]);

  const otherBlocks = useMemo(
    () => appState.blocks.filter((b) => ['cardio', 'bodyweight'].includes(b.id)),
    [appState.blocks]
  );

  const blockChips = useMemo(
    () => [...muscleGroupBlocks, ...otherBlocks],
    [muscleGroupBlocks, otherBlocks]
  );

  const exercisesForBlock: Exercise[] = useMemo(() => {
    if (!selectedBlockId) return [];
    return appState.exercises
      .filter((ex) => ex.blockId === selectedBlockId)
      .slice()
      .sort((a, b) => formatExerciseLabel(a).localeCompare(formatExerciseLabel(b)));
  }, [appState.exercises, selectedBlockId]);

  const selectedExercise = selectedExerciseId
    ? appState.exercises.find((ex) => ex.id === selectedExerciseId) ?? null
    : null;

  const pendingExerciseLabel = useMemo(() => {
    if (!pendingExercise) return '';
    const found = appState.exercises.find((ex) => ex.id === pendingExercise.id);
    if (found) return formatExerciseLabel(found);
    return pendingExercise.name;
  }, [appState.exercises, pendingExercise]);

  const todayLogs: LogEntry[] = useMemo(() => {
    const logs = appState.logs ?? [];
    const todayKey = new Date().toISOString().slice(0, 10);
    return logs
      .filter((l) => (l.createdAt ?? '').slice(0, 10) === todayKey)
      .slice(-30)
      .slice()
      .reverse();
  }, [appState.logs]);

  const todaySets: SetEntry[] = useMemo(() => {
    const todayKey = new Date().toISOString().slice(0, 10);
    return appState.sets
      .filter((set) => (set.createdAt ?? '').slice(0, 10) === todayKey)
      .slice()
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [appState.sets]);

  const exerciseById = useMemo(
    () => new Map(appState.exercises.map((exercise) => [exercise.id, exercise] as const)),
    [appState.exercises]
  );

  const editingExercise = editingSet ? exerciseById.get(editingSet.exerciseId) ?? null : null;

  const liveLogItems: LiveLogItem[] = useMemo(() => {
    const remainingSets = [...todaySets];

    const claimLinkedSet = (entry: LogEntry): SetEntry | null => {
      const exactMatches = remainingSets.filter((set) => set.createdAt === entry.createdAt);
      if (exactMatches.length === 1) {
        const match = exactMatches[0];
        const index = remainingSets.findIndex((set) => set.id === match.id);
        if (index >= 0) remainingSets.splice(index, 1);
        return match;
      }
      if (exactMatches.length > 1) return null;

      const entryMs = Date.parse(entry.createdAt);
      if (!Number.isFinite(entryMs)) return null;

      const nearbyMatches = remainingSets
        .map((set) => ({ set, diff: Math.abs(Date.parse(set.createdAt) - entryMs) }))
        .filter((candidate) => Number.isFinite(candidate.diff) && candidate.diff <= EDITABLE_LOG_WINDOW_MS)
        .sort((a, b) => a.diff - b.diff);

      if (nearbyMatches.length !== 1 && !(nearbyMatches.length > 1 && nearbyMatches[0].diff < nearbyMatches[1].diff)) {
        return null;
      }

      const match = nearbyMatches[0]?.set ?? null;
      if (!match) return null;
      const index = remainingSets.findIndex((set) => set.id === match.id);
      if (index >= 0) remainingSets.splice(index, 1);
      return match;
    };

    return todayLogs.map((entry) => {
      const linkedSet = claimLinkedSet(entry);
      const exercise = linkedSet ? exerciseById.get(linkedSet.exerciseId) ?? null : null;
      const displayText =
        linkedSet && exercise
          ? `${formatExerciseLabel(exercise)} ${formatSetListLabel(language, linkedSet, massUnit)}`
          : entry.text;

      return {
        entry,
        linkedSet,
        displayText,
        editable: Boolean(linkedSet && exercise),
      };
    });
  }, [todayLogs, todaySets, exerciseById, language, massUnit]);

  const formatTime = (iso: string, lang: AppLanguage): string => {
    const locale = lang === 'nb' ? 'nb-NO' : lang === 'es' ? 'es-ES' : 'en-US';
    const dt = new Date(iso);
    if (Number.isNaN(dt.getTime())) return '';
    return dt.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  };

  const parseOptionalNumber = (value: string): number | null => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed.replace(',', '.'));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };

  const openEditSet = (set: SetEntry) => {
    setEditError(null);
    setEditingSet(set);
    if (set.setType === 'cardio') {
      const nextDurationUnit = inferDurationUnit(set.durationMin);
      setEditWeightText('');
      setEditRepsText('');
      setEditDistanceText(set.distanceKm != null ? String(set.distanceKm).replace('.', ',') : '');
      setEditDurationUnit(nextDurationUnit);
      setEditDurationText(set.durationMin != null ? formatDurationInputValue(language, set.durationMin, nextDurationUnit) : '');
      setEditPauseText(set.pauseSec != null ? String(set.pauseSec) : '');
      return;
    }

    setEditWeightText(
      set.isBodyweight || set.setType === 'bodyweight' || set.weight === 0
        ? ''
        : formatInputWeight(set.weight, massUnit, language)
    );
    setEditRepsText(String(set.reps));
    setEditDistanceText('');
    setEditDurationText('');
    setEditPauseText('');
    setEditDurationUnit('minutes');
  };

  const closeEditSet = () => {
    setEditingSet(null);
    setEditWeightText('');
    setEditRepsText('');
    setEditDistanceText('');
    setEditDurationText('');
    setEditPauseText('');
    setEditDurationUnit('minutes');
    setEditError(null);
  };

  const handleUpdateLoggedSet = () => {
    if (!editingSet) return;

    if (editingSet.setType === 'cardio') {
      const distanceKm = parseOptionalNumber(editDistanceText);
      const durationValue = parseOptionalNumber(editDurationText);
      const durationMin = durationValue != null ? convertDurationToMinutes(durationValue, editDurationUnit) : null;
      const pauseSec = parseOptionalNumber(editPauseText);
      if (distanceKm == null && durationMin == null && pauseSec == null) {
        setEditError(t(language, 'cardioInvalid'));
        return;
      }
      onUpdateSet(editingSet.id, 0, 1, { distanceKm, durationMin, pauseSec });
      closeEditSet();
      return;
    }

    const reps = Number(editRepsText.trim());
    const isBodyweight = editingSet.isBodyweight || editingSet.setType === 'bodyweight' || editingSet.weight === 0;
    if (isBodyweight) {
      if (!Number.isFinite(reps) || reps <= 0) {
        setEditError(t(language, 'invalidWeightReps'));
        return;
      }
      onUpdateSet(editingSet.id, 0, reps, { isBodyweight: true });
      closeEditSet();
      return;
    }

    const inputWeight = Number(editWeightText.trim().replace(',', '.'));
    const weightKg = toKg(inputWeight, massUnit);
    if (!editWeightText.trim() || !Number.isFinite(weightKg) || weightKg < 0 || !Number.isFinite(reps) || reps <= 0) {
      setEditError(t(language, 'invalidWeightReps'));
      return;
    }

    onUpdateSet(editingSet.id, weightKg, reps);
    closeEditSet();
  };

  const blockTitle = (block: TrainingBlock): string => {
    const id = block.id as TrainingBlockId;
    const isKnown = (
      ['chest', 'shoulders', 'back', 'arms', 'core', 'legs', 'cardio', 'bodyweight'] as string[]
    ).includes(id);
    return isKnown ? blockLabel(id, language) : block.name;
  };

  const enterHint =
    Platform.OS === 'web'
      ? language === 'nb'
        ? 'Enter for å logge'
        : language === 'es'
          ? 'Enter para registrar'
          : 'Enter to log'
      : null;

  const parsePreview = useMemo(() => {
    const trimmed = input.trim();
    if (!trimmed) return null;

    const prefix =
      language === 'nb'
        ? 'Tolket som: '
        : language === 'es'
          ? 'Interpretado como: '
          : 'Parsed as: ';
    const hint =
      language === 'nb'
        ? 'Skriv øvelse + vekt x reps for å logge.'
        : language === 'es'
          ? 'Escribe ejercicio + peso x reps para registrar.'
          : 'Type exercise + weight x reps to log.';
    const setsLabel = language === 'nb' ? 'sett' : language === 'es' ? 'series' : 'sets';

    const parsed = parseInputToAction(trimmed, { appState, language, defaultUnit: massUnit });
    if (parsed.kind !== 'workout') {
      return { kind: 'hint', text: hint };
    }

    const entries = parsed.payload.entries;
    if (!entries.length) {
      return { kind: 'hint', text: hint };
    }

    const formatWeightRange = (values: number[]): string => {
      const valid = values.filter((value) => Number.isFinite(value));
      if (!valid.length) return '';
      const min = Math.min(...valid);
      const max = Math.max(...valid);
      const minLabel = formatWeight(min, massUnit, language);
      if (min === max) return minLabel;
      const maxLabel = formatWeight(max, massUnit, language);
      return `${minLabel}–${maxLabel}`;
    };

    const formatRepsRange = (values: number[]): string => {
      const valid = values.filter((value) => Number.isFinite(value) && value > 0);
      if (!valid.length) return '';
      const min = Math.min(...valid);
      const max = Math.max(...valid);
      const range = min === max ? `${min}` : `${min}–${max}`;
      return `${range} reps`;
    };

    if (entries.length > 1) {
      const totalSets = entries.reduce((sum, entry) => sum + entry.sets.length, 0);
      const multiLabel = language === 'nb' ? 'Flere øvelser' : language === 'es' ? 'Varios ejercicios' : 'Multiple exercises';
      return { kind: 'workout', text: `${prefix}${multiLabel} · ${totalSets} ${setsLabel}` };
    }

    const entry = entries[0];
    const weights = entry.sets.map((set) => set.weight);
    const reps = entry.sets.map((set) => set.reps);
    const allBodyweight = entry.sets.length > 0 && entry.sets.every((set) => set.isBodyweight);
    const weightLabel = allBodyweight ? 'BW' : formatWeightRange(weights);
    const repsLabel = formatRepsRange(reps);
    const detail = `${entry.exerciseName} · ${weightLabel} · ${repsLabel} · ${entry.sets.length} ${setsLabel}`;
    return { kind: 'workout', text: `${prefix}${detail}` };
  }, [appState, input, language, massUnit]);

  const flashSaved = (kind: 'note' | 'workout') => {
    const key = kind === 'note' ? 'noteSaved' : 'workoutLogged';
    setSavedNotice(t(language, key));
    setTimeout(() => setSavedNotice(null), 1600);
  };

  const normalize = (value: string): string =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9æøåáéíóúüñ\s]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const suggestionItems = useMemo(() => {
    const term = normalize(input);
    if (!term) return [];

    return appState.exercises
      .map((ex) => {
        const label = formatExerciseLabel(ex);
        const haystack = normalize(label);
        const score =
          haystack.startsWith(term) ? 3 :
          haystack.includes(term) ? 2 :
          0;
        return { ex, score, label };
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
      .slice(0, 5);
  }, [appState.exercises, input]);

  const resetSetFlow = () => {
    setWeightText('');
    setRepsText('');
    setSetError(null);
    setWeightModalOpen(false);
    setRepsModalOpen(false);
    setBodyweightMode(false);
    setCardioModalOpen(false);
    setDistanceText('');
    setDurationText('');
    setPauseText('');
    setCardioDurationUnit('minutes');
  };

  const startSetFlow = (exerciseId: string) => {
    const exercise = appState.exercises.find((entry) => entry.id === exerciseId);
    const isCardioExercise = exercise?.blockId === 'cardio' || selectedBlockId === 'cardio';
    setSelectedExerciseId(exerciseId);
    setIsExerciseOpen(false);
    setWeightText('');
    setRepsText('');
    setSetError(null);
    setBodyweightMode(false);
    if (isCardioExercise) {
      setDistanceText('');
      setDurationText('');
      setPauseText('');
      setCardioDurationUnit('minutes');
      setWeightModalOpen(false);
      setRepsModalOpen(false);
      setCardioModalOpen(true);
      return;
    }
    setCardioModalOpen(false);
    setWeightModalOpen(true);
  };

  const handleSave = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    const res = await onSave(trimmed, { blockId: selectedBlockId });
    setInput('');
    flashSaved(res.kind);

    if (res.newExerciseId && res.newExerciseName) {
      setPendingExercise({ id: res.newExerciseId, name: res.newExerciseName });
    }

    setTimeout(() => inputRef.current?.focus(), 120);
  };

  const showLocalNoticeLine = showLocalOnlyNotice && appState.authProvider === 'guest';
  const isInputEmpty = input.trim().length === 0;

  const quickLogInputSection = (
    <View style={styles.inputCard}>
      <View style={styles.inputWrapper}>
        <View style={styles.placeholderWrapper} pointerEvents="none">
          <Animated.Text
            style={[styles.placeholderOverlay, { opacity: placeholderOpacity }]}
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {placeholderText}
          </Animated.Text>
        </View>
        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder="" // handled by animated overlay
          value={input}
          onChangeText={setInput}
          autoCapitalize="sentences"
          multiline
          returnKeyType="done"
          onSubmitEditing={handleSave}
          blurOnSubmit={false}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          selectionColor={palette.selectionColor}
        />
      </View>

      <View style={styles.inputMeta}>
        {parsePreview ? (
          <Text
            style={[
              styles.parsePreviewText,
              parsePreview.kind === 'hint' ? styles.parsePreviewHint : styles.parsePreviewOk,
            ]}
          >
            {parsePreview.text}
          </Text>
        ) : null}
        {enterHint ? <Text style={styles.inputHelper}>{enterHint}</Text> : null}
      </View>

      <View style={styles.actionBar}>
        <Pressable
          onPress={handleSave}
          disabled={isInputEmpty}
          style={({ pressed }) => [
            styles.primaryActionButton,
            isInputEmpty && styles.primaryActionButtonDisabled,
            pressed && !isInputEmpty && styles.primaryActionButtonPressed,
          ]}
        >
          <Text style={[styles.primaryActionText, isInputEmpty && styles.primaryActionTextDisabled]}>
            {t(language, 'quickLogButton')}
          </Text>
        </Pressable>
      </View>
    </View>
  );

  const muscleGroupSection = (
    <View style={styles.chipsCard}>
      <Text style={styles.sectionLabel}>{t(language, 'muscleGroups')}</Text>
      <View style={styles.chipRow}>
        {blockChips.map((block) => {
          const tone = getBlockTone(block.id);
          const selected = block.id === selectedBlockId;
          return (
            <TouchableOpacity
              key={block.id}
              style={[
                styles.chip,
                {
                  borderColor: selected ? tone.accent : palette.chipBorder,
                  backgroundColor: selected
                    ? (palette.isLightTheme ? toRgba(tone.accent, 0.14) : tone.soft)
                    : palette.chipBackground,
                },
              ]}
              onPress={() => {
                if (selected) {
                  setSelectedBlockId(null);
                  setSelectedExerciseId(null);
                  setIsExerciseOpen(false);
                  return;
                }
                setSelectedBlockId(block.id);
                setSelectedExerciseId(null);
                setIsExerciseOpen(true);
              }}
              activeOpacity={0.9}
            >
              <View style={[styles.chipDot, { backgroundColor: getDotColor(block.id) }]} />
              <Text style={[styles.chipText, selected && { color: tone.accent }]}>{blockTitle(block)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const exerciseSection = (
    <View style={[styles.selectBox, { marginTop: SPACING.md }]}>
      <TouchableOpacity
        style={styles.selectHeaderRow}
        onPress={() => selectedBlockId && setIsExerciseOpen((v) => !v)}
        activeOpacity={selectedBlockId ? 0.8 : 1}
      >
        <Text style={styles.selectLabel}>{t(language, 'exercises')}</Text>
        <Text style={[styles.chevron, !selectedBlockId && styles.chevronDisabled]}>
          {isExerciseOpen ? 'v' : '>'}
        </Text>
      </TouchableOpacity>

      {isExerciseOpen && selectedBlockId ? (
        exercisesForBlock.length === 0 ? (
          <Text style={styles.emptyText}>{t(language, 'noExercisesInBlock')}</Text>
        ) : (
          <View style={[styles.selectList, styles.compactList]}>
            <ScrollView nestedScrollEnabled>
              {exercisesForBlock.map((ex) => {
                const selected = ex.id === selectedExerciseId;
                return (
                  <TouchableOpacity
                    key={ex.id}
                    style={[styles.selectRow, selected && styles.selectRowSelected]}
                    onPress={() => startSetFlow(ex.id)}
                    activeOpacity={0.9}
                  >
                    <View style={[styles.dot, { backgroundColor: getDotColor(selectedBlockId) }]} />
                    <ExerciseLabelText
                      label={formatExerciseLabel(ex)}
                      style={styles.selectRowTextWrap}
                      mainStyle={styles.selectRowText}
                      secondaryStyle={[styles.selectRowTextMeta, { color: palette.textMuted }]}
                    />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <View style={styles.headerSide}>
            <TouchableOpacity onPress={onBack} hitSlop={12} style={styles.backButton} activeOpacity={0.8}>
              <Text style={styles.back}>{'< Tilbake'}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>{'📌 Hurtiglogg'}</Text>
          </View>
          <View style={styles.headerSide} />
        </View>

        {showLocalNoticeLine ? (
          <Text style={styles.localOnlyNotice}>
            {t(language, 'localOnlyNotice')}
          </Text>
        ) : null}
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingBottom:
                SPACING.xxl + (Platform.OS === 'android' && isKeyboardVisible ? keyboardHeight : 0),
            },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.guidedCard}>
            {muscleGroupSection}
            {selectedBlockId ? exerciseSection : null}

            {selectedExercise ? (
              <View style={styles.quickActions}>
                {selectedBlockId === 'cardio' ? (
                  <TouchableOpacity
                    style={[styles.secondaryButton, styles.inlineButton]}
                    onPress={() => {
                      setSetError(null);
                      setCardioModalOpen(true);
                      setDistanceText('');
                      setDurationText('');
                      setPauseText('');
                      setCardioDurationUnit('minutes');
                    }}
                    activeOpacity={0.9}
                  >
                    <Text style={styles.secondaryButtonText}>{t(language, 'logDistanceTime')}</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.secondaryButton, styles.inlineButton]}
                    onPress={() => {
                      setBodyweightMode(true);
                      setWeightText('0');
                      setWeightModalOpen(false);
                      setRepsModalOpen(true);
                    }}
                    activeOpacity={0.9}
                  >
                    <Text style={styles.secondaryButtonText}>{t(language, 'logBodyweight')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : null}
            {quickLogInputSection}
          </View>

        {suggestionItems.length > 0 && (
          <View style={styles.suggestionCard}>
            <TouchableOpacity
              style={styles.suggestionHeader}
              onPress={() => setSuggestionsOpen((v) => !v)}
              activeOpacity={0.8}
            >
              <Text style={styles.suggestionTitle}>{t(language, 'quickLogSuggestions')}</Text>
              <Text style={styles.chevron}>{suggestionsOpen ? 'v' : '>'}</Text>
            </TouchableOpacity>
            {suggestionsOpen && (
              <View style={styles.suggestionList}>
                {suggestionItems.map(({ ex, label }) => {
                  const tone = getBlockTone(ex.blockId);
                  const blk = muscleGroupBlocks.find((b) => b.id === ex.blockId);
                  return (
                    <TouchableOpacity
                      key={ex.id}
                      style={styles.suggestionRow}
                      onPress={() => {
                        setSelectedBlockId(ex.blockId);
                        setSelectedExerciseId(ex.id);
                        startSetFlow(ex.id);
                        setInput(label + ' ');
                      }}
                      activeOpacity={0.9}
                    >
                      <View style={[styles.dot, { backgroundColor: getDotColor(ex.blockId) }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.suggestionLabel}>{label}</Text>
                        <Text style={styles.suggestionMeta}>
                          {blk ? blockTitle(blk) : ''}
                        </Text>
                      </View>
                      <Text style={[styles.suggestionAction, { color: tone.accent }]}>
                        {t(language, 'logSet')}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {savedNotice ? <Text style={styles.savedNotice}>{savedNotice}</Text> : null}

        <View style={[styles.liveLogCard, { marginTop: SPACING.md }]}>
          <Text style={styles.liveLogTitle}>{t(language, 'liveLogTitle')}</Text>
          {liveLogItems.length === 0 ? (
            <Text style={styles.liveLogEmpty}>{t(language, 'liveLogEmpty')}</Text>
          ) : (
            <>
              <View style={styles.liveLogList}>
                {(showAllLogs ? liveLogItems : liveLogItems.slice(0, 5)).map(({ entry, linkedSet, displayText, editable }, index, array) => (
                  <TouchableOpacity
                    key={entry.id}
                    style={[
                      styles.liveLogRow,
                      index < array.length - 1 ? styles.liveLogRowDivider : null,
                    ]}
                    activeOpacity={editable ? 0.82 : 1}
                    disabled={!editable}
                    onPress={() => {
                      if (linkedSet) openEditSet(linkedSet);
                    }}
                  >
                    <Text style={styles.liveLogTime}>{formatTime(entry.createdAt, language)}</Text>
                    <View style={styles.liveLogContent}>
                      <Text style={styles.liveLogText}>{displayText}</Text>
                      {entry.pinned ? <Text style={styles.liveLogPin}>{'📌'}</Text> : null}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
              {!showAllLogs && liveLogItems.length > 5 ? (
                <TouchableOpacity
                  onPress={() => setShowAllLogs(true)}
                  hitSlop={8}
                  activeOpacity={0.85}
                  style={styles.showAllRow}
                >
                  <Text style={styles.showAllText}>{'Vis alle'}</Text>
                </TouchableOpacity>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={Boolean(editingSet)} transparent animationType="fade">
        <Pressable style={styles.dialogBackdrop} onPress={closeEditSet}>
          <Pressable style={styles.dialogCard} onPress={() => {}}>
            <Text style={styles.dialogTitle}>{t(language, 'editSetTitle')}</Text>
            <Text style={styles.dialogSubtitle}>
              {editingExercise ? formatExerciseLabel(editingExercise) : t(language, 'editSetSubtitle')}
            </Text>

            {editingSet?.setType === 'cardio' ? (
              <>
                <Text style={styles.dialogFieldLabel}>{t(language, 'distanceLabel')}</Text>
                <TextInput
                  style={styles.dialogInput}
                  placeholder="0"
                  placeholderTextColor={palette.placeholderText}
                  value={editDistanceText}
                  onChangeText={setEditDistanceText}
                  keyboardType="numeric"
                />
                <Text style={styles.dialogFieldLabel}>{t(language, 'cardioDurationLabel')}</Text>
                <View style={styles.durationUnitRow}>
                  {durationUnitOptions.map((option) => {
                    const active = editDurationUnit === option.id;
                    return (
                      <TouchableOpacity
                        key={`edit-${option.id}`}
                        style={[styles.durationUnitButton, active ? styles.durationUnitButtonActive : null]}
                        onPress={() => setEditDurationUnit(option.id)}
                        activeOpacity={0.85}
                      >
                        <Text style={[styles.durationUnitText, active ? styles.durationUnitTextActive : null]}>{option.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <TextInput
                  style={styles.dialogInput}
                  placeholder="0"
                  placeholderTextColor={palette.placeholderText}
                  value={editDurationText}
                  onChangeText={setEditDurationText}
                  keyboardType="numeric"
                />
                <Text style={styles.dialogFieldLabel}>{t(language, 'pauseLabel')}</Text>
                <TextInput
                  style={styles.dialogInput}
                  placeholder="0"
                  placeholderTextColor={palette.placeholderText}
                  value={editPauseText}
                  onChangeText={setEditPauseText}
                  keyboardType="numeric"
                />
              </>
            ) : (
              <>
                {editingSet?.isBodyweight || editingSet?.setType === 'bodyweight' || editingSet?.weight === 0 ? null : (
                  <>
                    <Text style={styles.dialogFieldLabel}>{t(language, 'weightKg', { unit: unitLabel })}</Text>
                    <TextInput
                      style={styles.dialogInput}
                      placeholder="0"
                      placeholderTextColor={palette.placeholderText}
                      value={editWeightText}
                      onChangeText={setEditWeightText}
                      keyboardType="numeric"
                    />
                  </>
                )}
                <Text style={styles.dialogFieldLabel}>{t(language, 'reps')}</Text>
                <TextInput
                  style={styles.dialogInput}
                  placeholder="1"
                  placeholderTextColor={palette.placeholderText}
                  value={editRepsText}
                  onChangeText={setEditRepsText}
                  keyboardType="numeric"
                />
              </>
            )}

            {editError ? <Text style={styles.error}>{editError}</Text> : null}

            <View style={styles.dialogButtons}>
              <TouchableOpacity style={styles.secondaryButton} onPress={closeEditSet}>
                <Text style={styles.secondaryButtonText}>{t(language, 'cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primarySmallButton} onPress={handleUpdateLoggedSet}>
                <Text style={styles.primarySmallButtonText}>{t(language, 'save')}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={weightModalOpen} transparent animationType="fade">
        <Pressable style={styles.dialogBackdrop} onPress={resetSetFlow}>
          <Pressable style={styles.dialogCard} onPress={() => {}}>
            {selectedExercise ? (
              <ExerciseLabelText
                label={formatExerciseLabel(selectedExercise)}
                style={styles.dialogTitleWrap}
                mainStyle={styles.dialogTitle}
                secondaryStyle={[styles.dialogTitleMeta, { color: palette.textMuted }]}
              />
            ) : null}
            <Text style={styles.dialogSubtitle}>{t(language, 'weightKg', { unit: unitLabel })}</Text>
            <TextInput
              style={styles.dialogInput}
              placeholder="0"
              placeholderTextColor={palette.placeholderText}
              value={weightText}
              onChangeText={setWeightText}
              keyboardType="numeric"
            />
            <QuickKeypad value={weightText} onChange={setWeightText} rows={WEIGHT_KEYS} variant={keypadVariant} />

            {setError ? <Text style={styles.error}>{setError}</Text> : null}

            <View style={styles.dialogButtons}>
              <TouchableOpacity style={styles.secondaryButton} onPress={resetSetFlow}>
                <Text style={styles.secondaryButtonText}>{t(language, 'cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => {
                  setBodyweightMode(true);
                  setWeightText('0');
                  setWeightModalOpen(false);
                  setRepsModalOpen(true);
                }}
              >
                <Text style={styles.secondaryButtonText}>{t(language, 'logBodyweight')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                  style={styles.primarySmallButton}
                  onPress={() => {
                    const unit = appState.massUnit ?? 'kg';
                    const inputW = Number(weightText.trim().replace(',', '.'));
                    const wKg = toKg(inputW, unit);
                    if (!Number.isFinite(wKg) || wKg < 0) {
                      setSetError(t(language, 'invalidWeightReps'));
                      return;
                    }
                    setSetError(null);
                    setWeightModalOpen(false);
                  setRepsModalOpen(true);
                }}
              >
                <Text style={styles.primarySmallButtonText}>{t(language, 'continue')}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={repsModalOpen} transparent animationType="fade">
        <Pressable style={styles.dialogBackdrop} onPress={resetSetFlow}>
          <Pressable style={styles.dialogCard} onPress={() => {}}>
            {selectedExercise ? (
              <ExerciseLabelText
                label={formatExerciseLabel(selectedExercise)}
                style={styles.dialogTitleWrap}
                mainStyle={styles.dialogTitle}
                secondaryStyle={[styles.dialogTitleMeta, { color: palette.textMuted }]}
              />
            ) : null}
            <Text style={styles.dialogSubtitle}>{t(language, 'reps')}</Text>
            <TextInput
              style={styles.dialogInput}
              placeholder="1"
              placeholderTextColor={palette.placeholderText}
              value={repsText}
              onChangeText={setRepsText}
              keyboardType="numeric"
            />
            <QuickKeypad value={repsText} onChange={setRepsText} rows={REPS_KEYS} variant={keypadVariant} />

            {setError ? <Text style={styles.error}>{setError}</Text> : null}

            <View style={styles.dialogButtons}>
              <TouchableOpacity style={styles.secondaryButton} onPress={resetSetFlow}>
                <Text style={styles.secondaryButtonText}>{t(language, 'cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                  style={styles.primarySmallButton}
                  onPress={() => {
                    const unit = appState.massUnit ?? 'kg';
                    const inputW = Number(weightText.trim().replace(',', '.'));
                    const wKg = toKg(inputW, unit);
                    const r = Number(repsText.trim());
                    if (!Number.isFinite(wKg) || !Number.isFinite(r) || wKg < 0 || r <= 0) {
                      setSetError(t(language, 'invalidWeightReps'));
                      return;
                    }
                    if (selectedExercise) {
                      onLogSet(selectedExercise.id, wKg, r, { bodyweight: bodyweightMode });
                      flashSaved('workout');
                    }
                    resetSetFlow();
                  }}
              >
                <Text style={styles.primarySmallButtonText}>{t(language, 'logSet')}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={cardioModalOpen} transparent animationType="fade">
        <Pressable style={styles.dialogBackdrop} onPress={resetSetFlow}>
          <Pressable style={styles.dialogCard} onPress={() => {}}>
            {selectedExercise ? (
              <ExerciseLabelText
                label={formatExerciseLabel(selectedExercise)}
                style={styles.dialogTitleWrap}
                mainStyle={styles.dialogTitle}
                secondaryStyle={[styles.dialogTitleMeta, { color: palette.textMuted }]}
              />
            ) : null}
            <Text style={styles.dialogFieldLabel}>{t(language, 'distanceLabel')}</Text>
            <TextInput
              style={styles.dialogInput}
              placeholder="5"
              placeholderTextColor={palette.placeholderText}
              value={distanceText}
              onChangeText={setDistanceText}
              keyboardType="numeric"
            />
            <Text style={styles.dialogFieldLabel}>{t(language, 'cardioDurationLabel')}</Text>
            <View style={styles.durationUnitRow}>
              {durationUnitOptions.map((option) => {
                const active = cardioDurationUnit === option.id;
                return (
                  <TouchableOpacity
                    key={option.id}
                    style={[styles.durationUnitButton, active ? styles.durationUnitButtonActive : null]}
                    onPress={() => setCardioDurationUnit(option.id)}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.durationUnitText, active ? styles.durationUnitTextActive : null]}>{option.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TextInput
              style={styles.dialogInput}
              placeholder="30"
              placeholderTextColor={palette.placeholderText}
              value={durationText}
              onChangeText={setDurationText}
              keyboardType="numeric"
            />
            <Text style={styles.dialogFieldLabel}>{t(language, 'pauseLabel')}</Text>
            <TextInput
              style={styles.dialogInput}
              placeholder="0"
              placeholderTextColor={palette.placeholderText}
              value={pauseText}
              onChangeText={setPauseText}
              keyboardType="numeric"
            />

            {setError ? <Text style={styles.error}>{setError}</Text> : null}

            <View style={styles.dialogButtons}>
              <TouchableOpacity style={styles.secondaryButton} onPress={resetSetFlow}>
                <Text style={styles.secondaryButtonText}>{t(language, 'cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.primarySmallButton}
                onPress={() => {
                  const dist = distanceText ? Number(distanceText.trim().replace(',', '.')) : null;
                  const durationValue = durationText ? Number(durationText.trim().replace(',', '.')) : null;
                  const dur =
                    durationValue != null && Number.isFinite(durationValue) && durationValue > 0
                      ? convertDurationToMinutes(durationValue, cardioDurationUnit)
                      : null;
                  const pauseSec = pauseText ? Number(pauseText.trim().replace(',', '.')) : null;
                  if ((!dist || dist <= 0) && (dur == null || dur <= 0) && (!pauseSec || pauseSec <= 0)) {
                    setSetError(t(language, 'cardioInvalid'));
                    return;
                  }
                  if (selectedExercise) {
                    onLogSet(selectedExercise.id, 0, 1, {
                      bodyweight: false,
                      distanceKm: dist && dist > 0 ? dist : null,
                      durationMin: dur && dur > 0 ? dur : null,
                      pauseSec: pauseSec && pauseSec > 0 ? pauseSec : null,
                    });
                    flashSaved('workout');
                  }
                  resetSetFlow();
                }}
              >
                <Text style={styles.primarySmallButtonText}>{t(language, 'logDistanceTime')}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={pendingExercise !== null} transparent animationType="fade">
        <Pressable style={styles.sheetBackdrop} onPress={() => setPendingExercise(null)}>
          <Pressable style={styles.sheetCard} onPress={() => {}}>
            <Text style={styles.sheetTitle}>
              {t(language, 'newExerciseFound', { name: pendingExerciseLabel })}
            </Text>
            <Text style={styles.sheetSubtitle}>{t(language, 'chooseMuscleGroup')}</Text>

            <View style={styles.groupGrid}>
              {MUSCLE_GROUP_ORDER.map((groupId) => {
                const tone = getBlockTone(groupId);
                return (
                  <TouchableOpacity
                    key={groupId}
                    style={[
                      styles.groupButton,
                      { borderColor: tone.accent, backgroundColor: tone.soft },
                    ]}
                    activeOpacity={0.9}
                    onPress={() => {
                      if (pendingExercise) {
                        onCategorizeExercise(pendingExercise.id, groupId);
                      }
                      setPendingExercise(null);
                      setTimeout(() => inputRef.current?.focus(), 120);
                    }}
                  >
                    <Text style={[styles.groupText, { color: tone.accent }]}>
                      {blockLabel(groupId, language)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
};

const createStyles = (palette: QuickLogPalette) =>
  StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.screenBg,
    paddingTop: Platform.OS === 'ios' ? SPACING.sm : SPACING.lg,
    ...Platform.select({
      web: { width: '100%', maxWidth: 720, alignSelf: 'center' },
    }),
  },
  content: {
    paddingHorizontal: SCREEN_PADDING,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  headerSide: {
    width: HEADER_SIDE_WIDTH,
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: palette.headerTitle,
    fontSize: TEXT.md,
    fontWeight: '800',
    textAlign: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SCREEN_PADDING,
    paddingBottom: SPACING.xxl,
  },
  backButton: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
  },
  back: {
    color: palette.backText,
    fontSize: TEXT.sm,
    fontWeight: '600',
  },
  localOnlyNotice: {
    color: palette.noticeText,
    fontSize: TEXT.xs,
    marginBottom: SPACING.md,
  },
  inputCard: {
    backgroundColor: palette.cardBgAlt,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    padding: SPACING.md,
    ...Platform.select({
      web: { boxShadow: palette.webShadow },
      default: {
        shadowColor: palette.shadowColor,
        shadowOpacity: palette.isLightTheme ? 0.08 : 0.35,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
      },
    }),
  },
  input: {
    minHeight: 124,
    borderRadius: RADIUS.md,
    borderWidth: 0,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    color: palette.inputText,
    fontSize: TEXT.lg,
    fontWeight: '600',
    lineHeight: TEXT.lg + 4,
    backgroundColor: palette.inputBg,
  },
  placeholderWrapper: {
    position: 'absolute',
    left: SPACING.md,
    right: SPACING.md,
    top: SPACING.sm,
    zIndex: 2,
  },
  placeholderOverlay: {
    color: palette.placeholderText,
    fontSize: TEXT.sm,
    fontWeight: '600',
    opacity: 0.9,
  },
  savedNotice: {
    marginTop: SPACING.sm,
    color: palette.savedText,
    fontSize: TEXT.sm,
  },
  actionBar: {
    marginTop: SPACING.xs,
  },
  primaryActionButton: {
    backgroundColor: palette.primaryActionBg,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    width: '100%',
  },
  primaryActionButtonPressed: {
    opacity: 0.85,
  },
  primaryActionButtonDisabled: {
    backgroundColor: palette.primaryActionDisabledBg,
  },
  primaryActionText: {
    color: palette.primaryActionText,
    fontWeight: '700',
    fontSize: TEXT.md,
  },
  primaryActionTextDisabled: {
    color: palette.primaryActionDisabledText,
  },
  liveLogCard: {
    marginTop: SPACING.xl,
    backgroundColor: palette.cardBg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    padding: SPACING.lg,
  },
  liveLogTitle: {
    color: palette.textStrong,
    fontSize: TEXT.md,
    fontWeight: '800',
    marginBottom: SPACING.xs,
  },
  liveLogEmpty: {
    color: palette.textMuted,
    fontSize: TEXT.sm,
  },
  liveLogList: {
    marginTop: SPACING.sm,
  },
  showAllRow: {
    marginTop: SPACING.xs,
    alignItems: 'flex-start',
    paddingVertical: SPACING.xs,
  },
  showAllText: {
    color: palette.linkText,
    fontSize: TEXT.sm,
    fontWeight: '700',
  },
  liveLogRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  liveLogRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.rowDivider,
  },
  liveLogTime: {
    width: 64,
    color: palette.liveRowTime,
    fontSize: TEXT.xs,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  liveLogContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  liveLogText: {
    flex: 1,
    color: palette.inputText,
    fontSize: TEXT.sm,
    fontWeight: '600',
  },
  liveLogPin: {
    minWidth: 18,
    textAlign: 'right',
    fontSize: TEXT.sm,
  },

  guidedCard: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    padding: 0,
    marginTop: SPACING.lg,
    gap: SPACING.md,
  },
  guidedTitle: {
    color: palette.textStrong,
    fontSize: TEXT.lg,
    fontWeight: '700',
    marginBottom: SPACING.xs,
  },
  inputWrapper: {
    position: 'relative',
  },
  inputMeta: {
    marginTop: SPACING.xs,
    gap: SPACING.xs,
  },
  parsePreviewText: {
    fontSize: TEXT.sm,
    fontWeight: '600',
  },
  parsePreviewOk: {
    color: palette.parseOk,
  },
  parsePreviewHint: {
    color: palette.parseHint,
  },
  inputHelper: {
    color: palette.helperText,
    fontSize: TEXT.xs,
    fontWeight: '600',
  },
  selectBox: {
    marginTop: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    backgroundColor: palette.cardBg,
    overflow: 'hidden',
  },
  chipsCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    backgroundColor: palette.cardBg,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
  },
  sectionLabel: {
    color: palette.textBase,
    fontSize: TEXT.sm,
    fontWeight: '700',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
    gap: SPACING.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    flexBasis: '48%',
    maxWidth: '48%',
  },
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  chipText: {
    color: palette.chipText,
    fontSize: TEXT.sm,
    fontWeight: '700',
  },
  selectHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    gap: SPACING.sm,
  },
  selectLabel: {
    color: palette.textBase,
    fontSize: TEXT.sm,
    fontWeight: '700',
  },
  selectValue: {
    flex: 1,
    color: palette.textMuted,
    fontSize: TEXT.sm,
    fontWeight: '600',
  },
  chevron: {
    fontSize: TEXT.md,
    color: palette.chevron,
    fontWeight: '700',
    marginLeft: 'auto',
  },
  chevronDisabled: {
    color: palette.chevronDisabled,
  },
  selectList: {
    borderTopWidth: 1,
    borderTopColor: palette.listBorderTop,
  },
  compactList: {
    maxHeight: 260,
    overflow: 'hidden',
  },
  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: palette.rowDivider,
    backgroundColor: palette.selectRowBg,
    gap: SPACING.md,
  },
  selectRowSelected: {
    backgroundColor: palette.selectRowSelectedBg,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  selectRowText: {
    color: palette.textStrong,
    fontSize: TEXT.sm,
    fontWeight: '700',
    flex: 1,
  },
  selectRowTextWrap: {
    flex: 1,
  },
  selectRowTextMeta: {
    fontSize: TEXT.xs,
    fontWeight: '700',
    marginTop: 2,
  },
  emptyText: {
    color: palette.textMuted,
    fontSize: TEXT.xs,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
  },
  suggestionCard: {
    backgroundColor: palette.cardBg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    padding: SPACING.md,
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  suggestionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  suggestionTitle: {
    color: palette.textBase,
    fontSize: TEXT.sm,
    fontWeight: '700',
  },
  suggestionList: {
    gap: SPACING.xs,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  suggestionLabel: {
    color: palette.textBase,
    fontSize: TEXT.sm,
    fontWeight: '700',
  },
  suggestionMeta: {
    color: palette.textMuted,
    fontSize: TEXT.xs,
  },
  suggestionAction: {
    fontSize: TEXT.xs,
    fontWeight: '800',
  },
  quickActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
    flexWrap: 'wrap',
  },

  // Dialogs
  dialogBackdrop: {
    flex: 1,
    backgroundColor: palette.dialogBackdrop,
    justifyContent: 'center',
    paddingHorizontal: SCREEN_PADDING,
  },
  dialogCard: {
    backgroundColor: palette.dialogCardBg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: palette.dialogCardBorder,
    padding: SPACING.xl,
  },
  dialogTitle: {
    color: palette.textStrong,
    fontSize: TEXT.lg,
    fontWeight: '800',
  },
  dialogTitleWrap: {
    marginBottom: SPACING.xs,
  },
  dialogTitleMeta: {
    fontSize: TEXT.sm,
    fontWeight: '700',
    marginTop: 2,
  },
  dialogSubtitle: {
    color: palette.textMuted,
    fontSize: TEXT.sm,
    fontWeight: '700',
    marginBottom: SPACING.sm,
  },
  dialogFieldLabel: {
    color: palette.textMuted,
    fontSize: TEXT.sm,
    fontWeight: '700',
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  durationUnitRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  durationUnitButton: {
    flex: 1,
    minHeight: 36,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: palette.secondaryBtnBorder,
    backgroundColor: palette.secondaryBtnBg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.sm,
  },
  durationUnitButtonActive: {
    backgroundColor: palette.primarySmallBg,
    borderColor: palette.primarySmallBg,
  },
  durationUnitText: {
    color: palette.secondaryBtnText,
    fontSize: TEXT.xs,
    fontWeight: '700',
  },
  durationUnitTextActive: {
    color: palette.primarySmallText,
  },
  dialogInput: {
    backgroundColor: palette.dialogInputBg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: palette.dialogInputBorder,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    color: palette.dialogInputText,
    fontSize: TEXT.lg,
    fontWeight: '700',
  },
  error: {
    color: palette.errorText,
    fontSize: TEXT.xs,
    marginTop: SPACING.sm,
  },
  dialogButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: SPACING.lg,
  },
  secondaryButton: {
    backgroundColor: palette.secondaryBtnBg,
    borderWidth: 1,
    borderColor: palette.secondaryBtnBorder,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.pill,
    marginRight: SPACING.sm,
  },
  inlineButton: {
    marginRight: 0,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
  },
  secondaryButtonText: {
    color: palette.secondaryBtnText,
    fontSize: TEXT.sm,
    fontWeight: '600',
  },
  primarySmallButton: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.pill,
    backgroundColor: palette.primarySmallBg,
  },
  primarySmallButtonText: {
    color: palette.primarySmallText,
    fontSize: TEXT.sm,
    fontWeight: '700',
  },

  // Bottom sheet
  sheetBackdrop: {
    flex: 1,
    backgroundColor: palette.sheetBackdrop,
    justifyContent: 'flex-end',
  },
  sheetCard: {
    backgroundColor: palette.sheetCardBg,
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: palette.sheetCardBorder,
    padding: SPACING.xl,
  },
  sheetTitle: {
    color: palette.textStrong,
    fontSize: TEXT.md,
    fontWeight: '700',
    marginBottom: SPACING.xs,
  },
  sheetSubtitle: {
    color: palette.textMuted,
    fontSize: TEXT.sm,
    marginBottom: SPACING.md,
  },
  groupGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  groupButton: {
    flexBasis: '48%',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    minHeight: 48,
    justifyContent: 'center',
  },
  groupText: {
    fontSize: TEXT.sm,
    fontWeight: '700',
  },
  otherLabel: {
    color: palette.textBase,
    fontSize: TEXT.sm,
    fontWeight: '700',
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  });
