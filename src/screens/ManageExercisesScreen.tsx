import React, { useMemo, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AppState, Exercise, TrainingBlock, TrainingBlockId } from '../features/workouts/model/types';
import { normalizeExerciseName } from '../features/workouts/model/nameNormalize';
import type { AppLanguage } from '../shared/types';
import { blockLabel, t } from '../shared/i18n/i18n';
import { COLORS, RADIUS, SCREEN_PADDING, SPACING, TEXT } from '../shared/theme/tokens';
import { formatExerciseLabel } from '../shared/utils/exerciseLabel';
import { LabeledInput } from '../shared/ui/LabeledInput';
import { Surface } from '../shared/ui/Surface';

type Props = {
  appState: AppState;
  onBack: () => void;
  onMerge: (fromExerciseId: string, intoExerciseId: string) => void;
};

type ExerciseRow = {
  exercise: Exercise;
  label: string;
};

const KNOWN_BLOCK_IDS: TrainingBlockId[] = [
  'chest',
  'shoulders',
  'back',
  'arms',
  'core',
  'legs',
  'cardio',
  'bodyweight',
];

function formatBlockTitle(block: TrainingBlock, language: AppLanguage): string {
  const id = block.id as TrainingBlockId;
  if (KNOWN_BLOCK_IDS.includes(id)) {
    return blockLabel(id, language);
  }
  return block.name;
}

export const ManageExercisesScreen: React.FC<Props> = ({ appState, onBack, onMerge }) => {
  const language = appState.language ?? 'en';
  const [query, setQuery] = useState('');
  const [fromId, setFromId] = useState<string | null>(null);
  const [intoId, setIntoId] = useState<string | null>(null);

  const queryNorm = useMemo(() => normalizeExerciseName(query), [query]);

  const grouped = useMemo(() => {
    const rowsByBlock = new Map<string, ExerciseRow[]>();

    for (const ex of appState.exercises) {
      const label = formatExerciseLabel(ex);
      const blockId = String(ex.blockId ?? '');

      if (queryNorm) {
        const tokens: string[] = [
          normalizeExerciseName(label),
          normalizeExerciseName(ex.name),
          normalizeExerciseName(ex.canonicalName ?? ''),
          ...(Array.isArray(ex.aliases) ? ex.aliases.map(normalizeExerciseName) : []),
          normalizeExerciseName(ex.shortCode ?? ''),
          ...(ex.tags ?? []).map(normalizeExerciseName),
        ];
        if (!tokens.some((tkn) => tkn && tkn.includes(queryNorm))) {
          continue;
        }
      }

      const list = rowsByBlock.get(blockId);
      const row = { exercise: ex, label };
      if (list) list.push(row);
      else rowsByBlock.set(blockId, [row]);
    }

    for (const list of rowsByBlock.values()) {
      list.sort((a, b) => a.label.localeCompare(b.label));
    }

    return rowsByBlock;
  }, [appState.exercises, queryNorm]);

  const fromExercise = fromId ? appState.exercises.find((ex) => ex.id === fromId) ?? null : null;
  const intoExercise = intoId ? appState.exercises.find((ex) => ex.id === intoId) ?? null : null;
  const canMerge = Boolean(fromExercise && intoExercise && fromExercise.id !== intoExercise.id);

  const handleSelect = (exerciseId: string) => {
    if (fromId === exerciseId) {
      setFromId(null);
      return;
    }
    if (intoId === exerciseId) {
      setIntoId(null);
      return;
    }
    if (!fromId) {
      setFromId(exerciseId);
      return;
    }
    if (!intoId) {
      setIntoId(exerciseId);
      return;
    }
    // If both selected, restart selection with the newly tapped exercise as "from".
    setFromId(exerciseId);
    setIntoId(null);
  };

  const confirmMerge = () => {
    if (!fromExercise || !intoExercise) return;
    if (fromExercise.id === intoExercise.id) return;

    const title = t(language, 'mergeInto', {
      from: formatExerciseLabel(fromExercise),
      into: formatExerciseLabel(intoExercise),
    });
    const body = t(language, 'mergeConfirmBody');

    Alert.alert(title, body, [
      { text: t(language, 'cancel'), style: 'cancel' },
      {
        text: t(language, 'mergeExercises'),
        style: 'destructive',
        onPress: () => {
          onMerge(fromExercise.id, intoExercise.id);
          setFromId(null);
          setIntoId(null);
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={onBack} hitSlop={12} style={styles.backButton} activeOpacity={0.8}>
          <Text style={styles.back}>{t(language, 'back')}</Text>
        </TouchableOpacity>

        <Text style={styles.title}>{t(language, 'manageExercises')}</Text>
        <Text style={styles.subtitle}>{t(language, 'manageExercisesHelp')}</Text>

        <Surface style={styles.card}>
          <LabeledInput
            label={t(language, 'search')}
            value={query}
            onChangeText={setQuery}
            placeholder={t(language, 'search')}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </Surface>

        <Surface style={styles.card}>
          <View style={styles.mergeRow}>
            <View style={styles.mergeLabels}>
              <Text style={styles.mergeLabel}>
                {t(language, 'mergeFrom')}: {fromExercise ? formatExerciseLabel(fromExercise) : '—'}
              </Text>
              <Text style={styles.mergeLabel}>
                {t(language, 'mergeIntoLabel')}: {intoExercise ? formatExerciseLabel(intoExercise) : '—'}
              </Text>
            </View>

            <TouchableOpacity
              onPress={confirmMerge}
              activeOpacity={0.9}
              disabled={!canMerge}
              style={[styles.mergeButton, !canMerge ? styles.mergeButtonDisabled : null]}
              accessibilityRole={Platform.OS === 'web' ? ('button' as any) : undefined}
            >
              <Text style={styles.mergeButtonText}>{t(language, 'mergeExercises')}</Text>
            </TouchableOpacity>
          </View>
        </Surface>

        {appState.blocks.map((block) => {
          const rows = grouped.get(String(block.id)) ?? [];
          if (rows.length === 0) return null;

          return (
            <View key={String(block.id)} style={styles.blockSection}>
              <Text style={styles.blockTitle}>{formatBlockTitle(block, language)}</Text>
              <Surface style={styles.listCard}>
                {rows.map(({ exercise, label }) => {
                  const isFrom = exercise.id === fromId;
                  const isInto = exercise.id === intoId;
                  const aliasesCount = Array.isArray(exercise.aliases) ? exercise.aliases.length : 0;

                  return (
                    <TouchableOpacity
                      key={exercise.id}
                      activeOpacity={0.9}
                      onPress={() => handleSelect(exercise.id)}
                      style={[
                        styles.exerciseRow,
                        isFrom ? styles.exerciseRowFrom : null,
                        isInto ? styles.exerciseRowInto : null,
                      ]}
                    >
                      <View style={styles.exerciseTextWrap}>
                        <Text style={styles.exerciseName} numberOfLines={1}>
                          {label}
                        </Text>
                        <Text style={styles.exerciseMeta}>
                          {t(language, 'aliasesCount', { count: aliasesCount })}
                        </Text>
                      </View>

                      <View style={styles.badges}>
                        {isFrom ? (
                          <View style={[styles.badge, styles.badgeFrom]}>
                            <Text style={styles.badgeText}>{t(language, 'mergeFrom')}</Text>
                          </View>
                        ) : null}
                        {isInto ? (
                          <View style={[styles.badge, styles.badgeInto]}>
                            <Text style={styles.badgeText}>{t(language, 'mergeIntoLabel')}</Text>
                          </View>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </Surface>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#020617',
  },
  content: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: Platform.OS === 'ios' ? SPACING.sm : SPACING.xxxl,
    paddingBottom: SPACING.xxl,
    ...Platform.select({
      web: { width: '100%', maxWidth: 720, alignSelf: 'center' },
    }),
  },
  backButton: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  back: {
    color: '#93C5FD',
    fontSize: TEXT.sm,
    fontWeight: '600',
  },
  title: {
    fontSize: TEXT.xl,
    fontWeight: '800',
    color: '#F9FAFB',
  },
  subtitle: {
    marginTop: SPACING.xs,
    marginBottom: SPACING.lg,
    color: '#9CA3AF',
    fontSize: TEXT.sm,
    fontWeight: '600',
  },
  card: {
    padding: SPACING.lg,
    marginTop: SPACING.md,
  },
  mergeRow: {
    gap: SPACING.md,
  },
  mergeLabels: {
    gap: 6,
  },
  mergeLabel: {
    color: '#E5E7EB',
    fontSize: TEXT.sm,
    fontWeight: '700',
  },
  mergeButton: {
    borderRadius: RADIUS.lg,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    backgroundColor: COLORS.blue2,
  },
  mergeButtonDisabled: {
    backgroundColor: '#1F2937',
  },
  mergeButtonText: {
    color: '#F9FAFB',
    fontSize: TEXT.sm,
    fontWeight: '900',
  },
  blockSection: {
    marginTop: SPACING.xl,
  },
  blockTitle: {
    color: '#E5E7EB',
    fontSize: TEXT.sm,
    fontWeight: '800',
    marginBottom: SPACING.sm,
  },
  listCard: {
    overflow: 'hidden',
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    backgroundColor: '#0B1220',
  },
  exerciseRowFrom: {
    backgroundColor: 'rgba(59, 130, 246, 0.14)',
  },
  exerciseRowInto: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
  },
  exerciseTextWrap: {
    flex: 1,
    paddingRight: SPACING.md,
    gap: 2,
  },
  exerciseName: {
    color: '#F9FAFB',
    fontSize: TEXT.sm,
    fontWeight: '800',
  },
  exerciseMeta: {
    color: '#9CA3AF',
    fontSize: TEXT.xs,
    fontWeight: '700',
  },
  badges: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  badge: {
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
  },
  badgeFrom: {
    backgroundColor: 'rgba(59, 130, 246, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.36)',
  },
  badgeInto: {
    backgroundColor: 'rgba(34, 197, 94, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.32)',
  },
  badgeText: {
    color: '#E5E7EB',
    fontSize: TEXT.xs,
    fontWeight: '900',
  },
});
