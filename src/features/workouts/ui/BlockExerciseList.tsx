import React from 'react';
import { FlatList, StyleSheet, View, Text, Platform } from 'react-native';
import { SPACING, TEXT, RADIUS, COLORS } from '../../../shared/theme/tokens';
import { Surface } from '../../../shared/ui/Surface';

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

type Props<ItemT> = {
  data: ItemT[];
  renderItem: ({ item }: { item: ItemT }) => React.ReactElement;
  keyExtractor: (item: ItemT) => string;
  emptyText: string;
  extraBottomPadding?: number;
  accentColor?: string;
};

export function BlockExerciseList<ItemT>({
  data,
  renderItem,
  keyExtractor,
  emptyText,
  extraBottomPadding = 0,
  accentColor = FALLBACK_ACCENT,
}: Props<ItemT>) {
  const borderColor = toRgba(accentColor, 0.38);

  return (
    <View style={styles.shadowWrap}>
      <Surface style={[styles.container, { borderColor }]}>
        <FlatList
          data={data}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          style={styles.list}
          contentContainerStyle={[
            styles.listContent,
            extraBottomPadding ? { paddingBottom: extraBottomPadding } : null,
            data.length === 0 && styles.emptyContent,
          ]}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={<Text style={styles.emptyText}>{emptyText}</Text>}
        />
      </Surface>
    </View>
  );
}

const LIST_RADIUS = RADIUS.lg + 4;

const styles = StyleSheet.create({
  shadowWrap: {
    flex: 1,
    borderRadius: LIST_RADIUS,
    ...Platform.select({
      web: { boxShadow: '0 10px 20px rgba(2, 6, 23, 0.22)' },
      default: {
        shadowColor: COLORS.treasyNavy,
        shadowOpacity: 0.3,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 12 },
        elevation: 6,
      },
    }),
  },
  container: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#071224',
    borderColor: 'rgba(59, 130, 246, 0.28)',
    borderRadius: LIST_RADIUS,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingVertical: SPACING.xs,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(148, 163, 184, 0.2)',
    marginLeft: SPACING.lg + 18,
    marginRight: SPACING.lg,
  },
  emptyContent: {
    minHeight: 168,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: 'rgba(203, 213, 225, 0.78)',
    fontSize: TEXT.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    textAlign: 'center',
    fontWeight: '600',
  },
});
