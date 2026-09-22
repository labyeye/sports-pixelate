import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import Mail from 'lucide-react-native/icons/mail';
import { SafeAreaView } from 'react-native-safe-area-context';
import { authAPI } from '../../api/client';
import { Button, TextField } from '../../components/ui';
import { colors } from '../../theme/colors';
import LottieView from 'lottie-react-native';
import { Smartphone } from 'lucide-react-native';

type Step = 'email' | 'choose' | 'code' | 'done';

// Only methods the account has actually set up are offered (see /methods).
const METHOD_INFO: Record<string, { label: string; desc: string }> = {
  email: { label: 'Email link', desc: 'Get a password reset link in your inbox' },
  whatsapp: {
    label: 'WhatsApp code',
    desc: 'Get a 6-digit code on your verified WhatsApp number',
  },
  totp: {
    label: 'Authenticator app',
    desc: 'Enter the code from your authenticator app',
  },
};

export default function ForgotPasswordScreen({ navigation }: any) {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [methods, setMethods] = useState<string[]>([]);
  const [method, setMethod] = useState<'whatsapp' | 'totp'>('whatsapp');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [doneMsg, setDoneMsg] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setError('');
    setLoading(true);
    try {
      await fn();
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const sendLink = async () => {
    await authAPI.forgotPassword(email.trim());
    setDoneMsg('If an account exists for that email, a reset link has been sent.');
    setStep('done');
  };

  const onContinue = () => {
    if (!email.trim()) return setError('Please enter your email');
    run(async () => {
      const res: any = await authAPI.forgotPasswordMethods(email.trim());
      setMethods(res.data.methods);
      if (res.data.methods.length > 1) return setStep('choose');
      await sendLink();
    });
  };

  const choose = (m: string) =>
    run(async () => {
      if (m === 'email') return sendLink();
      if (m === 'whatsapp') await authAPI.forgotPasswordWhatsapp(email.trim());
      setMethod(m as 'whatsapp' | 'totp');
      setCode('');
      setStep('code');
    });

  const onReset = () => {
    if (password !== confirm) return setError("Passwords don't match");
    run(async () => {
      if (method === 'whatsapp')
        await authAPI.resetPasswordWithOtp(email.trim(), code.trim(), password);
      else
        await authAPI.resetPasswordWithTotp(email.trim(), code.trim(), password);
      setDoneMsg('Your password has been reset. You can now log in.');
      setStep('done');
    });
  };

  const title =
    step === 'email'
      ? 'Reset your password'
      : step === 'choose'
      ? 'How do you want to reset it?'
      : step === 'code'
      ? method === 'whatsapp'
        ? 'Enter WhatsApp code'
        : 'Enter authenticator code'
      : 'All set';

  return (
    <SafeAreaView
      edges={['top']}
      style={{ flex: 1, backgroundColor: colors.white }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <LottieView
            source={require('../../assets/lottie/forgot.json')}
            autoPlay
            loop
            style={{
              width: '100%',
              height: 250,
              marginTop: -204,
              marginBottom: 24,
            }}
          />
          <Text style={styles.title}>{title}</Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {step === 'email' && (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                />
              </View>

              <Button title="Continue" onPress={onContinue} loading={loading} />

              <Text
                style={{
                  textAlign: 'center',
                  marginVertical: 16,
                  color: colors.muted,
                  marginTop: 25,
                }}
              >
                ----------------------------------- Or Login With
                ---------------------------------
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 20,
                }}
              >
                <View>
                  <TouchableOpacity
                    style={styles.round}
                    onPress={() => navigation.navigate('Login')}
                  >
                    <Mail color={colors.white} size={26} />
                  </TouchableOpacity>
                  <Text style={styles.roundLabel}>Email</Text>
                </View>
                <View>
                  <TouchableOpacity
                    style={styles.round}
                    onPress={() => navigation.navigate('PhoneOtpLogin')}
                  >
                    <Smartphone color={colors.white} size={26} />
                  </TouchableOpacity>
                  <Text style={styles.roundLabel}>Phone</Text>
                </View>
              </View>
            </>
          )}

          {step === 'choose' && (
            <>
              {methods.map(m => (
                <TouchableOpacity
                  key={m}
                  style={styles.method}
                  onPress={() => choose(m)}
                  disabled={loading}
                >
                  <Text style={styles.methodLabel}>
                    {METHOD_INFO[m]?.label ?? m}
                  </Text>
                  <Text style={styles.methodDesc}>{METHOD_INFO[m]?.desc}</Text>
                </TouchableOpacity>
              ))}
              <Text style={styles.link} onPress={() => setStep('email')}>
                ← Back
              </Text>
            </>
          )}

          {step === 'code' && (
            <>
              <TextField
                label={method === 'whatsapp' ? 'WhatsApp Code' : 'Authenticator Code'}
                value={code}
                onChangeText={setCode}
                keyboardType={method === 'whatsapp' ? 'number-pad' : 'default'}
                placeholder="123456"
              />
              <TextField
                label="New Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="8+ chars, upper, lower & a number"
              />
              <TextField
                label="Confirm New Password"
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry
              />
              <Button title="Reset Password" onPress={onReset} loading={loading} />
              <Text
                style={styles.link}
                onPress={() => {
                  setError('');
                  setStep('choose');
                }}
              >
                ← Choose a different method
              </Text>
            </>
          )}

          {step === 'done' && (
            <>
              <Text style={styles.success}>{doneMsg}</Text>
              <Button
                title="Back to Login"
                onPress={() => navigation.navigate('Login')}
              />
            </>
          )}
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
    backgroundColor: colors.white,
  },
  logo: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.blue,
    textAlign: 'center',
    marginBottom: 4,
  },
  title: {
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '700',
    color: colors.black,
    marginBottom: 8,
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
  success: {
    color: colors.green,
    marginBottom: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  link: {
    textAlign: 'center',
    marginTop: 16,
    color: colors.blue,
    fontWeight: '700',
  },
  round: {
    alignSelf: 'center',
    marginBottom: 16,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  roundLabel: { color: colors.muted, marginTop: 0, textAlign: 'center' },
  method: {
    borderWidth: 2,
    borderColor: colors.black,
    padding: 14,
    marginBottom: 12,
  },
  methodLabel: { fontWeight: '700', fontSize: 15, color: colors.black },
  methodDesc: { color: colors.muted, marginTop: 2, fontSize: 12 },
});
