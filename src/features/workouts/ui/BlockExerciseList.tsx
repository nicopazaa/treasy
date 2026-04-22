import React from 'react';
import { FlatList, StyleSheet, View, Text, Platform } from 'react-native';
import { SPACING, TEXT, RADIUS, COLORS } from '../../../shared/theme/tokens';

type Props<ItemT> = {
  data: ItemT[];
  renderItem: ({ item }: { item: ItemT }) => React.ReactElement;
  keyExtractor: (item: ItemT) => string;
  emptyText: string;
  variant?: 'dark' | 'light';
  extraBottomPadding?: number;
};

export function BlockExerciseList<ItemT>({
  data,
  renderItem,
  keyExtractor,
  emptyText,
  variant = 'dark',
  extraBottomPadding = 0,
}: Props<ItemT>) {
  const isLight = variant === 'light';
  const containerBackground = isLight ? 'rgba(255, 255, 255, 0.42)' : 'transparent';
  const separatorColor = isLight ? 'rgba(100, 116, 139, 0.18)' : 'rgba(148, 163, 184, 0.14)';
  const emptyColor = isLight ? COLORS.textSecondaryGray : 'rgba(203, 213, 225, 0.78)';
  const cardStyle = isLight
    ? Platform.select({
        web: { boxShadow: '0 4px 10px rgba(15, 23, 42, 0.04)' },
        default: {
          shadowColor: '#0F172A',
          shadowOpacity: 0.05,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
          elevation: 1,
        },
      })
    : null;

  return (
    <View style={[styles.container, cardStyle, { backgroundColor: containerBackground }]}>
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
        ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: separatorColor }]} />}
        ListEmptyComponent={<Text style={[styles.emptyText, { color: emptyColor }]}>{emptyText}</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'visible',
    backgroundColor: 'transparent',
    borderRadius: RADIUS.lg,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingVertical: 0,
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
