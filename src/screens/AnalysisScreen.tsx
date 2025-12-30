import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppLanguage } from '../shared/types';
import { SPACING, TEXT, RADIUS, SCREEN_PADDING } from '../shared/theme/tokens';
import { t } from '../shared/i18n/i18n';

type Props = {
  language: AppLanguage;
  onBack: () => void;
};

const titleForLanguage = (language: AppLanguage): string => {
  if (language === 'nb') return 'Analyset';
  if (language === 'es') return 'Análisis';
  return 'Analysis';
};

const subtitleForLanguage = (language: AppLanguage): string => {
  if (language === 'nb') return 'Kommer snart.';
  if (language === 'es') return 'Próximamente.';
  return 'Coming soon.';
};

export const AnalysisScreen: React.FC<Props> = ({ language, onBack }) => {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <TouchableOpacity onPress={onBack} hitSlop={12} style={styles.backButton} activeOpacity={0.8}>
          <Text style={styles.backLabel}>{t(language, 'back')}</Text>
        </TouchableOpacity>

        <View style={styles.card}>
          <Text style={styles.title}>{titleForLanguage(language)}</Text>
          <Text style={styles.subtitle}>{subtitleForLanguage(language)}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
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
  backLabel: {
    color: '#60A5FA',
    fontSize: TEXT.sm,
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#0B1220',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: '#1F2937',
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  title: {
    color: '#F9FAFB',
    fontSize: TEXT.lg,
    fontWeight: '800',
  },
  subtitle: {
    color: '#9CA3AF',
    fontSize: TEXT.sm,
    fontWeight: '600',
  },
});

