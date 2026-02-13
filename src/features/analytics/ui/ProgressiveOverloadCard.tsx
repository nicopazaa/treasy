import React from 'react';
import { Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SPACING, TEXT as TEXT_TOKENS, RADIUS } from '../../../shared/theme/tokens';
import { STAT_NUMBER_STYLE } from '../../../shared/theme/typography';
import type { TreasyThemeTokens } from '../../../shared/theme/themes';

type Props = {
  summary: string;
  deltaText?: string | null;
  onPress?: () => void;
  theme: Pick<TreasyThemeTokens, 'surfaceAlt' | 'stroke' | 'accent' | 'text' | 'success'>;
};

function splitAroundDelta(summary: string, deltaText: string): { before: string; after: string } | null {
  const idx = summary.indexOf(deltaText);
  if (idx === -1) return null;
  return {
    before: summary.slice(0, idx),
    after: summary.slice(idx + deltaText.length),
  };
}

export const ProgressiveOverloadCard: React.FC<Props> = ({ summary, deltaText, onPress, theme }) => {
  const split = deltaText ? splitAroundDelta(summary, deltaText) : null;
  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: theme.surfaceAlt, borderColor: theme.stroke }]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={0.9}
      hitSlop={8}
    >
      <Text style={[styles.title, { color: theme.accent }]}>{'Progressive overload'}</Text>
      {split && deltaText ? (
        <Text style={[styles.summary, { color: theme.text }]} numberOfLines={3} ellipsizeMode="tail">
          {split.before}
          <Text style={[styles.delta, STAT_NUMBER_STYLE, { color: theme.success }]}>{deltaText}</Text>
          {split.after}
        </Text>
      ) : (
        <Text style={[styles.summary, { color: theme.text }]} numberOfLines={3} ellipsizeMode="tail">
          {summary}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderWidth: 1,
    minHeight: 84,
  },
  title: {
    fontSize: TEXT_TOKENS.sm,
    fontWeight: '800',
    marginBottom: SPACING.xs,
  },
  summary: {
    fontSize: TEXT_TOKENS.sm,
    fontWeight: '700',
    lineHeight: 20,
  },
  delta: {
    fontWeight: '900',
  },
});
