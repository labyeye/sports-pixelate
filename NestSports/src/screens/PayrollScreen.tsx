import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, ChevronLeft, ChevronRight, Play, X } from 'lucide-react-native';
import { employeeAPI, payrollAPI, payrollPreviewAPI } from '../api/client';
import {
  Badge,
  Button,
  Card,
  ChipSelect,
  EmptyState,
  FilterPills,
  KpiTile,
  LoadingView,
  Row,
  SearchBar,
} from '../components/ui';
import { colors, FONT } from '../theme/colors';

function formatCurrency(n: number) {
  return `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const PAY_MODES = ['bank_transfer', 'cash', 'upi'] as const;
type PayMode = (typeof PAY_MODES)[number];
const PAY_LABELS: Record<PayMode, string> = {
  bank_transfer: 'Bank Transfer',
  cash: 'Cash',
  upi: 'UPI',
};

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'processed', label: 'Processed' },
  { value: 'paid', label: 'Paid' },
];

const now = new Date();

export default function PayrollScreen() {
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [payrolls, setPayrolls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');

  // Process / preview flow (web: process modal with "all" | "select" modes).
  const [processOpen, setProcessOpen] = useState(false);
  const [mode, setMode] = useState<'all' | 'select'>('all');
  const [employees, setEmployees] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<any[] | null>(null);
  const [busy, setBusy] = useState<'preview' | 'process' | null>(null);

  // Mark-paid flow (single or bulk) with a payment mode, as on web.
  const [paid, setPaid] = useState<{ id: string | null; bulk: boolean } | null>(null);
  const [payMode, setPayMode] = useState<PayMode>('bank_transfer');
  const [paying, setPaying] = useState(false);

  const load = useCallback(async () => {
    const res: any = await payrollAPI.getAll({
      month: String(month),
      year: String(year),
      limit: '200',
    });
    setPayrolls(res.data || []);
  }, [month, year]);

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

  const stepMonth = (d: number) => {
    const m = month + d;
    if (m < 1) {
      setMonth(12);
      setYear(y => y - 1);
    } else if (m > 12) {
      setMonth(1);
      setYear(y => y + 1);
    } else setMonth(m);
  };

  const openProcess = async () => {
    setMode('all');
    setSelected(new Set());
    setPreview(null);
    setProcessOpen(true);
    if (!employees.length) {
      const res: any = await employeeAPI
        .getAll({ status: 'active', limit: '200' })
        .catch(() => null);
      setEmployees(res?.data || []);
    }
  };

  const employeeIds = () => (mode === 'all' ? undefined : Array.from(selected));
  const selectionEmpty = mode === 'select' && selected.size === 0;

  const runPreview = async () => {
    setBusy('preview');
    try {
      const res: any = await payrollPreviewAPI.preview({
        month,
        year,
        employeeIds: employeeIds(),
      });
      setPreview(res.data || []);
    } catch (e: any) {
      Alert.alert('Preview Failed', e?.message || 'Could not build preview');
    } finally {
      setBusy(null);
    }
  };

  const runProcess = async () => {
    setBusy('process');
    try {
      const res: any = await payrollAPI.process({
        month,
        year,
        employeeIds: employeeIds(),
        force: false,
      });
      setProcessOpen(false);
      Alert.alert('Payroll Processed', res.message || 'Payroll processed successfully.');
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to process payroll');
    } finally {
      setBusy(null);
    }
  };

  const confirmPaid = async () => {
    if (!paid) return;
    setPaying(true);
    try {
      if (paid.bulk) await payrollAPI.bulkMarkPaid(month, year, payMode);
      else await payrollAPI.markPaid(paid.id!, payMode);
      setPaid(null);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to mark as paid');
    } finally {
      setPaying(false);
    }
  };

  const markSlip = async (id: string, s: 'received' | 'not_received') => {
    try {
      const res: any = await payrollAPI.markSlipReceived(id, s);
      setPayrolls(prev =>
        prev.map(p => (p._id === id ? { ...p, slipReceived: s, slipReceivedAt: res.data?.slipReceivedAt } : p)),
      );
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not update slip status');
    }
  };

  const totals = useMemo(
    () => ({
      gross: payrolls.reduce((s, p) => s + (p.grossSalary || 0), 0),
      ded: payrolls.reduce((s, p) => s + (p.totalDeductions || 0), 0),
      net: payrolls.reduce((s, p) => s + (p.netSalary || 0), 0),
      paid: payrolls.filter(p => p.status === 'paid').length,
    }),
    [payrolls],
  );

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return payrolls.filter(p => {
      const name = `${p.employee?.firstName ?? ''} ${p.employee?.lastName ?? ''}`.toLowerCase();
      return (!q || name.includes(q)) && (status === 'all' || p.status === status);
    });
  }, [payrolls, search, status]);

  if (loading) return <LoadingView />;

  const unpaidCount = payrolls.filter(p => p.status !== 'paid').length;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Payroll</Text>
            <Text style={styles.subtitle}>Employee salary records</Text>
          </View>
          <TouchableOpacity onPress={openProcess} style={styles.processBtn} hitSlop={8}>
            <Play size={12} color={colors.white} strokeWidth={2.5} />
            <Text style={styles.processBtnText}>Process</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.stepper}>
          <TouchableOpacity onPress={() => stepMonth(-1)} hitSlop={10}>
            <ChevronLeft size={22} color={colors.black} strokeWidth={2.5} />
          </TouchableOpacity>
          <Text style={styles.stepperText}>
            {MONTHS[month - 1]} {year}
          </Text>
          <TouchableOpacity onPress={() => stepMonth(1)} hitSlop={10}>
            <ChevronRight size={22} color={colors.black} strokeWidth={2.5} />
          </TouchableOpacity>
        </View>

        <View style={styles.kpiRow}>
          <KpiTile label="Gross" value={formatCurrency(totals.gross)} color={colors.blue} />
          <KpiTile label="Deductions" value={formatCurrency(totals.ded)} color={colors.red} />
        </View>
        <View style={styles.kpiRow}>
          <KpiTile label="Net Payable" value={formatCurrency(totals.net)} color={colors.green} />
          <KpiTile label="Paid" value={`${totals.paid}/${payrolls.length}`} color={colors.purple} />
        </View>

        <SearchBar value={search} onChangeText={setSearch} placeholder="Search employee..." />
        <View style={{ height: 8 }} />
        <FilterPills options={STATUS_FILTERS} value={status} onChange={setStatus} />
        <View style={{ height: 12 }} />

        {unpaidCount > 0 && (
          <View style={{ marginBottom: 12 }}>
            <Button
              title={`Mark All ${unpaidCount} Unpaid as Paid`}
              onPress={() => {
                setPayMode('bank_transfer');
                setPaid({ id: null, bulk: true });
              }}
              color={colors.green}
            />
          </View>
        )}

        {shown.length === 0 ? (
          <Card>
            <EmptyState title="No payroll records found" />
          </Card>
        ) : (
          shown.map(p => {
            const isPaid = p.status === 'paid';
            return (
              <Card key={p._id}>
                <View style={styles.headerRowInner}>
                  <Text style={styles.name}>
                    {p.employee ? `${p.employee.firstName} ${p.employee.lastName}` : '—'}
                  </Text>
                  <Badge label={p.status} color={isPaid ? colors.green : colors.orange} />
                </View>
                <Text style={styles.sub}>
                  Present {p.presentDays ?? '-'}/{p.workingDays ?? '-'} days · Basic {formatCurrency(p.basicSalary)}
                </Text>
                <View style={styles.breakdown}>
                  <Line label="Gross" value={formatCurrency(p.grossSalary)} />
                  <Line label="Late deduction" value={`-${formatCurrency(p.lateDeductionAmount)}`} hide={!p.lateDeductionAmount} />
                  <Line label="Half-day deduction" value={`-${formatCurrency(p.halfDayDeduction)}`} hide={!p.halfDayDeduction} />
                  <Line label="Penalty" value={`-${formatCurrency(p.penaltyAmount)}`} hide={!p.penaltyAmount} />
                  <Line label="Loan / advance" value={`-${formatCurrency(p.loanDeduction)}`} hide={!p.loanDeduction} />
                  <Line label="Allowances" value={`+${formatCurrency(p.otherAllowances)}`} hide={!p.otherAllowances} />
                  <Line label="Overtime" value={`+${formatCurrency(p.otPay)}`} hide={!p.otPay} />
                  <Line label="Total deductions" value={`-${formatCurrency(p.totalDeductions)}`} />
                </View>
                <Text style={styles.amount}>Net {formatCurrency(p.netSalary)}</Text>
                {!isPaid && (
                  <Button
                    title="Mark Paid"
                    onPress={() => {
                      setPayMode('bank_transfer');
                      setPaid({ id: p._id, bulk: false });
                    }}
                    color={colors.green}
                  />
                )}
                {isPaid && (
                  <View style={styles.slipRow}>
                    <Text style={styles.slipLabel}>Salary slip</Text>
                    {(['received', 'not_received'] as const).map(s => (
                      <TouchableOpacity
                        key={s}
                        onPress={() => markSlip(p._id, s)}
                        style={[styles.slipBtn, p.slipReceived === s && styles.slipBtnOn]}
                      >
                        <Text style={[styles.slipBtnText, p.slipReceived === s && { color: colors.white }]}>
                          {s === 'received' ? 'Received' : 'Not received'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </Card>
            );
          })
        )}
      </ScrollView>

      {/* Process payroll: choose scope → preview → confirm */}
      <Modal
        visible={processOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setProcessOpen(false)}
      >
        <SafeAreaView edges={['top']} style={styles.screen}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>
              Process Payroll · {MONTHS[month - 1]} {year}
            </Text>
            <TouchableOpacity onPress={() => setProcessOpen(false)} hitSlop={8}>
              <X size={22} color={colors.black} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            <ChipSelect
              label="Process for"
              options={['all', 'select'] as const}
              labels={{ all: 'All active employees', select: 'Select employees' }}
              value={mode}
              onChange={m => {
                setMode(m);
                setPreview(null);
              }}
            />
            {mode === 'select' && (
              <Card>
                <Row
                  title={selected.size === employees.length ? 'Clear all' : 'Select all'}
                  subtitle={`${selected.size} of ${employees.length} selected`}
                  onPress={() => {
                    setPreview(null);
                    setSelected(
                      selected.size === employees.length ? new Set() : new Set(employees.map(e => e._id)),
                    );
                  }}
                />
                {employees.map(e => (
                  <Row
                    key={e._id}
                    title={`${e.firstName} ${e.lastName}`}
                    subtitle={e.employeeId || e.email}
                    right={selected.has(e._id) ? <Check size={18} color={colors.green} strokeWidth={3} /> : undefined}
                    onPress={() => {
                      setPreview(null);
                      setSelected(s => {
                        const n = new Set(s);
                        if (n.has(e._id)) n.delete(e._id);
                        else n.add(e._id);
                        return n;
                      });
                    }}
                  />
                ))}
              </Card>
            )}

            {preview && (
              <Card>
                {preview.length === 0 ? (
                  <EmptyState title="Nothing to process" />
                ) : (
                  preview.map(p => (
                    <Row
                      key={p.employee._id}
                      title={`${p.employee.firstName} ${p.employee.lastName}`}
                      subtitle={`${p.presentDays}/${p.workingDays} days · Gross ${formatCurrency(
                        p.grossSalary,
                      )} · Ded ${formatCurrency(p.totalDeductions)} · Net ${formatCurrency(p.netSalary)}`}
                      right={
                        <Badge
                          label={p.alreadyProcessed ? 'Exists' : 'New'}
                          color={p.alreadyProcessed ? colors.orange : colors.green}
                        />
                      }
                    />
                  ))
                )}
              </Card>
            )}

            <Button
              title="Preview"
              variant="outline"
              onPress={runPreview}
              loading={busy === 'preview'}
              disabled={selectionEmpty}
            />
            <View style={{ height: 10 }} />
            <Button
              title="Confirm & Process"
              color={colors.orange}
              onPress={runProcess}
              loading={busy === 'process'}
              disabled={selectionEmpty}
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Mark paid: pick payment mode */}
      <Modal visible={!!paid} animationType="fade" transparent onRequestClose={() => setPaid(null)}>
        <View style={styles.backdrop}>
          <View style={styles.dialog}>
            <Text style={styles.formTitle}>{paid?.bulk ? 'Mark All Paid' : 'Mark as Paid'}</Text>
            <View style={{ height: 12 }} />
            <ChipSelect
              label="Payment mode"
              options={PAY_MODES}
              labels={PAY_LABELS}
              value={payMode}
              onChange={setPayMode}
            />
            <Button title="Confirm" color={colors.green} onPress={confirmPaid} loading={paying} />
            <View style={{ height: 8 }} />
            <Button title="Cancel" variant="outline" onPress={() => setPaid(null)} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Line({ label, value, hide }: { label: string; value: string; hide?: boolean }) {
  if (hide) return null;
  return (
    <View style={styles.line}>
      <Text style={styles.lineLabel}>{label}</Text>
      <Text style={styles.lineValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  title: { fontSize: 24, fontWeight: '800', color: colors.black },
  subtitle: { color: colors.muted, marginTop: 2 },
  processBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.blue,
    borderWidth: 2,
    borderColor: colors.black,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 4,
  },
  processBtnText: { color: colors.white, fontSize: 12, fontFamily: FONT.bold, textTransform: 'uppercase' },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: colors.black,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  stepperText: { fontSize: 16, fontFamily: FONT.bold, color: colors.black },
  kpiRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  headerRowInner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 16, fontWeight: '800', color: colors.black },
  sub: { color: colors.muted, fontSize: 12, marginTop: 4 },
  breakdown: { marginTop: 10, gap: 4 },
  line: { flexDirection: 'row', justifyContent: 'space-between' },
  lineLabel: { color: colors.muted, fontSize: 12, fontFamily: FONT.medium },
  lineValue: { color: colors.black, fontSize: 12, fontFamily: FONT.semiBold },
  amount: { fontWeight: '800', color: colors.black, fontSize: 16, marginTop: 10, marginBottom: 12 },
  slipRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  slipLabel: { flex: 1, color: colors.muted, fontSize: 12, fontFamily: FONT.medium },
  slipBtn: { borderWidth: 2, borderColor: colors.black, paddingHorizontal: 10, paddingVertical: 6 },
  slipBtnOn: { backgroundColor: colors.blue },
  slipBtnText: { fontSize: 11, fontFamily: FONT.bold, color: colors.black },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: colors.black,
    backgroundColor: colors.white,
  },
  formTitle: { fontSize: 17, color: colors.black, fontFamily: FONT.bold },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  dialog: { backgroundColor: colors.white, borderWidth: 2, borderColor: colors.black, padding: 16 },
});
