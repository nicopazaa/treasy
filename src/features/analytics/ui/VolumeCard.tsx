import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, LayoutAnimation } from 'react-native';
import type { AppLanguage } from '../../../shared/types';
import { SPACING, TEXT as TEXT_TOKENS, RADIUS, COLORS } from '../../../shared/theme/tokens';
import { t } from '../../../shared/i18n/i18n';
import { fromKg, type MassUnit } from '../../../shared/utils/units';

export type VolumeByMuscleRow = {
  id: string;
  label: string;
  volume7d: number;
  pctChange: number;
};

type TrendStatus = 'up' | 'down' | 'stable';

type Props = {
  language: AppLanguage;
  massUnit: MassUnit;
  hasData: boolean;
  totalLabel: string;
  changePct: number;
  volumeLabel: string;
  rows: VolumeByMuscleRow[];
};

function formatNumber(language: AppLanguage, value: number): string {
  const locale = language === 'nb' ? 'nb-NO' : language === 'es' ? 'es-ES' : 'en-US';
  const formatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  return formatter.format(Math.round(value));
}

function trendFromPct(pctChange: number): TrendStatus {
  if (pctChange >= 5) return 'up';
  if (pctChange <= -5) return 'down';
  return 'stable';
}

function arrowForTrend(trend: TrendStatus): string {
  if (trend === 'up') return '↑';
  if (trend === 'down') return '↓';
  return '→';
}

function colorForTrend(trend: TrendStatus): string {
  if (trend === 'up') return COLORS.success;
  if (trend === 'down') return COLORS.warning;
  return COLORS.neutral;
}

function formatChangeText(language: AppLanguage, pctChange: number): string {
  const rounded = Math.round(pctChange);
  if (Math.abs(rounded) < 1) return t(language, 'analysis.volume.changeFlat');
  if (rounded > 0) return t(language, 'analysis.volume.changeUp', { pct: Math.abs(rounded) });
  return t(language, 'analysis.volume.changeDown', { pct: Math.abs(rounded) });
}

function formatChange(language: AppLanguage, pctChange: number): { text: string; trend: TrendStatus } {
  return { text: formatChangeText(language, pctChange), trend: trendFromPct(pctChange) };
}

export const VolumeCard: React.FC<Props> = ({ language, massUnit, hasData, totalLabel, changePct, volumeLabel, rows }) => {
  const [open, setOpen] = useState(false);

  const items = useMemo(() => rows.slice(), [rows]);
  const unit = massUnit === 'lb' ? t(language, 'units.lb') : t(language, 'units.kg');
  const changeDisplay = hasData ? formatChange(language, changePct) : { text: t(language, 'analysis.empty'), trend: 'stable' as const };
  const changeColor = hasData ? colorForTrend(changeDisplay.trend) : COLORS.neutral;
  const changeArrow = arrowForTrend(changeDisplay.trend);

  const toggle = () => {
    if (Platform.OS !== 'web') {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setOpen((v) => !v);
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t(language, 'analysis.volume.title')}</Text>

      <View style={styles.rowBetween}>
        <Text style={styles.label}>{totalLabel}</Text>
        <View style={styles.trendWrap}>
          <Text style={[styles.trendArrow, { color: changeColor }]}>{changeArrow}</Text>
          <Text style={[styles.change, { color: changeColor }]}>{changeDisplay.text}</Text>
        </View>
      </View>

      <Text style={styles.value}>{hasData ? volumeLabel : t(language, 'analysis.empty')}</Text>

      <TouchableOpacity onPress={toggle} activeOpacity={0.85} style={styles.toggleRow} hitSlop={8}>
        <Text style={styles.toggleText}>{t(language, 'analysis.volume.byMuscle.toggle')}</Text>
        <Text style={styles.chevron}>{open ? 'v' : '>'}</Text>
      </TouchableOpacity>

      {open ? (
        <View style={styles.listWrapper}>
          {!hasData ? (
            <Text style={styles.emptyText}>{t(language, 'analysis.empty')}</Text>
          ) : (
            <ScrollView style={styles.list} contentContainerStyle={styles.listContent} nestedScrollEnabled>
              {items.map((item) => {
                const volumeText = `${formatNumber(language, fromKg(item.volume7d, massUnit))} ${unit}`;
                const changeText = formatChange(language, item.pctChange);
                const color = colorForTrend(changeText.trend);
                return (
                  <View key={item.id} style={styles.itemRow}>
                    <Text style={styles.itemLabel} numberOfLines={1}>
                      {item.label}
                    </Text>
                    <View style={styles.itemRight}>
                      <Text style={[styles.itemChange, { color }]}>{changeText.text}</Text>
                      <Text style={styles.itemVolume}>{volumeText}</Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      ) : null}
    </View>
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
  },
  title: {
    color: '#E5E7EB',
    fontSize: TEXT_TOKENS.sm,
    fontWeight: '800',
    marginBottom: SPACING.sm,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  trendWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trendArrow: {
    fontSize: TEXT_TOKENS.sm,
    fontWeight: '900',
    lineHeight: TEXT_TOKENS.sm + 2,
  },
  label: {
    flex: 1,
    color: '#9CA3AF',
    fontSize: TEXT_TOKENS.xs,
    fontWeight: '700',
  },
  change: {
    color: '#E5E7EB',
    fontSize: TEXT_TOKENS.xs,
    fontWeight: '800',
  },
  value: {
    marginTop: 2,
    color: '#F9FAFB',
    fontSize: TEXT_TOKENS.lg,
    fontWeight: '800',
  },
  toggleRow: {
    marginTop: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingVertical: SPACING.xs,
  },
  toggleText: {
    color: '#93C5FD',
    fontSize: TEXT_TOKENS.sm,
    fontWeight: '700',
  },
  chevron: {
    color: '#9CA3AF',
    fontSize: TEXT_TOKENS.md,
    fontWeight: '800',
  },
  listWrapper: {
    marginTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: '#111827',
    paddingTop: SPACING.sm,
    maxHeight: 240,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: SPACING.xs,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingVertical: SPACING.xs,
  },
  itemLabel: {
    flex: 1,
    paddingRight: SPACING.md,
    color: '#E5E7EB',
    fontSize: TEXT_TOKENS.sm,
    fontWeight: '700',
  },
  itemRight: {
    alignItems: 'flex-end',
  },
  itemChange: {
    color: '#9CA3AF',
    fontSize: TEXT_TOKENS.xs,
    fontWeight: '800',
  },
  itemVolume: {
    marginTop: 2,
    color: '#E5E7EB',
    fontSize: TEXT_TOKENS.xs,
    fontWeight: '700',
  },
  emptyText: {
    color: '#9CA3AF',
    fontSize: TEXT_TOKENS.sm,
    fontWeight: '600',
    paddingVertical: SPACING.xs,
  },
});
