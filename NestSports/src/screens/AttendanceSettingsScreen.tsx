import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  Text,
  View,
  TextInput,
  Switch,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BarChart2 } from 'lucide-react-native';
import { attendanceSettingsAPI, employeeAPI } from '../api/client';
import { Card, SectionTitle, Button, ChipSelect, LoadingView } from '../components/ui';
import { colors, FONT } from '../theme/colors';

interface AttendanceSettings {
  shiftStartHour: number;
  shiftStartMinute: number;
  shiftEndHour: number;
  shiftEndMinute: number;
  lateThresholdMinutes: number;
  lateDeductionType: 'fixed' | 'percent';
  lateDeductionAmount: number;
  halfDayThresholdMinutes: number;
  earlyCheckoutThresholdMinutes: number;
  earlyCheckoutDeductionEnabled: boolean;
}

const DEFAULT: AttendanceSettings = {
  shiftStartHour: 9,
  shiftStartMinute: 0,
  shiftEndHour: 18,
  shiftEndMinute: 0,
  lateThresholdMinutes: 15,
  lateDeductionType: 'fixed',
  lateDeductionAmount: 0,
  halfDayThresholdMinutes: 120,
  earlyCheckoutThresholdMinutes: 15,
  earlyCheckoutDeductionEnabled: false,
};

const LEAVE_TYPES = [
  'casual',
  'sick',
  'earned',
  'maternity',
  'paternity',
  'unpaid',
  'compensatory',
  'hourly',
  'wfh',
  'outdoor_duty',
] as const;

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function NumField({
  label,
  value,
  onChange,
  hint,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  hint?: string;
  suffix?: string;
}) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          style={[styles.fieldInput, { flex: 1 }]}
          value={String(value ?? '')}
          onChangeText={v => onChange(Number(v) || 0)}
          keyboardType="numeric"
          placeholderTextColor={colors.muted}
        />
        {suffix ? (
          <View style={styles.suffix}>
            <Text style={styles.suffixText}>{suffix}</Text>
          </View>
        ) : null}
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export default function AttendanceSettingsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rules, setRules] = useState<AttendanceSettings>(DEFAULT);
  const [employees, setEmployees] = useState<any[]>([]);

  const [lateMode, setLateMode] = useState<'bulk' | 'custom'>('bulk');
  const [lateBulk, setLateBulk] = useState('0');
  const [latePerEmp, setLatePerEmp] = useState<Record<string, string>>({});
  const [savingLate, setSavingLate] = useState(false);

  const [leaveType, setLeaveType] = useState<(typeof LEAVE_TYPES)[number]>('casual');
  const [leaveMode, setLeaveMode] = useState<'bulk' | 'custom'>('bulk');
  const [leaveBulk, setLeaveBulk] = useState('0');
  const [leavePerEmp, setLeavePerEmp] = useState<Record<string, string>>({});
  const [savingLeave, setSavingLeave] = useState(false);

  const [summary, setSummary] = useState<any[]>([]);
  const [showSummary, setShowSummary] = useState(false);

  const load = async () => {
    const [settingsRes, empRes] = await Promise.all([
      attendanceSettingsAPI.get(),
      employeeAPI.getAll(),
    ]);
    if ((settingsRes as any)?.data) {
      setRules({ ...DEFAULT, ...(settingsRes as any).data });
    }
    setEmployees((empRes as any)?.data || []);
  };

  useEffect(() => {
    load()
      .catch((e: any) => Alert.alert('Error', e.message))
      .finally(() => setLoading(false));
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load().catch(() => {});
    setRefreshing(false);
  };

  const set = (key: keyof AttendanceSettings, value: any) =>
    setRules(p => ({ ...p, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await attendanceSettingsAPI.update(rules);
      Alert.alert('Saved', 'Attendance settings updated successfully');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveLateAllowance = async () => {
    setSavingLate(true);
    try {
      await attendanceSettingsAPI.upsertLateAllowance(
        lateMode === 'bulk'
          ? { mode: 'bulk', bulkCount: Number(lateBulk) || 0 }
          : {
              mode: 'custom',
              perEmployee: Object.entries(latePerEmp).map(([employee, count]) => ({
                employee,
                count: Number(count) || 0,
              })),
            },
      );
      Alert.alert('Saved', 'Late allowance updated');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSavingLate(false);
    }
  };

  const handleSaveLeaveAllowance = async () => {
    setSavingLeave(true);
    try {
      await attendanceSettingsAPI.upsertLeaveAllowance(
        leaveMode === 'bulk'
          ? { leaveType, mode: 'bulk', bulkDays: Number(leaveBulk) || 0 }
          : {
              leaveType,
              mode: 'custom',
              perEmployee: Object.entries(leavePerEmp).map(([employee, days]) => ({
                employee,
                days: Number(days) || 0,
              })),
            },
      );
      Alert.alert('Saved', `Leave allowance updated for ${leaveType}`);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSavingLeave(false);
    }
  };

  const loadSummary = async () => {
    setShowSummary(p => !p);
    if (summary.length === 0) {
      try {
        const res = await attendanceSettingsAPI.getBalanceSummary();
        setSummary((res as any)?.data || []);
      } catch (e: any) {
        Alert.alert('Error', e.message);
      }
    }
  };

  if (loading) return <LoadingView />;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Text style={styles.title}>Attendance Settings</Text>
        <Text style={styles.subtitle}>Shift, late & leave allowance rules</Text>

        <Card>
          <SectionTitle title="Shift Timings" />
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Shift Start</Text>
              <View style={styles.timeInputs}>
                <TextInput
                  style={[styles.fieldInput, styles.timeInput]}
                  value={pad(rules.shiftStartHour)}
                  onChangeText={v =>
                    set('shiftStartHour', Math.min(23, Math.max(0, Number(v) || 0)))
                  }
                  keyboardType="numeric"
                  maxLength={2}
                  placeholder="HH"
                  placeholderTextColor={colors.muted}
                />
                <Text style={styles.timeSep}>:</Text>
                <TextInput
                  style={[styles.fieldInput, styles.timeInput]}
                  value={pad(rules.shiftStartMinute)}
                  onChangeText={v =>
                    set('shiftStartMinute', Math.min(59, Math.max(0, Number(v) || 0)))
                  }
                  keyboardType="numeric"
                  maxLength={2}
                  placeholder="MM"
                  placeholderTextColor={colors.muted}
                />
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Shift End</Text>
              <View style={styles.timeInputs}>
                <TextInput
                  style={[styles.fieldInput, styles.timeInput]}
                  value={pad(rules.shiftEndHour)}
                  onChangeText={v =>
                    set('shiftEndHour', Math.min(23, Math.max(0, Number(v) || 0)))
                  }
                  keyboardType="numeric"
                  maxLength={2}
                  placeholder="HH"
                  placeholderTextColor={colors.muted}
                />
                <Text style={styles.timeSep}>:</Text>
                <TextInput
                  style={[styles.fieldInput, styles.timeInput]}
                  value={pad(rules.shiftEndMinute)}
                  onChangeText={v =>
                    set('shiftEndMinute', Math.min(59, Math.max(0, Number(v) || 0)))
                  }
                  keyboardType="numeric"
                  maxLength={2}
                  placeholder="MM"
                  placeholderTextColor={colors.muted}
                />
              </View>
            </View>
          </View>
        </Card>

        <Card>
          <SectionTitle title="Late Coming" />
          <NumField
            label="Grace Period"
            value={rules.lateThresholdMinutes}
            onChange={v => set('lateThresholdMinutes', v)}
            hint="Employee is marked late after this many minutes"
            suffix="min"
          />
          <ChipSelect
            label="Deduction Type"
            options={['fixed', 'percent'] as const}
            value={rules.lateDeductionType}
            onChange={v => set('lateDeductionType', v)}
            labels={{ fixed: 'Fixed (₹)', percent: 'Percent (%)' }}
          />
          <NumField
            label={
              rules.lateDeductionType === 'fixed'
                ? 'Deduction Amount (₹)'
                : 'Deduction Percent (%)'
            }
            value={rules.lateDeductionAmount}
            onChange={v => set('lateDeductionAmount', v)}
            hint={
              rules.lateDeductionType === 'percent'
                ? 'Percentage of daily salary to deduct'
                : undefined
            }
            suffix={rules.lateDeductionType === 'fixed' ? '₹' : '%'}
          />
          <NumField
            label="Half-Day Threshold"
            value={rules.halfDayThresholdMinutes}
            onChange={v => set('halfDayThresholdMinutes', v)}
            hint="Mark as half-day if late by more than this"
            suffix="min"
          />
        </Card>

        <Card>
          <SectionTitle title="Early Checkout" />
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleLabel}>Enable Early Checkout Deduction</Text>
              <Text style={styles.toggleDesc}>
                Deduct salary for employees who leave early
              </Text>
            </View>
            <Switch
              value={rules.earlyCheckoutDeductionEnabled}
              onValueChange={v => set('earlyCheckoutDeductionEnabled', v)}
              trackColor={{ false: '#E5E7EB', true: colors.blue }}
              thumbColor={colors.white}
            />
          </View>
          {rules.earlyCheckoutDeductionEnabled ? (
            <NumField
              label="Early Checkout Grace"
              value={rules.earlyCheckoutThresholdMinutes}
              onChange={v => set('earlyCheckoutThresholdMinutes', v)}
              hint="Minutes before shift end that triggers deduction"
              suffix="min"
            />
          ) : null}
        </Card>

        <Button title="Save Attendance Settings" onPress={handleSave} loading={saving} />

        <View style={{ height: 20 }} />

        <Card>
          <SectionTitle title="Late Allowance / Month" />
          <ChipSelect
            label="Mode"
            options={['bulk', 'custom'] as const}
            value={lateMode}
            onChange={setLateMode}
            labels={{ bulk: 'Bulk (all employees)', custom: 'Custom (per employee)' }}
          />
          {lateMode === 'bulk' ? (
            <View style={{ marginBottom: 14 }}>
              <Text style={styles.fieldLabel}>Max lates/month (no deduction)</Text>
              <TextInput
                style={styles.fieldInput}
                value={lateBulk}
                onChangeText={setLateBulk}
                keyboardType="numeric"
                placeholderTextColor={colors.muted}
              />
            </View>
          ) : (
            employees.map(e => (
              <View key={e._id} style={styles.perEmpRow}>
                <Text style={styles.perEmpName} numberOfLines={1}>
                  {e.firstName} {e.lastName}
                </Text>
                <TextInput
                  style={styles.perEmpInput}
                  value={latePerEmp[e._id] ?? ''}
                  onChangeText={v => setLatePerEmp(p => ({ ...p, [e._id]: v }))}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.muted}
                />
              </View>
            ))
          )}
          <Button
            title="Save Late Allowance"
            onPress={handleSaveLateAllowance}
            loading={savingLate}
          />
        </Card>

        <Card>
          <SectionTitle title="Leave Allowance / Month" />
          <ChipSelect
            label="Leave Type"
            options={LEAVE_TYPES}
            value={leaveType}
            onChange={setLeaveType}
          />
          <ChipSelect
            label="Mode"
            options={['bulk', 'custom'] as const}
            value={leaveMode}
            onChange={setLeaveMode}
            labels={{ bulk: 'Bulk (all employees)', custom: 'Custom (per employee)' }}
          />
          {leaveMode === 'bulk' ? (
            <View style={{ marginBottom: 14 }}>
              <Text style={styles.fieldLabel}>
                No-deduction days/month for {leaveType}
              </Text>
              <TextInput
                style={styles.fieldInput}
                value={leaveBulk}
                onChangeText={setLeaveBulk}
                keyboardType="numeric"
                placeholderTextColor={colors.muted}
              />
            </View>
          ) : (
            employees.map(e => (
              <View key={e._id} style={styles.perEmpRow}>
                <Text style={styles.perEmpName} numberOfLines={1}>
                  {e.firstName} {e.lastName}
                </Text>
                <TextInput
                  style={styles.perEmpInput}
                  value={leavePerEmp[e._id] ?? ''}
                  onChangeText={v => setLeavePerEmp(p => ({ ...p, [e._id]: v }))}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.muted}
                />
              </View>
            ))
          )}
          <Button
            title="Save Leave Allowance"
            onPress={handleSaveLeaveAllowance}
            loading={savingLeave}
          />
        </Card>

        <Card>
          <TouchableOpacity
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
            onPress={loadSummary}
          >
            <BarChart2 size={16} color={colors.blue} />
            <Text style={styles.sectionTitleInline}>
              Balance Summary {showSummary ? '▲' : '▼'}
            </Text>
          </TouchableOpacity>
          {showSummary ? (
            summary.length === 0 ? (
              <Text style={[styles.hint, { marginTop: 10 }]}>
                No usage recorded this month yet.
              </Text>
            ) : (
              summary.map((row, i) => (
                <View
                  key={row.employee?._id || i}
                  style={[styles.perEmpRow, { flexDirection: 'column', alignItems: 'flex-start', marginTop: 10 }]}
                >
                  <Text style={styles.perEmpName}>
                    {row.employee?.firstName} {row.employee?.lastName}
                    {row.employee?.employeeId ? ` (${row.employee.employeeId})` : ''}
                  </Text>
                  <Text style={styles.hint}>
                    Late: {row.lateUsed}/{row.lateAllowed}
                  </Text>
                  {(row.leaveUsed || []).map((l: any) => (
                    <Text key={l.leaveType} style={styles.hint}>
                      {l.leaveType}: {l.daysUsed}/{l.daysAllowed}d
                    </Text>
                  ))}
                </View>
              ))
            )
          ) : null}
        </Card>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            These rules apply globally to all employees. Per-employee overrides
            can be set above via Custom mode.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  title: { fontFamily: FONT.bold, fontSize: 24, fontWeight: '800', color: colors.black },
  subtitle: { fontFamily: FONT.medium, color: colors.muted, marginTop: 2, marginBottom: 16 },
  fieldLabel: {
    fontFamily: FONT.bold,
    fontSize: 11,
    fontWeight: '700',
    color: colors.black,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.black,
  },
  fieldInput: {
    fontFamily: FONT.medium,
    borderWidth: 2,
    borderColor: colors.black,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.black,
  },
  suffix: {
    paddingHorizontal: 10,
    borderLeftWidth: 2,
    borderLeftColor: colors.black,
    backgroundColor: colors.background,
    paddingVertical: 10,
  },
  suffixText: { fontFamily: FONT.bold, fontSize: 13, fontWeight: '700', color: colors.muted },
  hint: { fontFamily: FONT.medium, fontSize: 11, color: colors.muted, marginTop: 4 },
  timeInputs: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timeInput: { width: 56, textAlign: 'center', borderWidth: 2 },
  timeSep: { fontFamily: FONT.bold, fontSize: 18, fontWeight: '700', color: colors.black },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  toggleLabel: { fontFamily: FONT.bold, fontSize: 13, fontWeight: '700', color: colors.black },
  toggleDesc: { fontFamily: FONT.medium, fontSize: 11, color: colors.muted, marginTop: 2 },
  perEmpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    gap: 8,
  },
  perEmpName: { flex: 1, fontFamily: FONT.bold, fontSize: 13, fontWeight: '600', color: colors.black },
  perEmpInput: {
    width: 60,
    borderWidth: 2,
    borderColor: colors.black,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 13,
    fontWeight: '700',
    fontFamily: FONT.bold,
    color: colors.black,
    textAlign: 'center',
  },
  sectionTitleInline: { fontFamily: FONT.bold, fontSize: 16, fontWeight: '700', color: colors.black },
  infoBox: {
    backgroundColor: '#EFF6FF',
    borderWidth: 2,
    borderColor: colors.blue,
    padding: 12,
    marginTop: 4,
  },
  infoText: {
    fontFamily: FONT.medium,
    fontSize: 12,
    color: colors.blue,
    fontWeight: '500',
    lineHeight: 18,
  },
});
