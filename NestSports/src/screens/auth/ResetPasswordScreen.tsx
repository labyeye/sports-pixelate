import React, { useState } from 'react';
import {
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StatusBar,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LottieView from 'lottie-react-native';
import { ArrowLeft, CheckCircle2, KeyRound, Lock } from 'lucide-react-native';
import { authAPI } from '../../api/client';
import { colors } from '../../theme/colors';
import { getErrorMessage } from '../../utils/format';
import PasswordChecklist from '../../components/PasswordChecklist';

const forgotAnim = require('../../assets/lottie/forgot.json');

// Finishes an emailed reset link: paste the token, choose a new password (NestHR auth look).
export default function ResetPasswordScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError('');
    if (!token.trim() || !password) {
      setError('Please fill in all fields');
      return;
    }
    setLoading(true);
    try {
      await authAPI.resetPassword(token.trim(), password);
      setSuccess(true);
    } catch (err: unknown) {
      setError(getErrorMessage(err) || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          style={styles.back}
          onPress={() => navigation.navigate('Login')}
        >
          <ArrowLeft size={18} color={colors.black} />
          <Text style={styles.backText}>Back to login</Text>
        </TouchableOpacity>
        <LottieView source={forgotAnim} autoPlay loop style={styles.lottie} />
        <Text style={styles.title}>Set a new password</Text>

        {success ? (
          <>
            <View style={styles.doneRow}>
              <CheckCircle2 size={22} color={colors.green} />
              <Text style={styles.doneText}>
                Your password has been reset. You can now sign in.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.btnText}>Back to Login</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.field}>
              <Text style={styles.label}>Reset Token</Text>
              <View style={styles.inputRow}>
                <KeyRound size={16} color={colors.black} style={styles.icon} />
                <TextInput
                  style={styles.input}
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={token}
                  onChangeText={setToken}
                  placeholder="Paste the token emailed to you"
                  placeholderTextColor="#94a3b8"
                />
              </View>
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>New Password</Text>
              <View style={styles.inputRow}>
                <Lock size={16} color={colors.black} style={styles.icon} />
                <TextInput
                  style={styles.input}
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Create a strong password"
                  placeholderTextColor="#94a3b8"
                />
              </View>
              {!!password && <PasswordChecklist password={password} />}
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={onSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.btnText}>Reset Password</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const hard = {
  borderWidth: 2,
  borderRadius: 8,
  borderRightWidth: 5,
  borderBottomWidth: 5,
  borderRightColor: '#0A0A0A',
  borderBottomColor: '#0A0A0A',
  borderColor: colors.black,
} as const;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  scroll: { flexGrow: 1, paddingHorizontal: 24, backgroundColor: '#fff' },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  backText: { fontSize: 13, fontWeight: '700', color: colors.black },
  lottie: { width: '100%', height: 240, alignSelf: 'center' },
  title: { fontSize: 32, fontWeight: '600', color: '#000', marginBottom: 18 },
  field: { marginBottom: 16 },
  label: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: colors.black,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  inputRow: {
    ...hard,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  icon: { marginHorizontal: 10 },
  input: {
    flex: 1,
    paddingVertical: 12,
    paddingRight: 12,
    fontSize: 14,
    fontWeight: '500',
    color: colors.black,
  },
  error: { color: colors.red, fontWeight: '600', marginBottom: 8 },
  btnPrimary: {
    ...hard,
    backgroundColor: colors.blue,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  btnText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  doneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  doneText: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.black },
});
