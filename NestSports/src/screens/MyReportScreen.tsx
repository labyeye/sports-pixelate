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
  Clock,
  CheckCircle2,
  XCircle,
  AlarmClock,
  CalendarDays,
  Clock3,
} from 'lucide-react-native';
import { employeeAPI, attendanceAPI } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { KpiTile, LoadingView, EmptyState } from '../components/ui';
import { colors } from '../theme/colors';

export default function MyReportScreen() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<{
    total: number;
    present: number;
    absent: number;
    late: number;
    onLeave: number;
    halfDay: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const now = new Date();
    const empRes: any = await employeeAPI.getAll({ search: user?.email || '' });
    const employee = (empRes.data || [])[0];
    if (!employee) {
      setSummary(null);
      return;
    }
    const attRes: any = await attendanceAPI.getAll({
      employeeId: employee._id,
      month: String(now.getMonth() + 1),
      year: String(now.getFullYear()),
      limit: '60',
    });
    const records = attRes.data || [];
    const present = records.filter(
      (r: any) => r.status === 'present' || r.status === 'late',
    ).length;
    const absent = records.filter((r: any) => r.status === 'absent').length;
    const late = records.filter((r: any) => r.status === 'late').length;
    const onLeave = records.filter((r: any) => r.status === 'on_leave').length;
    const halfDay = records.filter((r: any) => r.status === 'half_day').length;
    const holidays = records.filter(
      (r: any) => r.status === 'holiday' || r.status === 'weekend',
    ).length;
    const total = records.length - holidays;
    setSummary({ total, present, absent, late, onLeave, halfDay });
  }, [user]);

  useEffect(() => {
    load()
      .catch(() => setSummary(null))
      .finally(() => setLoading(false));
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load().catch(() => {});
    setRefreshing(false);
  };

  if (loading) return <LoadingView />;
  if (!summary) return <EmptyState title="Couldn't load your report" />;

  const rate =
    summary.total > 0 ? Math.round((summary.present / summary.total) * 100) : 0;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Text style={styles.title}>My Report</Text>
        <Text style={styles.subtitle}>Attendance summary for this month</Text>

        <View style={styles.kpiGrid}>
          <KpiTile
            label="Attendance Rate"
            value={`${rate}%`}
            sub={`${summary.present}/${summary.total} days`}
            color={colors.blue}
            icon={Clock}
          />
          <KpiTile
            label="Present"
            value={summary.present}
            color={colors.green}
            icon={CheckCircle2}
          />
          <KpiTile
            label="Absent"
            value={summary.absent}
            color={colors.red}
            icon={XCircle}
          />
          <KpiTile
            label="Late"
            value={summary.late}
            color={colors.orange}
            icon={AlarmClock}
          />
          <KpiTile
            label="On Leave"
            value={summary.onLeave}
            color={colors.purple}
            icon={CalendarDays}
          />
          <KpiTile
            label="Half Day"
            value={summary.halfDay}
            color={colors.yellow}
            icon={Clock3}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  title: { fontSize: 24, fontWeight: '800', color: colors.black },
  subtitle: { color: colors.muted, marginTop: 2, marginBottom: 16 },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
});
