import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  IndianRupee,
  Wallet,
  Users,
  UserCheck,
  CalendarClock,
  Phone,
} from 'lucide-react-native';
import { dashboardAPI, notificationAPI } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { Card, SectionTitle, StatusPill, LoadingView } from '../components/ui';
import AppHeader from '../components/common/AppHeader';
import StatTile from '../components/common/StatTile';
import AnimatedLineChart from '../components/common/AnimatedLineChart';
import TwoLineChart from '../components/common/TwoLineChart';
import FadeInUp from '../components/motion/FadeInUp';
import { colors, FONT } from '../theme/colors';
import {
  AttendanceTableFooter,
  AttendanceTableHeader,
  AttendanceTableRow,
  TableCol,
} from '../components/common/AttendanceTable';
import { formatCurrency, formatDateOrDash } from '../utils/format';
import { notifyError } from '../utils/notifyError';

// ₹6.4k / ₹1.2L — four cards share a row, so money is shortened.
const compactInr = (n: number) =>
  n >= 10000000
    ? `₹${(n / 10000000).toFixed(1).replace(/\.0$/, '')}Cr`
    : n >= 100000
    ? `₹${(n / 100000).toFixed(1).replace(/\.0$/, '')}L`
    : n >= 1000
    ? `₹${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`
    : `₹${Math.round(n)}`;

type Range = '1M' | '3M' | '6M' | '1Y';
const RANGES: Range[] = ['1M', '3M', '6M', '1Y'];

export default function DashboardScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [range, setRange] = useState<Range>('6M');
  const [attTab, setAttTab] = useState<'students' | 'staff'>('students');
  const [trend, setTrend] = useState<any>(null);
  const [unread, setUnread] = useState(0);

  const loadStats = useCallback(() => {
    return dashboardAPI
      .getStats()
      .then((res: any) => {
        if (res.success) setData(res.data);
      })
      .catch(notifyError);
  }, []);

  const loadTrend = useCallback(() => {
    return dashboardAPI
      .getTrend(range)
      .then((res: any) => {
        if (res.success) setTrend(res.data);
      })
      .catch(notifyError);
  }, [range]);

  useEffect(() => {
    loadStats().finally(() => setLoading(false));
  }, [loadStats]);

  useEffect(() => {
    notificationAPI
      .getAll({ limit: '1' })
      .then((r: any) => setUnread(r?.unreadCount || 0))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadTrend();
  }, [loadTrend]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadStats(), loadTrend()]);
    setRefreshing(false);
  };

  if (loading || !data) return <LoadingView />;

  const { stats, feeSummary, subscriptionAlerts = [] } = data;
  const hasStudents = (stats.totalStudents || 0) > 0;
  const hasStaff = (stats.totalEmployees || 0) > 0;
  const showAttendance = hasStudents || hasStaff;
  const activeAttTab =
    attTab === 'students'
      ? hasStudents
        ? 'students'
        : 'staff'
      : hasStaff
      ? 'staff'
      : 'students';
  const points = (trend?.points || []).map((p: any) => ({
    label: p.label,
    values: { income: p.income || 0, expense: p.expense || 0 },
  }));

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <AppHeader
        name={user?.name}
        avatar={user?.avatar}
        title="Dashboard"
        unread={unread}
        onMenu={() => navigation.navigate('Menu')}
        onSearch={() => navigation.navigate('StudentAttendanceTab')}
        onBell={() => navigation.navigate('Notifications')}
        onAvatar={() => navigation.navigate('Profile')}
      />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Text style={styles.sectionLabel}>Overview · This Month</Text>
        <View style={styles.row4}>
          <FadeInUp delay={0 * 70} style={styles.tileCell4}>
            <StatTile
              compact
              width="100%"
              label="FEES COLLECTED"
              value={compactInr(feeSummary?.collected || 0)}
              color={colors.green}
              icon={IndianRupee}
            />
          </FadeInUp>
          <FadeInUp delay={1 * 70} style={styles.tileCell4}>
            <StatTile
              compact
              width="100%"
              label="FEE REMAINING"
              value={compactInr(feeSummary?.remaining || 0)}
              color={colors.orange}
              icon={Wallet}
            />
          </FadeInUp>
          <FadeInUp delay={2 * 70} style={styles.tileCell4}>
            <StatTile
              compact
              width="100%"
              label="PRESENT TODAY"
              value={stats.studentsPresentToday ?? 0}
              color={colors.purple}
              icon={UserCheck}
            />
          </FadeInUp>
          <FadeInUp delay={3 * 70} style={styles.tileCell4}>
            <StatTile
              compact
              width="100%"
              label="TOTAL STUDENTS"
              value={stats.totalStudents ?? 0}
              color={colors.blue}
              icon={Users}
            />
          </FadeInUp>
        </View>

        <View style={styles.chartHead}>
          <View />
          <View style={styles.pillGroup}>
            {RANGES.map(r => (
              <TouchableOpacity
                key={r}
                onPress={() => setRange(r)}
                style={[
                  styles.pill,
                  styles.rangePill,
                  range === r && styles.pillActive,
                ]}
              >
                <Text
                  style={[
                    styles.pillText,
                    range === r && { color: colors.white },
                  ]}
                >
                  {r}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <Card>
          <SectionTitle
            title="Income vs Expense"
            sub={`${formatCurrency(
              trend?.totals?.income || 0,
            )} in · ${formatCurrency(
              trend?.totals?.expense || 0,
            )} out, last ${range}`}
          />
          {points.length > 0 ? (
            <AnimatedLineChart
              morph
              dots={false}
              legend
              series={[
                { key: 'income', label: 'Income', color: colors.green },
                { key: 'expense', label: 'Expense', color: colors.red },
              ]}
              data={points}
              format={n => (n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`)}
            />
          ) : (
            <Text style={styles.empty}>No data for this period</Text>
          )}
        </Card>

        <Text style={styles.sectionLabel}>Recent Students</Text>
        <FadeInUp delay={80} style={styles.tableCard}>
          <View style={[styles.tr, styles.thRow]}>
            <Text style={[styles.th, { flex: 2.2 }]}>Student</Text>
            <Text style={[styles.th, { flex: 1.3 }]}>Sport</Text>
            <Text style={[styles.th, { flex: 1.2, textAlign: 'right' }]}>
              Joined
            </Text>
          </View>
          {(data.latestStudents || []).length === 0 ? (
            <Text style={styles.empty}>No students yet</Text>
          ) : (
            (data.latestStudents || []).map(
              (st: any, i: number, arr: any[]) => (
                <View
                  key={st._id}
                  style={[styles.tr, i < arr.length - 1 && styles.trBorder]}
                >
                  <View style={[styles.tdName, { flex: 2.2 }]}>
                    <View style={styles.tdAvatar}>
                      <Text style={styles.tdAvatarText}>
                        {(st.firstName?.[0] || '?').toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.td} numberOfLines={1}>
                        {st.firstName} {st.lastName}
                      </Text>
                      <Text style={styles.tdSub} numberOfLines={1}>
                        {st.studentId}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.td, { flex: 1.3 }]} numberOfLines={1}>
                    {st.sport || '—'}
                  </Text>
                  <Text
                    style={[styles.tdSub, { flex: 1.2, textAlign: 'right' }]}
                    numberOfLines={1}
                  >
                    {formatDateOrDash(st.enrollmentDate)}
                  </Text>
                </View>
              ),
            )
          )}
        </FadeInUp>

        <Text style={styles.sectionLabel}>Student Growth · Last 6 Months</Text>
        <FadeInUp delay={120} style={styles.tableCard}>
          <Text style={styles.growthSub}>
            New registrations vs students who subscribed again
          </Text>
          <AnimatedLineChart
            legend
            series={[
              { key: 'new', label: 'New students', color: colors.purple },
              { key: 'repeat', label: 'Repeat students', color: colors.green },
            ]}
            data={(data.studentGrowth || []).map((g: any) => ({
              label: g.label,
              values: { new: g.newStudents, repeat: g.repeatStudents },
            }))}
          />
        </FadeInUp>

        <Text style={styles.sectionLabel}>Fee Payments · Last 6 Months</Text>
        <FadeInUp delay={130} style={styles.tableCard}>
          <Text style={styles.growthSub}>Paid on time vs not on time</Text>
          <TwoLineChart
            series={[
              { key: 'paid', label: 'Paid on time', color: colors.green },
              { key: 'late', label: 'Not on time', color: colors.red },
            ]}
            data={(data.feeTrend || []).map((t: any) => ({
              label: MONTHS[t.month - 1],
              values: { paid: t.paidOnTime, late: t.notOnTime },
            }))}
          />
        </FadeInUp>

        {showAttendance && (
          <>
            <View style={styles.chartHead}>
              <Text style={styles.sectionLabel}>
                Daily Attendance · Last 7 Days
              </Text>
              <View
                style={[
                  styles.pillGroup,
                  !(hasStudents && hasStaff) && { display: 'none' },
                ]}
              >
                {(['students', 'staff'] as const)
                  .filter(k => (k === 'students' ? hasStudents : hasStaff))
                  .map(k => (
                    <TouchableOpacity
                      key={k}
                      onPress={() => setAttTab(k)}
                      style={[
                        styles.pill,
                        activeAttTab === k && styles.pillActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.pillText,
                          activeAttTab === k && { color: colors.white },
                        ]}
                      >
                        {k === 'students' ? 'Students' : 'Staff'}
                      </Text>
                    </TouchableOpacity>
                  ))}
              </View>
            </View>
            <FadeInUp delay={140} style={styles.tableCard}>
              <AnimatedLineChart
                key={activeAttTab}
                legend
                series={[
                  { key: 'present', label: 'Present', color: '#00C48C' },
                  { key: 'late', label: 'Late', color: '#CA8A04' },
                  { key: 'halfDay', label: 'Half day', color: '#F59E0B' },
                  { key: 'onLeave', label: 'On leave', color: '#3B82F6' },
                  { key: 'absent', label: 'Absent', color: '#EF4444' },
                ]}
                data={(
                  (activeAttTab === 'students'
                    ? data.studentAttDaily
                    : data.staffAttDaily) || []
                )
                  .slice(-7)
                  .map((d: any) => ({
                    label: d.label,
                    values: {
                      present: d.present || 0,
                      late: d.late || 0,
                      halfDay: d.halfDay || 0,
                      onLeave: d.onLeave || 0,
                      absent: d.absent || 0,
                    },
                  }))}
              />
            </FadeInUp>
          </>
        )}

        <Text style={styles.sectionLabel}>Payroll Trend · Last 6 Months</Text>
        <FadeInUp delay={160} style={styles.tableCard}>
          <Text style={styles.growthSub}>Net payout (₹K)</Text>
          <AnimatedLineChart
            color={colors.blue}
            data={(data.payTrend || []).map((t: any) => ({
              label: MONTHS[t.month - 1],
              value: Math.round((t.total || 0) / 1000),
            }))}
            format={n => `${n}k`}
          />
        </FadeInUp>

        <Text style={styles.sectionLabel}>Headcount by Department</Text>
        <FadeInUp delay={160} style={styles.tableCard}>
          <AnimatedLineChart
            color={colors.blue}
            data={(data.deptHeadcounts || []).map((d: any) => ({
              label: d.name,
              value: d.count,
            }))}
          />
        </FadeInUp>

        <Text style={styles.sectionLabel}>Recent Staff Joinings</Text>
        <FadeInUp delay={180} style={styles.tableCard}>
          {(data.recentHires || []).length === 0 ? (
            <Text style={styles.empty}>No recent joinings</Text>
          ) : (
            (data.recentHires || [])
              .slice(0, 5)
              .map((p: any, i: number, arr: any[]) => (
                <View
                  key={p._id}
                  style={[styles.tr, i < arr.length - 1 && styles.trBorder]}
                >
                  <View style={[styles.tdName, { flex: 2.2 }]}>
                    <View style={styles.tdAvatar}>
                      <Text style={styles.tdAvatarText}>
                        {(p.firstName?.[0] || '?').toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.td} numberOfLines={1}>
                      {p.firstName} {p.lastName}
                    </Text>
                  </View>
                  <Text
                    style={[styles.tdSub, { flex: 1.2, textAlign: 'right' }]}
                    numberOfLines={1}
                  >
                    {formatDateOrDash(p.joiningDate || p.createdAt)}
                  </Text>
                </View>
              ))
          )}
        </FadeInUp>

        <Text style={styles.sectionLabel}>Pending Leave Requests</Text>
        <FadeInUp delay={200} style={styles.tableCard}>
          {(data.pendingLeaveList || []).length === 0 ? (
            <Text style={styles.empty}>
              All clear! No pending leave requests
            </Text>
          ) : (
            (data.pendingLeaveList || []).map(
              (l: any, i: number, arr: any[]) => (
                <TouchableOpacity
                  key={l._id}
                  onPress={() => navigation.navigate('Leave')}
                  style={[styles.tr, i < arr.length - 1 && styles.trBorder]}
                >
                  <View style={[styles.tdName, { flex: 2.2 }]}>
                    <View style={styles.tdAvatar}>
                      <Text style={styles.tdAvatarText}>
                        {(l.employee?.firstName?.[0] || '?').toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.td} numberOfLines={1}>
                        {l.employee?.firstName} {l.employee?.lastName}
                      </Text>
                      <Text style={styles.tdSub} numberOfLines={1}>
                        {l.leaveType} · {l.days} day{l.days > 1 ? 's' : ''}
                      </Text>
                    </View>
                  </View>
                  <Text
                    style={[styles.tdSub, { flex: 0.8, textAlign: 'right' }]}
                  >
                    Pending
                  </Text>
                </TouchableOpacity>
              ),
            )
          )}
        </FadeInUp>

        <View style={styles.renewHead}>
          <SectionTitle
            title="Recent Subscription Renewals"
            sub="Latest renewals, newest first"
          />
        </View>
        {subscriptionAlerts.length > 0 ? (
          <>
            <AttendanceTableHeader cols={RENEW_COLS} />
            {subscriptionAlerts.map((sub: any) => {
              const days = Math.ceil(
                (new Date(sub.renewalDate).getTime() - Date.now()) / 86400000,
              );
              const isPastDue = days < 0;
              const accent = isPastDue ? colors.red : colors.orange;
              const balance = Math.max(
                0,
                (sub.amount || 0) - (sub.amountPaid || 0),
              );
              const g = sub.student?.guardians?.[0];
              const inr = (n: number) => `₹${(n || 0).toLocaleString('en-IN')}`;
              return (
                <AttendanceTableRow
                  key={sub._id}
                  cols={RENEW_COLS}
                  avatar={sub.student?.avatar}
                  initials={`${sub.student?.firstName?.[0] || ''}${
                    sub.student?.lastName?.[0] || ''
                  }`.toUpperCase()}
                  name={`${sub.student?.firstName || ''} ${
                    sub.student?.lastName || ''
                  }`}
                  sub={`${sub.student?.studentId || ''} · ${
                    sub.student?.sport || '—'
                  }`}
                  status={{
                    label: isPastDue ? 'Ended' : 'Ending soon',
                    color: accent,
                    bg: accent + '1A',
                  }}
                  cells={{
                    left: isPastDue
                      ? `${Math.abs(days)}d over`
                      : days === 0
                      ? 'Today'
                      : `${days}d left`,
                  }}
                  details={[
                    { label: 'Plan', value: sub.planName },
                    { label: 'Billing', value: sub.billingCycle },
                    {
                      label: 'Renews',
                      value: formatDateOrDash(sub.renewalDate),
                    },
                    {
                      label: 'Started',
                      value: formatDateOrDash(sub.startDate),
                    },
                    { label: 'Total', value: inr(sub.amount) },
                    { label: 'Paid', value: inr(sub.amountPaid) },
                    { label: 'Due', value: inr(balance) },
                    { label: 'Batch', value: sub.student?.batch },
                    {
                      label: 'Guardian',
                      value: g
                        ? `${g.name}${g.phone ? ` · ${g.phone}` : ''}`
                        : '',
                    },
                  ]}
                />
              );
            })}
            <AttendanceTableFooter />
          </>
        ) : (
          <Card>
            <Text style={styles.empty}>No subscriptions ending soon</Text>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const RENEW_COLS: TableCol[] = [
  { key: 'name', label: 'Student', flex: 1, icon: 'users' },
  { key: 'left', label: 'Left', width: 64 },
  { key: 'status', label: 'Status', width: 70 },
  { key: 'kebab', label: '', width: 56 },
];

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  content: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24 },
  renewInfo: { flex: 1, minWidth: 0 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 1,
  },
  logo: { width: 146, height: 74 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  greeting: {
    flexShrink: 1,
    fontSize: 23,
    fontFamily: FONT.bold,
    fontWeight: '400',
    color: colors.black,
  },
  sectionLabel: {
    fontFamily: FONT.bold,
    fontSize: 12,
    fontWeight: '400',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: colors.black,
    marginTop: 14,
    marginBottom: 8,
  },
  row4: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  tileCell4: { flex: 1, minWidth: 0 },
  tableCard: {
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: colors.black,
    backgroundColor: colors.white,
    padding: 12,
    marginBottom: 16,
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  insightIcon: {
    width: 28,
    height: 28,
    borderWidth: 2,
    borderColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  insightText: {
    flex: 1,
    fontFamily: FONT.bold,
    fontSize: 12,
    color: colors.black,
  },
  growthSub: {
    fontFamily: FONT.medium,
    fontSize: 12,
    color: colors.muted,
    marginBottom: 8,
  },
  tr: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  trBorder: { borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  thRow: {
    borderBottomWidth: 2,
    borderBottomColor: colors.black,
    paddingTop: 0,
  },
  th: {
    fontFamily: FONT.bold,
    fontSize: 10,
    fontWeight: '400',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: colors.black,
  },
  td: {
    fontFamily: FONT.bold,
    fontSize: 13,
    fontWeight: '400',
    color: colors.black,
  },
  tdSub: { fontFamily: FONT.medium, fontSize: 11, color: colors.muted },
  tdName: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tdAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: colors.black,
    backgroundColor: colors.blue + '1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tdAvatarText: {
    fontFamily: FONT.bold,
    fontWeight: '400',
    color: colors.blue,
  },
  tileCell: { width: '48.5%' },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  chartHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  pillGroup: { flexDirection: 'row', gap: 6 },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.black,
    backgroundColor: colors.white,
  },
  pillActive: { backgroundColor: colors.blue },
  rangePill: { paddingHorizontal: 8 },
  pillText: { fontFamily: FONT.bold, fontSize: 12, color: colors.black },
  empty: { color: colors.muted, fontFamily: FONT.medium, fontSize: 13 },
  renewHead: { marginTop: 4 },
  renewCard: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRadius: 8,
    borderColor: colors.black,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    padding: 12,
    marginBottom: 12,
  },
  renewTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  renewAvatar: {
    width: 38,
    height: 38,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  renewAvatarText: { fontFamily: FONT.bold, fontSize: 16 },
  renewalName: { fontFamily: FONT.bold, fontSize: 14, color: colors.black },
  renewalSub: {
    fontFamily: FONT.medium,
    fontSize: 11,
    color: colors.muted,
    marginTop: 1,
  },
  renewMeta: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#0000001A',
  },
  metaCol: { flex: 1, minWidth: 0 },
  metaDivider: { width: 1, backgroundColor: '#0000001A', marginHorizontal: 8 },
  metaLabel: {
    fontFamily: FONT.bold,
    fontSize: 10,
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  metaValue: {
    fontFamily: FONT.bold,
    fontSize: 12,
    color: colors.black,
    marginTop: 2,
  },
  metaHint: {
    fontFamily: FONT.medium,
    fontSize: 10,
    color: colors.muted,
    marginTop: 1,
    textTransform: 'capitalize',
  },
  moneyRow: {
    flexDirection: 'row',
    marginTop: 10,
    backgroundColor: '#F8FAFF',
    borderWidth: 1,
    borderColor: '#0000001A',
    borderRadius: 8,
    padding: 8,
  },
  moneyCell: { flex: 1 },
  moneyValue: {
    fontFamily: FONT.bold,
    fontSize: 14,
    color: colors.black,
    marginTop: 2,
  },
  guardianRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  guardianText: {
    fontFamily: FONT.medium,
    fontSize: 12,
    color: colors.black,
    flex: 1,
  },
});
