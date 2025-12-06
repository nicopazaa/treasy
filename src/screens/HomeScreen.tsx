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

type Props = {
  appState: AppState;
  onSelectBlock: (blockId: string) => void;
  onOpenAI: () => void;
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
  'legs',
];

export const HomeScreen: React.FC<Props> = ({
  appState,
  onSelectBlock,
  onOpenAI,
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
              Velg muskelgruppe for å se øvelser og logge økter.
            </Text>
          </View>
          <TouchableOpacity onPress={onOpenProfile} hitSlop={8}>
            <Text style={styles.profileLink}>Profil</Text>
          </TouchableOpacity>
        </View>

        {/* Muskelgrupper */}
        <View style={styles.section}>
          {blocks.map((block) => (
            <TouchableOpacity
              key={block.id}
              style={styles.blockButton}
              onPress={() => onSelectBlock(block.id)}
              activeOpacity={0.9}
            >
              <Text style={styles.blockLabel}>{block.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Analyse – kollapsbar seksjon */}
        <View style={styles.analysisWrapper}>
          <TouchableOpacity
            style={styles.analysisHeaderRow}
            onPress={() => setAnalysisOpen((v) => !v)}
            activeOpacity={0.8}
          >
            <Text style={styles.analysisTitle}>Analyse</Text>
            <Text style={styles.chevron}>{analysisOpen ? '▲' : '▼'}</Text>
          </TouchableOpacity>

          {analysisOpen && (
            <View style={styles.analysisCards}>
              <TouchableOpacity
                style={styles.analysisCard}
                onPress={onOpenHistory}
                activeOpacity={0.9}
              >
                <Text style={styles.cardTitle}>Tidligere økter</Text>
                <Text style={styles.cardText}>
                  Se komplette økter per dag – alle øvelser, uansett muskelgruppe.
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.analysisCard}
                onPress={onOpenProgress}
                activeOpacity={0.9}
              >
                <Text style={styles.cardTitle}>Progressive overload</Text>
                <Text style={styles.cardText}>
                  Velg muskelgruppe og øvelse for å se utviklingen din over tid.
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.analysisCard}
                onPress={onOpenRepMax}
                activeOpacity={0.9}
              >
                <Text style={styles.cardTitle}>Rep for max</Text>
                <Text style={styles.cardText}>
                  Se høyeste vekt og antall reps du har tatt for hver øvelse.
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Treasy AI */}
        <View style={styles.aiCard}>
          <Text style={styles.aiTitle}>Treasy AI</Text>
          <Text style={styles.aiText}>
            Spør f.eks: &quot;Hva tok jeg sist i benkpress?&quot; så svarer Treasy
            basert på loggen din.
          </Text>
          <TouchableOpacity style={styles.aiButton} onPress={onOpenAI} activeOpacity={0.9}>
            <Text style={styles.aiButtonLabel}>Åpne AI</Text>
          </TouchableOpacity>
        </View>

        {/* Litt ekstra luft nederst på mobil */}
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
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  headerTextWrapper: {
    flex: 1,
    paddingRight: 16,
  },
  greeting: {
    fontSize: 32,
    fontWeight: '700',
    color: '#F9FAFB',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  profileLink: {
    fontSize: 15,
    color: '#60A5FA',
    fontWeight: '500',
    paddingTop: 4,
  },
  section: {
    gap: 12,
    marginBottom: 28,
  },
  blockButton: {
    backgroundColor: '#0B1220',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 3,
  },
  blockLabel: {
    fontSize: 18,
    fontWeight: '500',
    color: '#F9FAFB',
  },
  analysisWrapper: {
    marginTop: 8,
    marginBottom: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#1F2937',
    paddingTop: 16,
  },
  analysisHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  analysisTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#F9FAFB',
  },
  chevron: {
    fontSize: 16,
    color: '#9CA3AF',
  },
  analysisCards: {
    gap: 12,
  },
  analysisCard: {
    backgroundColor: '#020617',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F9FAFB',
    marginBottom: 4,
  },
  cardText: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  aiCard: {
    backgroundColor: '#020617',
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  aiTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F9FAFB',
    marginBottom: 4,
  },
  aiText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 16,
  },
  aiButton: {
    marginTop: 4,
    borderRadius: 999,
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F9FAFB',
  },
});
