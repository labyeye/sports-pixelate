import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  Alert,
  ActivityIndicator,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { employeeAPI, departmentAPI, shiftAPI } from '../api/client';
import {
  Button,
  Card,
  ChipSelect,
  CollapsibleSection,
  PickerField,
  SectionTitle,
  TextField,
  ToggleRow,
} from '../components/ui';
import { INDIA_STATES, INDIA_STATES_AND_CITIES } from '../data/indiaStatesAndCities';
import { getCurrentPosition } from '../utils/location';
import { colors, FONT } from '../theme/colors';

const ROLES = ['coach', 'staff'] as const;
const EMPLOYMENT_TYPES = ['full_time', 'part_time', 'contract', 'intern'] as const;
const GENDERS = ['male', 'female', 'other'] as const;
const STATUSES = ['active', 'inactive', 'on_leave', 'terminated'] as const;
const MARITAL = ['', 'single', 'married', 'divorced', 'widowed'] as const;
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const WORK_DAYS = ['5', '6', '7'] as const;
const SCHEDULES = ['standard', 'custom'] as const;
const GEO_MODES = ['specific', 'any'] as const;
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Plain-text fields, all kept as strings in one state object.
const TEXT_KEYS = [
  'firstName', 'lastName', 'email', 'phone', 'designation', 'sport', 'joinDate', 'salary', 'password',
  'dateOfBirth', 'bloodGroup', 'nationality', 'religion', 'fatherName', 'motherName', 'spouseName',
  'personalEmail', 'alternatePhone', 'emergencyContact', 'qualification', 'totalExperience', 'previousCompany',
  'address', 'permanentAddress', 'state', 'city', 'pincode',
  'bankName', 'bankAccount', 'accountHolderName', 'ifscCode', 'panNumber', 'aadharNumber',
  'uanNumber', 'esicNumber', 'pfNumber',
  'otRate', 'geofenceLat', 'geofenceLng', 'geofenceRadiusMeters',
] as const;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const today = () => new Date().toISOString().slice(0, 10);

const initForm = (e: any) => {
  const f: Record<string, any> = {};
  for (const k of TEXT_KEYS) {
    const v = e?.[k];
    f[k] = v == null ? '' : String(v);
  }
  f.joinDate = (e?.joinDate || '').split('T')[0] || today();
  f.dateOfBirth = (e?.dateOfBirth || '').split('T')[0];
  f.nationality = e?.nationality || 'Indian';
  f.geofenceRadiusMeters = String(e?.geofenceRadiusMeters || 200);
  f.password = '';
  f.role = e?.role || 'staff';
  f.employmentType = e?.employmentType || 'full_time';
  f.gender = e?.gender || 'male';
  f.status = e?.status || 'active';
  f.maritalStatus = e?.maritalStatus || '';
  f.departmentId = e?.department?._id || '';
  f.workScheduleType = e?.workScheduleType || 'standard';
  f.workDaysPerWeek = String(e?.workDaysPerWeek || 6);
  f.customWorkDays = e?.customWorkDays || [];
  f.otEnabled = e?.otEnabled === true;
  f.geofenceAttendanceEnabled = e?.geofenceAttendanceEnabled === true;
  f.geofenceMode = e?.geofenceMode === 'any' ? 'any' : 'specific';
  f.shiftId = e?.isCustomShift ? 'custom' : e?.shift?._id || e?.shift || '';
  const cs = e?.customShift || {};
  f.csStart = cs.startTime || '';
  f.csEnd = cs.endTime || '';
  f.csBreak = String(cs.breakMinutes ?? 30);
  f.csHours = String(cs.workingHours ?? 8);
  f.csOt = String(cs.otAfterHours ?? 9);
  return f;
};

export default function AddEmployeeScreen({ navigation, route }: any) {
  const editing = route?.params?.employee;
  const isEditing = !!editing;

  const [form, setForm] = useState<Record<string, any>>(() => initForm(editing));
  const [departments, setDepartments] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [cityOther, setCityOther] = useState(() => {
    const s = editing?.state, c = editing?.city;
    return !!c && !(INDIA_STATES_AND_CITIES[s] || []).includes(c);
  });
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));
  const text = (k: string, label: string, extra: object = {}) => (
    <TextField label={label} value={form[k]} onChangeText={v => set(k, v)} {...extra} />
  );

  useEffect(() => {
    departmentAPI.getAll().then((r: any) => setDepartments(r.data || [])).catch(() => {});
    shiftAPI.getAll().then((r: any) => setShifts(r.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    navigation.setOptions?.({ title: isEditing ? 'Edit Staff' : 'Add Staff' });
  }, [navigation, isEditing]);

  const useMyLocation = async () => {
    setLocating(true);
    try {
      if (Platform.OS === 'android') {
        const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
        if (r !== PermissionsAndroid.RESULTS.GRANTED) throw new Error('Location permission is required');
      }
      const p = await getCurrentPosition();
      setForm(f => ({ ...f, geofenceLat: String(p.latitude), geofenceLng: String(p.longitude) }));
    } catch (e: any) {
      Alert.alert('Location unavailable', e?.message || 'Could not read your location');
    } finally {
      setLocating(false);
    }
  };

  const save = async () => {
    const t = (k: string) => String(form[k] ?? '').trim();
    if (!t('firstName') || !t('lastName') || !t('designation') || (!isEditing && !t('email'))) {
      Alert.alert('Missing fields', 'First name, last name, email and designation are required');
      return;
    }
    for (const [k, label] of [['joinDate', 'Join date'], ['dateOfBirth', 'Date of birth']] as const) {
      if (t(k) && !DATE_RE.test(t(k))) {
        Alert.alert('Invalid date', `${label} must be YYYY-MM-DD`);
        return;
      }
    }
    if (form.password && form.password.length < 6) {
      Alert.alert('Weak password', 'Password must be at least 6 characters');
      return;
    }
    const custom = form.shiftId === 'custom';
    const shift = shifts.find(s => s._id === form.shiftId);

    // Fields the backend only accepts on update (create ignores them).
    const scheduleFields: any = {
      workScheduleType: form.workScheduleType,
      workDaysPerWeek:
        form.workScheduleType === 'custom' ? form.customWorkDays.length : Number(form.workDaysPerWeek) || 6,
      customWorkDays: form.workScheduleType === 'custom' ? form.customWorkDays : [],
      otEnabled: form.otEnabled,
      otRate: Number(form.otRate) || 0,
      geofenceAttendanceEnabled: form.geofenceAttendanceEnabled,
      geofenceMode: form.geofenceMode,
      geofenceLat: t('geofenceLat') === '' ? undefined : Number(t('geofenceLat')),
      geofenceLng: t('geofenceLng') === '' ? undefined : Number(t('geofenceLng')),
      geofenceRadiusMeters: Number(t('geofenceRadiusMeters')) || 200,
    };

    const payload: any = {
      firstName: t('firstName'),
      lastName: t('lastName'),
      designation: t('designation'),
      role: form.role,
      sport: form.role === 'coach' ? t('sport') : '',
      employmentType: form.employmentType,
      department: form.departmentId || undefined,
      gender: form.gender,
      salary: Number(t('salary')) || 0,
      shift: custom ? undefined : form.shiftId || undefined,
      shiftName: custom ? 'Custom' : shift?.name || 'General',
      isCustomShift: custom,
      customShift: custom
        ? {
            startTime: t('csStart'),
            endTime: t('csEnd'),
            breakMinutes: Number(form.csBreak) || 30,
            workingHours: Number(form.csHours) || 8,
            otAfterHours: Number(form.csOt) || 9,
          }
        : undefined,
      ...scheduleFields,
    };
    for (const k of TEXT_KEYS) {
      if (['firstName', 'lastName', 'designation', 'sport', 'salary', 'email', 'password', 'joinDate', 'otRate',
        'geofenceLat', 'geofenceLng', 'geofenceRadiusMeters'].includes(k)) continue;
      payload[k] = t(k);
    }
    if (isEditing) payload.status = form.status;
    else {
      payload.email = t('email');
      payload.joinDate = t('joinDate') || today();
      if (form.password) payload.password = form.password;
    }

    setSaving(true);
    try {
      if (isEditing) {
        await employeeAPI.update(editing._id, payload);
      } else {
        const res: any = await employeeAPI.create(payload);
        const id = res?.data?._id;
        if (id) {
          await employeeAPI.update(id, scheduleFields).catch(() => {
            Alert.alert('Saved with a warning', 'Staff was added, but schedule/overtime/geofence settings could not be saved. Edit the staff to retry.');
          });
        }
      }
      Alert.alert('Success', isEditing ? 'Staff updated successfully' : 'Staff added successfully');
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not save staff member');
    } finally {
      setSaving(false);
    }
  };

  const cityOptions = form.state ? INDIA_STATES_AND_CITIES[form.state] || [] : [];

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Card>
          <SectionTitle title="Staff Details" />
          {text('firstName', 'First Name', { required: true })}
          {text('lastName', 'Last Name', { required: true })}
          {text('email', 'Email', { keyboardType: 'email-address', required: !isEditing })}
          {isEditing && <Text style={styles.hint}>Email can't be changed after creation</Text>}
          {text('phone', 'Phone', { keyboardType: 'phone-pad' })}
          {text('designation', 'Designation', { placeholder: 'e.g. Head Coach', required: true })}
          <ChipSelect label="Role" options={ROLES} value={form.role} onChange={v => set('role', v)} />
          {form.role === 'coach' && text('sport', 'Sport', { placeholder: 'e.g. Football' })}
          <ChipSelect label="Employment Type" options={EMPLOYMENT_TYPES} value={form.employmentType} onChange={v => set('employmentType', v)} />
          <ChipSelect label="Gender" options={GENDERS} value={form.gender} onChange={v => set('gender', v)} />
          {departments.length > 0 && (
            <ChipSelect
              label="Department"
              options={['', ...departments.map(d => d._id)] as string[]}
              value={form.departmentId}
              onChange={v => set('departmentId', v)}
              labels={Object.fromEntries([['', 'Unassigned'], ...departments.map(d => [d._id, d.name])])}
            />
          )}
          {!isEditing && text('joinDate', 'Join Date (YYYY-MM-DD)', { placeholder: today() })}
          {text('salary', 'Salary (₹)', { keyboardType: 'numeric' })}
          {!isEditing && text('password', 'Initial Password (optional)', { secureTextEntry: true, placeholder: 'Auto-generated if blank' })}
          {isEditing && <ChipSelect label="Status" options={STATUSES} value={form.status} onChange={v => set('status', v)} />}
        </Card>

        <CollapsibleSection title="Personal Details">
          {text('dateOfBirth', 'Date of Birth (YYYY-MM-DD)', { placeholder: '1990-01-31' })}
          <ChipSelect label="Marital Status" options={MARITAL} value={form.maritalStatus} onChange={v => set('maritalStatus', v)} labels={{ '': '—' }} />
          <PickerField label="Blood Group" options={BLOOD_GROUPS} value={form.bloodGroup} onChange={v => set('bloodGroup', v)} />
          {text('nationality', 'Nationality')}
          {text('religion', 'Religion')}
          {text('fatherName', "Father's Name")}
          {text('motherName', "Mother's Name")}
          {text('spouseName', "Spouse's Name")}
          {text('personalEmail', 'Personal Email', { keyboardType: 'email-address' })}
          {text('alternatePhone', 'Alternate Phone', { keyboardType: 'phone-pad' })}
          {text('emergencyContact', 'Emergency Contact', { keyboardType: 'phone-pad' })}
          {text('qualification', 'Qualification')}
          {text('totalExperience', 'Total Experience')}
          {text('previousCompany', 'Previous Company')}
        </CollapsibleSection>

        <CollapsibleSection title="Address">
          {text('address', 'Current Address', { multiline: true })}
          {text('permanentAddress', 'Permanent Address', { multiline: true })}
          <PickerField
            label="State"
            options={INDIA_STATES}
            value={form.state}
            onChange={v => {
              setForm(f => ({ ...f, state: v, city: '' }));
              setCityOther(false);
            }}
          />
          {cityOther ? (
            text('city', 'City')
          ) : (
            <PickerField
              label="City"
              options={[...cityOptions, 'Other']}
              value={form.city}
              disabled={!form.state}
              disabledHint="Select a state first"
              onChange={v => (v === 'Other' ? (setCityOther(true), set('city', '')) : set('city', v))}
            />
          )}
          {text('pincode', 'Pincode', { keyboardType: 'numeric' })}
        </CollapsibleSection>

        <CollapsibleSection title="Bank & Statutory">
          {text('bankName', 'Bank Name')}
          {text('bankAccount', 'Account Number', { keyboardType: 'numeric' })}
          {text('accountHolderName', 'Account Holder Name')}
          {text('ifscCode', 'IFSC Code')}
          {text('panNumber', 'PAN Number')}
          {text('aadharNumber', 'Aadhar Number', { keyboardType: 'numeric' })}
          {text('uanNumber', 'UAN Number')}
          {text('esicNumber', 'ESIC Number')}
          {text('pfNumber', 'PF Number')}
        </CollapsibleSection>

        <CollapsibleSection title="Work Schedule & Overtime">
          <ChipSelect label="Schedule" options={SCHEDULES} value={form.workScheduleType} onChange={v => set('workScheduleType', v)} />
          {form.workScheduleType === 'custom' ? (
            <View style={styles.dayRow}>
              {DAYS.map(d => {
                const on = form.customWorkDays.includes(d);
                return (
                  <TouchableOpacity
                    key={d}
                    style={[styles.day, on && styles.dayOn]}
                    onPress={() => set('customWorkDays', on ? form.customWorkDays.filter((x: string) => x !== d) : [...form.customWorkDays, d])}
                  >
                    <Text style={[styles.dayText, on && { color: colors.white }]}>{d}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <ChipSelect label="Work days per week" options={WORK_DAYS} value={form.workDaysPerWeek as any} onChange={v => set('workDaysPerWeek', v)} />
          )}
          <ChipSelect
            label="Shift"
            options={['', ...shifts.map(s => s._id), 'custom'] as string[]}
            value={form.shiftId}
            onChange={v => set('shiftId', v)}
            labels={Object.fromEntries([['', 'General'], ...shifts.map(s => [s._id, s.name]), ['custom', 'Custom']])}
          />
          {form.shiftId === 'custom' && (
            <>
              {text('csStart', 'Start Time (HH:MM)', { placeholder: '09:00' })}
              {text('csEnd', 'End Time (HH:MM)', { placeholder: '18:00' })}
              {text('csBreak', 'Break (minutes)', { keyboardType: 'numeric' })}
              {text('csHours', 'Working Hours', { keyboardType: 'numeric' })}
              {text('csOt', 'OT After (hours)', { keyboardType: 'numeric' })}
            </>
          )}
          <ToggleRow label="Enable Overtime" value={form.otEnabled} onChange={v => set('otEnabled', v)} />
          {form.otEnabled && text('otRate', 'OT Rate (₹ / hour)', { keyboardType: 'numeric' })}
        </CollapsibleSection>

        <CollapsibleSection title="Geofence Attendance">
          <ToggleRow
            label="Restrict check-in to a location"
            sub="Staff can only mark attendance from within the allowed area"
            value={form.geofenceAttendanceEnabled}
            onChange={v => set('geofenceAttendanceEnabled', v)}
          />
          {form.geofenceAttendanceEnabled && (
            <>
              <ChipSelect
                label="Mode"
                options={GEO_MODES}
                value={form.geofenceMode}
                onChange={v => set('geofenceMode', v)}
                labels={{ specific: 'Specific location', any: 'Any allowed location' }}
              />
              {form.geofenceMode === 'specific' && (
                <>
                  {text('geofenceLat', 'Latitude', { keyboardType: 'numeric' })}
                  {text('geofenceLng', 'Longitude', { keyboardType: 'numeric' })}
                  <Button title={locating ? 'Locating…' : 'Use my current location'} variant="outline" onPress={useMyLocation} loading={locating} />
                  <View style={{ height: 12 }} />
                </>
              )}
              {text('geofenceRadiusMeters', 'Radius (metres)', { keyboardType: 'numeric' })}
            </>
          )}
        </CollapsibleSection>

        <View style={{ height: 12 }} />
        <Button title={saving ? 'Saving...' : isEditing ? 'Update Staff' : 'Save Staff'} onPress={save} disabled={saving} />
        {saving && <ActivityIndicator style={{ marginTop: 12 }} color={colors.blue} />}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  hint: { color: colors.muted, fontSize: 11, marginTop: -8, marginBottom: 14 },
  dayRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  day: { borderWidth: 2, borderColor: colors.black, paddingHorizontal: 12, paddingVertical: 8 },
  dayOn: { backgroundColor: colors.blue },
  dayText: { fontFamily: FONT.bold, fontSize: 12, color: colors.black },
});
