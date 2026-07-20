import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  View,
  Text,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Calendar,
  Download,
  LogIn,
  LogOut,
} from 'lucide-react-native';
import { studentAttendanceAPI, studentAPI, sportAPI } from '../api/client';
import {
  Card,
  Badge,
  FilterPills,
  EmptyState,
  LoadingView,
} from '../components/ui';
import { exportRowsToExcel } from '../utils/excelImportExport';
import { colors, FONT } from '../theme/colors';

// Mirrors StudentAttendanceScreen's STATUS_CONFIG so status colors read the
// same across the app.
const STATUS_CONFIG: Record<
  string,
  { color: string; bg: string; icon: any; label: string }
> = {
  present: {
    color: colors.green,
    bg: '#E7F9F1',
    icon: CheckCircle2,
    label: 'Present',
  },
  late: {
    color: colors.yellow,
    bg: '#FEF3E2',
    icon: AlertCircle,
    label: 'Late',
  },
  absent: { color: colors.red, bg: '#FDEBEB', icon: XCircle, label: 'Absent' },
  excused: {
    color: colors.blue,
    bg: '#E8F0FB',
    icon: Calendar,
    label: 'Excused',
  },
};

function viaLabel(r: any): string {
  if (r.verifyMode === 'manual') {
    return `Manual — marked by ${r.markedBy?.name || 'staff'}`;
  }
  if (r.checkInLog) {
    const loc = r.checkInLog.location?.name || '';
    const dev = r.checkInLog.device?.name || '';
    return `${r.checkInLog.method} @ ${loc}${dev ? ` (${dev})` : ''}`;
  }
  return r.verifyMode || '—';
}

function fmtTime(iso?: string) {
  if (!iso) return '--:--';
  return new Date(iso).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function StudentAttendanceReportScreen() {
  const [records, setRecords] = useState<any[]>([]);
  const [batches, setBatches] = useState<string[]>([]);
  const [sports, setSports] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [batch, setBatch] = useState('');
  const [sport, setSport] = useState('');
  const [status, setStatus] = useState('');

  const loadFilters = useCallback(async () => {
    try {
      const [stRes, spRes]: any[] = await Promise.all([
        studentAPI.getAll({ limit: '1000' }),
        sportAPI.getAll(),
      ]);
      const students: any[] = stRes.data || [];
      const uniqueBatches = Array.from(
        new Set(students.map(s => s.batch).filter(Boolean)),
      ) as string[];
      setBatches(uniqueBatches);
      const sportList: any[] = spRes.data || [];
      setSports(sportList.map(s => s.name || s));
    } catch {
      // filters are optional; ignore failures
    }
  }, []);

  const load = useCallback(async () => {
    const res: any = await studentAttendanceAPI.getAll({
      month: String(month),
      year: String(year),
      limit: '500',
      ...(batch ? { batch } : {}),
      ...(sport ? { sport } : {}),
    });
    let data: any[] = res.data || [];
    if (status) data = data.filter(r => r.status === status);
    setRecords(data);
  }, [month, year, batch, sport, status]);

  useEffect(() => {
    loadFilters();
  }, [loadFilters]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load().catch(() => {});
    setRefreshing(false);
  };

  const shiftMonth = (n: number) => {
    let m = month + n;
    let y = year;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setMonth(m);
    setYear(y);
  };

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });

  const onExport = () =>
    exportRowsToExcel(
      [
        { key: 'student', label: 'Student' },
        { key: 'studentId', label: 'Student ID' },
        { key: 'batch', label: 'Batch' },
        { key: 'sport', label: 'Sport' },
        { key: 'date', label: 'Date' },
        { key: 'status', label: 'Status' },
        { key: 'checkIn', label: 'Check In' },
        { key: 'checkOut', label: 'Check Out' },
        { key: 'via', label: 'Via' },
      ],
      records.map(r => ({
        student: r.student
          ? `${r.student.firstName} ${r.student.lastName}`
          : '',
        studentId: r.student?.studentId || '',
        batch: r.batch || r.student?.batch || '',
        sport: r.student?.sport || '',
        date: r.date ? new Date(r.date).toISOString().slice(0, 10) : '',
        status: r.status,
        checkIn: fmtTime(r.checkIn),
        checkOut: fmtTime(r.checkOut),
        via: viaLabel(r),
      })),
      'student_attendance_report.xlsx',
      'Attendance',
    );

  if (loading) return <LoadingView />;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Student Attendance Report</Text>
        <TouchableOpacity onPress={onExport} style={styles.iconBtn} hitSlop={8}>
          <Download size={18} color={colors.black} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      <View style={styles.monthRow}>
        <TouchableOpacity
          onPress={() => shiftMonth(-1)}
          style={styles.monthBtn}
        >
          <Text style={styles.monthBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.monthLabel}>{monthLabel}</Text>
        <TouchableOpacity onPress={() => shiftMonth(1)} style={styles.monthBtn}>
          <Text style={styles.monthBtnText}>›</Text>
        </TouchableOpacity>
      </View>

      <FilterPills
        options={[
          { value: '', label: 'All Batches' },
          ...batches.map(b => ({ value: b, label: b })),
        ]}
        value={batch}
        onChange={setBatch}
      />
      <FilterPills
        options={[
          { value: '', label: 'All Sports' },
          ...sports.map(s => ({ value: s, label: s })),
        ]}
        value={sport}
        onChange={setSport}
      />
      <FilterPills
        options={[
          { value: '', label: 'All Status' },
          ...Object.entries(STATUS_CONFIG).map(([k, v]) => ({
            value: k,
            label: v.label,
          })),
        ]}
        value={status}
        onChange={setStatus}
      />

      <FlatList
        data={records}
        keyExtractor={(r, i) => r._id || String(i)}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState title="No attendance records" icon={Clock} />
        }
        renderItem={({ item }) => {
          const cfg = STATUS_CONFIG[item.status] || {
            color: colors.muted,
            bg: '#F3F4F6',
            icon: AlertCircle,
            label: item.status,
          };
          return (
            <Card accentColor={cfg.color}>
              <View style={styles.rowTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>
                    {item.student
                      ? `${item.student.firstName} ${item.student.lastName}`
                      : 'Unknown'}
                  </Text>
                  <Text style={styles.sub}>
                    {item.student?.studentId || ''}
                    {item.batch || item.student?.batch
                      ? ` · ${item.batch || item.student?.batch}`
                      : ''}
                  </Text>
                </View>
                <Badge label={cfg.label} color={cfg.color} />
              </View>
              <Text style={styles.dateText}>
                {item.date
                  ? new Date(item.date).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })
                  : ''}
              </Text>
              <View style={styles.timesRow}>
                <View style={styles.timeCol}>
                  <LogIn size={12} color={colors.green} strokeWidth={2.5} />
                  <Text style={styles.timeText}>{fmtTime(item.checkIn)}</Text>
                </View>
                <View style={styles.timeCol}>
                  <LogOut size={12} color={colors.red} strokeWidth={2.5} />
                  <Text style={styles.timeText}>{fmtTime(item.checkOut)}</Text>
                </View>
              </View>
              <Text style={styles.viaText} numberOfLines={1}>
                Via: {viaLabel(item)}
              </Text>
            </Card>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.white,
    borderBottomWidth: 2,
    borderBottomColor: colors.black,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.black,
    fontFamily: FONT.bold,
    flex: 1,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.black,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingVertical: 10,
  },
  monthBtn: { width: 36, alignItems: 'center' },
  monthBtnText: {
    fontSize: 22,
    fontFamily: FONT.bold,
    fontWeight: '700',
    color: colors.black,
  },
  monthLabel: {
    fontFamily: FONT.bold,
    fontSize: 14,
    fontWeight: '700',
    color: colors.black,
    minWidth: 140,
    textAlign: 'center',
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  name: {
    fontFamily: FONT.bold,
    fontWeight: '700',
    fontSize: 14,
    color: colors.black,
  },
  sub: {
    fontFamily: FONT.medium,
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
  },
  dateText: {
    fontFamily: FONT.medium,
    fontSize: 11,
    color: colors.muted,
    marginTop: 8,
  },
  timesRow: { flexDirection: 'row', gap: 16, marginTop: 8 },
  timeCol: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  timeText: {
    fontFamily: FONT.bold,
    fontWeight: '700',
    fontSize: 12,
    color: colors.black,
  },
  viaText: {
    fontFamily: FONT.medium,
    fontSize: 11,
    color: colors.muted,
    marginTop: 6,
    fontStyle: 'italic',
  },
});
