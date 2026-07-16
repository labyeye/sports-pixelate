import React, { useCallback, useEffect, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { sportsPlanAPI } from '../api/client';
import { Card, EmptyState, LoadingView, Badge } from '../components/ui';
import { colors } from '../theme/colors';

function formatCurrency(n: number) {
  return `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
}

export default function PlansScreen() {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const res: any = await sportsPlanAPI.getAll();
    setPlans(res.data || []);
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
        <Text style={styles.title}>Coaching Plans</Text>
        <Text style={styles.subtitle}>Available sports coaching plans</Text>

        {plans.length === 0 ? (
          <Card>
            <EmptyState title="No coaching plans found" />
          </Card>
        ) : (
          plans.map(p => (
            <Card key={p._id}>
              <View style={styles.headerRow}>
                <Text style={styles.name}>{p.name}</Text>
                <Badge label={p.sport} color={colors.blue} />
              </View>
              <Text style={styles.sub}>{p.sessionsPerWeek} sessions/week</Text>
              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>MONTHLY</Text>
                  <Text style={styles.statValue}>
                    {formatCurrency(p.monthlyPrice)}
                  </Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>YEARLY</Text>
                  <Text style={styles.statValue}>
                    {formatCurrency(p.yearlyPrice)}
                  </Text>
                </View>
              </View>
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
  sub: { color: colors.muted, fontSize: 12, marginTop: 2, marginBottom: 10 },
  statsRow: { flexDirection: 'row', gap: 10 },
  statBox: {
    flex: 1,
    borderWidth: 2,
    borderColor: colors.black,
    backgroundColor: colors.background,
    padding: 10,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.muted,
    marginBottom: 4,
  },
  statValue: { fontSize: 15, fontWeight: '800', color: colors.black },
});
