import React from 'react';
import { FlatList, StyleSheet, View, Text, Platform } from 'react-native';
import { SPACING, TEXT, RADIUS, COLORS } from '../../../shared/theme/tokens';
import { Surface } from '../../../shared/ui/Surface';

type Props<ItemT> = {
  data: ItemT[];
  renderItem: ({ item }: { item: ItemT }) => React.ReactElement;
  keyExtractor: (item: ItemT) => string;
  emptyText: string;
  extraBottomPadding?: number;
};

export function BlockExerciseList<ItemT>({
  data,
  renderItem,
  keyExtractor,
  emptyText,
  extraBottomPadding = 0,
}: Props<ItemT>) {
  return (
    <View style={styles.shadowWrap}>
      <Surface style={styles.container}>
        <FlatList
          data={data}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
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
    borderRadius: LIST_RADIUS,
    ...Platform.select({
      web: { boxShadow: '0 10px 20px rgba(2, 6, 23, 0.22)' },
      default: {
        shadowColor: COLORS.treasyNavy,
        shadowOpacity: 0.22,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 10 },
        elevation: 6,
      },
    }),
  },
  container: {
    overflow: 'hidden',
    backgroundColor: COLORS.surfaceWhite,
    borderColor: 'rgba(2, 6, 23, 0.12)',
    borderRadius: LIST_RADIUS,
  },
  listContent: {
    paddingVertical: 0,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(2, 6, 23, 0.1)',
    marginLeft: SPACING.lg,
    marginRight: SPACING.lg,
  },
  emptyContent: {
    paddingVertical: SPACING.md,
  },
  emptyText: {
    color: COLORS.textSecondaryGray,
    fontSize: TEXT.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
});
