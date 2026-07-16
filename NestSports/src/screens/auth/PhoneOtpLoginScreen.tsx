import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { authAPI } from '../../api/client';
import { Button } from '../../components/ui';
import { colors } from '../../theme/colors';

export default function PhoneOtpLoginScreen({ navigation }: any) {
  const { completeLogin } = useAuth();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSendOtp = async () => {
    setError('');
    setLoading(true);
    try {
      await authAPI.sendPhoneOtp(phone.trim());
      setOtpSent(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP');
    }
    setLoading(false);
  };

  const onVerifyOtp = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await authAPI.verifyPhoneOtp(phone.trim(), otp.trim());
      const { token, ...userData } = res.data;
      completeLogin(userData, token);
      // On success, AuthContext flips isAuthenticated and RootNavigator swaps
      // to the main app automatically.
    } catch (err: any) {
      setError(err.message || 'Invalid or expired OTP');
    }
    setLoading(false);
  };

  return (
    <SafeAreaView
      edges={['top']}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.title}>Sign in with WhatsApp OTP</Text>
          <Text style={styles.subtitle}>
            {otpSent
              ? 'Enter the code sent to your WhatsApp'
              : 'Enter your registered phone number'}
          </Text>

          <View style={styles.field}>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              placeholder="+91XXXXXXXXXX"
              editable={!otpSent}
            />
          </View>

          {otpSent && (
            <View style={styles.field}>
              <Text style={styles.label}>OTP</Text>
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                value={otp}
                onChangeText={setOtp}
                placeholder="6-digit code"
                maxLength={6}
              />
            </View>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {otpSent ? (
            <>
              <Button
                title="Verify & Sign In"
                onPress={onVerifyOtp}
                loading={loading}
              />
              <Text
                style={styles.link}
                onPress={() => {
                  setOtpSent(false);
                  setOtp('');
                }}
              >
                Change phone number
              </Text>
            </>
          ) : (
            <Button title="Send OTP" onPress={onSendOtp} loading={loading} />
          )}

          <Text
            style={styles.link}
            onPress={() => navigation.navigate('Login')}
          >
            Sign in with email & password instead
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: colors.background,
  },
  title: {
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '700',
    color: colors.black,
    marginBottom: 8,
  },
  subtitle: {
    textAlign: 'center',
    color: colors.muted,
    marginBottom: 24,
  },
  field: { marginBottom: 14 },
  label: { fontWeight: '700', marginBottom: 6, color: colors.black },
  input: {
    borderWidth: 2,
    borderColor: colors.black,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  error: { color: colors.red, marginBottom: 12, fontWeight: '600' },
  link: {
    textAlign: 'center',
    marginTop: 16,
    color: colors.blue,
    fontWeight: '700',
  },
});
