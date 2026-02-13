import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { deleteAllCustomExercises, deleteAllLoggedSets } from '../features/workouts';
import type { AppState } from '../features/workouts';
import { LANGUAGE_OPTIONS, t } from '../shared/i18n/i18n';
import { now } from '../shared/time';
import { toggleThemeMode } from '../shared/theme/themes';
import { RADIUS, SCREEN_PADDING, SPACING, TEXT } from '../shared/theme/tokens';
import { PrimaryButton } from '../shared/ui/PrimaryButton';
import { fromKg, roundForDisplay, toKg } from '../shared/utils/units';

type Props = {
  appState: AppState;
  onBack: () => void;
  onUpdate: (next: AppState) => void;
  onOpenLogin: () => void;
  onOpenManageExercises: () => void;
};

type PendingAction = null | { type: 'deleteSets' } | { type: 'deleteCustomExercises' };
type PendingActionType = Exclude<PendingAction, null>['type'];
type ActiveSection = 'menu' | 'profile' | 'language_units' | 'manage_exercises' | 'other';

const HOLD_TO_CONFIRM_MS = 1600;

export const SettingsScreen: React.FC<Props> = ({
  appState,
  onBack,
  onUpdate,
  onOpenLogin,
  onOpenManageExercises,
}) => {
  const language = appState.language ?? 'en';
  const massUnit = appState.massUnit ?? 'kg';
  const unitLabel = massUnit === 'lb' ? t(language, 'units.lb') : t(language, 'units.kg');

  const [nickname, setNickname] = useState(appState.nickname ?? '');
  const [height, setHeight] = useState(appState.heightCm != null ? String(appState.heightCm) : '');
  const [weight, setWeight] = useState(() => {
    if (appState.weightKg == null) return '';
    const converted = fromKg(appState.weightKg, massUnit);
    const rounded = roundForDisplay(converted, massUnit);
    const locale = language === 'nb' ? 'nb-NO' : language === 'es' ? 'es-ES' : 'en-US';

    try {
      return new Intl.NumberFormat(locale, {
        maximumFractionDigits: massUnit === 'lb' ? 0 : 1,
        minimumFractionDigits: 0,
        useGrouping: false,
      }).format(rounded);
    } catch {
      const raw = massUnit === 'lb' ? String(Math.round(rounded)) : String(rounded);
      return language === 'nb' || language === 'es' ? raw.replace('.', ',') : raw;
    }
  });
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<ActiveSection>('menu');

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
  const languageAndUnitsLabel = language === 'nb' ? 'Språk og enhet' : language === 'es' ? 'Idioma y unidades' : 'Language and units';
  const themeTitle = language === 'nb' ? 'Tema' : language === 'es' ? 'Tema' : 'Theme';
  const themeSubtitle =
    language === 'nb'
      ? 'Bytt mellom mørk og lys hjem-visning.'
      : language === 'es'
        ? 'Alterna entre modo oscuro y claro para Inicio.'
        : 'Switch between dark and light Home mode.';
  const themeButtonLabel = language === 'nb' ? 'Bytt tema' : language === 'es' ? 'Cambiar tema' : 'Toggle theme';
  const themeBadgeLabel =
    appState.theme === 'calmLight'
      ? language === 'nb'
        ? 'LYS'
        : language === 'es'
          ? 'CLARO'
          : 'LIGHT'
      : language === 'nb'
        ? 'MØRK'
        : language === 'es'
          ? 'OSCURO'
          : 'DARK';
  const toggleSection = (section: Exclude<ActiveSection, 'menu'>) => {
    setActiveSection((prev) => (prev === section ? 'menu' : section));
  };
  const sectionChevron = (section: Exclude<ActiveSection, 'menu'>): string =>
    activeSection === section ? '\u2304' : '\u203A';

  const handleSaveProfile = () => {
    const trimmedNickname = nickname.trim();
    const parsedWeight = weight.trim() ? Number(weight.trim().replace(',', '.')) : null;
    const weightKg =
      parsedWeight != null && Number.isFinite(parsedWeight) && parsedWeight > 0 ? toKg(parsedWeight, massUnit) : null;

    const next: AppState = {
      ...appState,
      nickname: trimmedNickname || null,
      heightCm: height ? Number(height) || null : null,
      weightKg: weightKg != null && Number.isFinite(weightKg) ? weightKg : null,
    };

    onUpdate(next);
    onBack();
  };

  const handleToggleTheme = () => {
    onUpdate({ ...appState, theme: toggleThemeMode(appState.theme) });
  };

  const buildBackupJson = (): string =>
    JSON.stringify(
      {
        version: 1,
        exportedAt: new Date().toISOString(),
        state: appState,
      },
      null,
      2
    );

  const handleDownloadBackup = async () => {
    try {
      if (Platform.OS !== 'web' || typeof window === 'undefined') {
        setExportStatus(t(language, 'backupWebOnly'));
        return;
      }
      const data = buildBackupJson();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `treasy-backup-${now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setExportStatus(t(language, 'backupDownloaded'));
    } catch {
      setExportStatus(t(language, 'backupFailed'));
    }
  };

  const handleSaveLocalBackup = async () => {
    try {
      const data = buildBackupJson();
      await AsyncStorage.setItem('treasy_backup_export', data);
      setExportStatus(t(language, 'backupSavedLocal'));
    } catch {
      setExportStatus(t(language, 'backupFailed'));
    }
  };

  const handleCopyBackup = async () => {
    const data = buildBackupJson();
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(data);
        setExportStatus(t(language, 'backupCopied'));
      } else {
        setExportStatus(t(language, 'backupCopyUnavailable'));
      }
    } catch {
      setExportStatus(t(language, 'backupCopyUnavailable'));
    }
  };

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
        onPress: () =>
          setPendingAction(type === 'deleteSets' ? { type: 'deleteSets' } : { type: 'deleteCustomExercises' }),
      },
    ]);
  };

  const closeHoldModal = () => {
    cancelHold();
    setPendingAction(null);
  };

  const authLine =
    appState.authProvider === 'github'
      ? t(language, 'loggedInWithGithub')
      : appState.authProvider === 'email'
        ? t(language, 'loggedInWithEmail')
        : t(language, 'continuingWithoutLogin');

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <TouchableOpacity onPress={onBack} hitSlop={12} style={styles.backButton} activeOpacity={0.8}>
            <Text style={styles.back}>{t(language, 'back')}</Text>
          </TouchableOpacity>

          <Text style={styles.title}>{t(language, 'settings.title')}</Text>

          <View style={styles.accordionList}>
            <View style={styles.accordionItem}>
              <TouchableOpacity style={styles.accordionHeader} onPress={() => toggleSection('profile')} activeOpacity={0.85}>
                <Text style={styles.accordionHeaderTitle}>{t(language, 'profileTitle')}</Text>
                <Text style={[styles.accordionHeaderChevron, activeSection === 'profile' ? styles.accordionHeaderChevronOpen : null]}>
                  {sectionChevron('profile')}
                </Text>
              </TouchableOpacity>
              {activeSection === 'profile' ? (
                <View style={styles.accordionBody}>
                  <View style={styles.card}>
                    <Text style={styles.label}>{authLine}</Text>
                    {appState.userEmail ? <Text style={styles.helper}>{appState.userEmail}</Text> : null}
                    {appState.authProvider === 'guest' ? (
                      <TouchableOpacity style={styles.secondaryButton} onPress={onOpenLogin} activeOpacity={0.9}>
                        <Text style={styles.secondaryButtonText}>{t(language, 'login')}</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  <View style={styles.card}>
                    <Text style={styles.label}>{t(language, 'nickname')}</Text>
                    <TextInput
                      style={styles.input}
                      placeholder={t(language, 'nicknamePlaceholder')}
                      placeholderTextColor="#4B5563"
                      value={nickname}
                      onChangeText={setNickname}
                    />

                    <Text style={[styles.label, styles.inputLabelTop]}>{t(language, 'heightCm')}</Text>
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      placeholder={t(language, 'heightPlaceholder')}
                      placeholderTextColor="#4B5563"
                      value={height}
                      onChangeText={setHeight}
                    />

                    <Text style={[styles.label, styles.inputLabelTop]}>{t(language, 'weightKg', { unit: unitLabel })}</Text>
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      placeholder={t(language, 'weightPlaceholder')}
                      placeholderTextColor="#4B5563"
                      value={weight}
                      onChangeText={setWeight}
                    />
                  </View>

                  <View style={styles.buttonWrap}>
                    <PrimaryButton title={t(language, 'save')} onPress={handleSaveProfile} />
                  </View>
                </View>
              ) : null}
            </View>

            <View style={styles.accordionItem}>
              <TouchableOpacity style={styles.accordionHeader} onPress={() => toggleSection('language_units')} activeOpacity={0.85}>
                <Text style={styles.accordionHeaderTitle}>{languageAndUnitsLabel}</Text>
                <Text style={[styles.accordionHeaderChevron, activeSection === 'language_units' ? styles.accordionHeaderChevronOpen : null]}>
                  {sectionChevron('language_units')}
                </Text>
              </TouchableOpacity>
              {activeSection === 'language_units' ? (
                <View style={styles.accordionBody}>
                  <View style={styles.card}>
                    <Text style={styles.label}>{t(language, 'language')}</Text>
                    <View style={styles.languageRow}>
                      {LANGUAGE_OPTIONS.map((opt) => {
                        const selected = opt.id === language;
                        return (
                          <TouchableOpacity
                            key={opt.id}
                            style={[styles.languageButton, selected && styles.languageButtonSelected]}
                            onPress={() => onUpdate({ ...appState, language: opt.id })}
                            activeOpacity={0.9}
                          >
                            <Text style={[styles.languageText, selected && styles.languageTextSelected]}>{opt.label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

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

                  <View style={styles.card}>
                    <View style={styles.cardHeaderRow}>
                      <Text style={styles.cardTitle}>{themeTitle}</Text>
                      <View style={styles.unitPill}>
                        <Text style={styles.unitPillText}>{themeBadgeLabel}</Text>
                      </View>
                    </View>
                    <Text style={styles.cardSubtitle}>{themeSubtitle}</Text>

                    <TouchableOpacity style={styles.manageButton} onPress={handleToggleTheme} activeOpacity={0.9}>
                      <Text style={styles.manageButtonText}>{themeButtonLabel}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}
            </View>

            <View style={styles.accordionItem}>
              <TouchableOpacity style={styles.accordionHeader} onPress={() => toggleSection('manage_exercises')} activeOpacity={0.85}>
                <Text style={styles.accordionHeaderTitle}>{t(language, 'manageExercises')}</Text>
                <Text style={[styles.accordionHeaderChevron, activeSection === 'manage_exercises' ? styles.accordionHeaderChevronOpen : null]}>
                  {sectionChevron('manage_exercises')}
                </Text>
              </TouchableOpacity>
              {activeSection === 'manage_exercises' ? (
                <View style={styles.accordionBody}>
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>{t(language, 'manageExercises')}</Text>
                    <Text style={styles.cardSubtitle}>{t(language, 'manageExercisesSettingsHint')}</Text>

                    <TouchableOpacity style={styles.manageButton} onPress={onOpenManageExercises} activeOpacity={0.9}>
                      <Text style={styles.manageButtonText}>{t(language, 'manageExercises')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : null}
            </View>

            <View style={[styles.accordionItem, styles.accordionItemLast]}>
              <TouchableOpacity style={styles.accordionHeader} onPress={() => toggleSection('other')} activeOpacity={0.85}>
                <Text style={styles.accordionHeaderTitle}>{t(language, 'otherSectionTitle')}</Text>
                <Text style={[styles.accordionHeaderChevron, activeSection === 'other' ? styles.accordionHeaderChevronOpen : null]}>
                  {sectionChevron('other')}
                </Text>
              </TouchableOpacity>
              {activeSection === 'other' ? (
                <View style={styles.accordionBody}>
                  <View style={styles.card}>
                    <Text style={styles.cardTitle}>{t(language, 'backupTitle')}</Text>
                    <Text style={styles.helper}>{t(language, 'backupInfo')}</Text>
                    <View style={styles.backupButtons}>
                      <TouchableOpacity style={styles.secondaryButton} onPress={handleDownloadBackup} activeOpacity={0.9}>
                        <Text style={styles.secondaryButtonText}>{t(language, 'backupDownloadWeb')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.secondaryButton} onPress={handleSaveLocalBackup} activeOpacity={0.9}>
                        <Text style={styles.secondaryButtonText}>{t(language, 'backupSaveLocal')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.secondaryButton} onPress={handleCopyBackup} activeOpacity={0.9}>
                        <Text style={styles.secondaryButtonText}>{t(language, 'backupCopy')}</Text>
                      </TouchableOpacity>
                    </View>
                    {exportStatus ? <Text style={[styles.helper, styles.statusText]}>{exportStatus}</Text> : null}
                  </View>

                  <View style={[styles.card, styles.dangerCard]}>
                    <Text style={styles.cardTitle}>{t(language, 'settings.danger.title')}</Text>
                    <TouchableOpacity
                      style={[styles.dangerButton, { marginTop: SPACING.xs }]}
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
                </View>
              ) : null}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

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
                {holding
                  ? `${t(language, 'settings.danger.holdToConfirm')}...`
                  : t(language, 'settings.danger.holdToConfirm')}
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
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  content: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: Platform.OS === 'ios' ? SPACING.xs : SPACING.lg,
    paddingBottom: SPACING.xxl,
    ...Platform.select({
      web: { width: '100%', maxWidth: 720, alignSelf: 'center' },
    }),
  },
  backButton: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    marginBottom: SPACING.xs,
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
    marginBottom: SPACING.md,
  },
  accordionList: {
    borderWidth: 1,
    borderColor: '#1F2937',
    borderRadius: RADIUS.lg,
    backgroundColor: '#07101F',
    overflow: 'hidden',
    marginBottom: SPACING.lg,
  },
  accordionItem: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1F2937',
  },
  accordionItemLast: {
    borderBottomWidth: 0,
  },
  accordionHeader: {
    minHeight: 56,
    paddingHorizontal: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#081224',
  },
  accordionHeaderTitle: {
    color: '#E5E7EB',
    fontSize: TEXT.md,
    fontWeight: '700',
    flex: 1,
    paddingRight: SPACING.sm,
  },
  accordionHeaderChevron: {
    color: '#64748B',
    fontSize: TEXT.lg,
    fontWeight: '700',
  },
  accordionHeaderChevronOpen: {
    color: '#93C5FD',
  },
  accordionBody: {
    paddingHorizontal: SPACING.sm,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
    gap: SPACING.sm,
    backgroundColor: '#060F1D',
  },
  card: {
    backgroundColor: '#0B1220',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: SPACING.md,
  },
  dangerCard: {
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
  label: {
    color: '#E5E7EB',
    marginBottom: SPACING.xs,
    fontWeight: '600',
    fontSize: TEXT.sm,
  },
  helper: {
    color: '#9CA3AF',
    fontSize: TEXT.xs,
    marginBottom: SPACING.sm,
  },
  inputLabelTop: {
    marginTop: SPACING.md,
  },
  input: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#1F2937',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    color: '#F9FAFB',
    fontSize: TEXT.md,
    backgroundColor: '#0B1220',
  },
  secondaryButton: {
    marginTop: SPACING.sm,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: '#1F2937',
    backgroundColor: '#0F172A',
    paddingVertical: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  secondaryButtonText: {
    color: '#E5E7EB',
    fontSize: TEXT.md,
    fontWeight: '600',
  },
  languageRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  languageButton: {
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: '#1F2937',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: '#0B1220',
    minHeight: 40,
    justifyContent: 'center',
  },
  languageButtonSelected: {
    borderColor: '#3B82F6',
    backgroundColor: 'rgba(59, 130, 246, 0.16)',
  },
  languageText: {
    color: '#E5E7EB',
    fontSize: TEXT.sm,
    fontWeight: '600',
  },
  languageTextSelected: {
    color: '#93C5FD',
  },
  buttonWrap: {
    marginTop: SPACING.xs,
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
  manageButton: {
    marginTop: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#111827',
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
  },
  manageButtonText: {
    color: '#E5E7EB',
    fontSize: TEXT.sm,
    fontWeight: '800',
  },
  backupButtons: {
    gap: SPACING.xs,
  },
  statusText: {
    marginTop: SPACING.sm,
    marginBottom: 0,
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
