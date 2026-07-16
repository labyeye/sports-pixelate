import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui';
import { colors } from '../../theme/colors';
import NestSportsLogo from '../../assets/logo.png';
export default function LoginScreen({ navigation }: any) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError('');
    setLoading(true);
    const res = await login(email.trim(), password);
    setLoading(false);
    if (!res.success && !res.requires2FA) {
      setError(res.error || 'Login failed');
    }
    // On success, AuthContext flips isAuthenticated and RootNavigator swaps
    // to the main app automatically.
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
          <Image source={NestSportsLogo} style={styles.logo} />
          <Text style={styles.subtitle}>Sign in to your academy</Text>

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
          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button title="Sign In" onPress={onSubmit} loading={loading} />

          <Text
            style={styles.link}
            onPress={() => navigation.navigate('PhoneOtpLogin')}
          >
            Sign in with WhatsApp OTP
          </Text>
          <Text
            style={styles.link}
            onPress={() => navigation.navigate('ForgotPassword')}
          >
            Forgot password?
          </Text>
          <Text
            style={styles.link}
            onPress={() => navigation.navigate('Register')}
          >
            New academy? Create an account
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
  logo: {
    width: '100%',
    height: 120,
    alignSelf: 'center',
    marginBottom: 24,
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
