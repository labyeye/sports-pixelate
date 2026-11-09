import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, Trash2 } from 'lucide-react-native';
import { employeeAPI } from '../api/client';
import {
  Button,
  Card,
  LoadingView,
  SectionTitle,
  TextField,
} from '../components/ui';
import ScreenHeader from '../components/ScreenHeader';
import { colors, FONT } from '../theme/colors';
import { notifyError } from '../utils/notifyError';

// Mirrors web components/ess/ProfileDetailsTabPane.tsx: same fields, same
// single PUT /employees/:id carrying all lists.
type Field = { key: string; label: string; numeric?: boolean };
type ListDef = { key: string; title: string; fields: Field[] };

const LISTS: ListDef[] = [
  {
    key: 'education',
    title: 'Education',
    fields: [
      { key: 'degree', label: 'Degree / Course' },
      { key: 'school', label: 'School / University' },
      { key: 'passYear', label: 'Pass Year', numeric: true },
      { key: 'percentage', label: 'Percentage / CGPA' },
    ],
  },
  {
    key: 'experience',
    title: 'Experience',
    fields: [
      { key: 'company', label: 'Company' },
      { key: 'role', label: 'Role' },
      { key: 'start', label: 'Start (YYYY-MM-DD)' },
      { key: 'end', label: 'End (YYYY-MM-DD)' },
      { key: 'description', label: 'Description' },
    ],
  },
  {
    key: 'certificates',
    title: 'Certifications',
    fields: [
      { key: 'title', label: 'Certificate Title' },
      { key: 'issuer', label: 'Issued By' },
      { key: 'year', label: 'Year', numeric: true },
    ],
  },
  {
    key: 'nominees',
    title: 'Nominees',
    fields: [
      { key: 'name', label: 'Name' },
      { key: 'relationship', label: 'Relationship' },
      { key: 'dateOfBirth', label: 'Date of Birth (YYYY-MM-DD)' },
      { key: 'percentage', label: 'Share %', numeric: true },
    ],
  },
  {
    key: 'familyDetails',
    title: 'Family Details',
    fields: [
      { key: 'name', label: 'Name' },
      { key: 'relationship', label: 'Relationship' },
      { key: 'dateOfBirth', label: 'Date of Birth (YYYY-MM-DD)' },
      { key: 'phone', label: 'Phone', numeric: true },
    ],
  },
];

const BASIC: Field[] = [
  { key: 'panNumber', label: 'PAN Number' },
  { key: 'bankAccount', label: 'Bank Account', numeric: true },
  { key: 'ifscCode', label: 'IFSC Code' },
  { key: 'emergencyContact', label: 'Emergency Contact', numeric: true },
];

export default function ProfileDetailsScreen() {
  const [emp, setEmp] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [newSkill, setNewSkill] = useState('');

  useEffect(() => {
    employeeAPI
      .getMe()
      .then((r: any) => setEmp(r?.data || r))
      .catch(notifyError);
  }, []);

  if (!emp) return <LoadingView />;

  const set = (k: string, v: any) => setEmp((e: any) => ({ ...e, [k]: v }));
  const list = (k: string): any[] => emp[k] || [];
  const setItem = (k: string, i: number, f: string, v: string) =>
    set(
      k,
      list(k).map((it, j) => (j === i ? { ...it, [f]: v } : it)),
    );

  const save = async () => {
    setSaving(true);
    try {
      const body: Record<string, any> = { skills: emp.skills || [] };
      BASIC.forEach(f => (body[f.key] = emp[f.key] || ''));
      LISTS.forEach(l => (body[l.key] = list(l.key)));
      const res: any = await employeeAPI.update(emp._id, body);
      if (res?.success) Alert.alert('Saved', 'Profile details updated.');
    } catch (e) {
      notifyError(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScreenHeader title="Profile Details" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          <Card>
            <SectionTitle title="Bank & Contact" />
            {BASIC.map(f => (
              <TextField
                key={f.key}
                label={f.label}
                value={String(emp[f.key] ?? '')}
                onChangeText={v => set(f.key, v)}
                keyboardType={f.numeric ? 'numeric' : 'default'}
              />
            ))}
          </Card>

          <Card>
            <SectionTitle title="Skills" />
            <View style={styles.chips}>
              {(emp.skills || []).map((s: string, i: number) => (
                <TouchableOpacity
                  key={`${s}-${i}`}
                  style={styles.chip}
                  onPress={() =>
                    set(
                      'skills',
                      (emp.skills || []).filter(
                        (_: string, j: number) => j !== i,
                      ),
                    )
                  }
                >
                  <Text style={styles.chipText}>{s} ✕</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextField
              label="Add a skill"
              value={newSkill}
              onChangeText={setNewSkill}
              placeholder="e.g. Tennis coaching"
            />
            <Button
              title="Add Skill"
              variant="outline"
              onPress={() => {
                if (!newSkill.trim()) return;
                set('skills', [...(emp.skills || []), newSkill.trim()]);
                setNewSkill('');
              }}
            />
          </Card>

          {LISTS.map(l => (
            <Card key={l.key}>
              <View style={styles.head}>
                <SectionTitle title={l.title} />
                <TouchableOpacity
                  onPress={() =>
                    set(l.key, [
                      ...list(l.key),
                      Object.fromEntries(l.fields.map(f => [f.key, ''])),
                    ])
                  }
                >
                  <Plus size={20} color={colors.blue} strokeWidth={3} />
                </TouchableOpacity>
              </View>
              {list(l.key).length === 0 ? (
                <Text style={styles.empty}>Nothing added yet</Text>
              ) : null}
              {list(l.key).map((it, i) => (
                <View key={i} style={styles.item}>
                  {l.fields.map(f => (
                    <TextField
                      key={f.key}
                      label={f.label}
                      value={String(it[f.key] ?? '')}
                      onChangeText={v => setItem(l.key, i, f.key, v)}
                      keyboardType={f.numeric ? 'numeric' : 'default'}
                    />
                  ))}
                  <TouchableOpacity
                    onPress={() =>
                      set(
                        l.key,
                        list(l.key).filter((_, j) => j !== i),
                      )
                    }
                    style={styles.del}
                  >
                    <Trash2 size={14} color={colors.red} strokeWidth={2.5} />
                    <Text style={styles.delText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </Card>
          ))}

          <Button
            title="Save Profile Details"
            onPress={save}
            loading={saving}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  chip: {
    borderWidth: 2,
    borderColor: colors.black,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: { fontFamily: FONT.semiBold, fontSize: 12, color: colors.black },
  item: {
    borderTopWidth: 1,
    borderColor: '#E5E7EB',
    paddingTop: 12,
    marginTop: 8,
  },
  empty: { color: colors.muted, fontFamily: FONT.medium, fontSize: 13 },
  del: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  delText: { color: colors.red, fontFamily: FONT.semiBold, fontSize: 12 },
});
