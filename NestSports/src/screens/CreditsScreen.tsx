import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { ChevronLeft, Coins, Gift, ExternalLink } from 'lucide-react-native';
import { creditsAPI } from '../api/client';
import { fmtCredits, useCreditBalance } from '../hooks/useCreditBalance';
import { colors } from '../theme/colors';

// Same palette names NestHR's screens were written with, on NestSports' tokens.
const C = {
  primary: colors.blue,
  secondary: colors.orange,
  success: colors.green,
  danger: colors.red,
  black: colors.black,
  white: colors.white,
  bg: colors.white,
  textLight: '#94a3b8',
};

// Top-ups are web-only: the app does not sell anything, it just shows the balance.
const WEB_CREDITS_URL = 'https://sports.pixelatenest.com/credits';

const FILTERS = [
  { key: '', label: 'All' },
  { key: 'debit', label: 'Charged' },
  { key: 'skipped', label: 'Not sent' },
  { key: 'refund', label: 'Refunds' },
  { key: 'topup', label: 'Top-ups' },
];

const EVENT_LABEL: Record<string, string> = {
  nestsports_checkin: 'Staff check-in',
  nestsports_checkout: 'Staff check-out',
  nestsports_checkin_hr: 'Staff check-in (admin copy)',
  nestsports_checkout_hr: 'Staff check-out (admin copy)',
  nestsports_student_checkin: 'Student check-in (parent)',
  nestsports_student_checkout: 'Student check-out (parent)',
  nestsports_attendance_status: 'Attendance status',
  nestsports_fee_payment_link: 'Fee payment link',
  nestsports_payment_verified: 'Payment received',
  nestsports_payment_verified_admin: 'Payment received (admin copy)',
  nestsports_payment_rejected: 'Payment rejected',
  nestsports_leave_submitted: 'Leave submitted',
  nestsports_leave_approved: 'Leave approved',
  nestsports_leave_rejected: 'Leave rejected',
  nestsports_leave_request_hr: 'Leave request (admin)',
  nestsports_salary_paid: 'Salary credited',
  nestsports_loan_submitted: 'Loan submitted',
  nestsports_loan_approved: 'Loan approved',
  nestsports_loan_rejected: 'Loan rejected',
  nestsports_loan_request_hr: 'Loan request (admin)',
};

const REASON: Record<string, string> = {
  low_balance: 'Not sent: no credits',
  daily_cap: 'Not sent: daily limit reached',
  send_failed: 'Refunded: could not send',
  delivery_failed: 'Refunded: not delivered',
};

export default function CreditsScreen({ navigation }: any) {
  const { credits, refresh } = useCreditBalance();
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (p: number, f: string) => {
    try {
      const res: any = await creditsAPI.ledger(p, f);
      setRows(prev => (p === 1 ? res.data : [...prev, ...res.data]));
      setTotal(res.total);
      setPage(p);
    } catch {}
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(1, filter);
    }, [load, filter]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refresh(), load(1, filter)]);
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{ padding: 4, marginRight: 4 }}
        >
          <ChevronLeft size={22} color={C.black} />
        </TouchableOpacity>
        <Coins size={20} color={C.primary} />
        <Text style={s.headerTitle}>WhatsApp Credits</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={C.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {credits && !credits.metered ? (
          <View style={s.card}>
            <Text style={s.bold}>Credits are not enabled</Text>
            <Text style={s.muted}>
              WhatsApp messages are included in your plan.
            </Text>
          </View>
        ) : (
          <>
            <View
              style={[
                s.card,
                credits?.zero && { backgroundColor: '#FEF2F2' },
              ]}
            >
              <Text style={s.label}>AVAILABLE CREDITS</Text>
              <Text
                style={[s.big, credits?.zero && { color: C.danger }]}
              >
                {fmtCredits(credits?.total)}
              </Text>
              {!!credits?.bonus && (
                <View style={s.bonusRow}>
                  <Gift size={13} color={C.success} />
                  <Text style={s.bonusText}>
                    includes {fmtCredits(credits.bonus)} bonus
                    {credits.bonusExpiresAt
                      ? ` · till ${new Date(
                          credits.bonusExpiresAt,
                        ).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                        })}`
                      : ''}
                  </Text>
                </View>
              )}
              {credits?.zero ? (
                <Text style={[s.warn, { color: C.danger }]}>
                  WhatsApp messages are paused. Login OTPs still work.
                </Text>
              ) : credits?.low ? (
                <Text style={[s.warn, { color: C.secondary }]}>
                  Running low. Top up so messages don't stop.
                </Text>
              ) : null}
              <Text style={s.muted}>
                {credits?.ratePerMessage ?? 0.2} credit per message, including
                automatic ones and HR copies. OTPs are free.
              </Text>
              <TouchableOpacity
                style={s.cta}
                activeOpacity={0.85}
                onPress={() => Linking.openURL(WEB_CREDITS_URL)}
              >
                <ExternalLink size={15} color={C.white} />
                <Text style={s.ctaText}>Add credits on web</Text>
              </TouchableOpacity>
            </View>

            <Text style={s.section}>Usage</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              {FILTERS.map(f => (
                <TouchableOpacity
                  key={f.key}
                  onPress={() => setFilter(f.key)}
                  style={[s.chip, filter === f.key && s.chipOn]}
                >
                  <Text style={[s.chipText, filter === f.key && { color: C.white }]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {loading ? (
              <ActivityIndicator color={C.primary} />
            ) : rows.length === 0 ? (
              <Text style={[s.muted, { textAlign: 'center' }]}>
                Nothing here yet
              </Text>
            ) : (
              <View style={s.list}>
                {rows.map(r => (
                  <View key={r._id} style={s.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.rowTitle}>
                        {r.type === 'topup'
                          ? 'Top-up'
                          : r.type === 'bonus'
                            ? 'Bonus credits'
                            : EVENT_LABEL[r.event] || r.event || r.type}
                      </Text>
                      <Text style={s.rowSub}>
                        {new Date(r.createdAt).toLocaleString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                        {r.phone ? ` · ${r.phone}` : ''}
                      </Text>
                      {!!(REASON[r.note] || (r.type !== 'debit' && r.note)) && (
                        <Text style={s.rowSub}>{REASON[r.note] || r.note}</Text>
                      )}
                    </View>
                    <Text
                      style={[
                        s.amount,
                        r.credits > 0 && { color: C.success },
                        r.credits === 0 && { color: C.textLight },
                      ]}
                    >
                      {r.credits > 0 ? '+' : ''}
                      {fmtCredits(r.credits)}
                    </Text>
                  </View>
                ))}
              </View>
            )}
            {rows.length < total && (
              <TouchableOpacity
                style={s.more}
                onPress={() => load(page + 1, filter)}
              >
                <Text style={s.chipText}>Load more</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: C.white,
    borderBottomWidth: 2,
    borderBottomColor: C.black,
    gap: 8,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: C.black },
  card: {
    backgroundColor: C.white,
    borderWidth: 2,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderColor: C.black,
    borderRadius: 8,
    padding: 16,
    gap: 8,
  },
  label: { fontSize: 11, fontWeight: '700', color: '#64748b', letterSpacing: 1 },
  big: { fontSize: 44, fontWeight: '800', color: C.black },
  bold: { fontSize: 15, fontWeight: '700', color: C.black },
  muted: { fontSize: 12, color: '#475569' },
  warn: { fontSize: 13, fontWeight: '700' },
  bonusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bonusText: { fontSize: 12, fontWeight: '700', color: C.success },
  cta: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: C.primary,
    borderWidth: 2,
    borderColor: C.black,
    paddingVertical: 12,
  },
  ctaText: { color: C.white, fontWeight: '700', fontSize: 14 },
  section: { fontSize: 16, fontWeight: '700', color: C.black },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 2,
    borderColor: C.black,
    backgroundColor: C.white,
  },
  chipOn: { backgroundColor: C.black },
  chipText: { fontSize: 12, fontWeight: '700', color: C.black },
  list: { borderWidth: 2, borderColor: C.black, backgroundColor: C.white },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  rowTitle: { fontSize: 13, fontWeight: '700', color: C.black },
  rowSub: { fontSize: 11, color: '#64748b', marginTop: 2 },
  amount: { fontSize: 14, fontWeight: '800', color: C.black },
  more: {
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderWidth: 2,
    borderColor: C.black,
  },
});
