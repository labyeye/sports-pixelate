import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, View, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IndianRupee, Wallet, CheckCircle2 } from 'lucide-react-native';
import { loanAPI } from '../api/client';
import {
  Card,
  Row,
  Badge,
  EmptyState,
  LoadingView,
  KpiTile,
} from '../components/ui';
import { colors } from '../theme/colors';

const STATUS_COLORS: Record<string, string> = {
  pending: colors.yellow,
  active: colors.blue,
  rejected: colors.red,
  cleared: colors.green,
  paused: colors.muted,
};

function formatCurrency(n: number) {
  return `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
}

export default function MyLoansScreen() {
  const [loans, setLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    () =>
      loanAPI
        .getAll()
        .then((res: any) => res.success && setLoans(res.data || [])),
    [],
  );

  useEffect(() => {
    load()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load().catch(() => {});
    setRefreshing(false);
  };

  if (loading) return <LoadingView />;

  const totalBorrowed = loans.reduce((sum, l) => sum + (l.amount || 0), 0);
  const outstandingBalance = loans.reduce(
    (sum, l) => sum + (l.remainingBalance || 0),
    0,
  );
  const activeCount = loans.filter(l => l.status === 'active').length;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.kpiGrid}>
          <KpiTile
            label="Total Borrowed"
            value={formatCurrency(totalBorrowed)}
            sub="All loans/advances"
            color={colors.blue}
            icon={IndianRupee}
          />
          <KpiTile
            label="Outstanding"
            value={formatCurrency(outstandingBalance)}
            sub="Remaining balance"
            color={colors.orange}
            icon={Wallet}
          />
          <KpiTile
            label="Active Loans"
            value={activeCount}
            sub="Currently active"
            color={colors.green}
            icon={CheckCircle2}
          />
        </View>

        <Card>
          {loans.length === 0 ? (
            <EmptyState title="No loans or advances found" />
          ) : (
            loans.map((l: any) => (
              <Row
                key={l._id}
                title={`${
                  (l.type || 'loan') === 'advance' ? 'Advance' : 'Loan'
                } · ${formatCurrency(l.amount)}`}
                subtitle={
                  l.remainingBalance != null
                    ? `Remaining: ${formatCurrency(l.remainingBalance)}`
                    : l.reason || ''
                }
                right={
                  <Badge
                    label={l.status}
                    color={STATUS_COLORS[l.status] || colors.blue}
                  />
                }
              />
            ))
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
});
