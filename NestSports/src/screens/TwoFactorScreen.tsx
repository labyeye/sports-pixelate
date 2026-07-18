import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, View, Text, Image, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { authAPI } from '../api/client';
import {
  Card,
  SectionTitle,
  TextField,
  Button,
  LoadingView,
  Badge,
} from '../components/ui';
import { colors } from '../theme/colors';

export default function TwoFactorScreen() {
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);

  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [settingUp, setSettingUp] = useState(false);
  const [confirmCode, setConfirmCode] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);

  const [disableCode, setDisableCode] = useState('');
  const [disabling, setDisabling] = useState(false);

  const load = useCallback(async () => {
    const res: any = await authAPI.getMe().catch(() => null);
    setEnabled(!!res?.data?.twoFactorEnabled);
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const handleSetup = async () => {
    setSettingUp(true);
    try {
      const res: any = await authAPI.setup2FA();
      setQrCode(res?.data?.qrCode || null);
      setSecret(res?.data?.secret || null);
    } catch (e: any) {
      Alert.alert('Setup failed', e?.message || 'Could not start 2FA setup');
    } finally {
      setSettingUp(false);
    }
  };

  const handleConfirm = async () => {
    if (!confirmCode.trim()) {
      Alert.alert(
        'Required Field Missing',
        'Enter the 6-digit code from your authenticator app',
      );
      return;
    }
    setConfirming(true);
    try {
      const res: any = await authAPI.confirm2FA(confirmCode.trim());
      setBackupCodes(res?.data?.backupCodes || []);
      setEnabled(true);
      setQrCode(null);
      setSecret(null);
      setConfirmCode('');
    } catch (e: any) {
      Alert.alert(
        'Verification failed',
        e?.message || 'Invalid code, please try again',
      );
    } finally {
      setConfirming(false);
    }
  };

  const handleDisable = async () => {
    if (!disableCode.trim()) {
      Alert.alert(
        'Required Field Missing',
        'Enter your 6-digit code to disable 2FA',
      );
      return;
    }
    setDisabling(true);
    try {
      await authAPI.disable2FA(disableCode.trim());
      setEnabled(false);
      setDisableCode('');
      setBackupCodes(null);
      Alert.alert('Disabled', 'Two-factor authentication has been disabled');
    } catch (e: any) {
      Alert.alert(
        'Disable failed',
        e?.message || 'Invalid code, please try again',
      );
    } finally {
      setDisabling(false);
    }
  };

  if (loading) return <LoadingView />;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16 }}>
        <Text style={styles.title}>2FA Security</Text>
        <Text style={styles.subtitle}>
          Protect your account with an authenticator app
        </Text>

        <Card>
          <SectionTitle title="Status" />
          <Badge
            label={enabled ? 'Enabled' : 'Disabled'}
            color={enabled ? colors.green : colors.muted}
          />
        </Card>

        {!enabled && !qrCode && (
          <Card>
            <SectionTitle
              title="Set Up Two-Factor Authentication"
              sub="Scan a QR code with Google Authenticator, Authy, or similar"
            />
            <Button
              title="Start Setup"
              onPress={handleSetup}
              loading={settingUp}
            />
          </Card>
        )}

        {!enabled && qrCode && (
          <Card>
            <SectionTitle title="Scan QR Code" />
            <View style={{ alignItems: 'center', marginBottom: 14 }}>
              <Image
                source={{ uri: qrCode }}
                style={{ width: 200, height: 200 }}
                resizeMode="contain"
              />
            </View>
            {secret ? (
              <Text style={styles.secretText}>Manual entry key: {secret}</Text>
            ) : null}
            <TextField
              label="6-Digit Code"
              value={confirmCode}
              onChangeText={setConfirmCode}
              keyboardType="number-pad"
              placeholder="123456"
            />
            <Button
              title="Confirm & Enable"
              onPress={handleConfirm}
              loading={confirming}
            />
          </Card>
        )}

        {backupCodes && backupCodes.length > 0 && (
          <Card>
            <SectionTitle
              title="Backup Codes"
              sub="Save these somewhere safe — each can be used once if you lose access to your authenticator"
            />
            {backupCodes.map(code => (
              <Text key={code} style={styles.backupCode}>
                {code}
              </Text>
            ))}
          </Card>
        )}

        {enabled && (
          <Card>
            <SectionTitle title="Disable Two-Factor Authentication" />
            <TextField
              label="6-Digit Code"
              value={disableCode}
              onChangeText={setDisableCode}
              keyboardType="number-pad"
              placeholder="123456"
            />
            <Button
              title="Disable 2FA"
              onPress={handleDisable}
              loading={disabling}
              color={colors.red}
            />
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  title: { fontSize: 24, fontWeight: '800', color: colors.black },
  subtitle: { color: colors.muted, marginTop: 2, marginBottom: 16 },
  secretText: {
    fontSize: 12,
    color: colors.muted,
    marginBottom: 14,
    textAlign: 'center',
  },
  backupCode: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.black,
    letterSpacing: 1,
    paddingVertical: 4,
  },
});
