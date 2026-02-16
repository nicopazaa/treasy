import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { Exercise, SetEntry } from '../../domain/workouts/types';
import type { AppLanguage } from '../types';
import { t } from '../i18n/i18n';
import { COLORS, RADIUS, SPACING, TEXT } from '../theme/tokens';
import { getBlockTone } from '../theme/blockTone';
import { formatExerciseLabel } from '../utils/exerciseLabel';
import { formatRelativeDateTime } from '../utils/dateLabels';
import { formatInputWeight, formatSetListLabel } from '../utils/setFormatting';
import type { MassUnit } from '../utils/units';
import { useCardioLoggerInput, useSetLoggerInput } from '../hooks/useSetLoggerInput';
import { QuickKeypad } from './QuickKeypad';

export type SetLoggerMeta = {
  distanceKm?: number | null;
  durationMin?: number | null;
  pauseSec?: number | null;
  isBodyweight?: boolean;
};

type Props = {
  visible: boolean;
  language: AppLanguage;
  massUnit: MassUnit;
  exercise: Exercise;
  sets: SetEntry[];
  onAddSet: (weightKg: number, reps: number, meta?: SetLoggerMeta) => void;
  onCopyLastSet: () => void;
  onClose: () => void;
};

const DISMISS_DRAG_PX = 120;
const FALLBACK_ACCENT = COLORS.blue2;
const BACKSPACE_KEY = '\u232B';
const CLEAR_KEY = 'C';

function parseHexColor(color: string): [number, number, number] | null {
  const clean = color.trim().replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16)];
}

function toRgba(color: string, alpha: number): string {
  const safeAlpha = Number.isFinite(alpha) ? Math.max(0, Math.min(1, alpha)) : 1;
  const rgb = parseHexColor(color) ?? parseHexColor(FALLBACK_ACCENT);
  if (!rgb) return `rgba(59, 130, 246, ${safeAlpha})`;
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${safeAlpha})`;
}

export const ExerciseLogBottomSheet: React.FC<Props> = ({
  visible,
  language,
  massUnit,
  exercise,
  sets,
  onAddSet,
  onCopyLastSet,
  onClose,
}) => {
  const screenHeight = Dimensions.get('window').height;
  const sheetHeight = Math.min(Math.round(screenHeight * 0.74), 680);

  const translateY = useRef(new Animated.Value(0)).current;

  const isCardio = exercise.blockId === 'cardio';
  const tone = getBlockTone(exercise.blockId);
  const logger = useSetLoggerInput({ massUnit });
  const cardioLogger = useCardioLoggerInput();

  const sortedSets = useMemo(() => {
    return sets
      .slice()
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [sets]);

  const lastSet = sortedSets[0] ?? null;
  const unitLabel = massUnit === 'lb' ? t(language, 'units.lb') : t(language, 'units.kg');
  const weightLabel = t(language, 'weightKg', { unit: unitLabel });
  const decimalKey = language === 'nb' || language === 'es' ? ',' : '.';

  const canLog = isCardio
    ? Boolean(
        cardioLogger.parsed.distanceKm != null ||
          cardioLogger.parsed.durationMin != null ||
          cardioLogger.parsed.pauseSec != null
      )
    : Boolean(logger.parsed.weightKg != null && logger.parsed.reps != null);
  const canCopy = isCardio ? Boolean(lastSet) : Boolean(lastSet && lastSet.setType !== 'cardio');

  const closeWithReset = () => {
    cardioLogger.clearAll();
    logger.clearAll();
    translateY.setValue(0);
    onClose();
  };

  const dismissByDrag = () => {
    Animated.timing(translateY, {
      toValue: sheetHeight,
      duration: 160,
      useNativeDriver: true,
    }).start(() => {
      closeWithReset();
    });
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => {
          return gesture.dy > 4 && Math.abs(gesture.dy) > Math.abs(gesture.dx);
        },
        onPanResponderMove: (_, gesture) => {
          if (gesture.dy <= 0) return;
          translateY.setValue(gesture.dy);
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy > DISMISS_DRAG_PX || gesture.vy > 1.2) {
            dismissByDrag();
            return;
          }
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
        },
      }),
    [dismissByDrag, translateY]
  );

  useEffect(() => {
    if (!visible) return;
    translateY.setValue(0);
    cardioLogger.clearAll();
    logger.clearAll();
  }, [cardioLogger.clearAll, exercise.id, logger.clearAll, translateY, visible]);

  const handleKeyPress = (key: string) => {
    const target = isCardio ? cardioLogger : logger;

    if (key === CLEAR_KEY) {
      target.clear();
      return;
    }
    if (key === BACKSPACE_KEY) {
      target.backspace();
      return;
    }
    target.appendKey(key);
  };

  const handleLogSet = () => {
    if (isCardio) {
      const distanceKm = cardioLogger.parsed.distanceKm;
      const durationMin = cardioLogger.parsed.durationMin;
      const pauseSec = cardioLogger.parsed.pauseSec;
      if (distanceKm == null && durationMin == null && pauseSec == null) return;
      onAddSet(0, 1, { distanceKm, durationMin, pauseSec });
      cardioLogger.clearAll();
      return;
    }

    const weightKg = logger.parsed.weightKg;
    const reps = logger.parsed.reps;
    if (weightKg == null || reps == null) return;
    if (!Number.isFinite(weightKg) || !Number.isFinite(reps) || weightKg < 0 || reps <= 0) return;
    onAddSet(weightKg, reps);
    logger.clearAll();
  };

  const handleCopyLastSet = () => {
    if (!lastSet) return;

    if (isCardio) {
      cardioLogger.setDistanceText(lastSet.distanceKm != null ? String(lastSet.distanceKm) : '');
      cardioLogger.setDurationText(lastSet.durationMin != null ? String(lastSet.durationMin) : '');
      cardioLogger.setPauseText(lastSet.pauseSec != null ? String(lastSet.pauseSec) : '');
      cardioLogger.setActiveField('duration');
      onCopyLastSet();
      return;
    }

    if (lastSet.setType === 'cardio') return;
    logger.setWeightText(formatInputWeight(lastSet.weight, massUnit, language));
    logger.setRepsText(String(lastSet.reps));
    logger.setActiveField('weight');
    onCopyLastSet();
  };

  const keypadRows: string[][] = isCardio
    ? [
        ['1', '2', '3'],
        ['4', '5', '6'],
        ['7', '8', '9'],
        [decimalKey, '0', BACKSPACE_KEY],
      ]
    : logger.activeField === 'weight'
      ? [
          ['1', '2', '3'],
          ['4', '5', '6'],
          ['7', '8', '9'],
          [decimalKey, '0', BACKSPACE_KEY],
        ]
      : [
          ['1', '2', '3'],
          ['4', '5', '6'],
          ['7', '8', '9'],
          ['0', CLEAR_KEY, BACKSPACE_KEY],
        ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={closeWithReset}
    >
      <Pressable style={styles.backdrop} onPress={closeWithReset}>
        <Animated.View
          style={[styles.sheet, { height: sheetHeight, transform: [{ translateY }] }]}
        >
          <Pressable
            style={[
              styles.sheetCard,
              { borderColor: toRgba(tone.accent, 0.34), backgroundColor: '#030D1A' },
            ]}
            onPress={() => {}}
          >
            <View style={styles.dragHandleHit} {...panResponder.panHandlers}>
              <View style={[styles.dragHandle, { backgroundColor: toRgba(tone.accent, 0.45) }]} />
            </View>

            <View style={styles.headerRow}>
              <View style={styles.headerSide} />
              <Text style={styles.title} numberOfLines={1}>
                {formatExerciseLabel(exercise)}
              </Text>
              <TouchableOpacity
                onPress={closeWithReset}
                style={styles.closeButton}
                hitSlop={12}
                activeOpacity={0.8}
              >
                <Text style={styles.closeText}>{'\u00D7'}</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.historyWrap, { borderColor: toRgba(tone.accent, 0.24), backgroundColor: toRgba(tone.accent, 0.09) }]}>
              <FlatList
                data={sortedSets}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <View style={styles.historyRow}>
                    <Text style={styles.historyLabel}>
                      {formatSetListLabel(language, item, massUnit)}
                    </Text>
                    <Text style={styles.historyTime}>
                      {formatRelativeDateTime(new Date(item.createdAt), new Date(), language)}
                    </Text>
                  </View>
                )}
                ItemSeparatorComponent={() => <View style={styles.historySeparator} />}
                ListEmptyComponent={<Text style={styles.emptyText}>{t(language, 'noSetsYet')}</Text>}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={sortedSets.length ? undefined : styles.emptyContent}
              />
            </View>

            {isCardio ? (
              <>
                <View style={styles.inputRow}>
                  <Pressable
                    style={[
                      styles.inputBox,
                      cardioLogger.activeField === 'duration' && styles.inputBoxActive,
                      cardioLogger.activeField === 'duration' && {
                        borderColor: tone.accent,
                        backgroundColor: toRgba(tone.accent, 0.18),
                      },
                    ]}
                    onPress={() => cardioLogger.setActiveField('duration')}
                  >
                    <Text style={styles.inputLabel}>{t(language, 'durationLabel')}</Text>
                    <TextInput
                      value={cardioLogger.durationText}
                      onChangeText={cardioLogger.setDurationText}
                      placeholder="0"
                      placeholderTextColor="rgba(203, 213, 225, 0.52)"
                      style={styles.input}
                      showSoftInputOnFocus={false}
                      editable={Platform.OS !== 'web'}
                      onFocus={() => cardioLogger.setActiveField('duration')}
                    />
                  </Pressable>
                  <Pressable
                    style={[
                      styles.inputBox,
                      cardioLogger.activeField === 'distance' && styles.inputBoxActive,
                      cardioLogger.activeField === 'distance' && {
                        borderColor: tone.accent,
                        backgroundColor: toRgba(tone.accent, 0.18),
                      },
                    ]}
                    onPress={() => cardioLogger.setActiveField('distance')}
                  >
                    <Text style={styles.inputLabel}>{t(language, 'distanceLabel')}</Text>
                    <TextInput
                      value={cardioLogger.distanceText}
                      onChangeText={cardioLogger.setDistanceText}
                      placeholder="0"
                      placeholderTextColor="rgba(203, 213, 225, 0.52)"
                      style={styles.input}
                      showSoftInputOnFocus={false}
                      editable={Platform.OS !== 'web'}
                      onFocus={() => cardioLogger.setActiveField('distance')}
                    />
                  </Pressable>
                </View>
                <View style={styles.inputRow}>
                  <Pressable
                    style={[
                      styles.inputBox,
                      cardioLogger.activeField === 'pause' && styles.inputBoxActive,
                      cardioLogger.activeField === 'pause' && {
                        borderColor: tone.accent,
                        backgroundColor: toRgba(tone.accent, 0.18),
                      },
                    ]}
                    onPress={() => cardioLogger.setActiveField('pause')}
                  >
                    <Text style={styles.inputLabel}>{t(language, 'pauseLabel')}</Text>
                    <TextInput
                      value={cardioLogger.pauseText}
                      onChangeText={cardioLogger.setPauseText}
                      placeholder="0"
                      placeholderTextColor="rgba(203, 213, 225, 0.52)"
                      style={styles.input}
                      showSoftInputOnFocus={false}
                      editable={Platform.OS !== 'web'}
                      onFocus={() => cardioLogger.setActiveField('pause')}
                    />
                  </Pressable>
                </View>
              </>
            ) : (
              <View style={styles.inputRow}>
                <Pressable
                  style={[
                    styles.inputBox,
                    logger.activeField === 'weight' && styles.inputBoxActive,
                    logger.activeField === 'weight' && {
                      borderColor: tone.accent,
                      backgroundColor: toRgba(tone.accent, 0.18),
                    },
                  ]}
                  onPress={() => logger.setActiveField('weight')}
                >
                  <Text style={styles.inputLabel}>{weightLabel}</Text>
                  <TextInput
                    value={logger.weightText}
                    onChangeText={logger.setWeightText}
                    placeholder="0"
                    placeholderTextColor="rgba(203, 213, 225, 0.52)"
                    style={styles.input}
                    showSoftInputOnFocus={false}
                    editable={Platform.OS !== 'web'}
                    onFocus={() => logger.setActiveField('weight')}
                  />
                </Pressable>
                <Pressable
                  style={[
                    styles.inputBox,
                    logger.activeField === 'reps' && styles.inputBoxActive,
                    logger.activeField === 'reps' && {
                      borderColor: tone.accent,
                      backgroundColor: toRgba(tone.accent, 0.18),
                    },
                  ]}
                  onPress={() => logger.setActiveField('reps')}
                >
                  <Text style={styles.inputLabel}>{t(language, 'reps')}</Text>
                  <TextInput
                    value={logger.repsText}
                    onChangeText={logger.setRepsText}
                    placeholder="0"
                    placeholderTextColor="rgba(203, 213, 225, 0.52)"
                    style={styles.input}
                    showSoftInputOnFocus={false}
                    editable={Platform.OS !== 'web'}
                    onFocus={() => logger.setActiveField('reps')}
                  />
                </Pressable>
              </View>
            )}

            <View style={styles.actionsRow}>
              <TouchableOpacity
                onPress={handleCopyLastSet}
                disabled={!canCopy}
                hitSlop={8}
                style={[
                  styles.copyButton,
                  { borderColor: toRgba(tone.accent, 0.3), backgroundColor: toRgba(tone.accent, 0.1) },
                  !canCopy && styles.copyButtonDisabled,
                ]}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.copyButtonText,
                    { color: tone.accent },
                    !canCopy && styles.copyLinkDisabled,
                  ]}
                >
                  {t(language, 'copyPreviousSet')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleLogSet}
                disabled={!canLog}
                style={[
                  styles.logButton,
                  { backgroundColor: tone.accent, borderColor: toRgba(tone.accent, 0.38) },
                  !canLog && styles.logButtonDisabled,
                ]}
                activeOpacity={0.85}
              >
                <Text style={styles.logButtonText}>{t(language, 'logSet')}</Text>
              </TouchableOpacity>
            </View>

            <QuickKeypad rows={keypadRows} onKeyPress={handleKeyPress} />
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.64)',
    justifyContent: 'flex-end',
  },
  sheet: {
    width: '100%',
  },
  sheetCard: {
    flex: 1,
    backgroundColor: COLORS.treasyNavy,
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(59, 130, 246, 0.32)',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.lg,
  },
  dragHandleHit: {
    paddingVertical: SPACING.sm,
    alignItems: 'center',
  },
  dragHandle: {
    width: 44,
    height: 5,
    borderRadius: RADIUS.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: SPACING.md,
  },
  headerSide: {
    width: 44,
    height: 44,
  },
  title: {
    flex: 1,
    color: '#F9FAFB',
    fontSize: TEXT.lg + 1,
    fontWeight: '800',
    textAlign: 'center',
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: 'rgba(255, 255, 255, 0.86)',
    fontSize: TEXT.xl,
    fontWeight: '700',
    lineHeight: TEXT.xl,
  },
  historyWrap: {
    minHeight: 94,
    maxHeight: 196,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.24)',
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    gap: SPACING.md,
  },
  historyLabel: {
    flex: 1,
    color: '#E2E8F0',
    fontSize: TEXT.sm,
    fontWeight: '700',
  },
  historyTime: {
    color: 'rgba(203, 213, 225, 0.72)',
    fontSize: TEXT.xs,
    fontWeight: '600',
  },
  historySeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(148, 163, 184, 0.24)',
  },
  emptyContent: {
    minHeight: 64,
    justifyContent: 'center',
  },
  emptyText: {
    color: 'rgba(203, 213, 225, 0.74)',
    fontSize: TEXT.sm,
    fontWeight: '600',
    textAlign: 'center',
  },
  inputRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  inputBox: {
    flex: 1,
    backgroundColor: '#0A1A30',
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderWidth: 1.5,
    borderColor: 'rgba(148, 163, 184, 0.32)',
  },
  inputBoxActive: {
    borderColor: COLORS.blue2,
  },
  inputLabel: {
    color: 'rgba(148, 163, 184, 0.95)',
    fontSize: TEXT.xs,
    fontWeight: '800',
    marginBottom: 2,
  },
  input: {
    color: '#F8FAFC',
    fontSize: TEXT.xl,
    fontWeight: '900',
    paddingVertical: 0,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  copyButton: {
    minHeight: 38,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    justifyContent: 'center',
  },
  copyButtonText: {
    fontSize: TEXT.sm,
    fontWeight: '800',
  },
  copyButtonDisabled: {
    opacity: 0.5,
  },
  copyLinkDisabled: {
    opacity: 0.45,
  },
  logButton: {
    backgroundColor: COLORS.blue2,
    borderWidth: 1,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.pill,
  },
  logButtonDisabled: {
    opacity: 0.55,
  },
  logButtonText: {
    color: '#F9FAFB',
    fontSize: TEXT.sm,
    fontWeight: '900',
  },
});
