import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  Settings,
  Sun,
  CloudSun,
  Moon,
  IndianRupee,
  Wallet,
  UserPlus,
  Users,
  UserCheck,
  UserX,
  Phone,
} from 'lucide-react-native';
import { dashboardAPI } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import {
  KpiTile,
  Card,
  SectionTitle,
  StatusPill,
  Avatar,
  LoadingView,
} from '../components/ui';
import { AreaChart } from '../components/charts';
import { colors, FONT } from '../theme/colors';
import { formatCurrency, formatDateOrDash } from '../utils/format';
import { notifyError } from '../utils/notifyError';

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
    loadTrend();
  }, [loadTrend]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadStats(), loadTrend()]);
    setRefreshing(false);
  };

  if (loading || !data) return <LoadingView />;

  const { stats, feeSummary, subscriptionAlerts = [] } = data;
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const GreetIcon = hour < 12 ? Sun : hour < 17 ? CloudSun : Moon;
  const greetColor =
    hour < 12 ? colors.orange : hour < 17 ? colors.blue : colors.purple;
  const chartColor = series === 'income' ? colors.green : colors.red;
  const points = (trend?.points || []).map((p: any) => ({
    label: p.label,
    value: p[series] || 0,
  }));

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.header}>
          <Image
            source={require('../assets/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => navigation.navigate('Settings')}
              accessibilityLabel="Settings"
            >
              <Settings size={18} color={colors.black} strokeWidth={2.5} />
            </TouchableOpacity>
            <Avatar
              uri={user?.avatar}
              name={user?.name}
              size={38}
              onPress={undefined}
            />
          </View>
        </View>

        <View style={styles.greetRow}>
          <Text style={styles.greeting} numberOfLines={1}>
            {greeting}, {user?.name?.split(' ')[0]}
          </Text>
          <GreetIcon size={30} color={greetColor} strokeWidth={2.5} />
        </View>

        <View style={styles.kpiGrid}>
          <KpiTile
            label="Fee Collected (This Month)"
            value={formatCurrency(feeSummary?.collected || 0)}
            color={colors.green}
            solid
            icon={IndianRupee}
          />
          <KpiTile
            label="Fee Remaining (This Month)"
            value={formatCurrency(feeSummary?.remaining || 0)}
            color={colors.orange}
            solid
            icon={Wallet}
          />
          <KpiTile
            label="New Students (This Month)"
            value={stats.newStudents ?? 0}
            color={colors.purple}
            solid
            icon={UserPlus}
          />
          <KpiTile
            label="Total Students"
            value={stats.totalStudents ?? 0}
            color={colors.blue}
            solid
            icon={Users}
          />
          <KpiTile
            label="Present Today"
            value={stats.studentsPresentToday ?? 0}
            color={colors.green}
            solid
            icon={UserCheck}
          />
          <KpiTile
            label="Absent Today"
            value={stats.studentsAbsentToday ?? 0}
            color={colors.red}
            solid
            icon={UserX}
          />
        </View>

        <View style={styles.chartHead}>
          <View style={styles.pillGroup}>
            {(['income', 'expense'] as Series[]).map(s => (
              <TouchableOpacity
                key={s}
                onPress={() => setSeries(s)}
                style={[
                  styles.pill,
                  series === s && styles.pillActive,
                ]}
              >
                <Text
                  style={[styles.pillText, series === s && { color: colors.white }]}
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
                  style={[styles.pillText, range === r && { color: colors.white }]}
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
            sub={`${formatCurrency(trend?.totals?.[series] || 0)} in the last ${range}`}
          />
          {points.length > 0 ? (
            <AreaChart
              data={points}
              color={chartColor}
              format={n => (n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`)}
            />
          ) : (
            <Text style={styles.empty}>No data for this period</Text>
          )}
        </Card>

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
  content: { padding: 16 },
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
