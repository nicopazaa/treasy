import React from 'react';
import { View, Text, StyleSheet, Image, type ImageSourcePropType, type ViewStyle } from 'react-native';

import { SPACING, TEXT, COLORS } from '../theme/tokens';

type Props = {
  title: string;
  subtitle: string;
  iconSource?: ImageSourcePropType | null;
  style?: ViewStyle;
};

export function BlockScreenHeader({ title, subtitle, iconSource, style }: Props) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.titleRow}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {iconSource ? (
          <Image source={iconSource} style={styles.icon} resizeMode="contain" />
        ) : null}
      </View>
      <View style={styles.signatureLine} />
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
  icon: {
    width: 24,
    height: 24,
    tintColor: COLORS.blue2,
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
    width: '68%',
    borderRadius: 999,
    backgroundColor: 'rgba(148, 163, 184, 0.22)',
  },
  subtitle: {
    color: '#9CA3AF',
    fontSize: TEXT.sm,
  },
});
