import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  departmentAPI,
  designationAPI,
  salaryHeadAPI,
  shiftAPI,
} from '../api/client';
import ConfigCrud, { CrudConfig } from '../components/ConfigCrud';
import { Card, FilterPills, Row, SectionTitle } from '../components/ui';
import { colors } from '../theme/colors';

const STATUS = ['active', 'inactive'];
const statusBadge = (s: string) => ({
  label: s,
  color: s === 'active' ? colors.green : colors.muted,
});

const CALC_LABELS: Record<string, string> = {
  fixed: 'Fixed Amount',
  percent_of_basic: '% of Basic',
  percent_of_gross: '% of Gross',
  formula: 'Formula',
  as_per_loan: 'As per Loan',
};

// Field lists and payloads mirror the web Manage page one-to-one.
const shifts: CrudConfig = {
  title: 'Shift',
  api: shiftAPI,
  fields: [
    { key: 'name', label: 'Shift Name', required: true, placeholder: 'e.g. Morning Batch' },
    { key: 'startTime', label: 'Start Time (HH:MM)', required: true, placeholder: '09:00' },
    { key: 'endTime', label: 'End Time (HH:MM)', required: true, placeholder: '18:00' },
    { key: 'breakMinutes', label: 'Break (minutes)', kind: 'number' },
    { key: 'workingHours', label: 'Working Hours', kind: 'number' },
    { key: 'otAfterHours', label: 'OT After (hours)', kind: 'number' },
    { key: 'color', label: 'Colour (hex)', placeholder: '#024BAB' },
    { key: 'status', label: 'Status', kind: 'select', options: STATUS },
  ],
  defaults: {
    name: '',
    startTime: '09:00',
    endTime: '18:00',
    breakMinutes: '30',
    workingHours: '8',
    otAfterHours: '9',
    color: '#024BAB',
    status: 'active',
  },
  row: s => ({
    title: s.name,
    subtitle: `${s.startTime} – ${s.endTime} · ${s.workingHours}h · break ${s.breakMinutes}m · OT after ${s.otAfterHours}h`,
    badge: statusBadge(s.status),
    dot: s.color,
  }),
};

const salaryHeads: CrudConfig = {
  title: 'Salary Head',
  api: salaryHeadAPI,
  fields: [
    { key: 'name', label: 'Component Name', required: true, placeholder: 'e.g. HRA, Medical Allowance' },
    { key: 'type', label: 'Type', kind: 'select', options: ['Earning', 'Deduction', 'Variable'] },
    { key: 'calcMethod', label: 'Calculation', kind: 'select', options: Object.keys(CALC_LABELS), labels: CALC_LABELS },
    { key: 'value', label: 'Value', kind: 'number', placeholder: 'e.g. 1600 or 12' },
    { key: 'taxable', label: 'Taxable', kind: 'toggle' },
    { key: 'status', label: 'Status', kind: 'select', options: STATUS },
  ],
  defaults: { name: '', type: 'Earning', calcMethod: 'fixed', value: '', taxable: false, status: 'active' },
  row: h => ({
    title: h.name,
    subtitle: `${h.type} · ${CALC_LABELS[h.calcMethod] || h.calcMethod} · ${
      h.calcMethod === 'fixed' ? `₹${h.value}` : `${h.value}%`
    }${h.taxable ? ' · Taxable' : ''}`,
    badge: statusBadge(h.status),
  }),
};

const designations: CrudConfig = {
  title: 'Designation',
  api: designationAPI,
  refs: { departments: () => departmentAPI.getAll() },
  fields: [
    { key: 'name', label: 'Designation Name', required: true, placeholder: 'e.g. Head Coach' },
    { key: 'department', label: 'Department', kind: 'ref', ref: 'departments', required: true },
    { key: 'grade', label: 'Grade', kind: 'select', options: ['L1', 'L2', 'L3', 'L4', 'L5'] },
    { key: 'minSalary', label: 'Min Salary (₹)', kind: 'number', placeholder: '12000' },
    { key: 'maxSalary', label: 'Max Salary (₹)', kind: 'number', placeholder: '30000' },
    { key: 'status', label: 'Status', kind: 'select', options: STATUS },
  ],
  defaults: { name: '', department: '', grade: 'L1', minSalary: '', maxSalary: '', status: 'active' },
  row: d => ({
    title: d.name,
    subtitle: `${d.department?.name || '—'} · ${
      d.minSalary ? `₹${d.minSalary}` : '—'
    } to ${d.maxSalary ? `₹${d.maxSalary}` : '—'} · ${d.employeeCount || 0} staff`,
    badge: { label: d.grade, color: colors.blue },
  }),
};

type Tab = 'shifts' | 'salary' | 'designations';
const TABS: { value: Tab; label: string }[] = [
  { value: 'shifts', label: 'Shift Timings' },
  { value: 'salary', label: 'Salary Heads' },
  { value: 'designations', label: 'Designations' },
];
const CONFIGS: Record<Tab, CrudConfig> = {
  shifts,
  salary: salaryHeads,
  designations,
};

export default function ManageScreen({ navigation }: any) {
  const [tab, setTab] = useState<Tab>('shifts');
  const go = (screen: string) => () => navigation?.navigate?.(screen);

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Manage</Text>
        <Text style={styles.subtitle}>Academy configuration and modules</Text>

        <FilterPills options={TABS} value={tab} onChange={setTab} />
        <View style={{ height: 12 }} />
        <ConfigCrud key={tab} config={CONFIGS[tab]} />

        <Card>
          <SectionTitle title="Modules" />
          <Row title="Departments" subtitle="Manage teams and departments" onPress={go('Departments')} />
          <Row title="Employees" subtitle="Manage staff and coaches" onPress={go('Employees')} />
          <Row title="Facilities" subtitle="Sports facilities and rates" onPress={go('Facilities')} />
          <Row title="Coaching Plans" subtitle="Sports plans and pricing" onPress={go('Plans')} />
          <Row title="Attendance Settings" subtitle="Shift, late & leave allowance rules" onPress={go('AttendanceSettings')} />
          <Row title="User Roles & Permissions" subtitle="Who can see and do what" onPress={go('Permissions')} />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  title: { fontSize: 24, fontWeight: '800', color: colors.black },
  subtitle: { color: colors.muted, marginTop: 2, marginBottom: 16 },
});
