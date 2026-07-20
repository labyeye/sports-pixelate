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
  X,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  CalendarDays,
  Calendar,
  Hash,
} from 'lucide-react-native';
import { leaveAPI, employeeAPI } from '../api/client';
import {
  Card,
  Row,
  Badge,
  Button,
  EmptyState,
  LoadingView,
  TextField,
  ChipSelect,
  SectionTitle,
  KpiTile,
} from '../components/ui';
import { colors, FONT } from '../theme/colors';

const STATUS_COLORS: Record<string, string> = {
  pending: colors.yellow,
  approved: colors.green,
  rejected: colors.red,
  cancelled: colors.muted,
};

const LEAVE_TYPES = [
  'casual',
  'sick',
  'earned',
  'maternity',
  'paternity',
  'unpaid',
  'compensatory',
] as const;

const EMPTY_FORM = {
  employee: '',
  leaveType: 'casual' as (typeof LEAVE_TYPES)[number],
  startDate: '',
  endDate: '',
  days: '1',
  reason: '',
};

export default function LeaveScreen() {
  const [leaves, setLeaves] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  const [applyVisible, setApplyVisible] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(
    () =>
      leaveAPI
        .getAll()
        .then((res: any) => res.success && setLeaves(res.data || [])),
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

  const handleApprove = (id: string) => {
    Alert.alert('Approve Leave', 'Deduct salary for this leave?', [
      {
        text: 'No Deduction',
        onPress: () => act(id, 'approved', { deductSalary: 'false' }),
      },
      {
        text: 'Deduct Salary',
        style: 'destructive',
        onPress: () => act(id, 'approved', { deductSalary: 'true' }),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const openReject = (id: string) => {
    setRejectId(id);
    setRejectReason('');
  };

  const confirmReject = async () => {
    if (!rejectReason.trim()) {
      Alert.alert('Reason required', 'Please enter a reason for rejection');
      return;
    }
    if (!rejectId) return;
    await act(rejectId, 'rejected', { rejectionReason: rejectReason.trim() });
    setRejectId(null);
  };

  const act = async (
    id: string,
    status: 'approved' | 'rejected',
    extra: object,
  ) => {
    setActingId(id);
    try {
      await leaveAPI.updateStatus(id, { status, ...extra });
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to update leave');
    } finally {
      setActingId(null);
    }
  };

  const openApply = () => {
    setForm(EMPTY_FORM);
    setApplyVisible(true);
    employeeAPI
      .getAll({ status: 'active', limit: '300' })
      .then((r: any) => setEmployees(r.data || []))
      .catch(() => {});
  };

  const submitApply = async () => {
    if (!form.employee) {
      Alert.alert('Missing field', 'Select an employee');
      return;
    }
    if (!form.startDate.trim() || !form.endDate.trim()) {
      Alert.alert('Missing field', 'Start and end date are required');
      return;
    }
    setSaving(true);
    try {
      await leaveAPI.create({ ...form, days: Number(form.days) });
      setApplyVisible(false);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not submit leave request');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingView />;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Leave</Text>
        <TouchableOpacity onPress={openApply} style={styles.addBtn} hitSlop={8}>
          <Plus size={14} color={colors.white} strokeWidth={2.5} />
          <Text style={styles.addBtnText}>Apply</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.screen}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.kpiGrid}>
          <KpiTile
            label="Pending"
            value={leaves.filter(l => l.status === 'pending').length}
            sub="Awaiting approval"
            color={colors.yellow}
            icon={Clock}
          />
          <KpiTile
            label="Approved"
            value={leaves.filter(l => l.status === 'approved').length}
            sub="Approved leaves"
            color={colors.green}
            icon={CheckCircle2}
          />
          <KpiTile
            label="Rejected"
            value={leaves.filter(l => l.status === 'rejected').length}
            sub="Rejected leaves"
            color={colors.red}
            icon={XCircle}
          />
        </View>

        <Card>
          {leaves.length === 0 ? (
            <EmptyState title="No leave requests found" />
          ) : (
            leaves.map((l: any) => (
              <View key={l._id} style={styles.item}>
                <Row
                  title={
                    l.employee
                      ? `${l.employee.firstName || ''} ${
                          l.employee.lastName || ''
                        }`.trim()
                      : '-'
                  }
                  subtitle={`${(l.leaveType || '-').replace(/_/g, ' ')} · ${
                    l.days ?? '-'
                  } day(s)`}
                  right={
                    <Badge
                      label={l.status}
                      color={STATUS_COLORS[l.status] || colors.blue}
                    />
                  }
                />
                {l.status === 'pending' && (
                  <View style={styles.actions}>
                    <View style={{ flex: 1 }}>
                      <Button
                        title="Approve"
                        color={colors.green}
                        loading={actingId === l._id}
                        onPress={() => handleApprove(l._id)}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Button
                        title="Reject"
                        color={colors.red}
                        loading={actingId === l._id}
                        onPress={() => openReject(l._id)}
                      />
                    </View>
                  </View>
                )}
              </View>
            ))
          )}
        </Card>
      </ScrollView>

      <Modal
        visible={!!rejectId}
        transparent
        animationType="fade"
        onRequestClose={() => setRejectId(null)}
      >
        <View style={styles.rejectBackdrop}>
          <View style={styles.rejectSheet}>
            <Text style={styles.formTitle}>Reject Leave</Text>
            <TextField
              label="Reason"
              icon={FileText}
              value={rejectReason}
              onChangeText={setRejectReason}
              placeholder="Why is this leave being rejected?"
              multiline
              required
            />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Button
                  title="Cancel"
                  variant="outline"
                  onPress={() => setRejectId(null)}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  title="Reject"
                  color={colors.red}
                  onPress={confirmReject}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={applyVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setApplyVisible(false)}
      >
        <SafeAreaView edges={['top']} style={styles.screen}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>Apply for Leave</Text>
            <TouchableOpacity
              onPress={() => setApplyVisible(false)}
              hitSlop={8}
            >
              <X size={22} color={colors.black} />
            </TouchableOpacity>
          </View>
          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          >
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
                      style={[
                        styles.pickRowText,
                        selected && { color: colors.white },
                      ]}
                    >
                      {e.firstName} {e.lastName}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <ChipSelect
              label="Leave Type"
              icon={CalendarDays}
              options={LEAVE_TYPES}
              value={form.leaveType}
              onChange={v => setForm(p => ({ ...p, leaveType: v }))}
            />
            <TextField
              label="Start Date"
              icon={Calendar}
              value={form.startDate}
              onChangeText={v => setForm(p => ({ ...p, startDate: v }))}
              placeholder="YYYY-MM-DD"
              required
            />
            <TextField
              label="End Date"
              icon={Calendar}
              value={form.endDate}
              onChangeText={v => setForm(p => ({ ...p, endDate: v }))}
              placeholder="YYYY-MM-DD"
              required
            />
            <TextField
              label="Days"
              icon={Hash}
              value={form.days}
              onChangeText={v => setForm(p => ({ ...p, days: v }))}
              keyboardType="numeric"
            />
            <TextField
              label="Reason"
              icon={FileText}
              value={form.reason}
              onChangeText={v => setForm(p => ({ ...p, reason: v }))}
              multiline
            />
            <Button
              title={saving ? 'Submitting...' : 'Submit Request'}
              onPress={submitApply}
              disabled={saving}
            />
            {saving && (
              <ActivityIndicator
                style={{ marginTop: 12 }}
                color={colors.blue}
              />
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
    fontSize: 20,
    fontWeight: '800',
    color: colors.black,
    fontFamily: FONT.bold,
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
  },
  addBtnText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FONT.bold,
    textTransform: 'uppercase',
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  item: { marginBottom: 4 },
  actions: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  rejectBackdrop: {
    flex: 1,
    backgroundColor: '#00000066',
    justifyContent: 'center',
    padding: 20,
  },
  rejectSheet: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.black,
    padding: 16,
  },
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
  formTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.black,
    fontFamily: FONT.bold,
    marginBottom: 10,
  },
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
