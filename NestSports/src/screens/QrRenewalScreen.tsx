import React, { useCallback, useEffect, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  Image,
  StyleSheet,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { launchImageLibrary, Asset } from 'react-native-image-picker';
import { Upload } from 'lucide-react-native';
import { settingsAPI, subscriptionAPI } from '../api/client';
import { API_BASE_URL } from '../config';
import {
  Card,
  TextField,
  Button,
  LoadingView,
  EmptyState,
} from '../components/ui';
import { colors, FONT } from '../theme/colors';

const ASSET_BASE_URL = API_BASE_URL.replace(/\/api$/, '');

function formatCurrency(n: number) {
  return `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
}

export default function QrRenewalScreen({ route, navigation }: any) {
  const { subscription } = route.params;
  const amountPaid = subscription.amountPaid || 0;
  const remaining = Math.max(subscription.amount - amountPaid, 0);
  const isTopUp = amountPaid > 0;

  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [method, setMethod] = useState<'qr' | 'cash'>('qr');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [transactionNumber, setTransactionNumber] = useState('');
  const [amountToPay, setAmountToPay] = useState(String(remaining));
  const [screenshot, setScreenshot] = useState<Asset | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const pickScreenshot = () => {
    launchImageLibrary({ mediaType: 'photo', quality: 0.7 }, r => {
      if (r.didCancel || !r.assets?.[0]) return;
      setScreenshot(r.assets[0]);
    });
  };

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
    const amount = Number(amountToPay);
    if (!amount || amount <= 0) {
      Alert.alert('Amount required', 'Enter a valid amount to pay.');
      return;
    }
    if (amount > remaining) {
      Alert.alert(
        'Amount too high',
        `You only owe ${formatCurrency(remaining)} on this plan.`,
      );
      return;
    }
    if (method === 'qr') {
      if (!referenceNumber.trim()) {
        Alert.alert('UTR required', 'Enter the UTR number from your payment.');
        return;
      }
      if (!transactionNumber.trim()) {
        Alert.alert(
          'Transaction number required',
          'Enter the transaction number from your payment.',
        );
        return;
      }
      if (!screenshot?.uri) {
        Alert.alert(
          'Screenshot required',
          'Upload a screenshot of the payment.',
        );
        return;
      }
    }
    setSubmitting(true);
    try {
      const screenshotFile =
        method === 'qr' && screenshot?.uri
          ? {
              uri: screenshot.uri,
              name: screenshot.fileName || 'payment-screenshot.jpg',
              type: screenshot.type || 'image/jpeg',
            }
          : undefined;
      if (isTopUp) {
        await subscriptionAPI.submitPayment(subscription._id, {
          method,
          referenceNumber:
            method === 'qr' ? referenceNumber.trim() : undefined,
          transactionNumber:
            method === 'qr' ? transactionNumber.trim() : undefined,
          amount,
          screenshot: screenshotFile,
        });
      } else {
        await subscriptionAPI.createQrRenewalRequest({
          studentId: subscription.student._id,
          planId: subscription.plan._id,
          billingCycle: subscription.billingCycle,
          method,
          referenceNumber:
            method === 'qr' ? referenceNumber.trim() : undefined,
          transactionNumber:
            method === 'qr' ? transactionNumber.trim() : undefined,
          amount,
          screenshot: screenshotFile,
        });
      }
      Alert.alert('Submitted', 'Waiting for the club to verify your payment.', [
        {
          text: 'OK',
          onPress: () =>
            isTopUp
              ? navigation.goBack()
              : navigation.reset({
                  index: 0,
                  routes: [{ name: 'Subscriptions' }],
                }),
        },
      ]);
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
            <Text style={styles.amountLabel}>
              {isTopUp ? 'Remaining balance' : 'Amount due'}
            </Text>
            <Text style={styles.amountValue}>{formatCurrency(remaining)}</Text>
          </View>
          {isTopUp && (
            <Text style={styles.instructions}>
              {formatCurrency(amountPaid)} of{' '}
              {formatCurrency(subscription.amount)} already verified.
            </Text>
          )}

          {method === 'qr' &&
            (qrUrl ? (
              <>
                <Image
                  source={{ uri: `${ASSET_BASE_URL}${qrUrl}` }}
                  style={styles.qrImage}
                  resizeMode="contain"
                />
                <Text style={styles.instructions}>
                  Scan this QR with any UPI app, pay any amount up to{' '}
                  {formatCurrency(remaining)}, then enter your UTR and
                  transaction number and upload a screenshot below.
                </Text>
              </>
            ) : (
              <EmptyState
                title="No payment QR set up yet"
                sub="Ask the club to upload their payment QR in Settings, or switch to Cash below."
              />
            ))}
        </Card>

        <Card>
          <View style={styles.methodRow}>
            <TouchableOpacity
              style={[
                styles.methodBtn,
                method === 'qr' && styles.methodBtnActive,
              ]}
              onPress={() => setMethod('qr')}
            >
              <Text
                style={[
                  styles.methodBtnText,
                  method === 'qr' && styles.methodBtnTextActive,
                ]}
              >
                UPI
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.methodBtn,
                method === 'cash' && styles.methodBtnActive,
              ]}
              onPress={() => setMethod('cash')}
            >
              <Text
                style={[
                  styles.methodBtnText,
                  method === 'cash' && styles.methodBtnTextActive,
                ]}
              >
                Cash
              </Text>
            </TouchableOpacity>
          </View>
          {method === 'cash' && (
            <Text style={styles.instructions}>
              Paid the club in cash? Enter the amount below — the club will
              verify it once they've received the cash.
            </Text>
          )}
          <TextField
            label="Amount to Pay"
            value={amountToPay}
            onChangeText={setAmountToPay}
            placeholder={`Up to ${remaining}`}
            keyboardType="numeric"
            required
          />
          {method === 'qr' && (
            <>
              <TextField
                label="UTR Number"
                value={referenceNumber}
                onChangeText={setReferenceNumber}
                placeholder="e.g. 402312345678"
                required
              />
              <TextField
                label="Transaction Number"
                value={transactionNumber}
                onChangeText={setTransactionNumber}
                placeholder="e.g. TXN20250117001"
                required
              />
              <Text style={styles.fieldLabel}>Payment Screenshot *</Text>
              <TouchableOpacity
                style={styles.uploadBtn}
                onPress={pickScreenshot}
              >
                {screenshot?.uri ? (
                  <Image
                    source={{ uri: screenshot.uri }}
                    style={styles.screenshotPreview}
                    resizeMode="cover"
                  />
                ) : (
                  <>
                    <Upload size={18} color={colors.muted} />
                    <Text style={styles.uploadBtnText}>
                      Choose Screenshot
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}
          <View style={{ height: 14 }} />
          <Button title="Submit" onPress={handleSubmit} loading={submitting} />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
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
  methodRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  methodBtn: {
    flex: 1,
    borderWidth: 2,
    borderColor: colors.black,
    paddingVertical: 10,
    alignItems: 'center',
  },
  methodBtnActive: { backgroundColor: colors.black },
  methodBtnText: {
    fontFamily: FONT.bold,
    fontSize: 12,
    fontWeight: '700',
    color: colors.black,
    textTransform: 'uppercase',
  },
  methodBtnTextActive: { color: colors.white },
  instructions: { color: colors.muted, fontSize: 12, textAlign: 'center' },
  fieldLabel: {
    fontFamily: FONT.bold,
    fontSize: 11,
    fontWeight: '700',
    color: colors.black,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  uploadBtn: {
    borderWidth: 2,
    borderColor: colors.black,
    borderStyle: 'dashed',
    minHeight: 100,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    overflow: 'hidden',
  },
  uploadBtnText: {
    fontFamily: FONT.bold,
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
  },
  screenshotPreview: { width: '100%', height: 160 },
});
