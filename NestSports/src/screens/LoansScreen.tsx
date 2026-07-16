import React, { useCallback, useEffect, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  RefreshControl,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { loanAPI } from '../api/client';
import { Card, EmptyState, LoadingView, Badge, Button } from '../components/ui';
import { colors } from '../theme/colors';

function formatCurrency(n: number) {
  return `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
}

const STATUS_COLORS: Record<string, string> = {
  pending: colors.orange,
  approved: colors.green,
  active: colors.green,
  rejected: colors.red,
  cleared: colors.blue,
  paused: colors.muted,
};

export default function LoansScreen() {
  const [loans, setLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res: any = await loanAPI.getAll();
    setLoans(res.data || []);
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

  const handleStatus = async (id: string, status: 'approved' | 'rejected') => {
    setUpdatingId(id);
    try {
      await loanAPI.updateStatus(id, { status });
      await load();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update loan status');
    } finally {
      setUpdatingId(null);
    }
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
        <Text style={styles.title}>Loans & Advances</Text>
        <Text style={styles.subtitle}>Employee loan and advance requests</Text>

        {loans.length === 0 ? (
          <Card>
            <EmptyState title="No loans found" />
          </Card>
        ) : (
          loans.map(l => (
            <Card key={l._id}>
              <View style={styles.headerRow}>
                <Text style={styles.name}>
                  {l.employee
                    ? `${l.employee.firstName} ${l.employee.lastName}`
                    : '—'}
                </Text>
                <Badge
                  label={l.status}
                  color={STATUS_COLORS[l.status] || colors.muted}
                />
              </View>
              <Text style={styles.amount}>{formatCurrency(l.amount)}</Text>
              {l.reason ? <Text style={styles.sub}>{l.reason}</Text> : null}
              {l.status === 'pending' && (
                <View style={styles.actionsRow}>
                  <View style={{ flex: 1 }}>
                    <Button
                      title="Approve"
                      onPress={() => handleStatus(l._id, 'approved')}
                      color={colors.green}
                      loading={updatingId === l._id}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      title="Reject"
                      onPress={() => handleStatus(l._id, 'rejected')}
                      color={colors.red}
                      variant="outline"
                      loading={updatingId === l._id}
                    />
                  </View>
                </View>
              )}
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
  amount: {
    fontWeight: '800',
    color: colors.black,
    fontSize: 16,
    marginTop: 8,
  },
  sub: { color: colors.muted, fontSize: 12, marginTop: 4, marginBottom: 8 },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
});
