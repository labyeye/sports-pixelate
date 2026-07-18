import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { employeeAPI, departmentAPI } from '../api/client';
import { Card, TextField, ChipSelect, Button, SectionTitle } from '../components/ui';
import { colors } from '../theme/colors';

const ROLES = ['coach', 'staff'] as const;
const EMPLOYMENT_TYPES = ['full_time', 'part_time', 'contract', 'intern'] as const;

export default function AddEmployeeScreen({ navigation, route }: any) {
  const editingEmployee = route?.params?.employee;
  const isEditing = !!editingEmployee;

  const [firstName, setFirstName] = useState(editingEmployee?.firstName || '');
  const [lastName, setLastName] = useState(editingEmployee?.lastName || '');
  const [email, setEmail] = useState(editingEmployee?.email || '');
  const [phone, setPhone] = useState(editingEmployee?.phone || '');
  const [designation, setDesignation] = useState(editingEmployee?.designation || '');
  const [sport, setSport] = useState(editingEmployee?.sport || '');
  const [role, setRole] = useState<(typeof ROLES)[number]>(
    editingEmployee?.role || 'staff',
  );
  const [employmentType, setEmploymentType] = useState<(typeof EMPLOYMENT_TYPES)[number]>(
    editingEmployee?.employmentType || 'full_time',
  );
  const [departmentId, setDepartmentId] = useState<string>(
    editingEmployee?.department?._id || '',
  );
  const [departments, setDepartments] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    departmentAPI
      .getAll()
      .then((res: any) => setDepartments(res.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    navigation.setOptions?.({
      title: isEditing ? 'Edit Staff' : 'Add Staff',
    });
  }, [navigation, isEditing]);

  const save = async () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !designation.trim()) {
      Alert.alert(
        'Missing fields',
        'First name, last name, email and designation are required',
      );
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        designation: designation.trim(),
        role,
        employmentType,
        sport: sport.trim() || undefined,
        department: departmentId || undefined,
        phone: phone.trim() || undefined,
      };
      if (!isEditing) {
        payload.email = email.trim();
        payload.joinDate = new Date().toISOString().slice(0, 10);
      }

      if (isEditing) {
        await employeeAPI.update(editingEmployee._id, payload);
      } else {
        await employeeAPI.create(payload);
      }

      Alert.alert('Success', isEditing ? 'Staff updated successfully' : 'Staff added successfully');
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not save staff member');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      >
        <Card>
          <SectionTitle title="Staff Details" />
          <TextField label="First Name" value={firstName} onChangeText={setFirstName} required />
          <TextField label="Last Name" value={lastName} onChangeText={setLastName} required />
          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            required={!isEditing}
          />
          {isEditing && (
            <Text style={styles.emailHint}>Email can't be changed after creation</Text>
          )}
          <TextField
            label="Phone"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
          <TextField
            label="Designation"
            value={designation}
            onChangeText={setDesignation}
            placeholder="e.g. Head Coach"
            required
          />
          <TextField
            label="Sport"
            value={sport}
            onChangeText={setSport}
            placeholder="e.g. Football"
          />
          <ChipSelect label="Role" options={ROLES} value={role} onChange={setRole} />
          <ChipSelect
            label="Employment Type"
            options={EMPLOYMENT_TYPES}
            value={employmentType}
            onChange={setEmploymentType}
          />
          {departments.length > 0 && (
            <ChipSelect
              label="Department"
              options={['', ...departments.map(d => d._id)] as string[]}
              value={departmentId}
              onChange={setDepartmentId}
              labels={Object.fromEntries([
                ['', 'Unassigned'],
                ...departments.map(d => [d._id, d.name]),
              ])}
            />
          )}
        </Card>

        <Button
          title={saving ? 'Saving...' : isEditing ? 'Update Staff' : 'Save Staff'}
          onPress={save}
          disabled={saving}
        />
        {saving && <ActivityIndicator style={{ marginTop: 12 }} color={colors.blue} />}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  emailHint: { color: colors.muted, fontSize: 11, marginTop: -8, marginBottom: 14 },
});
