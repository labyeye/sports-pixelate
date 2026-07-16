import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { payrollConfigAPI } from '../api/client';
import {
  Card,
  SectionTitle,
  Row,
  LoadingView,
  EmptyState,
} from '../components/ui';
import { colors } from '../theme/colors';

export default function PayrollSettingsScreen() {
  const [rules, setRules] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const res: any = await payrollConfigAPI.getDeductionRules();
    setRules(res.data || {});
  }, []);

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

  if (loading) return <LoadingView />;
  if (!rules) return <EmptyState title="Couldn't load payroll settings" />;

  const fmt = (h: number, m: number) =>
    `${String(h ?? 0).padStart(2, '0')}:${String(m ?? 0).padStart(2, '0')}`;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Text style={styles.title}>Payroll Settings</Text>
        <Text style={styles.subtitle}>
          Attendance deduction rules (read-only)
        </Text>

        <Card>
          <SectionTitle title="Shift Timing" />
          <Row
            title="Shift Hours"
            subtitle={`${fmt(
              rules.shiftStartHour,
              rules.shiftStartMinute,
            )} – ${fmt(rules.shiftEndHour, rules.shiftEndMinute)}`}
          />
        </Card>

        <Card>
          <SectionTitle title="Late Arrival" />
          <Row
            title="Grace Period"
            subtitle={`${rules.lateThresholdMinutes ?? 0} minutes`}
          />
          <Row
            title="Deduction"
            subtitle={
              rules.lateDeductionType === 'percent'
                ? `${rules.lateDeductionAmount ?? 0}% of daily salary`
                : `₹${rules.lateDeductionAmount ?? 0} per late day`
            }
          />
        </Card>

        <Card>
          <SectionTitle title="Half-Day Rule" />
          <Row
            title="Threshold"
            subtitle={`Late by more than ${
              rules.halfDayThresholdMinutes ?? 0
            } min = half day (50% pay)`}
          />
        </Card>

        <Card>
          <SectionTitle title="Early Checkout" />
          <Row
            title="Deduction Enabled"
            subtitle={rules.earlyCheckoutDeductionEnabled ? 'Yes' : 'No'}
          />
          {rules.earlyCheckoutDeductionEnabled && (
            <Row
              title="Grace Period"
              subtitle={`${
                rules.earlyCheckoutThresholdMinutes ?? 0
              } minutes before shift end`}
            />
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  title: { fontSize: 24, fontWeight: '800', color: colors.black },
  subtitle: { color: colors.muted, marginTop: 2, marginBottom: 16 },
});
