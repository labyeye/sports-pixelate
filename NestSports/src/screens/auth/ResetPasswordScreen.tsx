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
import { authAPI } from '../../api/client';
import { Button } from '../../components/ui';
import { colors } from '../../theme/colors';

export default function ResetPasswordScreen({ navigation }: any) {
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
    } catch (err: any) {
      setError(err.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
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
          <Text style={styles.logo}>
            Nest<Text style={{ color: colors.orange }}>Sports</Text>
          </Text>
          <Text style={styles.subtitle}>Set a new password</Text>

          {success ? (
            <>
              <Text style={styles.success}>
                Your password has been reset. You can now sign in.
              </Text>
              <Button
                title="Back to Login"
                onPress={() => navigation.navigate('Login')}
              />
            </>
          ) : (
            <>
              <View style={styles.field}>
                <Text style={styles.label}>Reset Token</Text>
                <TextInput
                  style={styles.input}
                  autoCapitalize="none"
                  value={token}
                  onChangeText={setToken}
                  placeholder="Paste the token emailed to you"
                />
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>New Password</Text>
                <TextInput
                  style={styles.input}
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                />
              </View>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <Button
                title="Reset Password"
                onPress={onSubmit}
                loading={loading}
              />

              <Text
                style={styles.link}
                onPress={() => navigation.navigate('Login')}
              >
                Back to sign in
              </Text>
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
    backgroundColor: colors.background,
  },
  logo: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.blue,
    textAlign: 'center',
    marginBottom: 4,
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
  success: {
    color: colors.green,
    marginBottom: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  link: {
    textAlign: 'center',
    marginTop: 16,
    color: colors.blue,
    fontWeight: '700',
  },
});
