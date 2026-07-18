import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, View, Text, TouchableOpacity, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TrendingUp, Download, Trophy } from 'lucide-react-native';
import { reportAPI, sportAPI, studentAPI } from '../api/client';
import { Card, Badge, FilterPills, EmptyState, LoadingView } from '../components/ui';
import { exportRowsToExcel } from '../utils/excelImportExport';
import { colors, FONT } from '../theme/colors';

const FEE_STATUS_COLORS: Record<string, string> = {
  paid: colors.green,
  due: colors.orange,
  overdue: colors.red,
};

function feeStatusColor(status: string) {
  return FEE_STATUS_COLORS[(status || '').toLowerCase()] || colors.muted;
}

export default function StudentPerformanceReportScreen() {
  const [rows, setRows] = useState<any[]>([]);
  const [sports, setSports] = useState<string[]>([]);
  const [batches, setBatches] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sport, setSport] = useState('');
  const [batch, setBatch] = useState('');

  const loadFilters = useCallback(async () => {
    try {
      const [stRes, spRes]: any[] = await Promise.all([
        studentAPI.getAll({ limit: '1000' }),
        sportAPI.getAll(),
      ]);
      const all: any[] = stRes.data || [];
      setBatches(Array.from(new Set(all.map(s => s.batch).filter(Boolean))) as string[]);
      const sportList: any[] = spRes.data || [];
      setSports(sportList.map(s => s.name || s));
    } catch {
      // filters are optional
    }
  }, []);

  const load = useCallback(async () => {
    const res: any = await reportAPI.studentPerformance({
      ...(sport ? { sport } : {}),
      ...(batch ? { batch } : {}),
    });
    setRows(res.data || []);
  }, [sport, batch]);

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

  const onExport = () =>
    exportRowsToExcel(
      [
        { key: 'student', label: 'Student' },
        { key: 'studentId', label: 'Student ID' },
        { key: 'sport', label: 'Sport' },
        { key: 'batch', label: 'Batch' },
        { key: 'attendanceRate', label: 'Attendance %' },
        { key: 'tournamentsCount', label: 'Tournaments' },
        { key: 'feeStatus', label: 'Fee Status' },
        { key: 'due', label: 'Amount Due' },
      ],
      rows.map((r: any) => ({
        student: r.student ? `${r.student.firstName} ${r.student.lastName}` : '',
        studentId: r.student?.studentId || '',
        sport: r.student?.sport || '',
        batch: r.student?.batch || '',
        attendanceRate: r.attendanceRate,
        tournamentsCount: r.tournamentsCount,
        feeStatus: r.feeStatus,
        due: r.due,
      })),
      'student_performance_report.xlsx',
      'Performance',
    );

  if (loading) return <LoadingView />;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Student Performance Report</Text>
        <TouchableOpacity onPress={onExport} style={styles.iconBtn} hitSlop={8}>
          <Download size={18} color={colors.black} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      <FilterPills
        options={[{ value: '', label: 'All Sports' }, ...sports.map(s => ({ value: s, label: s }))]}
        value={sport}
        onChange={setSport}
      />
      <FilterPills
        options={[{ value: '', label: 'All Batches' }, ...batches.map(b => ({ value: b, label: b }))]}
        value={batch}
        onChange={setBatch}
      />

      <FlatList
        data={rows}
        keyExtractor={(r, i) => r.student?._id || String(i)}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<EmptyState title="No performance data" icon={TrendingUp} />}
        renderItem={({ item }) => (
          <Card>
            <View style={styles.rowTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>
                  {item.student ? `${item.student.firstName} ${item.student.lastName}` : 'Unknown'}
                </Text>
                <Text style={styles.sub}>
                  {item.student?.sport || '—'} · {item.student?.batch || '—'}
                </Text>
              </View>
              <Badge label={item.feeStatus || '—'} color={feeStatusColor(item.feeStatus)} />
            </View>
            <View style={styles.statsRow}>
              <View style={styles.statCol}>
                <Text style={styles.statLabel}>Attendance</Text>
                <Text style={styles.statValue}>{item.attendanceRate}%</Text>
              </View>
              <View style={styles.statCol}>
                <View style={styles.statLabelRow}>
                  <Trophy size={11} color={colors.purple} strokeWidth={2.5} />
                  <Text style={styles.statLabel}>Tournaments</Text>
                </View>
                <Text style={styles.statValue}>{item.tournamentsCount}</Text>
              </View>
              {item.due > 0 ? (
                <View style={styles.statCol}>
                  <Text style={styles.statLabel}>Due</Text>
                  <Text style={[styles.statValue, { color: colors.red }]}>₹{item.due}</Text>
                </View>
              ) : null}
            </View>
          </Card>
        )}
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
  headerTitle: { fontSize: 18, fontWeight: '800', color: colors.black, fontFamily: FONT.bold, flex: 1 },
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
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  name: { fontFamily: FONT.bold, fontWeight: '700', fontSize: 14, color: colors.black },
  sub: { fontFamily: FONT.medium, fontSize: 12, color: colors.muted, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 20, marginTop: 10 },
  statCol: { gap: 2 },
  statLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statLabel: { fontFamily: FONT.medium, fontSize: 10, color: colors.muted, textTransform: 'uppercase' },
  statValue: { fontFamily: FONT.bold, fontWeight: '700', fontSize: 15, color: colors.black },
});
