import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IndianRupee, Wallet, CheckCircle2, Plus, X } from 'lucide-react-native';
import { loanAPI } from '../api/client';
import {
  Badge,
  Button,
  Card,
  ChipSelect,
  EmptyState,
  KpiTile,
  LoadingView,
  Row,
  TextField,
} from '../components/ui';
import { colors, FONT } from '../theme/colors';

const STATUS_COLORS: Record<string, string> = {
  pending: colors.yellow,
  active: colors.blue,
  rejected: colors.red,
  cleared: colors.green,
  paused: colors.muted,
};

function formatCurrency(n: number) {
  return `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
}

export default function MyLoansScreen() {
  const [loans, setLoans] = useState<any[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [type, setType] = useState<'loan' | 'advance'>('loan');
  const [amount, setAmount] = useState('');
  const [tenure, setTenure] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    () =>
      loanAPI
        .getAll()
        .then((res: any) => res.success && setLoans(res.data || [])),
    [],
  );

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

  const submit = async () => {
    if (!parseFloat(amount) || !reason.trim()) {
      Alert.alert('Missing fields', 'Amount and reason are required.');
      return;
    }
    setSaving(true);
    try {
      await loanAPI.request({
        type,
        amount: parseFloat(amount),
        tenureMonths: tenure ? parseInt(tenure, 10) : 0,
        reason: reason.trim(),
      });
      setFormOpen(false);
      setAmount('');
      setTenure('');
      setReason('');
      Alert.alert('Request sent', 'Your request is pending approval.');
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not submit the request');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingView />;

  const totalBorrowed = loans.reduce((sum, l) => sum + (l.amount || 0), 0);
  const outstandingBalance = loans.reduce(
    (sum, l) => sum + (l.remainingBalance || 0),
    0,
  );
  const activeCount = loans.filter(l => l.status === 'active').length;

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
          <Text style={styles.title}>My Loans</Text>
          <TouchableOpacity onPress={() => setFormOpen(true)} style={styles.addBtn} hitSlop={8}>
            <Plus size={14} color={colors.white} strokeWidth={2.5} />
            <Text style={styles.addBtnText}>Request</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.kpiGrid}>
          <KpiTile
            label="Total Borrowed"
            value={formatCurrency(totalBorrowed)}
            sub="All loans/advances"
            color={colors.blue}
            icon={IndianRupee}
          />
          <KpiTile
            label="Outstanding"
            value={formatCurrency(outstandingBalance)}
            sub="Remaining balance"
            color={colors.orange}
            icon={Wallet}
          />
          <KpiTile
            label="Active Loans"
            value={activeCount}
            sub="Currently active"
            color={colors.green}
            icon={CheckCircle2}
          />
        </View>

        <Card>
          {loans.length === 0 ? (
            <EmptyState title="No loans or advances found" />
          ) : (
            loans.map((l: any) => (
              <Row
                key={l._id}
                title={`${
                  (l.type || 'loan') === 'advance' ? 'Advance' : 'Loan'
                } · ${formatCurrency(l.amount)}`}
                subtitle={
                  [
                    l.remainingBalance != null ? `Remaining: ${formatCurrency(l.remainingBalance)}` : '',
                    l.tenureMonths ? `${l.tenureMonths} mo` : '',
                    l.reason || '',
                  ]
                    .filter(Boolean)
                    .join(' · ')
                }
                right={
                  <Badge
                    label={l.status}
                    color={STATUS_COLORS[l.status] || colors.blue}
                  />
                }
              />
            ))
          )}
        </Card>
      </ScrollView>

      <Modal
        visible={formOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setFormOpen(false)}
      >
        <SafeAreaView edges={['top']} style={styles.screen}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>Request Loan / Advance</Text>
            <TouchableOpacity onPress={() => setFormOpen(false)} hitSlop={8}>
              <X size={22} color={colors.black} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            <ChipSelect
              label="Type"
              options={['loan', 'advance'] as const}
              labels={{ loan: 'Loan', advance: 'Salary Advance' }}
              value={type}
              onChange={setType}
            />
            <TextField label="Amount (₹)" value={amount} onChangeText={setAmount} keyboardType="numeric" required />
            {type === 'loan' && (
              <TextField label="Repay over (months)" value={tenure} onChangeText={setTenure} keyboardType="numeric" />
            )}
            <TextField label="Reason" value={reason} onChangeText={setReason} multiline required />
            <Button title="Submit Request" onPress={submit} loading={saving} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontSize: 24, fontWeight: '800', color: colors.black },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.blue, borderWidth: 2, borderColor: colors.black, paddingHorizontal: 12, paddingVertical: 8 },
  addBtnText: { color: colors.white, fontSize: 12, fontFamily: FONT.bold, textTransform: 'uppercase' },
  formHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 2, borderBottomColor: colors.black },
  formTitle: { fontSize: 17, color: colors.black, fontFamily: FONT.bold },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
});
