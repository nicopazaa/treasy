import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { AppLanguage } from '../../../shared/types';
import { SPACING, TEXT as TEXT_TOKENS, RADIUS, COLORS } from '../../../shared/theme/tokens';
import { t } from '../../../shared/i18n/i18n';
import type { MomentumStatus } from '../model/insights';

type Props = {
  language: AppLanguage;
  hasData: boolean;
  status: MomentumStatus;
  onPress?: () => void;
};

export const MomentumCard: React.FC<Props> = ({ language, hasData, status, onPress }) => {
  const main = !hasData
    ? t(language, 'analysis.empty')
    : status === 'up'
      ? t(language, 'analysis.momentum.up')
      : status === 'down'
        ? t(language, 'analysis.momentum.down')
        : t(language, 'analysis.momentum.stable');
  const statusColor = !hasData
    ? COLORS.neutral
    : status === 'up'
      ? COLORS.success
      : status === 'down'
        ? COLORS.warning
        : COLORS.neutral;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.9}
      hitSlop={8}
    >
      <Text style={styles.title}>{t(language, 'analysis.momentum.title')}</Text>
      <Text style={[styles.main, { color: statusColor }]}>{main}</Text>
      <Text style={styles.sub}>{t(language, 'analysis.momentum.basedOn7d')}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#0B1220',
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderWidth: 1,
    borderColor: '#1F2937',
    minHeight: 84,
  },
  title: {
    color: '#E5E7EB',
    fontSize: TEXT_TOKENS.sm,
    fontWeight: '800',
    marginBottom: SPACING.xs,
  },
  main: {
    color: '#F9FAFB',
    fontSize: TEXT_TOKENS.md,
    fontWeight: '800',
  },
  sub: {
    marginTop: SPACING.xs,
    color: '#9CA3AF',
    fontSize: TEXT_TOKENS.xs,
    fontWeight: '600',
  },
});
