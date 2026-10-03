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
  FilterPills,
  LoadingView,
} from '../components/ui';
import { colors, FONT } from '../theme/colors';
import { formatCurrency, formatDateOrDash } from '../utils/format';
import { notifyError } from '../utils/notifyError';

export default function DashboardScreen() {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [joinTab, setJoinTab] = useState<'staff' | 'students'>('staff');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    return dashboardAPI
      .getStats()
      .then((res: any) => {
        if (res.success) setData(res.data);
      })
      .catch(notifyError);
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

  const {
    stats,
    subscriptionAlerts = [],
    recentHires = [],
    recentStudents = [],
  } = data;
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
              const days = Math.ceil(
                (new Date(sub.renewalDate).getTime() - Date.now()) / 86400000,
              );
              const isPastDue = days < 0;
              const balance = Math.max(
                0,
                (sub.amount || 0) - (sub.amountPaid || 0),
              );
              const g = sub.student?.guardians?.[0];
              return (
                <View key={sub._id} style={styles.renewal}>
                  <View style={styles.renewalTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.renewalName}>
                        {sub.student?.firstName} {sub.student?.lastName}
                      </Text>
                      <Text style={styles.renewalSub}>
                        {sub.student?.studentId} · {sub.student?.sport || '—'}
                        {sub.student?.batch ? ` · ${sub.student.batch}` : ''}
                      </Text>
                    </View>
                    <Badge
                      label={isPastDue ? 'Ended' : 'Ending Soon'}
                      color={isPastDue ? colors.red : colors.orange}
                    />
                  </View>
                  <View style={styles.renewalGrid}>
                    <Text style={styles.renewalCell}>
                      Plan: <Text style={styles.bold}>{sub.planName}</Text>
                      {sub.billingCycle ? ` (${sub.billingCycle})` : ''}
                    </Text>
                    <Text style={styles.renewalCell}>
                      {formatDateOrDash(sub.startDate)} →{' '}
                      <Text style={styles.bold}>{formatDateOrDash(sub.renewalDate)}</Text>
                    </Text>
                    <Text
                      style={[
                        styles.renewalCell,
                        {
                          color: isPastDue ? colors.red : colors.orange,
                          fontFamily: FONT.bold,
                        },
                      ]}
                    >
                      {isPastDue
                        ? `${Math.abs(days)}d overdue`
                        : days === 0
                        ? 'Due today'
                        : `${days}d left`}
                    </Text>
                    <Text style={styles.renewalCell}>
                      ₹{(sub.amount || 0).toLocaleString('en-IN')} · Paid ₹
                      {(sub.amountPaid || 0).toLocaleString('en-IN')} ·{' '}
                      <Text
                        style={{
                          color: balance > 0 ? colors.red : colors.muted,
                          fontFamily: FONT.bold,
                        }}
                      >
                        Due ₹{balance.toLocaleString('en-IN')}
                      </Text>
                    </Text>
                    {g ? (
                      <Text style={styles.renewalCell}>
                        {g.name}
                        {g.phone ? ` · ${g.phone}` : ''}
                      </Text>
                    ) : null}
                  </View>
                </View>
              );
            })
          ) : (
            <Text style={{ color: colors.muted }}>
              No subscriptions ending soon
            </Text>
          )}
        </Card>

        <Card>
          <SectionTitle
            title="Recent Joinings"
            sub={`${stats.newHires ?? 0} staff · ${
              stats.newStudents ?? 0
            } students this month`}
          />
          <FilterPills
            options={[
              { value: 'staff', label: 'Staff' },
              { value: 'students', label: 'Students' },
            ]}
            value={joinTab}
            onChange={v => setJoinTab(v as 'staff' | 'students')}
          />
          {(joinTab === 'staff' ? recentHires : recentStudents).length > 0 ? (
            (joinTab === 'staff' ? recentHires : recentStudents).map(
              (p: any) => (
                <Row
                  key={p._id}
                  title={`${p.firstName} ${p.lastName}`}
                  subtitle={
                    joinTab === 'staff'
                      ? `${p.designation || 'Staff'} · ${
                          p.department?.name || '—'
                        }`
                      : `${p.sport || '—'}${p.batch ? ` · ${p.batch}` : ''} · ${
                          p.studentId
                        }`
                  }
                  right={
                    <Text style={styles.joinDate}>
                      {new Date(
                        joinTab === 'staff' ? p.joinDate : p.enrollmentDate,
                      ).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                      })}
                    </Text>
                  }
                />
              ),
            )
          ) : (
            <Text style={{ color: colors.muted }}>
              No new {joinTab === 'staff' ? 'hires' : 'students'} this month
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
  renewal: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#0000001A',
  },
  renewalTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  renewalName: { fontFamily: FONT.bold, fontSize: 14, color: colors.black },
  renewalSub: { fontFamily: FONT.medium, fontSize: 12, color: colors.muted },
  renewalGrid: { marginTop: 6, gap: 2 },
  renewalCell: { fontFamily: FONT.medium, fontSize: 12, color: colors.black },
  bold: { fontFamily: FONT.bold },
  joinDate: { fontFamily: FONT.bold, fontSize: 11, color: colors.muted },
});
