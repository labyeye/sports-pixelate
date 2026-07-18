import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, View, Text, TouchableOpacity, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Wallet, Download } from 'lucide-react-native';
import { reportAPI } from '../api/client';
import { Card, Badge, FilterPills, EmptyState, LoadingView } from '../components/ui';
import { exportRowsToExcel } from '../utils/excelImportExport';
import { colors, FONT } from '../theme/colors';

function formatCurrency(n: number) {
  return `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
}

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'pending_renewal', label: 'Pending Renewal' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'cancelled', label: 'Cancelled' },
];

const STATUS_COLORS: Record<string, string> = {
  active: colors.green,
  pending_renewal: colors.orange,
  inactive: colors.muted,
  cancelled: colors.red,
};

// father → mother → other, first available guardian, matching web's slotting
// rule for "who is this subscription's guardian contact".
function primaryGuardian(guardians: any[] = []): any | null {
  return (
    guardians.find(g => g.relation === 'father') ||
    guardians.find(g => g.relation === 'mother') ||
    guardians[0] ||
    null
  );
}

export default function StudentSubscriptionReportScreen() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState('');

  const load = useCallback(async () => {
    const res: any = await reportAPI.studentFees(status ? { status } : {});
    setRows(res.data || []);
  }, [status]);

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
        { key: 'plan', label: 'Plan' },
        { key: 'amount', label: 'Amount' },
        { key: 'amountPaid', label: 'Amount Paid' },
        { key: 'due', label: 'Amount Remaining' },
        { key: 'guardian', label: 'Guardian' },
        { key: 'verified', label: 'Verified' },
        { key: 'status', label: 'Status' },
      ],
      rows.map((r: any) => {
        const guardian = primaryGuardian(r.student?.guardians);
        const due = (r.amount || 0) - (r.amountPaid || 0);
        return {
          student: r.student ? `${r.student.firstName} ${r.student.lastName}` : '',
          studentId: r.student?.studentId || '',
          plan: r.planName,
          amount: r.amount,
          amountPaid: r.amountPaid,
          due,
          guardian: guardian?.name || '',
          verified: r.paymentStatus === 'completed' && !!r.confirmedBy ? 'Yes' : 'No',
          status: r.status,
        };
      }),
      'student_subscription_report.xlsx',
      'Subscriptions',
    );

  if (loading) return <LoadingView />;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Student Subscription Report</Text>
        <TouchableOpacity onPress={onExport} style={styles.iconBtn} hitSlop={8}>
          <Download size={18} color={colors.black} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      <FilterPills options={STATUS_OPTIONS} value={status} onChange={setStatus} />

      <FlatList
        data={rows}
        keyExtractor={(r, i) => r._id || String(i)}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<EmptyState title="No subscriptions found" icon={Wallet} />}
        renderItem={({ item }) => {
          const due = (item.amount || 0) - (item.amountPaid || 0);
          const verified = item.paymentStatus === 'completed' && !!item.confirmedBy;
          const guardian = primaryGuardian(item.student?.guardians);
          return (
            <Card accentColor={STATUS_COLORS[item.status] || colors.muted}>
              <View style={styles.rowTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>
                    {item.student ? `${item.student.firstName} ${item.student.lastName}` : 'Unknown'}
                  </Text>
                  <Text style={styles.sub}>{item.planName}</Text>
                </View>
                <Badge
                  label={verified ? 'Verified' : 'Not Verified'}
                  color={verified ? colors.green : colors.orange}
                />
              </View>
              <View style={styles.amountRow}>
                <Text style={styles.amountText}>
                  {formatCurrency(item.amountPaid)} / {formatCurrency(item.amount)}
                </Text>
                {due > 0 ? (
                  <Text style={styles.dueText}>Remaining: {formatCurrency(due)}</Text>
                ) : null}
              </View>
              {guardian ? (
                <Text style={styles.guardianText}>
                  Guardian: {guardian.name} ({guardian.relation})
                </Text>
              ) : null}
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
  amountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  amountText: { fontFamily: FONT.bold, fontWeight: '700', fontSize: 13, color: colors.black },
  dueText: { fontFamily: FONT.bold, fontWeight: '700', fontSize: 11, color: colors.red },
  guardianText: { fontFamily: FONT.medium, fontSize: 11, color: colors.muted, marginTop: 6 },
});
