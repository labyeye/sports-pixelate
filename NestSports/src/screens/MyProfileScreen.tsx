import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { dashboardAPI } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import {
  Card,
  SectionTitle,
  Row,
  LoadingView,
  EmptyState,
} from '../components/ui';
import { colors } from '../theme/colors';

export default function MyProfileScreen() {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    () =>
      dashboardAPI
        .getEmployeeStats()
        .then((res: any) => res.success && setData(res.data)),
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
  if (!data) return <EmptyState title="Couldn't load your profile" />;

  const {
    todayShift,
    upcomingHolidays = [],
    pendingApprovalsCount,
    pendingSalary = [],
    announcements = [],
  } = data;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Text style={styles.title}>Hi, {user?.name?.split(' ')[0]} 👋</Text>
        <Text style={styles.subtitle}>Your workspace overview</Text>

        <Card>
          <SectionTitle title="Today's Shift" />
          <Text style={styles.shiftText}>
            {todayShift?.name} · {todayShift?.startTime} – {todayShift?.endTime}
          </Text>
        </Card>

        {pendingApprovalsCount > 0 && (
          <Card>
            <SectionTitle title="Pending Approvals" />
            <Text style={{ color: colors.orange, fontWeight: '700' }}>
              {pendingApprovalsCount} item{pendingApprovalsCount > 1 ? 's' : ''}{' '}
              need your review
            </Text>
          </Card>
        )}

        <Card>
          <SectionTitle title="Upcoming Holidays" sub="Next 30 days" />
          {upcomingHolidays.length > 0 ? (
            upcomingHolidays.map((h: any) => (
              <Row
                key={h._id}
                title={h.name}
                subtitle={new Date(h.date).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              />
            ))
          ) : (
            <Text style={{ color: colors.muted }}>
              No holidays in the next 30 days
            </Text>
          )}
        </Card>

        <Card>
          <SectionTitle title="Pending Salary" />
          {pendingSalary.length > 0 ? (
            pendingSalary.map((p: any) => (
              <Row
                key={p._id}
                title={`${p.month}/${p.year}`}
                subtitle={p.status}
              />
            ))
          ) : (
            <Text style={{ color: colors.muted }}>Nothing pending</Text>
          )}
        </Card>

        <Card>
          <SectionTitle title="Announcements" />
          {announcements.length > 0 ? (
            announcements.map((a: any) => (
              <Row key={a._id} title={a.title} subtitle={a.content} />
            ))
          ) : (
            <Text style={{ color: colors.muted }}>No announcements</Text>
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  title: { fontSize: 24, fontWeight: '800', color: colors.black },
  subtitle: { color: colors.muted, marginTop: 2, marginBottom: 16 },
  shiftText: { fontSize: 15, fontWeight: '700', color: colors.black },
});
