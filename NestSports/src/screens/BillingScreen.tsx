import React, { useCallback, useEffect, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import RNPrint from 'react-native-print';
import { Download } from 'lucide-react-native';
import { billingAPI } from '../api/client';
import { buildInvoiceHTML } from '../utils/buildInvoiceHTML';
import {
  Card,
  SectionTitle,
  LoadingView,
  EmptyState,
  Badge,
} from '../components/ui';
import { colors } from '../theme/colors';

function formatCurrency(n: number) {
  return `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
}

export default function BillingScreen() {
  const [subscription, setSubscription] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  const downloadInvoice = async (inv: any) => {
    setDownloading(inv._id);
    try {
      await RNPrint.print({ html: buildInvoiceHTML(inv) });
    } catch (e: any) {
      if (e?.message !== 'cancelled') {
        Alert.alert('Error', 'Could not generate invoice PDF.');
      }
    } finally {
      setDownloading(null);
    }
  };

  const load = useCallback(async () => {
    const [subRes, invRes] = await Promise.all([
      billingAPI.getSubscription().catch(() => ({ data: null })),
      billingAPI.getInvoices().catch(() => ({ data: [] })),
    ]);
    setSubscription((subRes as any).data || null);
    setInvoices((invRes as any).data || []);
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

  const isActive =
    subscription?.status === 'active' ||
    subscription?.status === 'pending_renewal';

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Text style={styles.title}>Billing</Text>
        <Text style={styles.subtitle}>Subscription and invoice history</Text>

        <Card>
          <SectionTitle title="Current Plan" />
          {subscription ? (
            <>
              <View style={styles.headerRow}>
                <Text style={styles.planName}>
                  {subscription.plan || 'Plan'}
                </Text>
                <Badge
                  label={
                    subscription.isTrial
                      ? 'Trial'
                      : isActive
                      ? 'Active'
                      : 'Inactive'
                  }
                  color={
                    subscription.isTrial
                      ? colors.yellow
                      : isActive
                      ? colors.green
                      : colors.red
                  }
                />
              </View>
              <Text style={styles.sub}>
                {subscription.maxStudents
                  ? `Up to ${subscription.maxStudents} students`
                  : ''}
                {subscription.maxEmployees
                  ? ` + ${subscription.maxEmployees} employees`
                  : ''}
              </Text>
              <Text style={styles.sub}>
                {subscription.wantsWhatsapp
                  ? 'Includes WhatsApp notifications'
                  : 'WhatsApp notifications not enabled'}
              </Text>
              {subscription.renewalDate ? (
                <Text style={styles.sub}>
                  Next billing:{' '}
                  {new Date(subscription.renewalDate).toLocaleDateString(
                    'en-IN',
                    { day: '2-digit', month: 'short', year: 'numeric' },
                  )}
                </Text>
              ) : null}
            </>
          ) : (
            <EmptyState
              title="No active subscription"
              sub="Manage your subscription and billing from the NestSports web dashboard."
            />
          )}
        </Card>

        <Card>
          <SectionTitle title="Invoice History" />
          {invoices.length === 0 ? (
            <Text style={{ color: colors.muted }}>No invoices found</Text>
          ) : (
            invoices.map(inv => (
              <View key={inv._id} style={styles.invoiceRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.invoiceNumber}>{inv.invoiceNumber}</Text>
                  <Text style={styles.sub}>
                    {new Date(inv.paidAt || inv.createdAt).toLocaleDateString(
                      'en-IN',
                      { day: '2-digit', month: 'short', year: 'numeric' },
                    )}
                  </Text>
                </View>
                <Text style={styles.invoiceAmount}>
                  {formatCurrency(inv.amount)}
                </Text>
                <Badge
                  label={inv.status}
                  color={inv.status === 'paid' ? colors.green : colors.orange}
                />
                <TouchableOpacity
                  style={styles.downloadBtn}
                  onPress={() => downloadInvoice(inv)}
                  disabled={downloading === inv._id}
                >
                  {downloading === inv._id ? (
                    <ActivityIndicator size={12} color={colors.white} />
                  ) : (
                    <Download size={12} color={colors.white} />
                  )}
                </TouchableOpacity>
              </View>
            ))
          )}
        </Card>

        <Text style={styles.footnote}>
          Manage your subscription and billing from the NestSports web
          dashboard.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  title: { fontSize: 24, fontWeight: '800', color: colors.black },
  subtitle: { color: colors.muted, marginTop: 2, marginBottom: 16 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planName: { fontSize: 16, fontWeight: '800', color: colors.black },
  sub: { color: colors.muted, fontSize: 12, marginTop: 4 },
  invoiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#0000001A',
  },
  invoiceNumber: { fontWeight: '700', color: colors.black, fontSize: 13 },
  invoiceAmount: { fontWeight: '800', color: colors.black, fontSize: 14 },
  downloadBtn: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.blue,
    borderWidth: 1,
    borderColor: colors.black,
  },
  footnote: {
    color: colors.muted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
});
