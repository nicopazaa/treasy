import React from 'react';
import {
  GestureResponderEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SPACING, TEXT, COLORS } from '../theme/tokens';

function splitLabelParentheses(label: string): { main: string; parentheses: string | null } {
  const idx = label.indexOf('(');
  if (idx <= 0) return { main: label, parentheses: null };
  const main = label.slice(0, idx).trimEnd();
  const parentheses = label.slice(idx).trim();
  return parentheses.startsWith('(') && parentheses.length > 0 ? { main, parentheses } : { main: label, parentheses: null };
}

type Props = {
  name: string;
  bestLabel?: string | null;
  showStar?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  onPressMenu: (event: GestureResponderEvent) => void;
  moving?: boolean;
  variant?: 'dark' | 'light';
};

export const ExerciseRow: React.FC<Props> = ({
  name,
  bestLabel,
  showStar = Boolean(bestLabel),
  onPress,
  onLongPress,
  onPressMenu,
  moving = false,
  variant = 'dark',
}) => {
  const splitLabel = variant === 'light' ? splitLabelParentheses(name) : null;
  const showSplitLabel = Boolean(splitLabel?.parentheses);

  return (
    <TouchableOpacity
      style={[
        styles.row,
        variant === 'light' && styles.rowLight,
        moving && (variant === 'light' ? styles.rowMovingLight : styles.rowMoving),
      ]}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={240}
      activeOpacity={0.85}
    >
      {variant === 'light' && showSplitLabel ? (
        <View style={styles.nameColumn}>
          <Text style={[styles.nameLightMain, { color: COLORS.textNavyPrimary }]} numberOfLines={1} ellipsizeMode="tail">
            {splitLabel?.main ?? name}
          </Text>
          <Text
            style={[styles.nameLightParen, { color: COLORS.textSecondaryGray }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {splitLabel?.parentheses}
          </Text>
        </View>
      ) : (
        <Text
          style={[
            styles.name,
            variant === 'light' && styles.nameLight,
            variant === 'light' ? { color: COLORS.textNavyPrimary } : null,
          ]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {name}
        </Text>
      )}

      <View style={styles.right} pointerEvents="box-none">
        {bestLabel ? (
          <View style={styles.bestWrap} pointerEvents="none">
            <Text
              style={[styles.bestText, variant === 'light' && styles.bestTextLight]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {bestLabel}
            </Text>
            {showStar ? <Text style={styles.star}>⭐</Text> : null}
          </View>
        ) : null}

        <TouchableOpacity
          style={styles.kebabButton}
          onPress={(event) => {
            event.stopPropagation?.();
            onPressMenu(event);
          }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.85}
        >
          <Text style={[styles.kebabText, variant === 'light' && styles.kebabTextLight]}>{'...'}</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    minHeight: 56,
  },
  rowLight: {
    backgroundColor: COLORS.surfaceWhite,
    paddingVertical: SPACING.xxl,
  },
  rowMoving: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  rowMovingLight: {
    backgroundColor: 'rgba(2, 6, 23, 0.04)',
  },
  name: {
    flex: 1,
    color: '#F9FAFB',
    fontSize: TEXT.md,
    fontWeight: '700',
    marginRight: SPACING.sm,
  },
  nameLight: {
    color: COLORS.textNavyPrimary,
    lineHeight: TEXT.md + 4,
  },
  nameColumn: {
    flex: 1,
    marginRight: SPACING.sm,
    minWidth: 0,
  },
  nameLightMain: {
    color: COLORS.textNavyPrimary,
    fontSize: TEXT.md,
    fontWeight: '700',
    lineHeight: TEXT.md + 4,
  },
  nameLightParen: {
    color: COLORS.textSecondaryGray,
    fontSize: TEXT.xs,
    fontWeight: '700',
    lineHeight: TEXT.xs + 2,
    marginTop: 2,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flexShrink: 0,
  },
  bestWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    maxWidth: 180,
    flexShrink: 1,
    minWidth: 0,
  },
  bestText: {
    color: '#9CA3AF',
    fontSize: TEXT.xs,
    fontWeight: '600',
  },
  bestTextLight: {
    color: COLORS.textSecondaryGray,
    lineHeight: TEXT.xs + 2,
  },
  star: {
    fontSize: TEXT.md,
    lineHeight: TEXT.md + 2,
    color: COLORS.warning,
  },
  kebabButton: {
    width: 40,
    height: 40,
    minWidth: 40,
    minHeight: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: SPACING.xs,
  },
  kebabText: {
    color: '#E5E7EB',
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 22,
    marginTop: -2,
  },
  kebabTextLight: {
    color: COLORS.textSecondaryGray,
  },
});
