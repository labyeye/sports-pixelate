import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, View, Text, Image, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { settingsAPI, subscriptionAPI } from '../api/client';
import { API_BASE_URL } from '../config';
import {
  Card,
  TextField,
  Button,
  LoadingView,
  EmptyState,
} from '../components/ui';
import { colors } from '../theme/colors';

const ASSET_BASE_URL = API_BASE_URL.replace(/\/api$/, '');

function formatCurrency(n: number) {
  return `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
}

export default function QrRenewalScreen({ route, navigation }: any) {
  const { subscription } = route.params;
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const res: any = await settingsAPI.get();
    setQrUrl(res.data?.paymentQrUrl || null);
  }, []);

  useEffect(() => {
    load()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [load]);

  const handleSubmit = async () => {
    if (!referenceNumber.trim()) {
      Alert.alert(
        'Reference required',
        'Enter the UPI reference number from your payment.',
      );
      return;
    }
    setSubmitting(true);
    try {
      await subscriptionAPI.createQrRenewalRequest({
        studentId: subscription.student._id,
        planId: subscription.plan._id,
        billingCycle: subscription.billingCycle,
        referenceNumber: referenceNumber.trim(),
      });
      Alert.alert(
        'Submitted',
        'Waiting for the club to confirm your payment.',
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to submit renewal request');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingView />;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16 }}>
        <Text style={styles.title}>Renew {subscription.planName}</Text>
        <Text style={styles.subtitle}>
          For {subscription.student?.firstName} {subscription.student?.lastName}
        </Text>

        <Card>
          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>Amount due</Text>
            <Text style={styles.amountValue}>
              {formatCurrency(subscription.amount)}
            </Text>
          </View>

          {qrUrl ? (
            <>
              <Image
                source={{ uri: `${ASSET_BASE_URL}${qrUrl}` }}
                style={styles.qrImage}
                resizeMode="contain"
              />
              <Text style={styles.instructions}>
                Scan this QR with any UPI app and pay{' '}
                {formatCurrency(subscription.amount)}, then enter your payment
                reference number below.
              </Text>
            </>
          ) : (
            <EmptyState
              title="No payment QR set up yet"
              sub="Ask the club to upload their payment QR in Settings before you can renew here."
            />
          )}
        </Card>

        {qrUrl && (
          <Card>
            <TextField
              label="UPI Reference Number"
              value={referenceNumber}
              onChangeText={setReferenceNumber}
              placeholder="e.g. 402312345678"
              required
            />
            <Button
              title="Submit"
              onPress={handleSubmit}
              loading={submitting}
            />
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  title: { fontSize: 22, fontWeight: '800', color: colors.black },
  subtitle: { color: colors.muted, marginTop: 2, marginBottom: 16 },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  amountLabel: { fontSize: 12, fontWeight: '700', color: colors.muted },
  amountValue: { fontSize: 18, fontWeight: '800', color: colors.black },
  qrImage: { width: '100%', height: 260, marginBottom: 12 },
  instructions: { color: colors.muted, fontSize: 12, textAlign: 'center' },
});
