import React, { useCallback, useEffect, useState } from 'react';
import {
  ScrollView,
  View,
  RefreshControl,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { leaveAPI } from '../api/client';
import {
  Card,
  Row,
  Badge,
  Button,
  EmptyState,
  LoadingView,
} from '../components/ui';
import { colors } from '../theme/colors';

const STATUS_COLORS: Record<string, string> = {
  pending: colors.yellow,
  approved: colors.green,
  rejected: colors.red,
  cancelled: colors.muted,
};

export default function LeaveScreen() {
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(
    () =>
      leaveAPI
        .getAll()
        .then((res: any) => res.success && setLeaves(res.data || [])),
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

  const act = async (id: string, status: 'approved' | 'rejected') => {
    setActingId(id);
    try {
      await leaveAPI.updateStatus(id, { status });
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update leave');
    } finally {
      setActingId(null);
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
        <Card>
          {leaves.length === 0 ? (
            <EmptyState title="No leave requests found" />
          ) : (
            leaves.map((l: any) => (
              <View key={l._id} style={styles.item}>
                <Row
                  title={
                    l.employee
                      ? `${l.employee.firstName || ''} ${
                          l.employee.lastName || ''
                        }`.trim()
                      : '-'
                  }
                  subtitle={`${(l.leaveType || '-').replace(/_/g, ' ')} · ${
                    l.days ?? '-'
                  } day(s)`}
                  right={
                    <Badge
                      label={l.status}
                      color={STATUS_COLORS[l.status] || colors.blue}
                    />
                  }
                />
                {l.status === 'pending' && (
                  <View style={styles.actions}>
                    <View style={{ flex: 1 }}>
                      <Button
                        title="Approve"
                        color={colors.green}
                        loading={actingId === l._id}
                        onPress={() => act(l._id, 'approved')}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Button
                        title="Reject"
                        color={colors.red}
                        loading={actingId === l._id}
                        onPress={() => act(l._id, 'rejected')}
                      />
                    </View>
                  </View>
                )}
              </View>
            ))
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  item: { marginBottom: 4 },
  actions: { flexDirection: 'row', gap: 8, marginBottom: 10 },
});
