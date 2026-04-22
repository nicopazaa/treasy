import React from 'react';
import {
  GestureResponderEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SPACING, TEXT, COLORS } from '../theme/tokens';

const DEFAULT_ACCENT = COLORS.blue2;

function splitLabelParentheses(label: string): { main: string; parentheses: string | null } {
  const idx = label.indexOf('(');
  if (idx <= 0) return { main: label, parentheses: null };
  const main = label.slice(0, idx).trimEnd();
  const parentheses = label.slice(idx).trim();
  return parentheses.startsWith('(') && parentheses.length > 0 ? { main, parentheses } : { main: label, parentheses: null };
}

function parseHexColor(color: string): [number, number, number] | null {
  const clean = color.trim().replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16)];
}

function toRgba(color: string, alpha: number): string {
  const safeAlpha = Number.isFinite(alpha) ? Math.max(0, Math.min(1, alpha)) : 1;
  const rgb = parseHexColor(color) ?? parseHexColor(DEFAULT_ACCENT);
  if (!rgb) return `rgba(59, 130, 246, ${safeAlpha})`;
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${safeAlpha})`;
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
  accentColor?: string;
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
  accentColor = DEFAULT_ACCENT,
}) => {
  const isLight = variant === 'light';
  const splitLabel = splitLabelParentheses(name);
  const showSplitLabel = Boolean(splitLabel.parentheses);
  const bestChipBg = toRgba(accentColor, isLight ? 0.1 : 0.18);
  const menuBg = toRgba(accentColor, isLight ? 0.08 : 0.16);

  return (
    <TouchableOpacity
      style={[
        styles.row,
        isLight ? styles.rowLight : styles.rowDark,
        moving && (isLight ? styles.rowMovingLight : styles.rowMoving),
      ]}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={240}
      activeOpacity={0.85}
    >
      <View style={[styles.leadingDot, { backgroundColor: accentColor }]} />

      <View style={styles.nameColumn}>
        <Text
          style={[
            styles.nameMain,
            isLight ? styles.nameMainLight : styles.nameMainDark,
          ]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {splitLabel.main}
        </Text>
        {showSplitLabel ? (
          <Text
            style={[
              styles.nameParen,
              isLight ? styles.nameParenLight : styles.nameParenDark,
            ]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {splitLabel.parentheses}
          </Text>
        ) : null}
      </View>

      <View style={styles.right} pointerEvents="box-none">
        {bestLabel ? (
          <View
            style={[
              styles.bestWrap,
              isLight ? styles.bestWrapLight : styles.bestWrapDark,
              { backgroundColor: bestChipBg },
            ]}
            pointerEvents="none"
          >
            <Text
              style={[styles.bestText, isLight ? styles.bestTextLight : styles.bestTextDark]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {bestLabel}
            </Text>
            {showStar ? <Text style={styles.star}>{'\u2B50'}</Text> : null}
          </View>
        ) : null}

        <TouchableOpacity
          style={[
            styles.kebabButton,
            isLight ? styles.kebabButtonLight : styles.kebabButtonDark,
            { backgroundColor: menuBg },
          ]}
          onPress={(event) => {
            event.stopPropagation?.();
            onPressMenu(event);
          }}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.85}
        >
          <Text style={[styles.kebabText, isLight ? styles.kebabTextLight : styles.kebabTextDark]}>{'\u22EF'}</Text>
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
    paddingVertical: SPACING.sm,
    minHeight: 64,
    gap: SPACING.sm,
  },
  rowDark: {
    backgroundColor: '#071224',
  },
  rowLight: {
    backgroundColor: COLORS.surfaceWhite,
  },
  rowMoving: {
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
  },
  rowMovingLight: {
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
  },
  leadingDot: {
    width: 9,
    height: 9,
    borderRadius: 999,
    opacity: 0.95,
  },
  nameColumn: {
    flex: 1,
    minWidth: 0,
  },
  nameMain: {
    fontSize: TEXT.md,
    lineHeight: TEXT.md + 4,
    fontWeight: '700',
  },
  nameMainLight: {
    color: COLORS.textNavyPrimary,
  },
  nameMainDark: {
    color: '#E5ECF8',
  },
  nameParen: {
    fontSize: TEXT.xs,
    lineHeight: TEXT.xs + 2,
    fontWeight: '700',
    marginTop: 2,
  },
  nameParenLight: {
    color: COLORS.textSecondaryGray,
  },
  nameParenDark: {
    color: 'rgba(203, 213, 225, 0.72)',
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    flexShrink: 0,
  },
  bestWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    maxWidth: 188,
    flexShrink: 1,
    minWidth: 0,
    borderRadius: 999,
    borderWidth: 0,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  bestWrapDark: {
    backgroundColor: 'rgba(37, 99, 235, 0.14)',
  },
  bestWrapLight: {
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
  },
  bestText: {
    fontSize: TEXT.xs,
    fontWeight: '600',
  },
  bestTextDark: {
    color: 'rgba(203, 213, 225, 0.84)',
  },
  bestTextLight: {
    color: COLORS.textSecondaryGray,
    lineHeight: TEXT.xs + 2,
  },
  star: {
    fontSize: TEXT.sm,
    lineHeight: TEXT.sm + 2,
    color: COLORS.warning,
  },
  kebabButton: {
    width: 34,
    height: 34,
    minWidth: 34,
    minHeight: 34,
    borderRadius: 999,
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
  kebabButtonDark: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
  },
  kebabButtonLight: {
    backgroundColor: 'rgba(59, 130, 246, 0.06)',
  },
  kebabText: {
    fontSize: TEXT.lg + 2,
    fontWeight: '800',
    lineHeight: TEXT.lg + 2,
    marginTop: -1,
  },
  kebabTextDark: {
    color: 'rgba(224, 236, 255, 0.86)',
  },
  kebabTextLight: {
    color: COLORS.textSecondaryGray,
  },
});
