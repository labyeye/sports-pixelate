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
import { Layers, Download } from 'lucide-react-native';
import { reportAPI, studentAPI } from '../api/client';
import {
  Card,
  Badge,
  FilterPills,
  EmptyState,
  LoadingView,
} from '../components/ui';
import { exportRowsToExcel } from '../utils/excelImportExport';
import { colors, FONT } from '../theme/colors';

const FEE_STATUS_COLORS: Record<string, string> = {
  paid: colors.green,
  due: colors.orange,
  overdue: colors.red,
};

export default function BatchSummaryReportScreen() {
  const [batches, setBatches] = useState<string[]>([]);
  const [batch, setBatch] = useState('');
  const [summaryRows, setSummaryRows] = useState<any[]>([]);
  const [studentRows, setStudentRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadFilters = useCallback(async () => {
    try {
      const res: any = await studentAPI.getAll({ limit: '1000' });
      const all: any[] = res.data || [];
      setBatches(
        Array.from(new Set(all.map(s => s.batch).filter(Boolean))) as string[],
      );
    } catch {
      // filters are optional
    }
  }, []);

  const load = useCallback(async () => {
    if (batch) {
      const res: any = await reportAPI.batchSummary({ batch });
      setStudentRows(res.data || []);
      setSummaryRows([]);
    } else {
      const res: any = await reportAPI.batchSummary();
      setSummaryRows(res.data || []);
      setStudentRows([]);
    }
  }, [batch]);

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
    if (batch) {
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
        `batch_summary_${batch}.xlsx`,
        'Batch',
      );
    } else {
      exportRowsToExcel(
        [
          { key: 'batch', label: 'Batch' },
          { key: 'total', label: 'Total' },
          { key: 'active', label: 'Active' },
          { key: 'inactive', label: 'Inactive' },
          { key: 'on_hold', label: 'On Hold' },
        ],
        summaryRows,
        'batch_summary_report.xlsx',
        'Batches',
      );
    }
  };

  if (loading) return <LoadingView />;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Batch Summary</Text>
        <TouchableOpacity onPress={onExport} style={styles.iconBtn} hitSlop={8}>
          <Download size={18} color={colors.black} strokeWidth={2.5} />
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

      {batch ? (
        <FlatList
          data={studentRows}
          keyExtractor={(r, i) => r.student?._id || String(i)}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState title="No students in this batch" icon={Layers} />
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
          keyExtractor={(r, i) => r.batch || String(i)}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState title="No batches found" icon={Layers} />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => setBatch(item.batch)}
              activeOpacity={0.85}
            >
              <Card>
                <Text style={styles.name}>{item.batch}</Text>
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
                    <Text style={styles.statLabel}>Inactive</Text>
                    <Text style={[styles.statValue, { color: colors.muted }]}>
                      {item.inactive}
                    </Text>
                  </View>
                  <View style={styles.statCol}>
                    <Text style={styles.statLabel}>On Hold</Text>
                    <Text style={[styles.statValue, { color: colors.orange }]}>
                      {item.on_hold}
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
