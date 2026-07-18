import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, View, Text, TouchableOpacity, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UserPlus, Download } from 'lucide-react-native';
import { reportAPI } from '../api/client';
import { Card, Badge, DateTimeField, KpiTile, EmptyState, LoadingView } from '../components/ui';
import { exportRowsToExcel } from '../utils/excelImportExport';
import { colors, FONT } from '../theme/colors';

function toDateStr(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function StudentEnrollmentReportScreen() {
  const [rows, setRows] = useState<any[]>([]);
  const [summary, setSummary] = useState<{ newEnrollments: number; exits: number; netChange: number }>({
    newEnrollments: 0,
    exits: 0,
    netChange: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const now = new Date();
  const monthAgo = new Date();
  monthAgo.setMonth(monthAgo.getMonth() - 1);
  const [from, setFrom] = useState(toDateStr(monthAgo));
  const [to, setTo] = useState(toDateStr(now));

  const load = useCallback(async () => {
    const res: any = await reportAPI.studentEnrollment({ from, to });
    setRows(res.data || []);
    setSummary(res.summary || { newEnrollments: 0, exits: 0, netChange: 0 });
  }, [from, to]);

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
        { key: 'type', label: 'Type' },
        { key: 'student', label: 'Student' },
        { key: 'studentId', label: 'Student ID' },
        { key: 'sport', label: 'Sport' },
        { key: 'batch', label: 'Batch' },
        { key: 'date', label: 'Date' },
      ],
      rows.map((r: any) => ({
        type: r.type,
        student: r.student ? `${r.student.firstName} ${r.student.lastName}` : '',
        studentId: r.student?.studentId || '',
        sport: r.student?.sport || '',
        batch: r.student?.batch || '',
        date: r.date ? r.date.slice(0, 10) : '',
      })),
      'student_enrollment_report.xlsx',
      'Enrollment',
    );

  if (loading) return <LoadingView />;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Enrollment Report</Text>
        <TouchableOpacity onPress={onExport} style={styles.iconBtn} hitSlop={8}>
          <Download size={18} color={colors.black} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      <View style={styles.filterRow}>
        <View style={{ flex: 1 }}>
          <DateTimeField label="From" value={from} onChangeText={setFrom} />
        </View>
        <View style={{ flex: 1 }}>
          <DateTimeField label="To" value={to} onChangeText={setTo} />
        </View>
      </View>

      <View style={styles.kpiGrid}>
        <KpiTile label="New" value={summary.newEnrollments} color={colors.green} icon={UserPlus} />
        <KpiTile label="Exits" value={summary.exits} color={colors.red} />
        <KpiTile label="Net Change" value={summary.netChange} color={colors.blue} />
      </View>

      <FlatList
        data={rows}
        keyExtractor={(r, i) => `${r.student?._id || i}_${r.type}`}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 10 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<EmptyState title="No enrollment activity in this range" icon={UserPlus} />}
        renderItem={({ item }) => (
          <Card accentColor={item.type === 'enrolled' ? colors.green : colors.red}>
            <View style={styles.rowTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>
                  {item.student ? `${item.student.firstName} ${item.student.lastName}` : 'Unknown'}
                </Text>
                <Text style={styles.sub}>
                  {item.student?.studentId || ''}
                  {item.student?.sport ? ` · ${item.student.sport}` : ''}
                  {item.student?.batch ? ` · ${item.student.batch}` : ''}
                </Text>
                <Text style={styles.dateText}>
                  {item.date
                    ? new Date(item.date).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })
                    : ''}
                </Text>
              </View>
              <Badge
                label={item.type === 'enrolled' ? 'Enrolled' : 'Exited'}
                color={item.type === 'enrolled' ? colors.green : colors.red}
              />
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
  filterRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingTop: 14 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingHorizontal: 16 },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  name: { fontFamily: FONT.bold, fontWeight: '700', fontSize: 14, color: colors.black },
  sub: { fontFamily: FONT.medium, fontSize: 12, color: colors.muted, marginTop: 2 },
  dateText: { fontFamily: FONT.medium, fontSize: 11, color: colors.muted, marginTop: 4 },
});
