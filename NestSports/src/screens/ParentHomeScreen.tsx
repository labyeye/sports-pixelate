import React, { useCallback, useEffect, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  studentAPI,
  studentAttendanceAPI,
  subscriptionAPI,
} from '../api/client';
import { Card, EmptyState, LoadingView, Badge } from '../components/ui';
import { colors } from '../theme/colors';

export default function ParentHomeScreen() {
  const [children, setChildren] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const now = new Date();
    const [studRes, attRes, subRes] = await Promise.all([
      studentAPI.getAll(),
      studentAttendanceAPI.getAll({
        month: String(now.getMonth() + 1),
        year: String(now.getFullYear()),
      }),
      subscriptionAPI.getAll(),
    ]);
    setChildren(studRes.data || []);
    setAttendance(attRes.data || []);
    setSubscriptions(subRes.data || []);
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
        <Text style={styles.title}>My Children</Text>
        <Text style={styles.subtitle}>
          Attendance and subscription overview
        </Text>

        {children.length === 0 ? (
          <Card>
            <EmptyState
              title="No children linked to your account yet"
              sub="Contact the academy to link your child's profile."
            />
          </Card>
        ) : (
          children.map(child => {
            const records = attendance.filter(
              a => a.student?._id === child._id,
            );
            const present = records.filter(a => a.status === 'present').length;
            const total = records.length;
            const rate = total > 0 ? Math.round((present / total) * 100) : 0;
            const sub = subscriptions.find(
              s => s.student?._id === child._id && s.status === 'active',
            );

            return (
              <Card key={child._id}>
                <View style={styles.headerRow}>
                  <Text style={styles.childName}>
                    {child.firstName} {child.lastName}
                  </Text>
                  <Badge label={child.sport} color={colors.blue} />
                </View>
                {child.batch ? (
                  <Text style={styles.batch}>{child.batch}</Text>
                ) : null}

                <View style={styles.statsRow}>
                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>ATTENDANCE (MONTH)</Text>
                    <Text style={styles.statValue}>{rate}%</Text>
                    <Text style={styles.statSub}>
                      {present}/{total} sessions
                    </Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>SUBSCRIPTION</Text>
                    {sub ? (
                      <>
                        <Text
                          style={[
                            styles.statValue,
                            { fontSize: 14, color: colors.green },
                          ]}
                        >
                          {sub.planName}
                        </Text>
                        <Text style={styles.statSub}>
                          Renews{' '}
                          {new Date(sub.renewalDate).toLocaleDateString(
                            'en-IN',
                            { day: '2-digit', month: 'short' },
                          )}
                        </Text>
                      </>
                    ) : (
                      <Text
                        style={[
                          styles.statValue,
                          { fontSize: 14, color: colors.red },
                        ]}
                      >
                        No active plan
                      </Text>
                    )}
                  </View>
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  title: { fontSize: 24, fontWeight: '800', color: colors.black },
  subtitle: { color: colors.muted, marginTop: 2, marginBottom: 16 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  childName: { fontSize: 17, fontWeight: '800', color: colors.black },
  batch: { color: colors.muted, fontSize: 12, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
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
  statValue: { fontSize: 22, fontWeight: '800', color: colors.black },
  statSub: { fontSize: 11, color: colors.muted, marginTop: 2 },
});
