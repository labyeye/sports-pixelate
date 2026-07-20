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
import { Trophy, Download } from 'lucide-react-native';
import { reportAPI, sportAPI } from '../api/client';
import {
  Card,
  Badge,
  FilterPills,
  EmptyState,
  LoadingView,
} from '../components/ui';
import { exportRowsToExcel } from '../utils/excelImportExport';
import { colors, FONT } from '../theme/colors';

function formatCurrency(n: number) {
  return `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
}

const FEE_STATUS_COLORS: Record<string, string> = {
  paid: colors.green,
  due: colors.orange,
  overdue: colors.red,
};

export default function SportSummaryReportScreen() {
  const [sports, setSports] = useState<string[]>([]);
  const [sport, setSport] = useState('');
  const [summaryRows, setSummaryRows] = useState<any[]>([]);
  const [studentRows, setStudentRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadFilters = useCallback(async () => {
    try {
      const res: any = await sportAPI.getAll();
      const sportList: any[] = res.data || [];
      setSports(sportList.map(s => s.name || s));
    } catch {
      // filters are optional
    }
  }, []);

  const load = useCallback(async () => {
    if (sport) {
      const res: any = await reportAPI.sportSummary({ sport });
      setStudentRows(res.data || []);
      setSummaryRows([]);
    } else {
      const res: any = await reportAPI.sportSummary();
      setSummaryRows(res.data || []);
      setStudentRows([]);
    }
  }, [sport]);

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

  const onExport = () => {
    if (sport) {
      exportRowsToExcel(
        [
          { key: 'student', label: 'Student' },
          { key: 'studentId', label: 'Student ID' },
          { key: 'status', label: 'Status' },
          { key: 'attendanceRate', label: 'Attendance %' },
          { key: 'feeStatus', label: 'Fee Status' },
        ],
        studentRows.map((r: any) => ({
          student: r.student
            ? `${r.student.firstName} ${r.student.lastName}`
            : '',
          studentId: r.student?.studentId || '',
          status: r.student?.status || '',
          attendanceRate: r.attendanceRate,
          feeStatus: r.feeStatus,
        })),
        `sport_summary_${sport}.xlsx`,
        'Sport',
      );
    } else {
      exportRowsToExcel(
        [
          { key: 'sport', label: 'Sport' },
          { key: 'total', label: 'Total' },
          { key: 'active', label: 'Active' },
          { key: 'revenue', label: 'Revenue' },
        ],
        summaryRows,
        'sport_summary_report.xlsx',
        'Sports',
      );
    }
  };

  if (loading) return <LoadingView />;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Sport-wise Summary</Text>
        <TouchableOpacity onPress={onExport} style={styles.iconBtn} hitSlop={8}>
          <Download size={18} color={colors.black} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      <FilterPills
        options={[
          { value: '', label: 'All Sports' },
          ...sports.map(s => ({ value: s, label: s })),
        ]}
        value={sport}
        onChange={setSport}
      />

      {sport ? (
        <FlatList
          data={studentRows}
          keyExtractor={(r, i) => r.student?._id || String(i)}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState title="No students for this sport" icon={Trophy} />
          }
          renderItem={({ item }) => (
            <Card>
              <View style={styles.rowTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>
                    {item.student
                      ? `${item.student.firstName} ${item.student.lastName}`
                      : 'Unknown'}
                  </Text>
                  <Text style={styles.sub}>
                    Attendance: {item.attendanceRate}%
                  </Text>
                </View>
                <Badge
                  label={item.feeStatus || '—'}
                  color={
                    FEE_STATUS_COLORS[(item.feeStatus || '').toLowerCase()] ||
                    colors.muted
                  }
                />
              </View>
            </Card>
          )}
        />
      ) : (
        <FlatList
          data={summaryRows}
          keyExtractor={(r, i) => r.sport || String(i)}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState title="No sports found" icon={Trophy} />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => setSport(item.sport)}
              activeOpacity={0.85}
            >
              <Card>
                <Text style={styles.name}>{item.sport}</Text>
                <View style={styles.statsRow}>
                  <View style={styles.statCol}>
                    <Text style={styles.statLabel}>Total</Text>
                    <Text style={styles.statValue}>{item.total}</Text>
                  </View>
                  <View style={styles.statCol}>
                    <Text style={styles.statLabel}>Active</Text>
                    <Text style={[styles.statValue, { color: colors.green }]}>
                      {item.active}
                    </Text>
                  </View>
                  <View style={styles.statCol}>
                    <Text style={styles.statLabel}>Revenue</Text>
                    <Text style={[styles.statValue, { color: colors.blue }]}>
                      {formatCurrency(item.revenue)}
                    </Text>
                  </View>
                </View>
              </Card>
            </TouchableOpacity>
          )}
        />
      )}
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
  rowTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  name: {
    fontFamily: FONT.bold,
    fontWeight: '700',
    fontSize: 15,
    color: colors.black,
  },
  sub: {
    fontFamily: FONT.medium,
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  statsRow: { flexDirection: 'row', gap: 20, marginTop: 10 },
  statCol: { gap: 2 },
  statLabel: {
    fontFamily: FONT.medium,
    fontSize: 10,
    color: colors.muted,
    textTransform: 'uppercase',
  },
  statValue: {
    fontFamily: FONT.bold,
    fontWeight: '700',
    fontSize: 15,
    color: colors.black,
  },
});
