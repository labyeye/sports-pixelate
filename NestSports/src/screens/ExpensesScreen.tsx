import React, { useCallback, useEffect, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { expenseAPI } from '../api/client';
import { Card, EmptyState, LoadingView, Badge } from '../components/ui';
import { colors } from '../theme/colors';

function formatCurrency(n: number) {
  return `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
}

export default function ExpensesScreen() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const now = new Date();
    const res: any = await expenseAPI.getAll({
      month: String(now.getMonth() + 1),
      year: String(now.getFullYear()),
    });
    setExpenses(res.data || []);
    setTotalAmount(res.totalAmount || 0);
  }, []);

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

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Text style={styles.title}>Expenses</Text>
        <Text style={styles.subtitle}>
          Spent this month: {formatCurrency(totalAmount)}
        </Text>

        {expenses.length === 0 ? (
          <Card>
            <EmptyState title="No expenses found" />
          </Card>
        ) : (
          expenses.map(e => (
            <Card key={e._id}>
              <View style={styles.headerRow}>
                <Text style={styles.name}>{e.title}</Text>
                <Badge
                  label={e.category?.replace('_', ' ')}
                  color={colors.orange}
                />
              </View>
              <Text style={styles.sub}>
                {e.date
                  ? new Date(e.date).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })
                  : '—'}
              </Text>
              <Text style={styles.amount}>{formatCurrency(e.amount)}</Text>
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  title: { fontSize: 24, fontWeight: '800', color: colors.black },
  subtitle: { color: colors.muted, marginTop: 2, marginBottom: 16 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: { fontSize: 16, fontWeight: '800', color: colors.black },
  sub: { color: colors.muted, fontSize: 12, marginTop: 4 },
  amount: {
    fontWeight: '800',
    color: colors.black,
    fontSize: 16,
    marginTop: 8,
  },
});
