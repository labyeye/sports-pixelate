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
  UserPlus,
  Users,
  UserCheck,
  UserX,
  CreditCard,
  CalendarClock,
  Phone,
} from 'lucide-react-native';
import { dashboardAPI, notificationAPI } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { Card, SectionTitle, StatusPill, LoadingView } from '../components/ui';
import AppHeader from '../components/common/AppHeader';
import StatTile from '../components/common/StatTile';
import AnimatedBarChart from '../components/common/AnimatedBarChart';
import FadeInUp from '../components/motion/FadeInUp';
import { colors, FONT } from '../theme/colors';
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

type Series = 'income' | 'expense';
type Range = '1M' | '3M' | '6M' | '1Y';
const RANGES: Range[] = ['1M', '3M', '6M', '1Y'];

export default function DashboardScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [series, setSeries] = useState<Series>('income');
  const [range, setRange] = useState<Range>('6M');
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
  const chartColor = series === 'income' ? colors.green : colors.red;
  const points = (trend?.points || []).map((p: any) => ({
    label: p.label,
    value: p[series] || 0,
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
              label="NEW STUDENTS"
              value={stats.newStudents ?? 0}
              color={colors.purple}
              icon={UserPlus}
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
          <View style={styles.pillGroup}>
            {(['income', 'expense'] as Series[]).map(s => (
              <TouchableOpacity
                key={s}
                onPress={() => setSeries(s)}
                style={[styles.pill, series === s && styles.pillActive]}
              >
                <Text
                  style={[
                    styles.pillText,
                    series === s && { color: colors.white },
                  ]}
                >
                  {s === 'income' ? 'Income' : 'Expense'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
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
            title={series === 'income' ? 'Income' : 'Expense'}
            sub={`${formatCurrency(
              trend?.totals?.[series] || 0,
            )} in the last ${range}`}
          />
          {points.length > 0 ? (
            <AnimatedBarChart
              key={`${series}-${range}`}
              series={[
                {
                  key: 'v',
                  label: series === 'income' ? 'Income' : 'Expense',
                  color: chartColor,
                },
              ]}
              data={points.map((p: any) => ({
                label: p.label,
                values: { v: p.value },
              }))}
              format={n => (n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`)}
            />
          ) : (
            <Text style={styles.empty}>No data for this period</Text>
          )}
        </Card>

        <Text style={styles.sectionLabel}>Today & Subscriptions</Text>
        <View style={styles.row4}>
          <FadeInUp delay={0 * 70} style={styles.tileCell4}>
            <StatTile
              compact
              width="100%"
              label="Present Today"
              value={stats.studentsPresentToday ?? 0}
              color={colors.green}
              icon={UserCheck}
            />
          </FadeInUp>
          <FadeInUp delay={1 * 70} style={styles.tileCell4}>
            <StatTile
              compact
              width="100%"
              label="Absent Today"
              value={stats.studentsAbsentToday ?? 0}
              color={colors.red}
              icon={UserX}
            />
          </FadeInUp>
          <FadeInUp delay={2 * 70} style={styles.tileCell4}>
            <StatTile
              compact
              width="100%"
              label="Active Plans"
              value={stats.activeSubscriptions ?? 0}
              color={colors.blue}
              icon={CreditCard}
            />
          </FadeInUp>
          <FadeInUp delay={3 * 70} style={styles.tileCell4}>
            <StatTile
              compact
              width="100%"
              label="Ending Soon"
              value={stats.endingSoon ?? 0}
              color={colors.orange}
              icon={CalendarClock}
            />
          </FadeInUp>
        </View>

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
          <AnimatedBarChart
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

        <View style={styles.renewHead}>
          <SectionTitle
            title="Recent Subscription Renewals"
            sub="Latest renewals, newest first"
          />
        </View>
        {subscriptionAlerts.length > 0 ? (
          subscriptionAlerts.map((sub: any) => {
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
              <View
                key={sub._id}
                style={[styles.renewCard, { borderLeftColor: accent }]}
              >
                <View style={styles.renewTop}>
                  <View
                    style={[
                      styles.renewAvatar,
                      { backgroundColor: accent + '1A', borderColor: accent },
                    ]}
                  >
                    <Text style={[styles.renewAvatarText, { color: accent }]}>
                      {(sub.student?.firstName?.[0] || '?').toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.renewInfo}>
                    <Text style={styles.renewalName} numberOfLines={1}>
                      {sub.student?.firstName} {sub.student?.lastName}
                    </Text>
                    <Text style={styles.renewalSub} numberOfLines={1}>
                      {sub.student?.studentId} · {sub.student?.sport || '—'}
                      {sub.student?.batch ? ` · ${sub.student.batch}` : ''}
                    </Text>
                  </View>
                  <StatusPill
                    label={isPastDue ? 'Ended' : 'Ending Soon'}
                    color={accent}
                  />
                </View>

                <View style={styles.renewMeta}>
                  <View style={styles.metaCol}>
                    <Text style={styles.metaLabel}>Plan</Text>
                    <Text style={styles.metaValue} numberOfLines={1}>
                      {sub.planName}
                    </Text>
                    {sub.billingCycle ? (
                      <Text style={styles.metaHint}>{sub.billingCycle}</Text>
                    ) : null}
                  </View>
                  <View style={styles.metaDivider} />
                  <View style={styles.metaCol}>
                    <Text style={styles.metaLabel}>Renews</Text>
                    <Text style={styles.metaValue} numberOfLines={1}>
                      {formatDateOrDash(sub.renewalDate)}
                    </Text>
                    <Text style={styles.metaHint}>
                      from {formatDateOrDash(sub.startDate)}
                    </Text>
                  </View>
                  <View style={styles.metaDivider} />
                  <View style={styles.metaCol}>
                    <Text style={styles.metaLabel}>Status</Text>
                    <Text style={[styles.metaValue, { color: accent }]}>
                      {isPastDue
                        ? `${Math.abs(days)}d overdue`
                        : days === 0
                        ? 'Due today'
                        : `${days}d left`}
                    </Text>
                  </View>
                </View>

                <View style={styles.moneyRow}>
                  <View style={styles.moneyCell}>
                    <Text style={styles.metaLabel}>Total</Text>
                    <Text style={styles.moneyValue}>{inr(sub.amount)}</Text>
                  </View>
                  <View style={styles.moneyCell}>
                    <Text style={styles.metaLabel}>Paid</Text>
                    <Text style={[styles.moneyValue, { color: colors.green }]}>
                      {inr(sub.amountPaid)}
                    </Text>
                  </View>
                  <View style={styles.moneyCell}>
                    <Text style={styles.metaLabel}>Due</Text>
                    <Text
                      style={[
                        styles.moneyValue,
                        { color: balance > 0 ? colors.red : colors.muted },
                      ]}
                    >
                      {inr(balance)}
                    </Text>
                  </View>
                </View>

                {g ? (
                  <View style={styles.guardianRow}>
                    <Phone size={12} color={colors.muted} strokeWidth={2.5} />
                    <Text style={styles.guardianText} numberOfLines={1}>
                      {g.name}
                      {g.phone ? ` · ${g.phone}` : ''}
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          })
        ) : (
          <Card>
            <Text style={styles.empty}>No subscriptions ending soon</Text>
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

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
    fontWeight: '800',
    color: colors.black,
  },
  sectionLabel: {
    fontFamily: FONT.bold,
    fontSize: 12,
    fontWeight: '800',
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
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: colors.black,
  },
  td: {
    fontFamily: FONT.bold,
    fontSize: 13,
    fontWeight: '700',
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
    fontWeight: '800',
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
