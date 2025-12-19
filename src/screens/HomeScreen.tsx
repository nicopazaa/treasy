// src/screens/HomeScreen.tsx
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { AppState, TrainingBlock, TrainingBlockId } from '../types';
import { getBlockTone } from '../utils/blockTone';
import { SPACING, TEXT, RADIUS } from '../theme/tokens';
import {
  getWorkoutDates,
  getDailyWorkout,
  groupDailySets,
  GroupedDailySetView,
} from '../services/workoutService';
import { formatDate, formatRelativeDayLabel } from '../utils/dateLabels';

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

type LastWorkoutSummary = {
  dateLabel: string;
  groups: GroupedDailySetView[];
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
  const [analysisOpen, setAnalysisOpen] = useState(true);

  const blocks = useMemo(() => {
    const byId: Record<string, TrainingBlock> = {};
    for (const b of appState.blocks) byId[b.id] = b;

    const ordered: TrainingBlock[] = [];
    for (const id of ORDER) {
      const block = byId[id];
      if (block) ordered.push(block);
    }

    // eventuelle custom-blokker (om du legger til senere)
    const rest = appState.blocks.filter(
      (b) => !ORDER.includes(b.id as TrainingBlockId),
    );

    return [...ordered, ...rest];
  }, [appState.blocks]);

  const lastWorkout = useMemo<LastWorkoutSummary | null>(() => {
    const dates = getWorkoutDates(appState);
    if (dates.length === 0) return null;

    const dateKey = dates[0];
    const daySets = getDailyWorkout(appState, dateKey);
    const grouped = groupDailySets(daySets);
    if (grouped.length === 0) return null;

    const dt = parseDateKey(dateKey);
    const dateLabel = dt ? (formatRelativeDayLabel(dt) ?? formatDate(dt)) : dateKey;

    return {
      dateLabel,
      groups: grouped,
    };
  }, [appState]);

  const greeting =
    appState.nickname && appState.nickname.trim().length > 0
      ? `Hei, ${appState.nickname}`
      : 'Hei';

  const previewGroups = lastWorkout ? lastWorkout.groups.slice(0, 2) : [];
  const extraGroups =
    lastWorkout && lastWorkout.groups.length > 2
      ? lastWorkout.groups.length - 2
      : 0;

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        bounces
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.headerTextWrapper}>
            <Text style={styles.greeting}>{greeting}</Text>
            <Text style={styles.subtitle}>
              Velg muskelgruppe for a se ovelser og logge okter.
            </Text>
          </View>
          <TouchableOpacity onPress={onOpenProfile} hitSlop={8}>
            <Text style={styles.profileLink}>Profil</Text>
          </TouchableOpacity>
        </View>

        {/* Hurtig logg */}
        <Text style={styles.sectionTitle}>Hurtig logg</Text>
        <TouchableOpacity
          style={[styles.analysisCard, styles.actionCard]}
          onPress={onOpenQuickLog}
          activeOpacity={0.9}
        >
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Hurtig logg</Text>
            <Text style={styles.cardChevron}>&gt;</Text>
          </View>
          <Text style={styles.cardText}>
            Skriv for eksempel: Benk 80x2, 70x5, 60x8
          </Text>
        </TouchableOpacity>

        {/* Sist okt */}
        <Text style={styles.sectionTitle}>Sist okt</Text>
        <TouchableOpacity
          style={[styles.analysisCard, styles.actionCard]}
          onPress={onOpenHistory}
          activeOpacity={0.9}
        >
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Sist okt</Text>
            <Text style={styles.cardChevron}>&gt;</Text>
          </View>
          {lastWorkout ? (
            <View style={styles.cardBody}>
              <Text style={styles.cardMeta}>{lastWorkout.dateLabel}</Text>
              {previewGroups.map((group) => (
                <Text key={group.id} style={styles.cardText}>
                  {group.exerciseName}
                  {group.blockName ? ` (${group.blockName})` : ''} - {group.sets.length} sett
                </Text>
              ))}
              {extraGroups > 0 ? (
                <Text style={styles.cardText}>+ {extraGroups} til</Text>
              ) : null}
            </View>
          ) : (
            <Text style={styles.cardText}>
              Ingen okter enda. Logg en okt for a se den her.
            </Text>
          )}
        </TouchableOpacity>

        {/* Ovelser */}
        <Text style={styles.sectionTitle}>Ovelser</Text>
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
                <Text style={[styles.blockLabel, { color: tone.accent }]}>
                  {block.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Analyse */}
        <View style={styles.analysisWrapper}>
          <TouchableOpacity
            style={styles.analysisHeaderRow}
            onPress={() => setAnalysisOpen((v) => !v)}
            activeOpacity={0.8}
          >
            <Text style={styles.analysisTitle}>Analyse</Text>
            <Text style={styles.chevron}>{analysisOpen ? 'v' : '>'}</Text>
          </TouchableOpacity>

          {analysisOpen && (
            <View style={styles.analysisCards}>
              <TouchableOpacity
                style={styles.analysisCard}
                onPress={onOpenHistory}
                activeOpacity={0.9}
              >
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardTitle}>Tidligere okter</Text>
                  <Text style={styles.cardChevron}>&gt;</Text>
                </View>
                <Text style={styles.cardText}>
                  Se komplette okter per dag - alle ovelser, uansett muskelgruppe.
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.analysisCard}
                onPress={onOpenProgress}
                activeOpacity={0.9}
              >
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardTitle}>Progressive overload</Text>
                  <Text style={styles.cardChevron}>&gt;</Text>
                </View>
                <Text style={styles.cardText}>
                  Velg muskelgruppe og ovelse for a se utviklingen din over tid.
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.analysisCard}
                onPress={onOpenRepMax}
                activeOpacity={0.9}
              >
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardTitle}>Rep for max</Text>
                  <Text style={styles.cardChevron}>&gt;</Text>
                </View>
                <Text style={styles.cardText}>
                  Se hoyeste vekt og antall reps du har tatt for hver ovelse.
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.analysisCard}
                onPress={onOpenAI}
                activeOpacity={0.9}
              >
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardTitle}>Treasy sok</Text>
                  <Text style={styles.cardChevron}>&gt;</Text>
                </View>
                <Text style={styles.cardText}>
                  Spor for eksempel "Hva tok jeg sist i benkpress?" og fa svar fra loggen.
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Litt ekstra luft nederst pa mobil */}
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
    marginBottom: SPACING.xxl,
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
    fontWeight: '500',
    paddingTop: SPACING.xs,
  },
  sectionTitle: {
    color: '#E5E7EB',
    fontSize: TEXT.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: SPACING.sm,
  },
  section: {
    gap: SPACING.md,
    marginBottom: SPACING.xxl,
  },
  blockButton: {
    backgroundColor: '#0B1220',
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1F2937',
    minHeight: 52,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 3,
  },
  blockLabel: {
    fontSize: TEXT.lg,
    fontWeight: '500',
    color: '#F9FAFB',
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
    fontWeight: '600',
    color: '#F9FAFB',
  },
  chevron: {
    fontSize: TEXT.md,
    color: '#9CA3AF',
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
    minHeight: 70,
  },
  actionCard: {
    marginBottom: SPACING.lg,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.xs,
  },
  cardChevron: {
    color: '#94A3B8',
    fontSize: TEXT.md,
  },
  cardTitle: {
    fontSize: TEXT.md,
    fontWeight: '600',
    color: '#F9FAFB',
  },
  cardMeta: {
    fontSize: TEXT.xs,
    color: '#94A3B8',
    marginBottom: SPACING.xs,
  },
  cardBody: {
    marginTop: SPACING.xs,
  },
  cardText: {
    fontSize: TEXT.xs,
    color: '#9CA3AF',
  },
});
