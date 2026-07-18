import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, View, Text, TouchableOpacity, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Receipt, Download } from 'lucide-react-native';
import { reportAPI } from '../api/client';
import { Card, Badge, SearchBar, EmptyState, LoadingView } from '../components/ui';
import { exportRowsToExcel } from '../utils/excelImportExport';
import { colors, FONT } from '../theme/colors';

function formatCurrency(n: number) {
  return `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
}

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  completed: colors.green,
  pending: colors.orange,
  rejected: colors.red,
  failed: colors.red,
};

let searchDebounce: ReturnType<typeof setTimeout>;

export default function StudentPaymentHistoryScreen() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    const res: any = await reportAPI.studentFees({});
    setRows(res.data || []);
  }, []);

  useEffect(() => {
    setLoading(true);
    load()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => setSearch(searchInput.trim().toLowerCase()), 300);
    return () => clearTimeout(searchDebounce);
  }, [searchInput]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load().catch(() => {});
    setRefreshing(false);
  };

  const filtered = rows.filter(r => {
    if (!search) return true;
    const name = r.student ? `${r.student.firstName} ${r.student.lastName}`.toLowerCase() : '';
    return name.includes(search) || (r.student?.studentId || '').toLowerCase().includes(search);
  });

  const onExport = () =>
    exportRowsToExcel(
      [
        { key: 'student', label: 'Student' },
        { key: 'plan', label: 'Plan' },
        { key: 'amount', label: 'Amount' },
        { key: 'amountPaid', label: 'Amount Paid' },
        { key: 'due', label: 'Due' },
        { key: 'paymentMethod', label: 'Payment Method' },
        { key: 'reference', label: 'UTR / Transaction No.' },
        { key: 'paymentStatus', label: 'Status' },
        { key: 'verified', label: 'Verified' },
        { key: 'verifiedBy', label: 'Verified By' },
        { key: 'date', label: 'Date' },
      ],
      filtered.map((r: any) => {
        const due = (r.amount || 0) - (r.amountPaid || 0);
        const verified = r.paymentStatus === 'completed' && !!r.confirmedBy;
        return {
          student: r.student ? `${r.student.firstName} ${r.student.lastName}` : '',
          plan: r.planName,
          amount: r.amount,
          amountPaid: r.amountPaid,
          due,
          paymentMethod: r.paymentMethod,
          reference: r.qrReferenceNumber || r.transactionNumber || '',
          paymentStatus: r.paymentStatus,
          verified: verified ? 'Yes' : 'No',
          verifiedBy: r.confirmedBy?.name || '',
          date: r.startDate ? r.startDate.slice(0, 10) : '',
        };
      }),
      'student_payment_history.xlsx',
      'Payments',
    );

  if (loading) return <LoadingView />;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Student Payment History</Text>
        <TouchableOpacity onPress={onExport} style={styles.iconBtn} hitSlop={8}>
          <Download size={18} color={colors.black} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrap}>
        <SearchBar value={searchInput} onChangeText={setSearchInput} placeholder="Search by student name..." />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(r, i) => r._id || String(i)}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<EmptyState title="No payment records found" icon={Receipt} />}
        renderItem={({ item }) => {
          const due = (item.amount || 0) - (item.amountPaid || 0);
          const verified = item.paymentStatus === 'completed' && !!item.confirmedBy;
          return (
            <Card>
              <View style={styles.rowTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>
                    {item.student ? `${item.student.firstName} ${item.student.lastName}` : 'Unknown'}
                  </Text>
                  <Text style={styles.sub}>{item.planName}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Badge
                    label={item.paymentStatus}
                    color={PAYMENT_STATUS_COLORS[item.paymentStatus] || colors.muted}
                  />
                  <Badge label={verified ? 'Verified' : 'Not Verified'} color={verified ? colors.green : colors.orange} />
                </View>
              </View>
              <View style={styles.amountRow}>
                <Text style={styles.amountText}>
                  {formatCurrency(item.amountPaid)} / {formatCurrency(item.amount)}
                </Text>
                {due > 0 ? <Text style={styles.dueText}>Due: {formatCurrency(due)}</Text> : null}
              </View>
              <Text style={styles.metaText}>
                {item.paymentMethod ? item.paymentMethod.toUpperCase() : '—'}
                {item.qrReferenceNumber || item.transactionNumber
                  ? ` · Ref: ${item.qrReferenceNumber || item.transactionNumber}`
                  : ''}
              </Text>
              {item.confirmedBy ? (
                <Text style={styles.metaText}>Verified by: {item.confirmedBy.name}</Text>
              ) : null}
              {item.startDate ? (
                <Text style={styles.metaText}>
                  {new Date(item.startDate).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
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
  searchWrap: {
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  name: { fontFamily: FONT.bold, fontWeight: '700', fontSize: 14, color: colors.black },
  sub: { fontFamily: FONT.medium, fontSize: 12, color: colors.muted, marginTop: 2 },
  amountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  amountText: { fontFamily: FONT.bold, fontWeight: '700', fontSize: 13, color: colors.black },
  dueText: { fontFamily: FONT.bold, fontWeight: '700', fontSize: 11, color: colors.red },
  metaText: { fontFamily: FONT.medium, fontSize: 11, color: colors.muted, marginTop: 4 },
});
