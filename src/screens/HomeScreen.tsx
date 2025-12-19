import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { AppState, TrainingBlock, TrainingBlockId, Exercise, SetEntry } from '../types';
import { getBlockTone } from '../utils/blockTone';
import { SPACING, TEXT, RADIUS } from '../theme/tokens';
import { formatDate, formatRelativeDayLabel, formatWeekday } from '../utils/dateLabels';
import { getDailyWorkout, getWorkoutDates, groupDailySets } from '../services/workoutService';
import { blockLabel, greeting, t } from '../i18n/i18n';

type Props = {
  appState: AppState;
  onSelectBlock: (blockId: string) => void;
  onOpenAI: () => void;
  onOpenQuickLog: () => void;
  onOpenHistory: () => void;
  onOpenProgress: () => void;
  onOpenRepMax: () => void;
  onOpenProfile: () => void;
};

const ORDER: TrainingBlockId[] = [
  'chest',
  'shoulders',
  'back',
  'arms',
  'core',
  'cardio',
  'legs',
];

function parseDateKey(dateKey: string): Date | null {
  const parts = dateKey.split('-');
  if (parts.length !== 3) return null;

  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);

  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function estimateOneRm(weight: number, reps: number): number {
  if (reps <= 1) return weight;
  const est = weight * (1 + reps / 30);
  return Math.round(est * 10) / 10;
}

export const HomeScreen: React.FC<Props> = ({
  appState,
  onSelectBlock,
  onOpenAI,
  onOpenQuickLog,
  onOpenHistory,
  onOpenProgress,
  onOpenRepMax,
  onOpenProfile,
}) => {
  const language = appState.language ?? 'en';
  const [analysisOpen, setAnalysisOpen] = useState(true);

  const blocks = useMemo(() => {
    const byId: Record<string, TrainingBlock> = {};
    for (const b of appState.blocks) byId[b.id] = b;

    const ordered: TrainingBlock[] = [];
    for (const id of ORDER) {
      const block = byId[id];
      if (block) ordered.push(block);
    }

    const rest = appState.blocks.filter((b) => !ORDER.includes(b.id as TrainingBlockId));
    return [...ordered, ...rest];
  }, [appState.blocks]);

  const greetingText = greeting(language, appState.nickname);

  const labelForBlock = (block: TrainingBlock): string => {
    const id = block.id as TrainingBlockId;
    return ORDER.includes(id) ? blockLabel(id, language) : block.name;
  };

  const lastWorkoutInsight = useMemo(() => {
    const dates = getWorkoutDates(appState);
    if (dates.length === 0) {
      return { title: t(language, 'lastWorkoutNoneTitle'), subtitle: t(language, 'lastWorkoutNoneSubtitle') };
    }

    const dateKey = dates[0];
    const dt = parseDateKey(dateKey);
    const dayLabel = dt ? formatRelativeDayLabel(dt, new Date(), language) ?? formatWeekday(dt, language) : null;
    const dateLabel = dt ? formatDate(dt) : dateKey;

    const daySets = getDailyWorkout(appState, dateKey);
    const groups = groupDailySets(daySets);
    const setCount = daySets.length;

    const blockCounts = new Map<string, { id: string; count: number }>();
    for (const g of groups) {
      const blockId = g.blockId ?? '';
      if (!blockId) continue;
      const prev = blockCounts.get(blockId);
      blockCounts.set(blockId, { id: blockId, count: (prev?.count ?? 0) + g.sets.length });
    }

    const dominantBlockId = Array.from(blockCounts.values()).sort((a, b) => b.count - a.count)[0]?.id;
    const dominantLabel =
      dominantBlockId && ORDER.includes(dominantBlockId as TrainingBlockId)
        ? blockLabel(dominantBlockId as TrainingBlockId, language)
        : null;

    const title = dominantLabel
      ? t(language, 'lastWorkoutTitle', { block: dominantLabel })
      : t(language, 'lastWorkoutFallbackTitle');
    const subtitle = t(language, 'lastWorkoutSubtitle', {
      day: dayLabel ?? dateLabel,
      count: setCount,
    });
    return { title, subtitle };
  }, [appState]);

  const progressInsight = useMemo(() => {
    if (appState.sets.length === 0) {
      return { title: t(language, 'progressNoneTitle'), subtitle: t(language, 'progressNoneSubtitle') };
    }

    const now = Date.now();
    const dayMs = 86400000;
    const recentStart = now - 30 * dayMs;
    const prevStart = now - 60 * dayMs;

    const byExercise = new Map<
      string,
      { recentMax?: number; prevMax?: number; recentCount: number }
    >();

    for (const s of appState.sets) {
      const ts = new Date(s.createdAt).getTime();
      const item = byExercise.get(s.exerciseId) ?? { recentCount: 0 };

      if (ts >= recentStart) {
        item.recentCount += 1;
        item.recentMax = Math.max(item.recentMax ?? 0, s.weight);
      } else if (ts >= prevStart) {
        item.prevMax = Math.max(item.prevMax ?? 0, s.weight);
      }

      byExercise.set(s.exerciseId, item);
    }

    let best:
      | { exercise: Exercise; recentMax: number; prevMax?: number; recentCount: number }
      | null = null;

    for (const ex of appState.exercises) {
      const data = byExercise.get(ex.id);
      if (!data || data.recentMax == null) continue;
      const candidate = { exercise: ex, recentMax: data.recentMax, prevMax: data.prevMax, recentCount: data.recentCount };

      if (!best) {
        best = candidate;
        continue;
      }

      const candDelta = candidate.prevMax != null ? candidate.recentMax - candidate.prevMax : null;
      const bestDelta = best.prevMax != null ? best.recentMax - best.prevMax : null;

      if (candDelta != null && bestDelta == null) {
        best = candidate;
        continue;
      }
      if (candDelta != null && bestDelta != null) {
        if (candDelta > bestDelta) {
          best = candidate;
          continue;
        }
        if (candDelta < bestDelta) continue;
      }

      if (candidate.recentCount > best.recentCount) {
        best = candidate;
        continue;
      }
      if (candidate.recentCount < best.recentCount) continue;

      if (candidate.recentMax > best.recentMax) {
        best = candidate;
      }
    }

    if (!best) {
      return { title: t(language, 'progressNoRecentTitle'), subtitle: t(language, 'progressNoRecentSubtitle') };
    }

    const delta = best.prevMax != null ? best.recentMax - best.prevMax : null;
    const deltaText =
      delta == null
        ? `${best.recentMax} kg`
        : `${delta >= 0 ? '+' : ''}${Math.round(delta * 10) / 10} kg`;
    return {
      title: t(language, 'progressTitle', { exercise: best.exercise.name, delta: deltaText }),
      subtitle: t(language, 'tapForDetails'),
    };
  }, [appState]);

  const repMaxInsight = useMemo(() => {
    if (appState.sets.length === 0) {
      return { title: t(language, 'repMaxNoneTitle'), subtitle: t(language, 'repMaxNoneSubtitle') };
    }

    let best: { set: SetEntry; exercise: Exercise } | null = null;
    let bestOneRm = 0;

    for (const s of appState.sets) {
      const ex = appState.exercises.find((e) => e.id === s.exerciseId);
      if (!ex) continue;
      const oneRm = estimateOneRm(s.weight, s.reps);
      if (oneRm > bestOneRm) {
        bestOneRm = oneRm;
        best = { set: s, exercise: ex };
      }
    }

    if (!best) {
      return { title: t(language, 'repMaxNoneTitle'), subtitle: t(language, 'repMaxNoneSubtitle') };
    }

    return {
      title: t(language, 'repMaxTitle', { exercise: best.exercise.name, oneRm: bestOneRm }),
      subtitle: t(language, 'repMaxSubtitle', { weight: best.set.weight, reps: best.set.reps }),
    };
  }, [appState]);

  return (
    <View style={styles.root}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} bounces>
        <View style={styles.headerRow}>
          <View style={styles.headerTextWrapper}>
            <Text style={styles.greeting}>{greetingText}</Text>
            <Text style={styles.subtitle}>{t(language, 'homeSubtitle')}</Text>
          </View>
          <TouchableOpacity onPress={onOpenProfile} hitSlop={8}>
            <Text style={styles.profileLink}>{t(language, 'profile')}</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.quickLogCard} onPress={onOpenQuickLog} activeOpacity={0.9}>
          <Text style={styles.quickLogTitle}>{t(language, 'quickLogTitle')}</Text>
          <Text style={styles.quickLogText}>{t(language, 'quickLogExample')}</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>{t(language, 'muscleGroups')}</Text>
        <View style={styles.section}>
          {blocks.map((block) => {
            const tone = getBlockTone(block.id);
            return (
              <TouchableOpacity
                key={block.id}
                style={[
                  styles.blockButton,
                  { backgroundColor: tone.soft, borderColor: tone.accent },
                ]}
                onPress={() => onSelectBlock(block.id)}
                activeOpacity={0.9}
              >
                <Text style={[styles.blockLabel, { color: tone.accent }]}>{labelForBlock(block)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.analysisWrapper}>
          <TouchableOpacity
            style={styles.analysisHeaderRow}
            onPress={() => setAnalysisOpen((v) => !v)}
            activeOpacity={0.8}
          >
            <Text style={styles.analysisTitle}>{t(language, 'analysis')}</Text>
            <Text style={styles.chevron}>{analysisOpen ? 'v' : '>'}</Text>
          </TouchableOpacity>

          {analysisOpen && (
            <View style={styles.analysisCards}>
              <TouchableOpacity style={styles.analysisCard} onPress={onOpenHistory} activeOpacity={0.9}>
                <Text style={styles.cardTitle}>{lastWorkoutInsight.title}</Text>
                <Text style={styles.cardText}>{lastWorkoutInsight.subtitle}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.analysisCard} onPress={onOpenProgress} activeOpacity={0.9}>
                <Text style={styles.cardTitle}>{progressInsight.title}</Text>
                <Text style={styles.cardText}>{progressInsight.subtitle}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.analysisCard} onPress={onOpenRepMax} activeOpacity={0.9}>
                <Text style={styles.cardTitle}>{repMaxInsight.title}</Text>
                <Text style={styles.cardText}>{repMaxInsight.subtitle}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.analysisCard} onPress={onOpenAI} activeOpacity={0.9}>
                <Text style={styles.cardTitle}>{t(language, 'aiSearchTitle')}</Text>
                <Text style={styles.cardText}>{t(language, 'aiSearchHint')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={{ height: Platform.OS === 'web' ? 32 : 48 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#020617',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.xxl,
    paddingTop: SPACING.xxl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: SPACING.xl,
  },
  headerTextWrapper: {
    flex: 1,
    paddingRight: SPACING.lg,
  },
  greeting: {
    fontSize: TEXT.title,
    fontWeight: '700',
    color: '#F9FAFB',
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: TEXT.sm,
    color: '#9CA3AF',
  },
  profileLink: {
    fontSize: TEXT.sm,
    color: '#60A5FA',
    fontWeight: '600',
    paddingTop: SPACING.xs,
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
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    borderWidth: 1,
    borderColor: '#1F2937',
    marginBottom: SPACING.xxl,
  },
  quickLogTitle: {
    color: '#F9FAFB',
    fontSize: TEXT.lg,
    fontWeight: '700',
    marginBottom: SPACING.xs,
  },
  quickLogText: {
    color: '#9CA3AF',
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
  analysisWrapper: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.xxl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#1F2937',
    paddingTop: SPACING.lg,
  },
  analysisHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  analysisTitle: {
    fontSize: TEXT.lg,
    fontWeight: '700',
    color: '#F9FAFB',
  },
  chevron: {
    fontSize: TEXT.md,
    color: '#9CA3AF',
    fontWeight: '700',
  },
  analysisCards: {
    gap: SPACING.md,
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
