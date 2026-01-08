import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { deleteAllCustomExercises, deleteAllLoggedSets } from '../features/workouts';
import type { AppState } from '../features/workouts/model/types';
import { t } from '../shared/i18n/i18n';
import { RADIUS, SCREEN_PADDING, SPACING, TEXT } from '../shared/theme/tokens';

type Props = {
  appState: AppState;
  onBack: () => void;
  onUpdate: (next: AppState) => void;
};

type PendingAction = null | { type: 'deleteSets' } | { type: 'deleteCustomExercises' };
type PendingActionType = Exclude<PendingAction, null>['type'];

const HOLD_TO_CONFIRM_MS = 1600;

export const SettingsScreen: React.FC<Props> = ({ appState, onBack, onUpdate }) => {
  const language = appState.language ?? 'en';
  const massUnit = appState.massUnit ?? 'kg';
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [holding, setHolding] = useState(false);

  const unitOptions = useMemo(
    () => [
      { id: 'kg' as const, label: t(language, 'settings.units.kg') },
      { id: 'lb' as const, label: t(language, 'settings.units.lb') },
    ],
    [language]
  );

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    };
  }, []);

  const unitPillLabel = massUnit === 'lb' ? t(language, 'units.lb') : t(language, 'units.kg');

  const startHold = () => {
    if (!pendingAction) return;
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    setHolding(true);
    holdTimerRef.current = setTimeout(() => {
      holdTimerRef.current = null;
      setHolding(false);

      if (pendingAction.type === 'deleteSets') {
        onUpdate(deleteAllLoggedSets(appState));
      } else if (pendingAction.type === 'deleteCustomExercises') {
        onUpdate(deleteAllCustomExercises(appState));
      }
      setPendingAction(null);
    }, HOLD_TO_CONFIRM_MS);
  };

  const cancelHold = () => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    holdTimerRef.current = null;
    setHolding(false);
  };

  const requestAction = (type: PendingActionType) => {
    const title = t(language, 'settings.danger.confirmTitle');
    const body =
      type === 'deleteSets'
        ? t(language, 'settings.danger.confirmSetsBody')
        : t(language, 'settings.danger.confirmExercisesBody');

    Alert.alert(title, body, [
      { text: t(language, 'settings.danger.confirmCancel'), style: 'cancel' },
      {
        text: t(language, 'settings.danger.confirmOk'),
        style: 'destructive',
        onPress: () => setPendingAction(type === 'deleteSets' ? { type: 'deleteSets' } : { type: 'deleteCustomExercises' }),
      },
    ]);
  };

  const closeHoldModal = () => {
    cancelHold();
    setPendingAction(null);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={onBack} hitSlop={12} style={styles.backButton} activeOpacity={0.8}>
          <Text style={styles.back}>{t(language, 'back')}</Text>
        </TouchableOpacity>

        <Text style={styles.title}>{t(language, 'settings.title')}</Text>

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>{t(language, 'settings.units.title')}</Text>
            <View style={styles.unitPill}>
              <Text style={styles.unitPillText}>{unitPillLabel.toUpperCase()}</Text>
            </View>
          </View>
          <Text style={styles.cardSubtitle}>{t(language, 'settings.units.weightUnit')}</Text>

          <View style={styles.toggleRow}>
            {unitOptions.map((opt) => {
              const selected = opt.id === massUnit;
              return (
                <TouchableOpacity
                  key={opt.id}
                  onPress={() => onUpdate({ ...appState, massUnit: opt.id })}
                  activeOpacity={0.9}
                  style={[styles.toggleButton, selected ? styles.toggleButtonSelected : styles.toggleButtonUnselected]}
                >
                  <Text style={[styles.toggleText, selected ? styles.toggleTextSelected : styles.toggleTextUnselected]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={[styles.card, styles.dangerCard]}>
          <Text style={styles.cardTitle}>{t(language, 'settings.danger.title')}</Text>

          <TouchableOpacity
            style={[styles.dangerButton, { marginTop: SPACING.md }]}
            activeOpacity={0.9}
            onPress={() => requestAction('deleteSets')}
          >
            <Text style={styles.dangerButtonText}>{t(language, 'settings.danger.deleteSets')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dangerButton, { marginTop: SPACING.sm }]}
            activeOpacity={0.9}
            onPress={() => requestAction('deleteCustomExercises')}
          >
            <Text style={styles.dangerButtonText}>{t(language, 'settings.danger.deleteCustomExercises')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={Boolean(pendingAction)} transparent animationType="fade" onRequestClose={closeHoldModal}>
        <Pressable style={styles.modalBackdrop} onPress={closeHoldModal}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>{t(language, 'settings.danger.confirmTitle')}</Text>
            <Text style={styles.modalBody}>
              {pendingAction?.type === 'deleteSets'
                ? t(language, 'settings.danger.confirmSetsBody')
                : t(language, 'settings.danger.confirmExercisesBody')}
            </Text>

            <Pressable
              style={[styles.holdButton, holding ? styles.holdButtonHolding : null]}
              onPressIn={startHold}
              onPressOut={cancelHold}
              accessibilityRole={Platform.OS === 'web' ? ('button' as any) : undefined}
            >
              <Text style={styles.holdButtonText}>
                {holding ? t(language, 'settings.danger.holdToConfirm') + '…' : t(language, 'settings.danger.holdToConfirm')}
              </Text>
            </Pressable>

            <TouchableOpacity style={styles.modalCancelButton} onPress={closeHoldModal} activeOpacity={0.9}>
              <Text style={styles.modalCancelText}>{t(language, 'cancel')}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
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
    marginBottom: SPACING.lg,
  },
  card: {
    backgroundColor: '#0B1220',
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  dangerCard: {
    marginTop: SPACING.xl,
    borderColor: '#3F1D1D',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  cardTitle: {
    color: '#F9FAFB',
    fontSize: TEXT.md,
    fontWeight: '800',
  },
  cardSubtitle: {
    marginTop: 4,
    color: '#9CA3AF',
    fontSize: TEXT.sm,
    fontWeight: '600',
  },
  unitPill: {
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  unitPillText: {
    color: '#E5E7EB',
    fontSize: TEXT.xs,
    fontWeight: '800',
    letterSpacing: 1,
  },
  toggleRow: {
    marginTop: SPACING.md,
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  toggleButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
  },
  toggleButtonSelected: {
    backgroundColor: '#1D4ED8',
    borderColor: '#60A5FA',
  },
  toggleButtonUnselected: {
    backgroundColor: '#0B1220',
    borderColor: '#1F2937',
  },
  toggleText: {
    fontSize: TEXT.sm,
    fontWeight: '800',
  },
  toggleTextSelected: {
    color: '#F9FAFB',
  },
  toggleTextUnselected: {
    color: '#E5E7EB',
  },
  dangerButton: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#7F1D1D',
    backgroundColor: '#0B1220',
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  dangerButtonText: {
    color: '#FCA5A5',
    fontSize: TEXT.sm,
    fontWeight: '800',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    paddingHorizontal: SCREEN_PADDING,
  },
  modalCard: {
    backgroundColor: '#0B1220',
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  modalTitle: {
    color: '#F9FAFB',
    fontSize: TEXT.lg,
    fontWeight: '900',
  },
  modalBody: {
    marginTop: SPACING.sm,
    color: '#9CA3AF',
    fontSize: TEXT.sm,
    fontWeight: '600',
  },
  holdButton: {
    marginTop: SPACING.lg,
    borderRadius: RADIUS.lg,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7F1D1D',
  },
  holdButtonHolding: {
    backgroundColor: '#991B1B',
  },
  holdButtonText: {
    color: '#F9FAFB',
    fontSize: TEXT.sm,
    fontWeight: '900',
  },
  modalCancelButton: {
    marginTop: SPACING.sm,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    color: '#93C5FD',
    fontSize: TEXT.sm,
    fontWeight: '700',
  },
});
