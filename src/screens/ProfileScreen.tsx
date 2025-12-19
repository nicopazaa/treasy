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
import { AppState } from '../features/workouts/model/types';
import { PrimaryButton } from '../shared/ui/PrimaryButton';
import { SPACING, TEXT, RADIUS, SCREEN_PADDING } from '../shared/theme/tokens';
import { LANGUAGE_OPTIONS, t } from '../shared/i18n/i18n';

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
  const [nickname, setNickname] = useState(appState.nickname ?? '');
  const [height, setHeight] = useState(appState.heightCm != null ? String(appState.heightCm) : '');
  const [weight, setWeight] = useState(appState.weightKg != null ? String(appState.weightKg) : '');

  const handleSave = () => {
    const trimmedNickname = nickname.trim();

    const next: AppState = {
      ...appState,
      nickname: trimmedNickname || null,
      heightCm: height ? Number(height) || null : null,
      weightKg: weight ? Number(weight) || null : null,
    };

    onUpdate(next);
    onBack();
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

          <Text style={[styles.label, { marginTop: SPACING.md }]}>{t(language, 'weightKg')}</Text>
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
