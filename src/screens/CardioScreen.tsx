import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AppLanguage, CardioEntry } from '../features/workouts';
import { SPACING, TEXT, SCREEN_PADDING, RADIUS } from '../shared/theme/tokens';
import { now } from '../shared/time';

type Props = {
  language: AppLanguage;
  cardioEntries: CardioEntry[];
  exerciseId?: string | null;
  onBack: () => void;
  onSave: (data: {
    durationMin: number;
    avgHeartRate?: number | null;
    intensity?: 'easy' | 'moderate' | 'hard' | null;
    note?: string | null;
    silentMode?: boolean;
    exerciseId?: string | null;
  }) => void;
};

type SessionState = 'idle' | 'running' | 'paused' | 'summary';
type IntervalId = ReturnType<typeof setInterval>;

const formatTime = (ms: number) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
};

export const CardioScreen: React.FC<Props> = ({ language, cardioEntries, onBack, onSave, exerciseId }) => {
  const [state, setState] = useState<SessionState>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [silentMode, setSilentMode] = useState(false);
  const [intensity, setIntensity] = useState<'easy' | 'moderate' | 'hard' | null>(null);
  const [note, setNote] = useState('');
  const [avgHeartRate, setAvgHeartRate] = useState<string>('');
  const [targetMinutes, setTargetMinutes] = useState<number | null>(null);
  const [sprintSec, setSprintSec] = useState('20');
  const [restSec, setRestSec] = useState('10');
  const [rounds, setRounds] = useState('10');
  const startRef = useRef<number | null>(null);
  const timerRef = useRef<IntervalId | null>(null);

  const streakDays = useMemo(() => {
    const keys = new Set<string>();
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 6);
    for (const entry of cardioEntries ?? []) {
      const d = new Date(entry.createdAt);
      if (d >= sevenDaysAgo && d <= now) {
        keys.add(entry.createdAt.slice(0, 10));
      }
    }
    return keys.size;
  }, [cardioEntries]);

  useEffect(() => {
    if (state !== 'running') {
      if (timerRef.current != null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    timerRef.current = setInterval(() => {
      if (startRef.current == null) return;
      setElapsedMs(now() - startRef.current);
    }, 250);

    return () => {
      if (timerRef.current != null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [state]);

  const startSession = (keepTarget?: boolean) => {
    setTargetMinutes((prev) => (keepTarget && prev && state === 'idle' ? prev : null));
    startRef.current = now();
    setElapsedMs(0);
    setState('running');
  };

  const togglePause = () => {
    if (state === 'running') {
      setState('paused');
      if (timerRef.current != null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    } else if (state === 'paused') {
      startRef.current = now() - elapsedMs;
      setState('running');
    }
  };

  const finishSession = () => {
    if (timerRef.current != null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setState('summary');
  };

  const startWithPreset = (label: string, minutes: number, presetNote?: string) => {
    setNote(presetNote ?? label);
    setTargetMinutes(minutes);
    startSession(true);
  };

  const planIntervals = () => {
    const s = Math.max(0, Number(sprintSec) || 0);
    const r = Math.max(0, Number(restSec) || 0);
    const n = Math.max(1, Number(rounds) || 1);
    const totalSec = (s + r) * n;
    const mins = Math.max(1, Math.round(totalSec / 60));
    const text = `Intervaller: ${s}s spurt / ${r}s pause x${n}`;
    setNote(text);
    setTargetMinutes(mins);
    startSession(true);
  };

  const handleSave = () => {
    const durationMin = Math.max(1, Math.round(elapsedMs / 60000));
    const hr = avgHeartRate.trim();
    onSave({
      durationMin,
      avgHeartRate: hr ? Number(hr) : null,
      intensity,
      note: note.trim() || null,
      silentMode,
      exerciseId,
    });
  };

  const liveTime = formatTime(elapsedMs);

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={12} activeOpacity={0.85}>
          <Text style={styles.back}>{language === 'es' ? '< Atrás' : '< Tilbake'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Cardio</Text>
        <Text style={styles.subtitle}>Tid, puls, flyt. Ingen sett/vekt.</Text>

        {state === 'idle' ? (
          <View style={styles.stack}>
            <View style={styles.quickRow}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => startWithPreset('Rolig 10 min', 10, 'Rolig 10 min')}
                activeOpacity={0.9}
              >
                <Text style={styles.secondaryButtonText}>Rolig 10 min</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => startWithPreset('Tempo 20 min', 20, 'Tempo 20 min')}
                activeOpacity={0.9}
              >
                <Text style={styles.secondaryButtonText}>Tempo 20 min</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.intervalCard}>
              <Text style={styles.sectionTitle}>Intervaller</Text>
              <View style={styles.inputsRow}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Spurt (s)</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={sprintSec}
                    onChangeText={setSprintSec}
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Pause (s)</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={restSec}
                    onChangeText={setRestSec}
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Runder</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={rounds}
                    onChangeText={setRounds}
                  />
                </View>
              </View>
              <TouchableOpacity style={styles.primaryButton} onPress={planIntervals} activeOpacity={0.9}>
                <Text style={styles.primaryButtonText}>Start intervaller</Text>
              </TouchableOpacity>
              <Text style={styles.hint}>f.eks 20s spurt / 10s pause x10</Text>
            </View>

            <TouchableOpacity style={styles.primaryButton} onPress={() => startSession()} activeOpacity={0.9}>
              <Text style={styles.primaryButtonText}>Start cardio</Text>
            </TouchableOpacity>
            <Text style={styles.hint}>10 min er nok i dag</Text>
            <Text style={styles.subtle}>Cardio-streak: {streakDays} dager siste 7</Text>
          </View>
        ) : null}

        {state === 'running' || state === 'paused' ? (
          <View style={[styles.livePanel, silentMode && styles.liveSilent]}>
            {!silentMode ? (
              <>
                <Text style={styles.timerLabel}>⏱️</Text>
                <Text style={styles.timer}>{liveTime}</Text>
                <Text style={styles.pulse}>❤️ {avgHeartRate ? `${avgHeartRate} bpm` : 'Ingen puls'}</Text>
              </>
            ) : (
              <Text style={styles.silentText}>Stillhets-modus på</Text>
            )}

            <View style={styles.liveActions}>
              <TouchableOpacity style={styles.secondaryButton} onPress={togglePause} activeOpacity={0.85}>
                <Text style={styles.secondaryButtonText}>{state === 'paused' ? 'Fortsett' : 'Pause'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.ghostButton} onPress={finishSession} activeOpacity={0.85}>
                <Text style={styles.ghostButtonText}>Ferdig</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={() => setSilentMode((v) => !v)} activeOpacity={0.85}>
              <Text style={styles.link}>{silentMode ? 'Vis tall' : 'Stillhets-modus'}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {state === 'summary' ? (
          <View style={styles.summary}>
            <Text style={styles.sectionTitle}>Oppsummering</Text>
            <Text style={styles.summaryLine}>Tid: {liveTime}</Text>
            {avgHeartRate ? <Text style={styles.summaryLine}>Puls: {avgHeartRate} bpm</Text> : null}
            {targetMinutes ? <Text style={styles.summaryLine}>Mål: ca {targetMinutes} min</Text> : null}

            <Text style={styles.sectionTitle}>Hvordan føltes økta?</Text>
            <View style={styles.feelingsRow}>
              {[
                { key: 'easy', label: '😌 Rolig' },
                { key: 'moderate', label: '🙂 Fin flyt' },
                { key: 'hard', label: '😤 Hard' },
              ].map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.feelingButton, intensity === opt.key && styles.feelingSelected]}
                  onPress={() => setIntensity(opt.key as any)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.feelingText}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Notat (valgfri)</Text>
            <TextInput
              style={styles.input}
              placeholder="En linje"
              placeholderTextColor="#6B7280"
              value={note}
              onChangeText={setNote}
            />

            <Text style={styles.inputLabel}>Snittpuls (valgfri)</Text>
            <TextInput
              style={styles.input}
              placeholder="f.eks. 135"
              placeholderTextColor="#6B7280"
              keyboardType="numeric"
              value={avgHeartRate}
              onChangeText={setAvgHeartRate}
            />

            <TouchableOpacity style={styles.primaryButton} onPress={handleSave} activeOpacity={0.9}>
              <Text style={styles.primaryButtonText}>Lagre cardio</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#020617',
    paddingTop: Platform.OS === 'ios' ? SPACING.sm : SPACING.xxxl,
    ...Platform.select({
      web: { width: '100%', maxWidth: 720, alignSelf: 'center' },
    }),
  },
  header: {
    paddingHorizontal: SCREEN_PADDING,
    marginBottom: SPACING.sm,
  },
  back: {
    color: '#93C5FD',
    fontSize: TEXT.sm,
    fontWeight: '600',
  },
  card: {
    marginHorizontal: SCREEN_PADDING,
    backgroundColor: '#081126',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#123265',
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  title: {
    color: '#E5E7EB',
    fontSize: TEXT.lg,
    fontWeight: '800',
  },
  subtitle: {
    color: '#9CA3AF',
    fontSize: TEXT.sm,
  },
  stack: {
    gap: SPACING.sm,
  },
  primaryButton: {
    backgroundColor: '#2E7CF6',
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#F9FAFB',
    fontSize: TEXT.md,
    fontWeight: '700',
  },
  hint: {
    color: '#9CA3AF',
    fontSize: TEXT.xs,
  },
  subtle: {
    color: '#6B7280',
    fontSize: TEXT.xs,
  },
  livePanel: {
    gap: SPACING.sm,
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#123265',
    backgroundColor: '#0A1A33',
  },
  liveSilent: {
    backgroundColor: '#071125',
    borderColor: '#0E1E3E',
  },
  timerLabel: {
    fontSize: TEXT.lg,
    color: '#9CA3AF',
  },
  timer: {
    fontSize: 48,
    fontWeight: '800',
    color: '#F9FAFB',
    letterSpacing: 1,
  },
  pulse: {
    color: '#93C5FD',
    fontSize: TEXT.sm,
    fontWeight: '700',
  },
  silentText: {
    color: '#9CA3AF',
    fontSize: TEXT.sm,
    fontWeight: '700',
  },
  liveActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  secondaryButton: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md,
    backgroundColor: '#0E1E3E',
    borderWidth: 1,
    borderColor: '#123265',
  },
  secondaryButtonText: {
    color: '#E5E7EB',
    fontSize: TEXT.sm,
    fontWeight: '700',
  },
  ghostButton: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#123265',
  },
  ghostButtonText: {
    color: '#93C5FD',
    fontSize: TEXT.sm,
    fontWeight: '700',
  },
  link: {
    color: '#93C5FD',
    fontSize: TEXT.sm,
    fontWeight: '700',
  },
  summary: {
    gap: SPACING.sm,
  },
  sectionTitle: {
    color: '#E5E7EB',
    fontSize: TEXT.md,
    fontWeight: '800',
    marginTop: SPACING.sm,
  },
  summaryLine: {
    color: '#9CA3AF',
    fontSize: TEXT.sm,
  },
  quickRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  intervalCard: {
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#123265',
    backgroundColor: '#0B1220',
  },
  inputsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  inputGroup: {
    flex: 1,
  },
  feelingsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  feelingButton: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#123265',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: '#0E1E3E',
  },
  feelingSelected: {
    backgroundColor: '#123265',
  },
  feelingText: {
    color: '#E5E7EB',
    fontWeight: '700',
  },
  inputLabel: {
    color: '#9CA3AF',
    fontSize: TEXT.xs,
    marginTop: SPACING.xs,
  },
  input: {
    backgroundColor: '#0B1220',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#1F2937',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    color: '#F9FAFB',
    fontSize: TEXT.md,
  },
});
