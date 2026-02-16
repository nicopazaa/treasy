import React from 'react';
import { View, Text, StyleSheet, Image, type ImageSourcePropType, type ViewStyle } from 'react-native';

import { SPACING, TEXT, COLORS } from '../theme/tokens';

const FALLBACK_ACCENT = COLORS.blue2;

function parseHexColor(color: string): [number, number, number] | null {
  const clean = color.trim().replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16)];
}

function toRgba(color: string, alpha: number): string {
  const safeAlpha = Number.isFinite(alpha) ? Math.max(0, Math.min(1, alpha)) : 1;
  const rgb = parseHexColor(color) ?? parseHexColor(FALLBACK_ACCENT);
  if (!rgb) return `rgba(59, 130, 246, ${safeAlpha})`;
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${safeAlpha})`;
}

type Props = {
  title: string;
  subtitle: string;
  iconSource?: ImageSourcePropType | null;
  style?: ViewStyle;
  accentColor?: string;
};

export function BlockScreenHeader({ title, subtitle, iconSource, style, accentColor = FALLBACK_ACCENT }: Props) {
  const iconWrapBorder = toRgba(accentColor, 0.35);
  const iconWrapBg = toRgba(accentColor, 0.12);
  const signatureLineColor = toRgba(accentColor, 0.36);

  return (
    <View style={[styles.container, style]}>
      <View style={styles.titleRow}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {iconSource ? (
          <View style={[styles.iconWrap, { borderColor: iconWrapBorder, backgroundColor: iconWrapBg }]}>
            <Image source={iconSource} style={[styles.icon, { tintColor: accentColor }]} resizeMode="contain" />
          </View>
        ) : null}
      </View>
      <View style={[styles.signatureLine, { backgroundColor: signatureLineColor }]} />
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: SPACING.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    width: 20,
    height: 20,
    opacity: 0.95,
  },
  title: {
    fontSize: TEXT.xxl,
    fontWeight: '700',
    color: '#F9FAFB',
    flexShrink: 1,
    minWidth: 0,
  },
  signatureLine: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
    borderRadius: 999,
    backgroundColor: 'rgba(148, 163, 184, 0.25)',
  },
  subtitle: {
    color: 'rgba(203, 213, 225, 0.72)',
    fontSize: TEXT.sm,
    fontWeight: '500',
  },
});
