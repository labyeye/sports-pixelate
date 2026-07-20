import React, { useCallback, useEffect, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  launchCamera,
  launchImageLibrary,
  Asset,
} from 'react-native-image-picker';
import {
  Clock,
  CalendarDays,
  IndianRupee,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  LogIn,
} from 'lucide-react-native';
import {
  employeeAPI,
  attendanceAPI,
  payrollAPI,
  dashboardAPI,
  authAPI,
  attendanceSettingsAPI,
} from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import {
  Card,
  SectionTitle,
  Row,
  Avatar,
  KpiTile,
  LoadingView,
} from '../components/ui';
import { colors, FONT } from '../theme/colors';

function uriToBase64(uri: string): Promise<string> {
  return fetch(uri)
    .then(res => res.blob())
    .then(
      blob =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        }),
    );
}

// Caps dimensions so the re-encoded JPEG stays well under the backend's
// 3MB avatar limit, even for large camera photos.
const AVATAR_PICKER_OPTS = {
  mediaType: 'photo' as const,
  quality: 0.7 as const,
  maxWidth: 1024,
  maxHeight: 1024,
};

function pickAvatar(onPicked: (uri: string) => void) {
  Alert.alert('Change Photo', 'Choose a source', [
    {
      text: 'Camera',
      onPress: () =>
        launchCamera(AVATAR_PICKER_OPTS, r => {
          const a: Asset | undefined = r.assets?.[0];
          if (a?.uri) onPicked(a.uri);
        }),
    },
    {
      text: 'Gallery',
      onPress: () =>
        launchImageLibrary(AVATAR_PICKER_OPTS, r => {
          const a: Asset | undefined = r.assets?.[0];
          if (a?.uri) onPicked(a.uri);
        }),
    },
    { text: 'Cancel', style: 'cancel' },
  ]);
}

function localDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    '0',
  )}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtTime(iso: string) {
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
  half_day: colors.purple,
  on_leave: colors.blue,
  holiday: colors.lime,
  weekend: colors.muted,
};

const TAB_DAYS = [
  { label: 'Today', offset: 0 },
  { label: 'Yesterday', offset: 1 },
  { label: '2 Days Ago', offset: 2 },
];

export default function MyProfileScreen({ navigation }: any) {
  const { user, updateUser } = useAuth();
  const [empProfile, setEmpProfile] = useState<any>(null);
  const [essStats, setEssStats] = useState<any>(null);
  const [myAttendance, setMyAttendance] = useState<any[]>([]);
  const [latestPayroll, setLatestPayroll] = useState<any>(null);
  const [myBalance, setMyBalance] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const load = useCallback(async () => {
    const [profileRes, attRes, payRes, essRes, balRes] =
      await Promise.allSettled([
        employeeAPI.getMe(),
        attendanceAPI.getAll({
          month: String(month),
          year: String(year),
          limit: '200',
        }),
        payrollAPI.getMy(),
        dashboardAPI.getEmployeeStats(),
        attendanceSettingsAPI.getMyBalance(),
      ]);
    if (profileRes.status === 'fulfilled')
      setEmpProfile(profileRes.value?.data || profileRes.value);
    if (attRes.status === 'fulfilled')
      setMyAttendance(attRes.value?.data || []);
    if (payRes.status === 'fulfilled') {
      const pays = payRes.value?.data || [];
      setLatestPayroll(pays[0] || null);
    }
    if (essRes.status === 'fulfilled')
      setEssStats(essRes.value?.data || essRes.value);
    if (balRes.status === 'fulfilled') setMyBalance(balRes.value?.data || null);
  }, [month, year]);

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

  const handlePickPhoto = () => {
    pickAvatar(async uri => {
      setUploadingAvatar(true);
      try {
        const base64 = await uriToBase64(uri);
        const res: any = await authAPI.updateProfile({ avatar: base64 });
        const avatar = res?.data?.avatar || base64;
        updateUser({ avatar });
      } catch (e: any) {
        Alert.alert('Upload failed', e?.message || 'Could not update photo');
      } finally {
        setUploadingAvatar(false);
      }
    });
  };

  if (loading) return <LoadingView />;

  const presentDays = myAttendance.filter(
    a => ['present', 'late', 'half_day'].includes(a.status) || a.checkIn,
  ).length;
  const absentDays = myAttendance.filter(a => a.status === 'absent').length;
  const lateDays = myAttendance.filter(a => a.status === 'late').length;
  const totalMarked = presentDays + absentDays;
  const attPct =
    totalMarked > 0 ? Math.round((presentDays / totalMarked) * 100) : 100;

  const recordFor = (offset: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - offset);
    const ds = localDateStr(d);
    return myAttendance.find(a => localDateStr(new Date(a.date)) === ds);
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
  const showBirthday =
    essStats?.birthdayWishes?.isTodayUserBirthday ||
    essStats?.birthdayWishes?.todayBirthdays?.length > 0 ||
    essStats?.workAnniversary?.isTodayUserAnniversary ||
    essStats?.workAnniversary?.todayAnniversaries?.length > 0;

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
          <Avatar
            uri={empProfile?.avatar || user?.avatar}
            name={user?.name}
            size={56}
            onPress={handlePickPhoto}
          />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.greet}>{greet()},</Text>
            <Text style={styles.name}>{user?.name}</Text>
            {empProfile?.designation || empProfile?.department?.name ? (
              <Text style={styles.role}>
                {[empProfile?.designation, empProfile?.department?.name]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            ) : null}
          </View>
        </View>
        {uploadingAvatar ? (
          <Text style={styles.uploadingText}>Uploading photo…</Text>
        ) : null}

        {showBirthday ? (
          <Card style={{ backgroundColor: '#FDF2F8' }}>
            {essStats.birthdayWishes?.isTodayUserBirthday && (
              <Text style={styles.wishTitle}>🎂 Happy Birthday to You! 🎉</Text>
            )}
            {essStats.birthdayWishes?.todayBirthdays?.map((b: any) => (
              <Text key={b._id} style={styles.wishText}>
                It's {b.firstName} {b.lastName}'s birthday today! 🎁
              </Text>
            ))}
            {essStats.workAnniversary?.isTodayUserAnniversary && (
              <Text style={styles.wishTitle}>
                🎖️ Happy Work Anniversary! 👏
              </Text>
            )}
            {essStats.workAnniversary?.todayAnniversaries?.map((a: any) => (
              <Text key={a._id} style={styles.wishText}>
                Happy Work Anniversary to {a.firstName} {a.lastName}! 🎖️
              </Text>
            ))}
          </Card>
        ) : null}

        <View style={styles.kpiGrid}>
          <KpiTile
            label="Today's Shift"
            value={essStats?.todayShift?.name || 'General'}
            sub={
              essStats?.todayShift
                ? `${essStats.todayShift.startTime} – ${essStats.todayShift.endTime}`
                : undefined
            }
            color={colors.blue}
            icon={Clock}
          />
          <KpiTile
            label="Approvals"
            value={essStats?.pendingApprovalsCount || 0}
            sub="Requires action"
            color={colors.orange}
            icon={AlertCircle}
          />
          <KpiTile
            label="Unpaid Salary"
            value={essStats?.pendingSalary?.length || 0}
            sub="Slips pending"
            color={colors.green}
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
                  <LogIn size={16} color={colors.green} />
                  <Text style={styles.attDayItemLabel}>Check In</Text>
                  <Text style={styles.attDayItemVal}>
                    {activeRecord.checkIn ? fmtTime(activeRecord.checkIn) : '—'}
                  </Text>
                </View>
                <View style={styles.attDayDivider} />
                <View style={styles.attDayItem}>
                  <LogIn
                    size={16}
                    color={colors.red}
                    style={{ transform: [{ scaleX: -1 }] }}
                  />
                  <Text style={styles.attDayItemLabel}>Check Out</Text>
                  <Text style={styles.attDayItemVal}>
                    {activeRecord.checkOut
                      ? fmtTime(activeRecord.checkOut)
                      : '—'}
                  </Text>
                </View>
                <View style={styles.attDayDivider} />
                <View style={styles.attDayItem}>
                  <Clock size={16} color={colors.blue} />
                  <Text style={styles.attDayItemLabel}>Hours</Text>
                  <Text style={styles.attDayItemVal}>
                    {activeRecord.workHours > 0
                      ? `${activeRecord.workHours.toFixed(1)}h`
                      : '—'}
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

        {myBalance ? (
          <Card>
            <SectionTitle title="This Month's Balance" />
            <Row
              title="Late Arrivals"
              subtitle={`${myBalance.lateUsed}/${myBalance.lateAllowed} left`}
              noBorder={!myBalance.leaveUsed?.length}
            />
            {(myBalance.leaveUsed || []).map((l: any, i: number) => (
              <Row
                key={l.leaveType}
                title={l.leaveType.replace(/_/g, ' ').toUpperCase()}
                subtitle={`${l.daysUsed}/${l.daysAllowed}d used`}
                noBorder={i === myBalance.leaveUsed.length - 1}
              />
            ))}
          </Card>
        ) : null}

        {latestPayroll ? (
          <TouchableOpacity
            onPress={() => navigation?.navigate('MyPayroll')}
            activeOpacity={0.8}
          >
            <Card>
              <SectionTitle title="Latest Payslip" />
              <View style={styles.payslipRow}>
                <View>
                  <Text style={styles.payslipMonth}>
                    {new Date(0, (latestPayroll.month || 1) - 1).toLocaleString(
                      'en-IN',
                      { month: 'short' },
                    )}{' '}
                    {latestPayroll.year}
                  </Text>
                  <Text style={styles.payslipStatus}>
                    {latestPayroll.status?.toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.payslipNet}>
                  ₹{(latestPayroll.netSalary || 0).toLocaleString('en-IN')}
                </Text>
              </View>
            </Card>
          </TouchableOpacity>
        ) : null}

        {essStats?.upcomingHolidays?.length > 0 ? (
          <Card>
            <SectionTitle title="Upcoming Holidays" sub="Next 30 days" />
            {essStats.upcomingHolidays.map((h: any) => (
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

        {essStats?.announcements?.length > 0 ? (
          <Card>
            <SectionTitle title="Announcements" />
            {essStats.announcements.map((a: any) => (
              <Row key={a._id} title={a.title} subtitle={a.content} />
            ))}
          </Card>
        ) : null}

        <SectionTitle title="Quick Actions" />
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={[styles.quickActionBtn, { backgroundColor: colors.blue }]}
            onPress={() => navigation?.navigate('MyPayroll')}
          >
            <IndianRupee size={16} color={colors.white} />
            <Text style={styles.quickActionText}>Payroll</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickActionBtn, { backgroundColor: colors.purple }]}
            onPress={() => navigation?.navigate('MyReport')}
          >
            <TrendingUp size={16} color={colors.white} />
            <Text style={styles.quickActionText}>Report</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickActionBtn, { backgroundColor: colors.orange }]}
            onPress={() => navigation?.navigate('MyLoans')}
          >
            <CalendarDays size={16} color={colors.white} />
            <Text style={styles.quickActionText}>Loans</Text>
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
  uploadingText: {
    color: colors.muted,
    fontSize: 12,
    marginBottom: 12,
    marginLeft: 68,
  },
  wishTitle: { fontSize: 14, fontFamily: FONT.bold, color: colors.black },
  wishText: { fontSize: 12, color: colors.black, marginTop: 2 },
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
