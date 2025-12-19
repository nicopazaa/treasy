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

  const greeting = appState.nickname && appState.nickname.trim().length > 0
    ? `Hei, ${appState.nickname}`
    : 'Hei';

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
              Velg muskelgruppe for A se A,velser og logge A,kter.
            </Text>
          </View>
          <TouchableOpacity onPress={onOpenProfile} hitSlop={8}>
            <Text style={styles.profileLink}>Profil</Text>
          </TouchableOpacity>
        </View>

        {/* Muskelgrupper */}
        <Text style={styles.sectionTitle}>Velg muskelgruppe</Text>
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

        {/* Handlinger */}
        <Text style={styles.sectionTitle}>Handlinger</Text>

        <TouchableOpacity
          style={[styles.analysisCard, styles.quickLogCard]}
          onPress={onOpenQuickLog}
          activeOpacity={0.9}
        >
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Hurtiglogg</Text>
            <Text style={styles.cardChevron}>&gt;</Text>
          </View>
          <Text style={styles.cardText}>
            Skriv for eksempel: Benk 80x2, 70x5, 60x8
          </Text>
        </TouchableOpacity>

        <View style={styles.analysisWrapper}>
          <TouchableOpacity
            style={styles.analysisHeaderRow}
            onPress={() => setAnalysisOpen((v) => !v)}
            activeOpacity={0.8}
          >
            <Text style={styles.analysisTitle}>Analyse</Text>
            <Text style={styles.chevron}>{analysisOpen ? 'ƒ-ý' : 'ƒ-¬'}</Text>
          </TouchableOpacity>

          {analysisOpen && (
            <View style={styles.analysisCards}>
              <TouchableOpacity
                style={styles.analysisCard}
                onPress={onOpenHistory}
                activeOpacity={0.9}
              >
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardTitle}>Tidligere A,kter</Text>
                  <Text style={styles.cardChevron}>&gt;</Text>
                </View>
                <Text style={styles.cardText}>
                  Se komplette A,kter per dag ƒ?" alle A,velser, uansett muskelgruppe.
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
                  Velg muskelgruppe og A,velse for A se utviklingen din over tid.
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
                  Se hA,yeste vekt og antall reps du har tatt for hver A,velse.
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Treasy AI */}
        <View style={styles.aiCard}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.aiTitle}>Treasy AI</Text>
            <Text style={styles.cardChevron}>&gt;</Text>
          </View>
          <Text style={styles.aiText}>
            SpA,r f.eks: &quot;Hva tok jeg sist i benkpress?&quot; sA svarer Treasy
            basert pA loggen din.
          </Text>
          <TouchableOpacity style={styles.aiButton} onPress={onOpenAI} activeOpacity={0.9}>
            <Text style={styles.aiButtonLabel}>A.pne AI</Text>
          </TouchableOpacity>
        </View>

        {/* Litt ekstra luft nederst pA mobil */}
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
  quickLogCard: {
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
  cardText: {
    fontSize: TEXT.xs,
    color: '#9CA3AF',
  },
  aiCard: {
    backgroundColor: '#0B1220',
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  aiTitle: {
    fontSize: TEXT.lg,
    fontWeight: '700',
    color: '#F9FAFB',
  },
  aiText: {
    fontSize: TEXT.sm,
    color: '#9CA3AF',
    marginBottom: SPACING.lg,
  },
  aiButton: {
    marginTop: SPACING.xs,
    borderRadius: RADIUS.pill,
    backgroundColor: '#3B82F6',
    paddingVertical: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  aiButtonLabel: {
    fontSize: TEXT.md,
    fontWeight: '600',
    color: '#F9FAFB',
  },
});
