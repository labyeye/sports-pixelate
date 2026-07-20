import React, { useCallback, useEffect, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Clock,
  CalendarDays,
  IndianRupee,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Trophy,
  Receipt,
  FileText,
} from 'lucide-react-native';
import {
  studentAPI,
  studentAttendanceAPI,
  subscriptionAPI,
  holidayAPI,
  announcementAPI,
} from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import {
  Card,
  SectionTitle,
  Row,
  Avatar,
  Badge,
  KpiTile,
  LoadingView,
} from '../components/ui';
import { colors, FONT } from '../theme/colors';

function formatCurrency(n: number) {
  return `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
}

function localDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    '0',
  )}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtTime(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h < 12 ? 'AM' : 'PM';
  const hh = h % 12 || 12;
  return `${hh}:${m.toString().padStart(2, '0')} ${ampm}`;
}

const STATUS_COLOR: Record<string, string> = {
  present: colors.green,
  late: colors.orange,
  absent: colors.red,
  excused: colors.blue,
};

const TAB_DAYS = [
  { label: 'Today', offset: 0 },
  { label: 'Yesterday', offset: 1 },
  { label: '2 Days Ago', offset: 2 },
];

// Mirrors MyProfileScreen.tsx (the staff/employee home tab) exactly: header
// row with avatar + greeting, a small KPI row, an "Attendance" section with
// day tabs and a check-in/out style card, a "This Month" KPI grid, an active
// plan card, a latest payment card, upcoming holidays, announcements, and
// quick actions — same layout, scoped to the parent's (selected) child.
export default function ParentHomeScreen({ navigation }: any) {
  const { user } = useAuth();
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChild, setSelectedChild] = useState('');
  const [attendance, setAttendance] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  const now = new Date();

  const load = useCallback(async () => {
    const [studRes, attRes, subRes, holRes, annRes] = await Promise.allSettled([
      studentAPI.getAll(),
      studentAttendanceAPI.getAll({
        month: String(now.getMonth() + 1),
        year: String(now.getFullYear()),
        limit: '200',
      }),
      subscriptionAPI.getAll(),
      holidayAPI.getAll(),
      announcementAPI.getAll(),
    ]);
    if (studRes.status === 'fulfilled') {
      const data = studRes.value?.data || [];
      setChildren(data);
      setSelectedChild(prev => prev || data[0]?._id || '');
    }
    if (attRes.status === 'fulfilled') setAttendance(attRes.value?.data || []);
    if (subRes.status === 'fulfilled') setSubscriptions(subRes.value?.data || []);
    if (holRes.status === 'fulfilled') setHolidays(holRes.value?.data || []);
    if (annRes.status === 'fulfilled')
      setAnnouncements(annRes.value?.data || []);
  }, [now]);

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

  const greet = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  if (loading) return <LoadingView />;

  const child = children.find(c => c._id === selectedChild);
  const childAttendance = attendance.filter(
    a => a.student?._id === selectedChild,
  );
  const childSub = subscriptions.find(
    s => s.student?._id === selectedChild && s.status !== 'cancelled',
  );

  const presentDays = childAttendance.filter(a =>
    ['present', 'late'].includes(a.status),
  ).length;
  const absentDays = childAttendance.filter(a => a.status === 'absent').length;
  const lateDays = childAttendance.filter(a => a.status === 'late').length;
  const totalMarked = presentDays + absentDays;
  const attPct =
    totalMarked > 0 ? Math.round((presentDays / totalMarked) * 100) : 100;

  const recordFor = (offset: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - offset);
    const ds = localDateStr(d);
    return childAttendance.find(a => localDateStr(new Date(a.date)) === ds);
  };

  const tabDate = (offset: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - offset);
    return d.toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  };

  const activeRecord = recordFor(activeTab);

  const amountDue = Math.max(
    (childSub?.amount || 0) - (childSub?.amountPaid || 0),
    0,
  );
  const needsRenewal =
    !childSub ||
    (childSub.renewalDate && new Date(childSub.renewalDate) < new Date());

  const latestPayment = (childSub?.payments || [])
    .filter((p: any) => p.status === 'verified')
    .sort(
      (a: any, b: any) =>
        new Date(b.verifiedAt || b.submittedAt).getTime() -
        new Date(a.verifiedAt || a.submittedAt).getTime(),
    )[0];

  const upcomingHolidays = holidays
    .filter((h: any) => new Date(h.date) >= new Date(localDateStr(now)))
    .slice(0, 5);

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.headerRow}>
          <Avatar uri={user?.avatar} name={user?.name} size={56} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.greet}>{greet()},</Text>
            <Text style={styles.name}>{user?.name}</Text>
            {child ? (
              <Text style={styles.role}>
                {[child.firstName + ' ' + child.lastName, child.sport]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            ) : null}
          </View>
        </View>

        {children.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, marginBottom: 14, marginTop: 12 }}
          >
            {children.map(c => {
              const selected = c._id === selectedChild;
              return (
                <TouchableOpacity
                  key={c._id}
                  onPress={() => setSelectedChild(c._id)}
                  style={[styles.childChip, selected && styles.childChipActive]}
                >
                  <Avatar uri={c.avatar} name={c.firstName} size={22} />
                  <Text
                    style={[
                      styles.childChipText,
                      selected && styles.childChipTextActive,
                    ]}
                  >
                    {c.firstName}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        <View style={styles.kpiGrid}>
          <KpiTile
            label="Sport"
            value={child?.sport || '—'}
            sub={child?.batch}
            color={colors.blue}
            icon={Trophy}
          />
          <KpiTile
            label="Renewal"
            value={needsRenewal ? 'Due' : 'Active'}
            sub={needsRenewal ? 'Needs attention' : 'All caught up'}
            color={needsRenewal ? colors.orange : colors.green}
            icon={AlertCircle}
          />
          <KpiTile
            label="Amount Due"
            value={formatCurrency(amountDue)}
            sub="Outstanding"
            color={amountDue > 0 ? colors.red : colors.green}
            icon={IndianRupee}
          />
        </View>

        <SectionTitle title="Attendance" />
        <View style={styles.tabBar}>
          {TAB_DAYS.map((t, i) => (
            <TouchableOpacity
              key={t.label}
              style={[styles.tabBtn, activeTab === i && styles.tabBtnActive]}
              onPress={() => setActiveTab(i)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.tabBtnText,
                  activeTab === i && styles.tabBtnTextActive,
                ]}
              >
                {t.label}
              </Text>
              <Text
                style={[
                  styles.tabBtnDate,
                  activeTab === i && styles.tabBtnTextActive,
                ]}
              >
                {tabDate(t.offset)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Card style={styles.attDayCard}>
          {activeRecord ? (
            <>
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor:
                      STATUS_COLOR[activeRecord.status] || colors.muted,
                  },
                ]}
              >
                <Text style={styles.statusBadgeText}>
                  {activeRecord.status.replace(/_/g, ' ').toUpperCase()}
                </Text>
              </View>
              <View style={styles.attDayRow}>
                <View style={styles.attDayItem}>
                  <Clock size={16} color={colors.green} />
                  <Text style={styles.attDayItemLabel}>Check In</Text>
                  <Text style={styles.attDayItemVal}>
                    {fmtTime(activeRecord.checkIn)}
                  </Text>
                </View>
                <View style={styles.attDayDivider} />
                <View style={styles.attDayItem}>
                  <Clock size={16} color={colors.red} />
                  <Text style={styles.attDayItemLabel}>Check Out</Text>
                  <Text style={styles.attDayItemVal}>
                    {fmtTime(activeRecord.checkOut)}
                  </Text>
                </View>
              </View>
            </>
          ) : (
            <View style={styles.attDayEmpty}>
              <AlertCircle size={28} color={colors.muted} />
              <Text style={styles.attDayEmptyText}>No attendance record</Text>
              <Text style={styles.attDayEmptyDate}>{tabDate(activeTab)}</Text>
            </View>
          )}
        </Card>

        <SectionTitle title="This Month" />
        <View style={styles.kpiGrid}>
          <KpiTile
            label="Present"
            value={presentDays}
            color={colors.green}
            icon={CheckCircle2}
          />
          <KpiTile
            label="Absent"
            value={absentDays}
            color={colors.red}
            icon={AlertCircle}
          />
          <KpiTile
            label="Late"
            value={lateDays}
            color={colors.orange}
            icon={Clock}
          />
          <KpiTile
            label="Att %"
            value={`${attPct}%`}
            color={colors.blue}
            icon={TrendingUp}
          />
        </View>

        {childSub ? (
          <TouchableOpacity
            onPress={() => navigation?.navigate('SubscriptionsTab')}
            activeOpacity={0.8}
          >
            <Card>
              <SectionTitle title="Active Plan" />
              <Row
                title={childSub.planName}
                subtitle={`Renews ${
                  childSub.renewalDate
                    ? new Date(childSub.renewalDate).toLocaleDateString(
                        'en-IN',
                        { day: '2-digit', month: 'short', year: 'numeric' },
                      )
                    : '—'
                }`}
                right={
                  <Badge
                    label={needsRenewal ? 'Renewal Due' : 'Active'}
                    color={needsRenewal ? colors.orange : colors.green}
                  />
                }
                noBorder
              />
            </Card>
          </TouchableOpacity>
        ) : null}

        {latestPayment ? (
          <TouchableOpacity
            onPress={() => navigation?.navigate('SubscriptionsTab')}
            activeOpacity={0.8}
          >
            <Card>
              <SectionTitle title="Latest Payment" />
              <View style={styles.payslipRow}>
                <View>
                  <Text style={styles.payslipMonth}>
                    {new Date(
                      latestPayment.verifiedAt || latestPayment.submittedAt,
                    ).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </Text>
                  <Text style={styles.payslipStatus}>VERIFIED</Text>
                </View>
                <Text style={styles.payslipNet}>
                  {formatCurrency(latestPayment.amount)}
                </Text>
              </View>
            </Card>
          </TouchableOpacity>
        ) : null}

        {upcomingHolidays.length > 0 ? (
          <Card>
            <SectionTitle title="Upcoming Holidays" sub="Next few days" />
            {upcomingHolidays.map((h: any) => (
              <Row
                key={h._id}
                title={h.name}
                subtitle={new Date(h.date).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              />
            ))}
          </Card>
        ) : null}

        {announcements.length > 0 ? (
          <Card>
            <SectionTitle title="Announcements" />
            {announcements.map((a: any) => (
              <Row key={a._id} title={a.title} subtitle={a.content} />
            ))}
          </Card>
        ) : null}

        <SectionTitle title="Quick Actions" />
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={[styles.quickActionBtn, { backgroundColor: colors.blue }]}
            onPress={() => navigation?.navigate('SubscriptionsTab')}
          >
            <IndianRupee size={16} color={colors.white} />
            <Text style={styles.quickActionText}>Plans</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickActionBtn, { backgroundColor: colors.purple }]}
            onPress={() => navigation?.navigate('ParentAttendanceTab')}
          >
            <TrendingUp size={16} color={colors.white} />
            <Text style={styles.quickActionText}>Attendance</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickActionBtn, { backgroundColor: colors.orange }]}
            onPress={() => navigation?.navigate('BookingsTab')}
          >
            <CalendarDays size={16} color={colors.white} />
            <Text style={styles.quickActionText}>Bookings</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickActionBtn, { backgroundColor: colors.green }]}
            onPress={() => navigation?.navigate('ParentReport')}
          >
            <FileText size={16} color={colors.white} />
            <Text style={styles.quickActionText}>Report</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  greet: { fontSize: 12, color: colors.muted, fontWeight: '500' },
  name: { fontSize: 20, fontWeight: '800', color: colors.black },
  role: { fontSize: 12, color: colors.muted, marginTop: 2 },
  childChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 2,
    borderColor: colors.black,
    backgroundColor: colors.white,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  childChipActive: { backgroundColor: colors.blue },
  childChipText: { fontSize: 12, fontWeight: '700', color: colors.black },
  childChipTextActive: { color: colors.white },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  tabBar: {
    flexDirection: 'row',
    borderWidth: 2,
    borderColor: colors.black,
    backgroundColor: colors.white,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRightWidth: 1,
    borderRightColor: colors.black,
  },
  tabBtnActive: { backgroundColor: colors.blue },
  tabBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.black,
    textTransform: 'uppercase',
  },
  tabBtnDate: { fontSize: 10, color: colors.muted, marginTop: 2 },
  tabBtnTextActive: { color: colors.white },
  attDayCard: {
    borderTopWidth: 0,
    padding: 20,
    minHeight: 110,
    marginTop: 0,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 16,
  },
  statusBadgeText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  attDayRow: { flexDirection: 'row', alignItems: 'center' },
  attDayItem: { flex: 1, alignItems: 'center', gap: 5 },
  attDayItemLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
  },
  attDayItemVal: { fontSize: 15, fontWeight: '700', color: colors.black },
  attDayDivider: { width: 1, height: 48, backgroundColor: '#E5E7EB' },
  attDayEmpty: { alignItems: 'center', gap: 6, paddingVertical: 10 },
  attDayEmptyText: { fontSize: 13, fontWeight: '700', color: colors.muted },
  attDayEmptyDate: { fontSize: 11, color: colors.muted },
  payslipRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  payslipMonth: { fontSize: 15, fontWeight: '700', color: colors.black },
  payslipStatus: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.green,
    marginTop: 2,
  },
  payslipNet: { fontSize: 22, fontWeight: '800', color: colors.black },
  quickActions: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  quickActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderWidth: 2,
    borderColor: colors.black,
  },
  quickActionText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
});
