import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from 'react-native';
import { AppState } from '../types';
import { PrimaryButton } from '../components/PrimaryButton';
import {
  parseQuickLog,
  findExerciseByName,
  inferBlockIdFromExercise,
  ParsedSet,
} from '../services/quickLogService';
import { getBlockTone } from '../utils/blockTone';
import { SPACING, TEXT, RADIUS } from '../theme/tokens';

type Props = {
  appState: AppState;
  onBack: () => void;
  onLogExisting: (exerciseId: string, sets: ParsedSet[]) => void;
  onLogNew: (blockId: string, exerciseName: string, sets: ParsedSet[]) => void;
};

export const QuickLogScreen: React.FC<Props> = ({
  appState,
  onBack,
  onLogExisting,
  onLogNew,
}) => {
  const [input, setInput] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const parsed = useMemo(() => parseQuickLog(input), [input]);
  const existingExercise = parsed
    ? findExerciseByName(appState, parsed.exerciseName)
    : null;
  const inferredBlockId = parsed ? inferBlockIdFromExercise(parsed.exerciseName) : null;
  const fallbackBlockId = inferredBlockId ?? appState.blocks[0]?.id ?? null;
  const fallbackBlockName = fallbackBlockId
    ? appState.blocks.find((b) => b.id === fallbackBlockId)?.name ?? 'Ukjent'
    : 'Ukjent';
  const tone = getBlockTone(existingExercise?.blockId ?? fallbackBlockId ?? '');

  const handleLogExisting = () => {
    if (!parsed || !existingExercise) return;
    onLogExisting(existingExercise.id, parsed.sets);
    setNotice(`Logget ${parsed.sets.length} sett i ${existingExercise.name}.`);
    setInput('');
  };

  const handleCreateAndLog = () => {
    if (!parsed || existingExercise || !fallbackBlockId) return;
    onLogNew(fallbackBlockId, parsed.exerciseName, parsed.sets);
    setNotice(`Opprettet ${parsed.exerciseName} og logget ${parsed.sets.length} sett.`);
    setInput('');
  };

  const hasInput = input.trim().length > 0;
  const canLogExisting = Boolean(parsed && existingExercise);
  const canCreate = Boolean(parsed && !existingExercise && fallbackBlockId);

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.back}>{'< Tilbake'}</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Hurtiglogg</Text>
      <Text style={styles.subtitle}>
        Skriv en ovelse og settene dine. Eksempel: Benk 80x2, 70x5, 60x8
      </Text>

      <View style={styles.inputCard}>
        <Text style={styles.inputLabel}>Logg</Text>
        <TextInput
          style={styles.input}
          placeholder="Benk 80x2, 70x5, 60x8"
          placeholderTextColor="#6B7280"
          value={input}
          onChangeText={setInput}
          autoCapitalize="sentences"
          multiline
        />
      </View>

      {notice ? <Text style={styles.notice}>{notice}</Text> : null}

      {!parsed && hasInput ? (
        <Text style={styles.error}>
          Finner ikke ovelse og sett. Skriv for eksempel: Benk 80x2, 70x5
        </Text>
      ) : null}

      {parsed ? (
        <View style={[styles.previewCard, { borderColor: tone.accent }]}>
          <Text style={styles.previewTitle}>Forhandsvisning</Text>
          <Text style={[styles.previewExercise, { color: tone.accent }]}>
            {parsed.exerciseName}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.previewSetsRow}>
              {parsed.sets.map((set, index) => (
                <View key={`${set.weight}-${set.reps}-${index}`} style={styles.setPill}>
                  <Text style={styles.setPillText}>
                    {set.weight} kg x {set.reps}
                  </Text>
                </View>
              ))}
            </View>
          </ScrollView>

          {!existingExercise ? (
            <Text style={styles.previewHint}>
              Forslag til blokk: {fallbackBlockName}
            </Text>
          ) : (
            <Text style={styles.previewHint}>
              Bruker eksisterende ovelse i loggen din.
            </Text>
          )}
        </View>
      ) : null}

      <View style={styles.actionBar}>
        {canLogExisting ? (
          <PrimaryButton title="Logg sett" onPress={handleLogExisting} />
        ) : null}
        {canCreate ? (
          <PrimaryButton title="Opprett ovelse og logg" onPress={handleCreateAndLog} />
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xxxl,
  },
  back: {
    color: '#93C5FD',
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: TEXT.xl,
    fontWeight: '700',
    color: '#F9FAFB',
  },
  subtitle: {
    marginTop: SPACING.xs,
    color: '#9CA3AF',
    fontSize: TEXT.sm,
  },
  inputCard: {
    marginTop: SPACING.lg,
    backgroundColor: '#0B1220',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  inputLabel: {
    color: '#E5E7EB',
    fontSize: TEXT.xs,
    marginBottom: SPACING.xs,
  },
  input: {
    minHeight: 96,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#111827',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    color: '#F9FAFB',
    fontSize: TEXT.md,
    backgroundColor: '#020617',
  },
  notice: {
    color: '#86EFAC',
    marginTop: SPACING.sm,
    fontSize: TEXT.sm,
  },
  error: {
    color: '#FCA5A5',
    marginTop: SPACING.sm,
    fontSize: TEXT.sm,
  },
  previewCard: {
    marginTop: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: SPACING.md,
    backgroundColor: '#0B1220',
  },
  previewTitle: {
    color: '#E5E7EB',
    fontSize: TEXT.sm,
    marginBottom: SPACING.xs,
  },
  previewExercise: {
    fontSize: TEXT.lg,
    fontWeight: '700',
  },
  previewSetsRow: {
    flexDirection: 'row',
    marginTop: SPACING.sm,
  },
  setPill: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.pill,
    backgroundColor: '#111827',
    marginRight: SPACING.sm,
  },
  setPillText: {
    color: '#E5E7EB',
    fontSize: TEXT.xs,
  },
  previewHint: {
    marginTop: SPACING.sm,
    color: '#9CA3AF',
    fontSize: TEXT.xs,
  },
  actionBar: {
    marginTop: SPACING.lg,
  },
});
