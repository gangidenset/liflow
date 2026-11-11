import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, SectionList, StyleSheet, Text, View } from 'react-native';

import { AddButton } from '@/components/AddButton';
import { BudgetCard } from '@/components/BudgetCard';
import { CategoryBreakdown } from '@/components/CategoryBreakdown';
import { EmptyState } from '@/components/EmptyState';
import { LedgerEntryItem } from '@/components/LedgerEntryItem';
import { LedgerSummaryCard } from '@/components/LedgerSummaryCard';
import { MonthSwitcher } from '@/components/MonthSwitcher';
import { ScreenHeader } from '@/components/ScreenHeader';
import { StorageErrorBanner } from '@/components/StorageErrorBanner';
import { useLedger } from '@/context/LedgerContext';
import { useTodayKey } from '@/hooks/useTodayKey';
import { cardShadow, colors, fontSize, radius, spacing } from '@/theme';
import {
  defaultDateForMonth,
  formatDayHeading,
  formatYen,
  groupByDate,
  summarizeMonth,
  toMonthKey,
} from '@/utils/ledger';

export default function LedgerScreen() {
  const { entries, budget, isLoaded, storageError } = useLedger();
  const todayKey = useTodayKey();
  const currentMonthKey = toMonthKey(todayKey);
  const [monthKey, setMonthKey] = useState(currentMonthKey);

  const summary = useMemo(() => summarizeMonth(entries, monthKey), [entries, monthKey]);
  const sections = useMemo(
    () => groupByDate(entries, monthKey).map((group) => ({ ...group, data: group.entries })),
    [entries, monthKey],
  );

  const openEntry = useCallback((id: string) => {
    router.push({ pathname: '/ledger-editor', params: { id } });
  }, []);

  return (
    <View style={styles.screen}>
      <ScreenHeader title="家計簿" />
      <StorageErrorBanner message={storageError} />
      {isLoaded ? (
        <SectionList
          sections={sections}
          keyExtractor={(entry) => entry.id}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={styles.content}
          ListHeaderComponent={
            <View style={styles.header}>
              <MonthSwitcher
                monthKey={monthKey}
                currentMonthKey={currentMonthKey}
                onChange={setMonthKey}
              />
              <LedgerSummaryCard summary={summary} />
              <BudgetCard budget={budget} spent={summary.expense} />
              {summary.expenseByCategory.length > 0 ? (
                <>
                  <Text style={styles.sectionTitle}>支出の内訳</Text>
                  <CategoryBreakdown totals={summary.expenseByCategory} />
                </>
              ) : null}
              {sections.length > 0 ? <Text style={styles.sectionTitle}>明細</Text> : null}
            </View>
          }
          renderSectionHeader={({ section }) => (
            <View style={styles.dayHeader}>
              <Text style={styles.dayTitle}>{formatDayHeading(section.date)}</Text>
              <Text style={styles.dayTotal}>
                {[
                  section.expense > 0 ? `支出 ${formatYen(section.expense)}` : null,
                  section.income > 0 ? `収入 ${formatYen(section.income)}` : null,
                ]
                  .filter(Boolean)
                  .join('　')}
              </Text>
            </View>
          )}
          renderItem={({ item, index, section }) => (
            <View
              style={[
                styles.itemWrap,
                index === 0 && styles.itemFirst,
                index === section.data.length - 1 && styles.itemLast,
              ]}
            >
              <LedgerEntryItem entry={item} onPress={openEntry} />
              {index < section.data.length - 1 ? <View style={styles.separator} /> : null}
            </View>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="wallet-outline"
              title="この月の記録はありません"
              message="右下の＋ボタンから支出や収入を記録できます"
            />
          }
        />
      ) : (
        <ActivityIndicator style={styles.loading} color={colors.primary} />
      )}
      <AddButton
        href={{
          pathname: '/ledger-editor',
          params: { date: defaultDateForMonth(monthKey, todayKey) },
        }}
        label="支出・収入を記録"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: 110,
  },
  header: { gap: spacing.md },
  sectionTitle: {
    fontSize: fontSize.subtitle,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.md,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  dayTitle: { fontSize: 15, fontWeight: '700', color: colors.textSecondary },
  dayTotal: { flexShrink: 1, fontSize: fontSize.caption, color: colors.textSecondary },
  itemWrap: { backgroundColor: colors.surface, overflow: 'hidden', ...cardShadow },
  itemFirst: { borderTopLeftRadius: radius.md, borderTopRightRadius: radius.md },
  itemLast: { borderBottomLeftRadius: radius.md, borderBottomRightRadius: radius.md },
  separator: { height: 1, backgroundColor: colors.border, marginLeft: 64 },
  loading: { marginTop: spacing.xxl },
});
