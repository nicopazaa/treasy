import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { AppState } from '../features/workouts';
import { PrimaryButton } from '../shared/ui/PrimaryButton';
import { SPACING, TEXT, RADIUS, SCREEN_PADDING } from '../shared/theme/tokens';
import { LANGUAGE_OPTIONS, t } from '../shared/i18n/i18n';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fromKg, roundForDisplay, toKg } from '../shared/utils/units';
import { now } from '../shared/time';

interface Props {
  appState: AppState;
  onBack: () => void;
  onUpdate: (next: AppState) => void;
  onOpenLogin: () => void;
}

export const ProfileScreen: React.FC<Props> = ({
  appState,
  onBack,
  onUpdate,
  onOpenLogin,
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

  const handleSave = () => {
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
    } catch (e) {
      setExportStatus(t(language, 'backupFailed'));
    }
  };

  const handleSaveLocalBackup = async () => {
    try {
      const data = buildBackupJson();
      await AsyncStorage.setItem('treasy_backup_export', data);
      setExportStatus(t(language, 'backupSavedLocal'));
    } catch (e) {
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

        <Text style={styles.title}>{t(language, 'profileTitle')}</Text>

        <View style={styles.card}>
          <Text style={styles.label}>{authLine}</Text>
          {appState.userEmail ? (
            <Text style={styles.helper}>{appState.userEmail}</Text>
          ) : null}
          {appState.authProvider === 'guest' ? (
            <TouchableOpacity style={styles.secondaryButton} onPress={onOpenLogin} activeOpacity={0.9}>
              <Text style={styles.secondaryButtonText}>{t(language, 'login')}</Text>
            </TouchableOpacity>
          ) : null}
        </View>

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
                  <Text style={[styles.languageText, selected && styles.languageTextSelected]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
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
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>{t(language, 'heightCm')}</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            placeholder={t(language, 'heightPlaceholder')}
            placeholderTextColor="#4B5563"
            value={height}
            onChangeText={setHeight}
          />

          <Text style={[styles.label, { marginTop: SPACING.md }]}>{t(language, 'weightKg', { unit: unitLabel })}</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            placeholder={t(language, 'weightPlaceholder')}
            placeholderTextColor="#4B5563"
            value={weight}
            onChangeText={setWeight}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>{t(language, 'backupTitle')}</Text>
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
          {exportStatus ? <Text style={styles.helper}>{exportStatus}</Text> : null}
        </View>

        <View style={styles.buttonWrap}>
          <PrimaryButton title={t(language, 'save')} onPress={handleSave} />
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
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
    fontWeight: '700',
    color: '#F9FAFB',
    marginBottom: SPACING.lg,
  },
  card: {
    backgroundColor: '#020617',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: SPACING.md,
    marginBottom: SPACING.md,
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
  backupButtons: {
    gap: SPACING.xs,
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
    backgroundColor: '#0B1220',
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
    marginTop: SPACING.md,
  },
});
