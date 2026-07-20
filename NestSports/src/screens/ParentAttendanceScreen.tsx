import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  ChevronLeft,
  ChevronRight,
  Clock,
  UserCheck,
  UserX,
  ShieldAlert,
  TrendingUp,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from 'lucide-react-native';
import { studentAPI, studentAttendanceAPI } from '../api/client';
import {
  Card,
  Avatar,
  Badge,
  Row,
  KpiTile,
  EmptyState,
  LoadingView,
} from '../components/ui';
import { colors, FONT } from '../theme/colors';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const STATUS_COLOR: Record<string, string> = {
  present: colors.green,
  late: colors.orange,
  absent: colors.red,
  excused: colors.blue,
};

const STATUS_ICON: Record<string, any> = {
  present: CheckCircle2,
  late: Clock,
  absent: XCircle,
  excused: AlertCircle,
};

function fmtTime(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h < 12 ? 'AM' : 'PM';
  const hh = h % 12 || 12;
  return `${hh}:${m.toString().padStart(2, '0')} ${ampm}`;
}

export default function ParentAttendanceScreen() {
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChild, setSelectedChild] = useState('');
  const [monthCursor, setMonthCursor] = useState(() => {
    const d = new Date();
    return { month: d.getMonth(), year: d.getFullYear() };
  });
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadChildren = useCallback(async () => {
    const res: any = await studentAPI.getAll();
    const data = res.data || [];
    setChildren(data);
    setSelectedChild(prev => prev || data[0]?._id || '');
  }, []);

  const loadAttendance = useCallback(async () => {
    const res: any = await studentAttendanceAPI.getAll({
      month: String(monthCursor.month + 1),
      year: String(monthCursor.year),
      limit: '200',
    });
    setRecords(res.data || []);
  }, [monthCursor.month, monthCursor.year]);

  useEffect(() => {
    loadChildren().catch(() => {});
  }, [loadChildren]);

  useEffect(() => {
    setLoading(true);
    loadAttendance()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [loadAttendance]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadChildren(), loadAttendance()]).catch(() => {});
    setRefreshing(false);
  };

  const shiftMonth = (delta: number) => {
    setMonthCursor(p => {
      let month = p.month + delta;
      let year = p.year;
      if (month < 0) {
        month = 11;
        year -= 1;
      } else if (month > 11) {
        month = 0;
        year += 1;
      }
      return { month, year };
    });
  };

  const childRecords = useMemo(
    () =>
      [...records]
        .filter(r => r.student?._id === selectedChild)
        .sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        ),
    [records, selectedChild],
  );

  const summary = useMemo(() => {
    const present = childRecords.filter(r => r.status === 'present').length;
    const late = childRecords.filter(r => r.status === 'late').length;
    const absent = childRecords.filter(r => r.status === 'absent').length;
    const excused = childRecords.filter(r => r.status === 'excused').length;
    const marked = present + late + absent;
    const rate = marked > 0 ? Math.round(((present + late) / marked) * 100) : 0;
    return { present, late, absent, excused, rate };
  }, [childRecords]);

  const child = children.find(c => c._id === selectedChild);

  if (loading && children.length === 0) return <LoadingView />;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Attendance</Text>
      </View>

      {children.length === 0 ? (
        <EmptyState
          title="No children linked to your account yet"
          sub="Contact the academy to link your child's profile."
        />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {children.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, marginBottom: 14 }}
            >
              {children.map(c => {
                const selected = c._id === selectedChild;
                return (
                  <TouchableOpacity
                    key={c._id}
                    onPress={() => setSelectedChild(c._id)}
                    style={[
                      styles.childChip,
                      selected && styles.childChipActive,
                    ]}
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

          {child ? (
            <View style={styles.childHeaderRow}>
              <Avatar uri={child.avatar} name={child.firstName} size={44} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.childName}>
                  {child.firstName} {child.lastName}
                </Text>
                {child.batch ? (
                  <Text style={styles.batch}>{child.batch}</Text>
                ) : null}
              </View>
              <Badge label={child.sport} color={colors.blue} />
            </View>
          ) : null}

          <View style={styles.monthNav}>
            <TouchableOpacity onPress={() => shiftMonth(-1)} hitSlop={8}>
              <ChevronLeft size={20} color={colors.black} />
            </TouchableOpacity>
            <Text style={styles.monthLabel}>
              {MONTHS[monthCursor.month]} {monthCursor.year}
            </Text>
            <TouchableOpacity onPress={() => shiftMonth(1)} hitSlop={8}>
              <ChevronRight size={20} color={colors.black} />
            </TouchableOpacity>
          </View>

          <View style={styles.kpiGrid}>
            <KpiTile
              label="Present"
              value={summary.present}
              color={colors.green}
              icon={UserCheck}
            />
            <KpiTile
              label="Late"
              value={summary.late}
              color={colors.orange}
              icon={Clock}
            />
            <KpiTile
              label="Absent"
              value={summary.absent}
              color={colors.red}
              icon={UserX}
            />
            <KpiTile
              label="Excused"
              value={summary.excused}
              color={colors.blue}
              icon={ShieldAlert}
            />
            <KpiTile
              label="Att %"
              value={`${summary.rate}%`}
              color={colors.purple}
              icon={TrendingUp}
            />
          </View>

          {loading ? (
            <LoadingView />
          ) : childRecords.length === 0 ? (
            <EmptyState
              title="No attendance records"
              sub={`for ${MONTHS[monthCursor.month]} ${monthCursor.year}`}
            />
          ) : (
            <Card>
              {childRecords.map((r, i) => {
                const Icon = STATUS_ICON[r.status] || AlertCircle;
                return (
                  <Row
                    key={r._id}
                    noBorder={i === childRecords.length - 1}
                    left={
                      <View
                        style={[
                          styles.statusIconWrap,
                          {
                            borderColor: STATUS_COLOR[r.status] || colors.muted,
                          },
                        ]}
                      >
                        <Icon
                          size={14}
                          color={STATUS_COLOR[r.status] || colors.muted}
                        />
                      </View>
                    }
                    title={new Date(r.date).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                    subtitle={`${fmtTime(r.checkIn)} – ${fmtTime(r.checkOut)}`}
                    right={
                      <Badge
                        label={r.status.toUpperCase()}
                        color={STATUS_COLOR[r.status] || colors.muted}
                      />
                    }
                  />
                );
              })}
            </Card>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.white,
    borderBottomWidth: 2,
    borderBottomColor: colors.black,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.black,
    fontFamily: FONT.bold,
  },
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
  childHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  childName: { fontSize: 16, fontWeight: '800', color: colors.black },
  batch: { color: colors.muted, fontSize: 12, marginTop: 2 },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    borderWidth: 2,
    borderColor: colors.black,
    backgroundColor: colors.white,
    paddingVertical: 10,
    marginBottom: 14,
  },
  monthLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.black,
    width: 150,
    textAlign: 'center',
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  statusIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
});
