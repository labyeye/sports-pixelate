import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Users,
  Clock,
  GraduationCap,
  CalendarClock,
  Wallet,
  IndianRupee,
  CalendarDays,
  Building2,
} from 'lucide-react-native';
import { dashboardAPI } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import {
  KpiTile,
  Card,
  SectionTitle,
  Row,
  Badge,
  LoadingView,
} from '../components/ui';
import { colors } from '../theme/colors';

function formatCurrency(n: number) {
  return `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
}

export default function DashboardScreen() {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    return dashboardAPI
      .getStats()
      .then((res: any) => {
        if (res.success) setData(res.data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (loading || !data) return <LoadingView />;

  const { stats, subscriptionAlerts = [] } = data;
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Text style={styles.greeting}>
          {greeting}, {user?.name?.split(' ')[0]} 👋
        </Text>
        <Text style={styles.subtitle}>
          Here's your academy overview for today
        </Text>

        <View style={styles.kpiGrid}>
          <KpiTile
            label="Employees"
            value={stats.totalEmployees}
            sub={`${stats.activeEmployees} active`}
            color={colors.blue}
            icon={Users}
          />
          <KpiTile
            label="Attendance"
            value={`${stats.attendanceRate}%`}
            sub={`${stats.todayPresent} present today`}
            color={colors.orange}
            icon={Clock}
          />
          <KpiTile
            label="Students"
            value={stats.totalStudents}
            sub="Active enrollments"
            color={colors.purple}
            icon={GraduationCap}
          />
          <KpiTile
            label="Bookings"
            value={stats.totalBookings}
            sub={`${stats.todayBookings} today`}
            color={colors.orange}
            icon={CalendarClock}
          />
          <KpiTile
            label="Subscription Income"
            value={formatCurrency(stats.subscriptionIncome)}
            sub="This month"
            color={colors.green}
            icon={Wallet}
          />
          <KpiTile
            label="Monthly Payroll"
            value={formatCurrency(stats.monthlyPayroll)}
            sub="Paid this month"
            color={colors.orange}
            icon={IndianRupee}
          />
          <KpiTile
            label="Pending Leaves"
            value={stats.pendingLeaves}
            sub="Awaiting approval"
            color={colors.blue}
            icon={CalendarDays}
          />
          <KpiTile
            label="Departments"
            value={stats.departments}
            sub="Active teams"
            color={colors.green}
            icon={Building2}
          />
        </View>

        <Card>
          <SectionTitle
            title="Subscription Renewals"
            sub="Ending within 7 days or already past due"
          />
          {subscriptionAlerts.length > 0 ? (
            subscriptionAlerts.map((sub: any) => {
              const isPastDue = new Date(sub.renewalDate) < new Date();
              return (
                <Row
                  key={sub._id}
                  title={`${sub.student?.firstName} ${sub.student?.lastName}`}
                  subtitle={`${sub.planName} · ${new Date(
                    sub.renewalDate,
                  ).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                  })}`}
                  right={
                    <Badge
                      label={isPastDue ? 'Ended' : 'Ending Soon'}
                      color={isPastDue ? colors.red : colors.orange}
                    />
                  }
                />
              );
            })
          ) : (
            <Text style={{ color: colors.muted }}>
              No subscriptions ending soon
            </Text>
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  greeting: { fontSize: 22, fontWeight: '800', color: colors.black },
  subtitle: { color: colors.muted, marginTop: 2, marginBottom: 16 },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
});
