import React, { useEffect, useState } from 'react';
import { ScrollView, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { sportsPlanAPI } from '../api/client';
import { Card, TextField, Button, SectionTitle } from '../components/ui';
import { colors } from '../theme/colors';

export default function AddPlanScreen({ navigation, route }: any) {
  const editingPlan = route?.params?.plan;
  const isEditing = !!editingPlan;

  const [name, setName] = useState(editingPlan?.name || '');
  const [sport, setSport] = useState(editingPlan?.sport || '');
  const [sessionsPerWeek, setSessionsPerWeek] = useState(
    editingPlan ? String(editingPlan.sessionsPerWeek ?? '0') : '0',
  );
  const [monthlyPrice, setMonthlyPrice] = useState(
    editingPlan ? String(editingPlan.monthlyPrice ?? '') : '',
  );
  const [yearlyPrice, setYearlyPrice] = useState(
    editingPlan ? String(editingPlan.yearlyPrice ?? '') : '',
  );
  const [description, setDescription] = useState(editingPlan?.description || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    navigation.setOptions?.({
      title: isEditing ? 'Edit Plan' : 'Add Plan',
    });
  }, [navigation, isEditing]);

  const save = async () => {
    if (!name.trim() || !sport.trim() || !monthlyPrice || !yearlyPrice) {
      Alert.alert(
        'Missing fields',
        'Plan name, sport and both prices are required',
      );
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        sport: sport.trim(),
        sessionsPerWeek: Number(sessionsPerWeek) || 0,
        monthlyPrice: Number(monthlyPrice),
        yearlyPrice: Number(yearlyPrice),
        description: description.trim() || undefined,
      };

      if (isEditing) {
        await sportsPlanAPI.update(editingPlan._id, payload);
      } else {
        await sportsPlanAPI.create(payload);
      }

      Alert.alert('Success', isEditing ? 'Plan updated successfully' : 'Plan added successfully');
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
          />
          <TextField
            label="Sport"
            value={sport}
            onChangeText={setSport}
            placeholder="e.g. Tennis"
            required
          />
          <TextField
            label="Sessions / Week (0 = unlimited)"
            value={sessionsPerWeek}
            onChangeText={setSessionsPerWeek}
            keyboardType="number-pad"
          />
          <TextField
            label="Monthly Price (₹)"
            value={monthlyPrice}
            onChangeText={setMonthlyPrice}
            keyboardType="number-pad"
            required
          />
          <TextField
            label="Yearly Price (₹)"
            value={yearlyPrice}
            onChangeText={setYearlyPrice}
            keyboardType="number-pad"
            required
          />
          <TextField
            label="Description"
            value={description}
            onChangeText={setDescription}
            placeholder="Optional"
            multiline
          />
        </Card>

        <Button
          title={saving ? 'Saving...' : isEditing ? 'Update Plan' : 'Save Plan'}
          onPress={save}
          disabled={saving}
        />
        {saving && <ActivityIndicator style={{ marginTop: 12 }} color={colors.blue} />}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
});
