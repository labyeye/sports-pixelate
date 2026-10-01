import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Plus,
  RotateCcw,
  UserMinus,
  Users,
  X,
} from 'lucide-react-native';
import { employeeAPI, exitAPI, studentAPI } from '../api/client';
import {
  Badge,
  Button,
  Card,
  ChipSelect,
  DateTimeField,
  EmptyState,
  FilterPills,
  KpiTile,
  LoadingView,
  PickerField,
  SectionTitle,
  TextField,
} from '../components/ui';
import { fetchAllPages } from '../utils/fetchAllPages';
import { colors, FONT } from '../theme/colors';

type PersonType = 'employee' | 'student';

const EMPLOYEE_EXIT_TYPES = [
  'resignation',
  'termination',
  'retirement',
  'contract_end',
  'absconded',
  'other',
] as const;
const STUDENT_EXIT_TYPES = [
  'course_completed',
  'withdrawn',
  'relocated',
  'fee_issue',
  'injury',
  'other',
] as const;

const labelOf = (v: string) =>
  v.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
const today = () => new Date().toISOString().slice(0, 10);
const toInput = (d?: string) => (d ? new Date(d).toISOString().slice(0, 10) : '');
const fmt = (d?: string) =>
  d
    ? new Date(d).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '—';

const STATUS_COLOR: Record<string, string> = {
  initiated: colors.yellow,
  in_clearance: colors.orange,
  completed: colors.green,
  cancelled: colors.muted,
  reinstated: colors.purple,
};

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'initiated', label: 'Initiated' },
  { value: 'in_clearance', label: 'In clearance' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];
const TYPE_FILTERS = [
  { value: '', label: 'Staff & Students' },
  { value: 'employee', label: 'Staff' },
  { value: 'student', label: 'Students' },
];

export default function ExitManagementScreen() {
  const [exits, setExits] = useState<any[]>([]);
  const [summary, setSummary] = useState({
    total: 0,
    inProgress: 0,
    completed: 0,
    staff: 0,
    students: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const params: Record<string, string> = {};
    if (status) params.status = status;
    if (type) params.personType = type;
    const res: any = await fetchAllPages(exitAPI.getAll, params);
    setExits(res.data || []);
    if (res.summary) setSummary(res.summary);
  }, [status, type]);

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

  if (loading) return <LoadingView />;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={{ padding: 16, paddingBottom: 0, flex: 1 }}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Exit Management</Text>
            <Text style={styles.subtitle}>Offboard staff and students</Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowNew(true)}
            style={styles.addBtn}
            hitSlop={8}
          >
            <Plus size={14} color={colors.white} strokeWidth={2.5} />
            <Text style={styles.addBtnText}>Initiate</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.kpiGrid}>
          <KpiTile
            label="Total Exits"
            value={summary.total}
            color={colors.blue}
            icon={UserMinus}
          />
          <KpiTile
            label="In Progress"
            value={summary.inProgress}
            color={colors.orange}
            icon={Clock}
          />
          <KpiTile
            label="Completed"
            value={summary.completed}
            color={colors.green}
            icon={CheckCircle2}
          />
          <KpiTile
            label="Staff · Students"
            value={`${summary.staff} · ${summary.students}`}
            color={colors.purple}
            icon={Users}
          />
        </View>

        <FilterPills options={TYPE_FILTERS} value={type} onChange={setType} />
        <FilterPills
          options={STATUS_FILTERS}
          value={status}
          onChange={setStatus}
        />

        <FlatList
          data={exits}
          keyExtractor={x => x._id}
          contentContainerStyle={{ paddingBottom: 24, gap: 12 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <EmptyState
              title="No exit records"
              sub="Tap Initiate when someone is leaving"
              icon={UserMinus}
            />
          }
          renderItem={({ item: x }) => (
            <TouchableOpacity activeOpacity={0.85} onPress={() => setOpenId(x._id)}>
              <Card>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{x.personName}</Text>
                    <Text style={styles.meta}>
                      {x.personCode} ·{' '}
                      {x.personType === 'employee' ? 'Staff' : 'Student'}
                    </Text>
                  </View>
                  <Badge
                    label={labelOf(x.status)}
                    color={STATUS_COLOR[x.status] || colors.muted}
                  />
                </View>
                <Text style={styles.line}>
                  {labelOf(x.exitType)} · Exit {fmt(x.exitDate)}
                </Text>
                <Text style={styles.line}>
                  Clearance {x.progress.done}/{x.progress.total}
                </Text>
                <View style={styles.bar}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        width: `${
                          x.progress.total
                            ? (x.progress.done / x.progress.total) * 100
                            : 0
                        }%`,
                      },
                    ]}
                  />
                </View>
              </Card>
            </TouchableOpacity>
          )}
        />
      </View>

      <InitiateModal
        visible={showNew}
        onClose={() => setShowNew(false)}
        onCreated={async id => {
          setShowNew(false);
          await load().catch(() => {});
          setOpenId(id);
        }}
      />
      <DetailModal
        id={openId}
        onClose={() => setOpenId(null)}
        onChanged={() => load().catch(() => {})}
      />
    </SafeAreaView>
  );
}

/* ───────────── Initiate ───────────── */

function InitiateModal({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [personType, setPersonType] = useState<PersonType>('employee');
  const [people, setPeople] = useState<any[]>([]);
  const [personLabel, setPersonLabel] = useState('');
  const [exitType, setExitType] = useState<string>('resignation');
  const [reason, setReason] = useState('');
  const [noticeDate, setNoticeDate] = useState(today());
  const [exitDate, setExitDate] = useState(today());
  const [saving, setSaving] = useState(false);

  const labelFor = (p: any) =>
    `${p.firstName} ${p.lastName} (${p.employeeId || p.studentId})`;

  useEffect(() => {
    if (!visible) return;
    setPersonLabel('');
    setPeople([]);
    setExitType(personType === 'employee' ? 'resignation' : 'withdrawn');
    const fn = personType === 'employee' ? employeeAPI.getAll : studentAPI.getAll;
    fetchAllPages(fn as any, { status: 'active' })
      .then((r: any) => setPeople(r.data || []))
      .catch(() => {});
  }, [visible, personType]);

  const options = useMemo(() => people.map(labelFor), [people]);

  const submit = async () => {
    const person = people.find(p => labelFor(p) === personLabel);
    if (!person) {
      Alert.alert('Missing field', 'Choose who is leaving');
      return;
    }
    setSaving(true);
    try {
      const res: any = await exitAPI.initiate({
        personType,
        personId: person._id,
        exitType,
        reason,
        noticeDate,
        exitDate,
      });
      setReason('');
      onCreated(res.data._id);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not start the exit');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView edges={['top']} style={styles.screen}>
        <View style={styles.formHeader}>
          <Text style={styles.formTitle}>Initiate Exit</Text>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <X size={22} color={colors.black} />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
          <ChipSelect
            label="Who is leaving?"
            options={['employee', 'student'] as const}
            value={personType}
            onChange={v => setPersonType(v)}
            labels={{ employee: 'Staff', student: 'Student' }}
          />
          <PickerField
            label={personType === 'employee' ? 'Staff member' : 'Student'}
            value={personLabel}
            options={options}
            onChange={setPersonLabel}
            placeholder="Search & select"
            required
          />
          <ChipSelect
            label="Exit type"
            options={
              (personType === 'employee'
                ? EMPLOYEE_EXIT_TYPES
                : STUDENT_EXIT_TYPES) as readonly string[]
            }
            value={exitType}
            onChange={setExitType}
            labels={Object.fromEntries(
              [...EMPLOYEE_EXIT_TYPES, ...STUDENT_EXIT_TYPES].map(t => [
                t,
                labelOf(t),
              ]),
            )}
          />
          <DateTimeField
            label="Notice date"
            value={noticeDate}
            onChangeText={setNoticeDate}
            mode="date"
          />
          <DateTimeField
            label={personType === 'employee' ? 'Last working day' : 'Last class'}
            value={exitDate}
            onChangeText={setExitDate}
            mode="date"
            required
          />
          <TextField
            label="Reason"
            value={reason}
            onChangeText={setReason}
            multiline
            placeholder="Why are they leaving?"
          />
          <Button
            title={saving ? 'Starting…' : 'Start Exit'}
            onPress={submit}
            disabled={saving}
          />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

/* ───────────── Detail / clearance ───────────── */

function DetailModal({
  id,
  onClose,
  onChanged,
}: {
  id: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [rec, setRec] = useState<any>(null);
  const [outstanding, setOutstanding] = useState<any>(null);
  const [settlement, setSettlement] = useState('');
  const [settlementNotes, setSettlementNotes] = useState('');
  const [feedback, setFeedback] = useState('');
  const [exitDate, setExitDate] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const res: any = await exitAPI.getOne(id);
    setRec(res.data);
    setOutstanding(res.outstanding);
    setSettlement(String(res.data.settlementAmount || ''));
    setSettlementNotes(res.data.settlementNotes || '');
    setFeedback(res.data.feedback || '');
    setExitDate(toInput(res.data.exitDate));
  }, [id]);

  useEffect(() => {
    setRec(null);
    if (id) load().catch(e => Alert.alert('Error', e?.message || 'Could not load'));
  }, [id, load]);

  const run = async (fn: () => Promise<any>, closeAfter = false) => {
    setBusy(true);
    try {
      await fn();
      onChanged();
      if (closeAfter) onClose();
      else await load();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  const editable = rec && ['initiated', 'in_clearance'].includes(rec.status);
  const isStaff = rec?.personType === 'employee';

  const save = () =>
    run(() =>
      exitAPI.update(id as string, {
        settlementAmount: Number(settlement) || 0,
        settlementNotes,
        feedback,
        exitDate,
      }),
    );

  const complete = () => {
    const pending = rec.checklist.filter((c: any) => c.required && !c.done);
    if (pending.length > 0) {
      Alert.alert(
        'Clearance incomplete',
        `${pending.map((c: any) => `• ${c.label}`).join('\n')}\n\nComplete the exit anyway?`,
        [
          { text: 'No', style: 'cancel' },
          {
            text: 'Complete anyway',
            style: 'destructive',
            onPress: () => run(() => exitAPI.complete(id as string, true), true),
          },
        ],
      );
    } else {
      Alert.alert('Complete exit', `Offboard ${rec.personName}?`, [
        { text: 'No', style: 'cancel' },
        {
          text: 'Complete',
          onPress: () => run(() => exitAPI.complete(id as string), true),
        },
      ]);
    }
  };

  const hasOutstanding =
    outstanding &&
    (outstanding.loans?.length ||
      outstanding.inventory?.length ||
      outstanding.subscriptions?.length ||
      outstanding.payrolls);

  return (
    <Modal
      visible={!!id}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView edges={['top']} style={styles.screen}>
        <View style={styles.formHeader}>
          <Text style={styles.formTitle} numberOfLines={1}>
            {rec?.personName || 'Exit'}
          </Text>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <X size={22} color={colors.black} />
          </TouchableOpacity>
        </View>
        {!rec ? (
          <LoadingView />
        ) : (
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            <View style={styles.cardTop}>
              <Text style={styles.meta}>
                {isStaff ? 'Staff' : 'Student'} · {rec.personCode} ·{' '}
                {labelOf(rec.exitType)}
              </Text>
              <Badge
                label={labelOf(rec.status)}
                color={STATUS_COLOR[rec.status] || colors.muted}
              />
            </View>
            <Text style={[styles.line, { marginBottom: 12 }]}>
              Exit date {fmt(rec.exitDate)}
              {rec.completedAt ? ` · Completed ${fmt(rec.completedAt)}` : ''}
            </Text>

            {editable && hasOutstanding ? (
              <View style={styles.warn}>
                <View style={styles.warnHead}>
                  <AlertTriangle size={15} color="#C2410C" strokeWidth={2.5} />
                  <Text style={styles.warnTitle}>Still outstanding</Text>
                </View>
                {outstanding.loans?.map((l: any) => (
                  <Text key={l._id} style={styles.warnLine}>
                    • {labelOf(l.type || 'loan')} — ₹
                    {Number(l.remainingBalance).toLocaleString('en-IN')} remaining
                  </Text>
                ))}
                {outstanding.inventory?.map((i: any) => (
                  <Text key={i._id} style={styles.warnLine}>
                    • {i.name} × {i.quantity} not returned
                  </Text>
                ))}
                {outstanding.subscriptions?.map((s: any) => (
                  <Text key={s._id} style={styles.warnLine}>
                    • {s.planName}: ₹
                    {Number(s.amountPaid || 0).toLocaleString('en-IN')} paid of ₹
                    {Number(s.amount).toLocaleString('en-IN')} — cancelled on
                    completion
                  </Text>
                ))}
                {outstanding.payrolls > 0 && (
                  <Text style={styles.warnLine}>
                    • {outstanding.payrolls} payroll record(s) not yet paid
                  </Text>
                )}
              </View>
            ) : null}

            <SectionTitle
              title={`Clearance checklist (${rec.progress.done}/${rec.progress.total})`}
            />
            {rec.checklist.map((c: any) => (
              <TouchableOpacity
                key={c.key}
                disabled={!editable || busy}
                onPress={() =>
                  run(() =>
                    exitAPI.update(id as string, {
                      checklist: [{ key: c.key, done: !c.done }],
                    }),
                  )
                }
                style={[
                  styles.check,
                  c.done && { backgroundColor: '#00C48C26' },
                ]}
                activeOpacity={0.8}
              >
                <View style={[styles.box, c.done && styles.boxOn]}>
                  {c.done ? (
                    <Check size={13} color={colors.white} strokeWidth={3} />
                  ) : null}
                </View>
                <Text style={styles.checkText}>
                  {c.label}
                  {!c.required ? '  (optional)' : ''}
                </Text>
              </TouchableOpacity>
            ))}

            <View style={{ height: 16 }} />
            <DateTimeField
              label="Exit date"
              value={exitDate}
              onChangeText={setExitDate}
              mode="date"
            />
            <TextField
              label={`Final settlement (₹) — ${
                isStaff ? 'payable to staff' : 'refund to family'
              }`}
              value={settlement}
              onChangeText={setSettlement}
              keyboardType="numeric"
            />
            <TextField
              label="Settlement notes"
              value={settlementNotes}
              onChangeText={setSettlementNotes}
            />
            <TextField
              label={isStaff ? 'Exit interview feedback' : 'Parent / student feedback'}
              value={feedback}
              onChangeText={setFeedback}
              multiline
            />

            {editable ? (
              <>
                <Button title="Save" onPress={save} loading={busy} variant="outline" />
                <View style={{ height: 10 }} />
                <Button
                  title="Complete Exit"
                  onPress={complete}
                  color={colors.green}
                  loading={busy}
                />
                <View style={{ height: 10 }} />
                <Button
                  title="Cancel Exit"
                  onPress={() =>
                    Alert.alert('Cancel exit', 'The person stays as they are.', [
                      { text: 'No', style: 'cancel' },
                      {
                        text: 'Cancel Exit',
                        style: 'destructive',
                        onPress: () =>
                          run(() => exitAPI.cancel(id as string), true),
                      },
                    ])
                  }
                  color={colors.red}
                  variant="outline"
                  loading={busy}
                />
              </>
            ) : null}
            {rec.status === 'completed' ? (
              <Button
                title="Reinstate"
                onPress={() =>
                  Alert.alert(
                    'Reinstate',
                    `Restore ${rec.personName} to their previous status?`,
                    [
                      { text: 'No', style: 'cancel' },
                      {
                        text: 'Reinstate',
                        onPress: () =>
                          run(() => exitAPI.reinstate(id as string), true),
                      },
                    ],
                  )
                }
                color={colors.purple}
                loading={busy}
              />
            ) : null}
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.black,
    fontFamily: FONT.bold,
  },
  subtitle: { color: colors.muted, marginTop: 2 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 10,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.blue,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
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
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontSize: 16, fontWeight: '800', color: colors.black, fontFamily: FONT.bold },
  meta: { fontFamily: FONT.medium, fontSize: 12, color: colors.muted },
  line: { fontFamily: FONT.medium, fontSize: 12, color: colors.black, marginTop: 4 },
  bar: {
    height: 8,
    marginTop: 6,
    borderWidth: 2,
    borderColor: colors.black,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: colors.white,
  },
  barFill: { height: '100%', backgroundColor: colors.green },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: colors.black,
  },
  formTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    color: colors.black,
    fontFamily: FONT.bold,
  },
  warn: {
    backgroundColor: '#FA731C0D',
    borderWidth: 2,
    borderColor: colors.orange,
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
    gap: 4,
  },
  warnHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  warnTitle: { fontFamily: FONT.bold, fontSize: 13, color: '#C2410C' },
  warnLine: { fontFamily: FONT.medium, fontSize: 12, color: colors.black },
  check: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 2,
    borderColor: colors.black,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    backgroundColor: colors.white,
  },
  box: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: colors.black,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: colors.blue },
  checkText: { flex: 1, fontFamily: FONT.medium, fontSize: 13, color: colors.black },
});
