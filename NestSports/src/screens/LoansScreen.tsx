import React, { useCallback, useEffect, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  RefreshControl,
  StyleSheet,
  Alert,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Plus,
  Trash2,
  Edit2,
  X,
  IndianRupee,
  Wallet,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
} from 'lucide-react-native';
import { loanAPI, employeeAPI } from '../api/client';
import {
  Card,
  EmptyState,
  LoadingView,
  Badge,
  Button,
  TextField,
  ChipSelect,
  SectionTitle,
  KpiTile,
} from '../components/ui';
import { ImportExportModal, ImportHeader } from '../components/ImportExportModal';
import { exportRowsToExcel } from '../utils/excelImportExport';
import { colors, FONT } from '../theme/colors';

const LOAN_IMPORT_HEADERS: ImportHeader[] = [
  { key: 'employeeId', label: 'Employee ID', required: true, example: 'EMP0001' },
  { key: 'type', label: 'Type', required: true, example: 'loan' },
  { key: 'amount', label: 'Amount', required: true, example: '20000' },
  { key: 'remainingBalance', label: 'Remaining Balance', required: false, example: '15000' },
  { key: 'monthlyEmi', label: 'Monthly EMI', required: false, example: '2000' },
  { key: 'tenureMonths', label: 'Tenure (Months)', required: false, example: '10' },
  { key: 'reason', label: 'Reason', required: false, example: 'Medical' },
  { key: 'disbursedOn', label: 'Disbursed On', required: false, example: '2024-01-15' },
  { key: 'status', label: 'Status', required: false, example: 'active' },
];

function formatCurrency(n: number) {
  return `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
}

const STATUS_COLORS: Record<string, string> = {
  pending: colors.orange,
  approved: colors.green,
  active: colors.green,
  rejected: colors.red,
  cleared: colors.blue,
  paused: colors.muted,
};

const TYPE_OPTIONS = ['loan', 'advance'] as const;

const EMPTY_FORM = {
  employee: '',
  type: 'loan' as (typeof TYPE_OPTIONS)[number],
  amount: '',
  monthlyEmi: '',
  reason: '',
  disbursedOn: new Date().toISOString().slice(0, 10),
  remarks: '',
};

export default function LoansScreen() {
  const [loans, setLoans] = useState<any[]>([]);
  const [importVisible, setImportVisible] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [formVisible, setFormVisible] = useState(false);
  const [editingLoan, setEditingLoan] = useState<any>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [loanRes, empRes] = await Promise.all([
      loanAPI.getAll(),
      employeeAPI.getAll({ status: 'active', limit: '300' }),
    ]);
    setLoans((loanRes as any).data || []);
    setEmployees((empRes as any).data || []);
  }, []);

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

  const handleStatus = async (id: string, status: 'approved' | 'rejected') => {
    setUpdatingId(id);
    try {
      await loanAPI.updateStatus(id, { status });
      await load();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update loan status');
    } finally {
      setUpdatingId(null);
    }
  };

  const openAdd = () => {
    setEditingLoan(null);
    setForm(EMPTY_FORM);
    setFormVisible(true);
  };

  const openEdit = (l: any) => {
    setEditingLoan(l);
    setForm({
      employee: l.employee?._id || '',
      type: l.type || 'loan',
      amount: l.amount ? String(l.amount) : '',
      monthlyEmi: l.monthlyEmi ? String(l.monthlyEmi) : '',
      reason: l.reason || '',
      disbursedOn: l.disbursedOn ? String(l.disbursedOn).slice(0, 10) : '',
      remarks: l.remarks || '',
    });
    setFormVisible(true);
  };

  const save = async () => {
    if (!form.employee) {
      Alert.alert('Missing field', 'Select an employee');
      return;
    }
    if (!form.amount.trim()) {
      Alert.alert('Missing field', 'Amount is required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        employee: form.employee,
        type: form.type,
        amount: Number(form.amount),
        monthlyEmi: form.monthlyEmi ? Number(form.monthlyEmi) : undefined,
        reason: form.reason.trim() || undefined,
        disbursedOn: form.disbursedOn.trim() || undefined,
        remarks: form.remarks.trim() || undefined,
      };
      if (editingLoan) {
        await loanAPI.update(editingLoan._id, payload);
      } else {
        await loanAPI.create(payload);
      }
      setFormVisible(false);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not save loan');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = (l: any) => {
    Alert.alert('Delete Loan', 'Remove this loan/advance record?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await loanAPI.delete(l._id);
            await load();
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Could not delete loan');
          }
        },
      },
    ]);
  };

  if (loading) return <LoadingView />;

  const totalDisbursed = loans.reduce((sum, l) => sum + (l.amount || 0), 0);
  const outstanding = loans.reduce(
    (sum, l) => sum + (l.remainingBalance || 0),
    0,
  );
  const activeCount = loans.filter(l => l.status === 'active').length;
  const pendingCount = loans.filter(l => l.status === 'pending').length;

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
          <View>
            <Text style={styles.title}>Loans & Advances</Text>
            <Text style={styles.subtitle}>Employee loan and advance requests</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              onPress={() =>
                exportRowsToExcel(
                  LOAN_IMPORT_HEADERS.map(h => ({ key: h.key, label: h.label })),
                  loans.map((l: any) => ({
                    employeeId: l.employee?.employeeId || '',
                    type: l.type,
                    amount: l.amount,
                    remainingBalance: l.remainingBalance,
                    monthlyEmi: l.monthlyEmi,
                    tenureMonths: l.tenureMonths,
                    reason: l.reason,
                    disbursedOn: l.disbursedOn?.slice(0, 10),
                    status: l.status,
                  })),
                  'loans_export.xlsx',
                  'Loans',
                )
              }
              style={styles.iconBtn}
              hitSlop={8}
            >
              <Download size={16} color={colors.black} strokeWidth={2.5} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setImportVisible(true)}
              style={styles.iconBtn}
              hitSlop={8}
            >
              <FileSpreadsheet size={16} color={colors.black} strokeWidth={2.5} />
            </TouchableOpacity>
            <TouchableOpacity onPress={openAdd} style={styles.addBtn} hitSlop={8}>
              <Plus size={14} color={colors.white} strokeWidth={2.5} />
              <Text style={styles.addBtnText}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.kpiGrid}>
          <KpiTile
            label="Total Disbursed"
            value={formatCurrency(totalDisbursed)}
            sub="All loans/advances"
            color={colors.blue}
            icon={IndianRupee}
          />
          <KpiTile
            label="Outstanding"
            value={formatCurrency(outstanding)}
            sub="Remaining balance"
            color={colors.orange}
            icon={Wallet}
          />
          <KpiTile
            label="Active"
            value={activeCount}
            sub="Currently active"
            color={colors.green}
            icon={CheckCircle2}
          />
          <KpiTile
            label="Pending"
            value={pendingCount}
            sub="Awaiting approval"
            color={colors.purple}
            icon={Clock}
          />
        </View>

        {loans.length === 0 ? (
          <Card>
            <EmptyState title="No loans found" />
          </Card>
        ) : (
          loans.map(l => (
            <Card key={l._id}>
              <View style={styles.headerRowInner}>
                <Text style={styles.name}>
                  {l.employee
                    ? `${l.employee.firstName} ${l.employee.lastName}`
                    : '—'}
                </Text>
                <Badge
                  label={l.status}
                  color={STATUS_COLORS[l.status] || colors.muted}
                />
              </View>
              <Text style={styles.amount}>{formatCurrency(l.amount)}</Text>
              {l.reason ? <Text style={styles.sub}>{l.reason}</Text> : null}
              {l.status === 'pending' && (
                <View style={styles.actionsRow}>
                  <View style={{ flex: 1 }}>
                    <Button
                      title="Approve"
                      onPress={() => handleStatus(l._id, 'approved')}
                      color={colors.green}
                      loading={updatingId === l._id}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      title="Reject"
                      onPress={() => handleStatus(l._id, 'rejected')}
                      color={colors.red}
                      variant="outline"
                      loading={updatingId === l._id}
                    />
                  </View>
                </View>
              )}
              <View style={styles.iconActionsRow}>
                <TouchableOpacity
                  onPress={() => openEdit(l)}
                  style={styles.actionBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Edit2 size={14} color={colors.blue} strokeWidth={2.5} />
                  <Text style={[styles.actionText, { color: colors.blue }]}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => onDelete(l)}
                  style={styles.actionBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Trash2 size={14} color={colors.red} strokeWidth={2.5} />
                  <Text style={[styles.actionText, { color: colors.red }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      <ImportExportModal
        visible={importVisible}
        onClose={() => setImportVisible(false)}
        entityLabel="Loan"
        headers={LOAN_IMPORT_HEADERS}
        templateFilename="loans_import_template.xlsx"
        notes={[
          "Employee ID must exactly match an employee's ID (e.g. EMP0001).",
          'Type must be loan or advance. Imported records are created as active immediately — for backfilling historical records.',
          'Maximum 200 loans per import.',
        ]}
        previewLine={r => `${r.employeeId} — ${r.type} ₹${r.amount || 0}`}
        onImport={rows => loanAPI.bulkImport(rows) as any}
        onImported={load}
      />

      <Modal
        visible={formVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setFormVisible(false)}
      >
        <SafeAreaView edges={['top']} style={styles.screen}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>
              {editingLoan ? 'Edit Loan' : 'Add Loan / Advance'}
            </Text>
            <TouchableOpacity onPress={() => setFormVisible(false)} hitSlop={8}>
              <X size={22} color={colors.black} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            <SectionTitle title="Employee" />
            <ScrollView style={styles.pickList} nestedScrollEnabled>
              {employees.map((e: any) => {
                const selected = form.employee === e._id;
                return (
                  <TouchableOpacity
                    key={e._id}
                    onPress={() => setForm(p => ({ ...p, employee: e._id }))}
                    style={[styles.pickRow, selected && styles.pickRowSelected]}
                  >
                    <Text
                      style={[styles.pickRowText, selected && { color: colors.white }]}
                    >
                      {e.firstName} {e.lastName}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <ChipSelect
              label="Type"
              options={TYPE_OPTIONS}
              value={form.type}
              onChange={v => setForm(p => ({ ...p, type: v }))}
            />
            <TextField
              label="Amount (₹)"
              value={form.amount}
              onChangeText={v => setForm(p => ({ ...p, amount: v }))}
              keyboardType="numeric"
              required
            />
            <TextField
              label="Monthly EMI (₹)"
              value={form.monthlyEmi}
              onChangeText={v => setForm(p => ({ ...p, monthlyEmi: v }))}
              keyboardType="numeric"
            />
            <TextField
              label="Reason"
              value={form.reason}
              onChangeText={v => setForm(p => ({ ...p, reason: v }))}
              multiline
            />
            <TextField
              label="Disbursed On"
              value={form.disbursedOn}
              onChangeText={v => setForm(p => ({ ...p, disbursedOn: v }))}
              placeholder="YYYY-MM-DD"
            />
            <TextField
              label="Remarks"
              value={form.remarks}
              onChangeText={v => setForm(p => ({ ...p, remarks: v }))}
              multiline
            />
            <Button
              title={saving ? 'Saving...' : editingLoan ? 'Update' : 'Save'}
              onPress={save}
              disabled={saving}
            />
            {saving && <ActivityIndicator style={{ marginTop: 12 }} color={colors.blue} />}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  iconBtn: {
    width: 36,
    height: 36,
    borderWidth: 2,
    borderColor: colors.black,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  title: { fontSize: 24, fontWeight: '800', color: colors.black },
  subtitle: { color: colors.muted, marginTop: 2 },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  addBtn: {
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
  addBtnText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FONT.bold,
    textTransform: 'uppercase',
  },
  headerRowInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: { fontSize: 16, fontWeight: '800', color: colors.black },
  amount: {
    fontWeight: '800',
    color: colors.black,
    fontSize: 16,
    marginTop: 8,
  },
  sub: { color: colors.muted, fontSize: 12, marginTop: 4, marginBottom: 8 },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  iconActionsRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionText: { fontFamily: FONT.bold, fontWeight: '700', fontSize: 12 },
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
  formTitle: { fontSize: 17, fontWeight: '800', color: colors.black, fontFamily: FONT.bold },
  pickList: {
    borderWidth: 2,
    borderColor: colors.black,
    marginBottom: 14,
    maxHeight: 180,
  },
  pickRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  pickRowSelected: { backgroundColor: colors.blue },
  pickRowText: { fontFamily: FONT.medium, fontSize: 14, color: colors.black },
});
