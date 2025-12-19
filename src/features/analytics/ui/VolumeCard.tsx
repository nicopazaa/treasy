import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, LayoutAnimation } from 'react-native';
import type { AppLanguage } from '../../../shared/types';
import { SPACING, TEXT as TEXT_TOKENS, RADIUS } from '../../../shared/theme/tokens';
import { t } from '../../../shared/i18n/i18n';

export type VolumeByMuscleRow = {
  id: string;
  label: string;
  volume7d: number;
  pctChange: number;
};

type Props = {
  language: AppLanguage;
  hasData: boolean;
  totalLabel: string;
  changeLabel: string;
  volumeLabel: string;
  rows: VolumeByMuscleRow[];
};

function formatNumber(language: AppLanguage, value: number): string {
  const locale = language === 'nb' ? 'nb-NO' : language === 'es' ? 'es-ES' : 'en-US';
  const formatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  return formatter.format(Math.round(value));
}

function formatChange(language: AppLanguage, pctChange: number): string {
  const rounded = Math.round(pctChange);
  if (rounded > 0) return t(language, 'analysis.volume.changeUp', { pct: Math.abs(rounded) });
  if (rounded < 0) return t(language, 'analysis.volume.changeDown', { pct: Math.abs(rounded) });
  return t(language, 'analysis.volume.changeFlat');
}

export const VolumeCard: React.FC<Props> = ({ language, hasData, totalLabel, changeLabel, volumeLabel, rows }) => {
  const [open, setOpen] = useState(false);

  const items = useMemo(() => rows.slice(), [rows]);
  const unit = t(language, 'units.kg');

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
        <Text style={styles.change}>{changeLabel}</Text>
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
                const volumeText = `${formatNumber(language, item.volume7d)} ${unit}`;
                const changeText = formatChange(language, item.pctChange);
                return (
                  <View key={item.id} style={styles.itemRow}>
                    <Text style={styles.itemLabel} numberOfLines={1}>
                      {item.label}
                    </Text>
                    <View style={styles.itemRight}>
                      <Text style={styles.itemChange}>{changeText}</Text>
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

