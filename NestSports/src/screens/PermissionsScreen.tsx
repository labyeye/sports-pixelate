import React, { useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  Switch,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card, Button } from '../components/ui';
import { colors, FONT } from '../theme/colors';

type Role =
  | 'super_admin'
  | 'hr_manager'
  | 'hr_executive'
  | 'department_head'
  | 'employee';
type Action = 'create' | 'read' | 'update' | 'delete';

const ROLES: { id: Role; label: string }[] = [
  { id: 'super_admin', label: 'Super Admin' },
  { id: 'hr_manager', label: 'HR Manager' },
  { id: 'hr_executive', label: 'HR Exec' },
  { id: 'department_head', label: 'Dept Head' },
  { id: 'employee', label: 'Employee' },
];

const ACTIONS: Action[] = ['create', 'read', 'update', 'delete'];

const MODULES = [
  'Employees',
  'Departments',
  'Attendance',
  'Leave',
  'Payroll',
  'Performance',
  'Recruitment',
  'Biometric',
  'Reports',
  'Settings',
];

// Same defaults the web SettingsPage seeds locally — permissions here are a
// client-side matrix only, never persisted to the backend (no API exists for
// this on either platform).
function defaultsFor(role: Role): Record<Action, boolean> {
  if (role === 'super_admin')
    return { create: true, read: true, update: true, delete: true };
  if (role === 'hr_manager')
    return { create: true, read: true, update: true, delete: false };
  if (role === 'hr_executive')
    return { create: true, read: true, update: false, delete: false };
  if (role === 'department_head')
    return { create: false, read: true, update: false, delete: false };
  return { create: false, read: true, update: false, delete: false };
}

function buildInitial(): Record<string, Record<Role, Record<Action, boolean>>> {
  const state: Record<string, Record<Role, Record<Action, boolean>>> = {};
  for (const mod of MODULES) {
    state[mod] = {} as Record<Role, Record<Action, boolean>>;
    for (const r of ROLES) state[mod][r.id] = defaultsFor(r.id);
  }
  return state;
}

export default function PermissionsScreen() {
  const [role, setRole] = useState<Role>('hr_manager');
  const [matrix, setMatrix] = useState(buildInitial);
  const [saving, setSaving] = useState(false);

  const toggle = (mod: string, action: Action) => {
    setMatrix(prev => ({
      ...prev,
      [mod]: {
        ...prev[mod],
        [role]: { ...prev[mod][role], [action]: !prev[mod][role][action] },
      },
    }));
  };

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      Alert.alert(
        'Saved',
        'Permissions updated (local only — not yet persisted to the server)',
      );
    }, 400);
  };

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <Text style={styles.title}>Permissions</Text>
        <Text style={styles.subtitle}>Per-role access matrix</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.roleBar}
      >
        {ROLES.map(r => {
          const active = role === r.id;
          return (
            <TouchableOpacity
              key={r.id}
              onPress={() => setRole(r.id)}
              style={[styles.roleChip, active && styles.roleChipActive]}
            >
              <Text
                style={[styles.roleChipText, active && { color: colors.white }]}
              >
                {r.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView
        style={styles.screen}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      >
        <Card>
          {MODULES.map((mod, i) => (
            <View
              key={mod}
              style={[
                styles.moduleBlock,
                i === MODULES.length - 1 && { borderBottomWidth: 0 },
              ]}
            >
              <Text style={styles.moduleTitle}>{mod}</Text>
              <View style={styles.actionRow}>
                {ACTIONS.map(action => (
                  <View key={action} style={styles.actionCol}>
                    <Text style={styles.actionLabel}>{action}</Text>
                    <Switch
                      value={matrix[mod][role][action]}
                      onValueChange={() => toggle(mod, action)}
                      trackColor={{ false: '#D1D5DB', true: colors.blue }}
                      thumbColor={colors.white}
                    />
                  </View>
                ))}
              </View>
            </View>
          ))}
        </Card>

        <Button
          title="Save Permissions"
          onPress={handleSave}
          loading={saving}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  title: { fontSize: 24, fontWeight: '800', color: colors.black },
  subtitle: { color: colors.muted, marginTop: 2, marginBottom: 12 },
  roleBar: { paddingHorizontal: 16, paddingBottom: 12, gap: 8 },
  roleChip: {
    borderWidth: 2,
    borderColor: colors.black,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
  },
  roleChipActive: { backgroundColor: colors.blue },
  roleChipText: {
    fontFamily: FONT.bold,
    fontWeight: '700',
    fontSize: 12,
    color: colors.black,
  },
  moduleBlock: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#0000001A',
  },
  moduleTitle: {
    fontFamily: FONT.bold,
    fontWeight: '700',
    fontSize: 14,
    color: colors.black,
    marginBottom: 8,
  },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between' },
  actionCol: { alignItems: 'center' },
  actionLabel: {
    fontFamily: FONT.medium,
    fontSize: 10,
    color: colors.muted,
    textTransform: 'capitalize',
    marginBottom: 4,
  },
});
