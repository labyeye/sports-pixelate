import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { studentAPI, sportsPlanAPI } from '../api/client';
import { Card, SectionTitle, Button, LoadingView, EmptyState, ChipSelect } from '../components/ui';
import { colors, FONT } from '../theme/colors';

type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
const WEEKDAY_LABELS: Record<Weekday, string> = {
  mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun',
};

function formatCurrency(n: number) {
  return `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
}

function scheduleLabel(p: any): string {
  if (p.scheduleType === 'custom_days') {
    const days: Weekday[] = p.scheduleDays || [];
    if (!days.length) return 'Custom days';
    return days.map(d => WEEKDAY_LABELS[d] || d).join('/');
  }
  return p.sessionsPerWeek === 0 ? 'Unlimited' : `${p.sessionsPerWeek}x/week`;
}

// Lets a parent pick which child, which coaching plan, and monthly/yearly
// billing, then hands off to QrRenewalScreen with a synthetic subscription
// object (no `_id` yet — createQrRenewalRequest creates the StudentSubscription
// on submit). This is the only entry point for a parent whose child has no
// subscription yet; SubscriptionsScreen only ever lists existing subscriptions.
export default function ChoosePlanScreen({ navigation }: any) {
  const [children, setChildren] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentId, setStudentId] = useState<string>('');
  const [planId, setPlanId] = useState<string>('');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

  const load = useCallback(async () => {
    const [studRes, planRes] = await Promise.all([
      studentAPI.getAll(),
      sportsPlanAPI.getAll({ limit: '200' }),
    ]);
    const kids = studRes.data || [];
    const activePlans = planRes.data || [];
    setChildren(kids);
    setPlans(activePlans);
    if (kids.length === 1) setStudentId(kids[0]._id);
  }, []);

  useEffect(() => {
    load()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [load]);

  if (loading) return <LoadingView />;

  if (children.length === 0) {
    return (
      <SafeAreaView edges={['top']} style={styles.screen}>
        <EmptyState
          title="No children linked to your account yet"
          sub="Contact the academy to link your child's profile before subscribing."
        />
      </SafeAreaView>
    );
  }

  const selectedChild = children.find(c => c._id === studentId);
  const selectedPlan = plans.find(p => p._id === planId);
  const amount = selectedPlan
    ? billingCycle === 'monthly'
      ? selectedPlan.monthlyPrice
      : selectedPlan.yearlyPrice
    : 0;

  const canContinue = !!studentId && !!planId;

  const goToPayment = () => {
    if (!selectedChild || !selectedPlan) return;
    navigation.navigate('QrRenewal', {
      subscription: {
        student: selectedChild,
        plan: selectedPlan,
        planName: selectedPlan.name,
        billingCycle,
        amount,
        amountPaid: 0,
      },
    });
  };

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <Text style={styles.title}>Choose a Plan</Text>
        <Text style={styles.subtitle}>Subscribe your child to a coaching plan</Text>

        <Card>
          <SectionTitle title="Child" />
          <View style={styles.pillRow}>
            {children.map(c => {
              const active = c._id === studentId;
              return (
                <TouchableOpacity
                  key={c._id}
                  onPress={() => setStudentId(c._id)}
                  style={[styles.pill, active && styles.pillActive]}
                >
                  <Text style={[styles.pillText, active && styles.pillTextActive]}>
                    {c.firstName} {c.lastName}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>

        <Card>
          <SectionTitle title="Coaching Plan" />
          {plans.length === 0 ? (
            <EmptyState title="No coaching plans available yet" sub="Ask the club to add a plan." />
          ) : (
            plans.map(p => {
              const active = p._id === planId;
              return (
                <TouchableOpacity
                  key={p._id}
                  onPress={() => setPlanId(p._id)}
                  style={[styles.planRow, active && styles.planRowActive]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.planName}>{p.name}</Text>
                    <Text style={styles.planMeta}>
                      {p.sport} · {scheduleLabel(p)}
                    </Text>
                  </View>
                  <Text style={styles.planPrice}>{formatCurrency(p.monthlyPrice)}/mo</Text>
                </TouchableOpacity>
              );
            })
          )}
        </Card>

        {selectedPlan && (
          <Card>
            <ChipSelect<'monthly' | 'yearly'>
              label="Billing Cycle"
              options={['monthly', 'yearly']}
              value={billingCycle}
              onChange={setBillingCycle}
              labels={{ monthly: 'Monthly', yearly: 'Yearly' }}
            />
            <View style={styles.amountRow}>
              <Text style={styles.amountLabel}>Amount Due</Text>
              <Text style={styles.amountValue}>{formatCurrency(amount)}</Text>
            </View>
          </Card>
        )}

        <Button title="Continue to Payment" onPress={goToPayment} disabled={!canContinue} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  title: { fontSize: 22, fontWeight: '800', color: colors.black, fontFamily: FONT.bold },
  subtitle: { color: colors.muted, marginTop: 2, marginBottom: 16 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: {
    borderWidth: 2,
    borderColor: colors.black,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pillActive: { backgroundColor: colors.blue },
  pillText: { fontSize: 13, fontWeight: '700', color: colors.black },
  pillTextActive: { color: colors.white },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.black,
    padding: 10,
    marginBottom: 8,
  },
  planRowActive: { backgroundColor: colors.blue + '14', borderColor: colors.blue },
  planName: { fontSize: 14, fontWeight: '800', color: colors.black },
  planMeta: { fontSize: 11, color: colors.muted, marginTop: 2 },
  planPrice: { fontSize: 13, fontWeight: '800', color: colors.blue },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  amountLabel: { fontSize: 12, fontWeight: '700', color: colors.muted },
  amountValue: { fontSize: 18, fontWeight: '800', color: colors.black },
});
