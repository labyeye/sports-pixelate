import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  Alert,
  ActivityIndicator,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Tag,
  Trophy,
  Repeat,
  Clock,
  IndianRupee,
  FileText,
} from 'lucide-react-native';
import { sportsPlanAPI } from '../api/client';
import {
  Card,
  TextField,
  Button,
  SectionTitle,
  ChipSelect,
  DateTimeField,
} from '../components/ui';
import { colors } from '../theme/colors';

type ScheduleType = 'unlimited' | 'sessions_per_week' | 'custom_days';
type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

const SCHEDULE_TYPES: readonly ScheduleType[] = [
  'unlimited',
  'sessions_per_week',
  'custom_days',
];
const SCHEDULE_TYPE_LABELS: Record<ScheduleType, string> = {
  unlimited: 'Unlimited',
  sessions_per_week: 'Sessions / Week',
  custom_days: 'Custom Days',
};
const WEEKDAYS: { key: Weekday; label: string }[] = [
  { key: 'mon', label: 'Mon' },
  { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' },
  { key: 'sat', label: 'Sat' },
  { key: 'sun', label: 'Sun' },
];
const SCHEDULE_PRESETS: { label: string; days: Weekday[] }[] = [
  { label: 'Daily', days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] },
  { label: 'Weekdays', days: ['mon', 'tue', 'wed', 'thu', 'fri'] },
  { label: 'Weekends', days: ['sat', 'sun'] },
  { label: 'Alt (M/W/F)', days: ['mon', 'wed', 'fri'] },
  { label: 'Alt (T/T/S)', days: ['tue', 'thu', 'sat'] },
];

export default function AddPlanScreen({ navigation, route }: any) {
  const editingPlan = route?.params?.plan;
  const isEditing = !!editingPlan;

  const [name, setName] = useState(editingPlan?.name || '');
  const [sport, setSport] = useState(editingPlan?.sport || '');
  const [sessionsPerWeek, setSessionsPerWeek] = useState(
    editingPlan ? String(editingPlan.sessionsPerWeek ?? '0') : '0',
  );
  const [scheduleType, setScheduleType] = useState<ScheduleType>(
    editingPlan?.scheduleType || 'sessions_per_week',
  );
  const [scheduleDays, setScheduleDays] = useState<Weekday[]>(
    editingPlan?.scheduleDays || [],
  );
  const [startTime, setStartTime] = useState(editingPlan?.startTime || '');
  const [endTime, setEndTime] = useState(editingPlan?.endTime || '');
  const [monthlyPrice, setMonthlyPrice] = useState(
    editingPlan ? String(editingPlan.monthlyPrice ?? '') : '',
  );
  const [yearlyPrice, setYearlyPrice] = useState(
    editingPlan ? String(editingPlan.yearlyPrice ?? '') : '',
  );
  const [description, setDescription] = useState(
    editingPlan?.description || '',
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    navigation.setOptions?.({
      title: isEditing ? 'Edit Plan' : 'Add Plan',
    });
  }, [navigation, isEditing]);

  const save = async () => {
    if (!name.trim() || !sport.trim() || !monthlyPrice) {
      Alert.alert(
        'Missing fields',
        'Plan name, sport and monthly price are required',
      );
      return;
    }
    if (scheduleType === 'custom_days' && scheduleDays.length === 0) {
      Alert.alert(
        'Missing schedule',
        'Select at least one day for a custom-day plan',
      );
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        sport: sport.trim(),
        scheduleType,
        scheduleDays,
        startTime: startTime || undefined,
        endTime: endTime || undefined,
        sessionsPerWeek: Number(sessionsPerWeek) || 0,
        monthlyPrice: Number(monthlyPrice),
        yearlyPrice: yearlyPrice ? Number(yearlyPrice) : undefined,
        description: description.trim() || undefined,
      };

      if (isEditing) {
        await sportsPlanAPI.update(editingPlan._id, payload);
      } else {
        await sportsPlanAPI.create(payload);
      }

      Alert.alert(
        'Success',
        isEditing ? 'Plan updated successfully' : 'Plan added successfully',
      );
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not save coaching plan');
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
          <SectionTitle title="Plan Details" />
          <TextField
            label="Plan Name"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Tennis - 3x/week"
            required
            icon={Tag}
          />
          <TextField
            label="Sport"
            value={sport}
            onChangeText={setSport}
            placeholder="e.g. Tennis"
            required
            icon={Trophy}
          />
          <ChipSelect<ScheduleType>
            label="Schedule Type"
            options={SCHEDULE_TYPES}
            value={scheduleType}
            onChange={setScheduleType}
            labels={SCHEDULE_TYPE_LABELS}
            icon={Repeat}
          />
          {scheduleType === 'sessions_per_week' && (
            <TextField
              label="Sessions / Week"
              value={sessionsPerWeek}
              onChangeText={setSessionsPerWeek}
              keyboardType="number-pad"
              icon={Repeat}
            />
          )}
          {scheduleType === 'custom_days' && (
            <View style={{ marginBottom: 14 }}>
              <Text style={dayPickerStyles.label}>
                Attends On (e.g. alternate-day clubs pick Mon/Wed/Fri)
              </Text>
              <View style={dayPickerStyles.presetRow}>
                {SCHEDULE_PRESETS.map(preset => (
                  <TouchableOpacity
                    key={preset.label}
                    onPress={() => setScheduleDays(preset.days)}
                    style={dayPickerStyles.presetChip}
                  >
                    <Text style={dayPickerStyles.presetChipText}>
                      {preset.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={dayPickerStyles.dayRow}>
                {WEEKDAYS.map(d => {
                  const active = scheduleDays.includes(d.key);
                  return (
                    <TouchableOpacity
                      key={d.key}
                      onPress={() =>
                        setScheduleDays(prev =>
                          active
                            ? prev.filter(x => x !== d.key)
                            : [...prev, d.key],
                        )
                      }
                      style={[
                        dayPickerStyles.dayChip,
                        active && dayPickerStyles.dayChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          dayPickerStyles.dayChipText,
                          active && dayPickerStyles.dayChipTextActive,
                        ]}
                      >
                        {d.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {scheduleDays.length === 0 && (
                <Text style={dayPickerStyles.warning}>
                  Select at least one day
                </Text>
              )}
            </View>
          )}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <DateTimeField
                label="Start Time"
                value={startTime}
                onChangeText={setStartTime}
                mode="time"
                icon={Clock}
              />
            </View>
            <View style={{ flex: 1 }}>
              <DateTimeField
                label="End Time"
                value={endTime}
                onChangeText={setEndTime}
                mode="time"
                icon={Clock}
              />
            </View>
          </View>
          <TextField
            label="Monthly Price (₹)"
            value={monthlyPrice}
            onChangeText={setMonthlyPrice}
            keyboardType="number-pad"
            required
            icon={IndianRupee}
          />
          <TextField
            label="Yearly Price (₹)"
            value={yearlyPrice}
            onChangeText={setYearlyPrice}
            keyboardType="number-pad"
            placeholder={
              monthlyPrice
                ? `Auto: ₹${Number(monthlyPrice) * 12}`
                : 'Leave blank for 12x monthly'
            }
            icon={IndianRupee}
          />
          <TextField
            label="Description"
            value={description}
            onChangeText={setDescription}
            placeholder="Optional"
            multiline
            icon={FileText}
          />
        </Card>

        <Button
          title={saving ? 'Saving...' : isEditing ? 'Update Plan' : 'Save Plan'}
          onPress={save}
          disabled={saving}
        />
        {saving && (
          <ActivityIndicator style={{ marginTop: 12 }} color={colors.blue} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
});

const dayPickerStyles = StyleSheet.create({
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.black,
    marginBottom: 6,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  presetChip: {
    borderWidth: 1,
    borderColor: colors.black + '4D',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  presetChipText: { fontSize: 11, fontWeight: '600', color: colors.black },
  dayRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dayChip: {
    width: 48,
    height: 40,
    borderWidth: 2,
    borderColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayChipActive: { backgroundColor: colors.green || colors.blue },
  dayChipText: { fontSize: 12, fontWeight: '700', color: colors.black },
  dayChipTextActive: { color: colors.white },
  warning: { fontSize: 11, fontWeight: '600', color: '#DC2626', marginTop: 4 },
});
