import React from 'react';
import { Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SPACING, TEXT as TEXT_TOKENS, RADIUS, COLORS } from '../../../shared/theme/tokens';

type Props = {
  summary: string;
  deltaText?: string | null;
  onPress?: () => void;
};

function splitAroundDelta(summary: string, deltaText: string): { before: string; after: string } | null {
  const idx = summary.indexOf(deltaText);
  if (idx === -1) return null;
  return {
    before: summary.slice(0, idx),
    after: summary.slice(idx + deltaText.length),
  };
}

export const ProgressiveOverloadCard: React.FC<Props> = ({ summary, deltaText, onPress }) => {
  const split = deltaText ? splitAroundDelta(summary, deltaText) : null;
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.9}
      hitSlop={8}
    >
      <Text style={styles.title}>{'Progressive overload'}</Text>
      {split && deltaText ? (
        <Text style={styles.summary} numberOfLines={3} ellipsizeMode="tail">
          {split.before}
          <Text style={styles.delta}>{deltaText}</Text>
          {split.after}
        </Text>
      ) : (
        <Text style={styles.summary} numberOfLines={3} ellipsizeMode="tail">
          {summary}
        </Text>
      )}
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
    color: COLORS.blue2,
    fontSize: TEXT_TOKENS.sm,
    fontWeight: '800',
    marginBottom: SPACING.xs,
  },
  summary: {
    color: '#F9FAFB',
    fontSize: TEXT_TOKENS.sm,
    fontWeight: '700',
    lineHeight: 20,
  },
  delta: {
    color: COLORS.success,
    fontWeight: '900',
  },
});
