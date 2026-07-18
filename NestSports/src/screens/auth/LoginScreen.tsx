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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui';
import { colors } from '../../theme/colors';
import LottieView from 'lottie-react-native';
import { Smartphone, Eye, EyeOff } from 'lucide-react-native';
export default function LoginScreen({ navigation }: any) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
  };

  return (
    <SafeAreaView
      edges={['top']}
      style={{ flex: 1, backgroundColor: colors.white }}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container}>
          <LottieView
            source={require('../../assets/lottie/login.json')}
            autoPlay
            loop
            style={{
              width: '100%',
              height: 250,
              marginTop: -74,
              marginBottom: 24,
            }}
          />
          <Text style={styles.title}>Login</Text>
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
            <View style={{ justifyContent: 'center' }}>
              <TextInput
                style={[styles.input, { paddingRight: 44 }]}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
              />
              <TouchableOpacity
                onPress={() => setShowPassword(prev => !prev)}
                style={{
                  position: 'absolute',
                  right: 12,
                  height: '100%',
                  justifyContent: 'center',
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                {showPassword ? (
                  <EyeOff color={colors.muted} size={20} />
                ) : (
                  <Eye color={colors.muted} size={20} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button title="Sign In" onPress={onSubmit} loading={loading} />
          <Text
            style={styles.forgot}
            onPress={() => navigation.navigate('ForgotPassword')}
          >
            Forgot password?
          </Text>
          <Text
            style={{
              textAlign: 'center',
              marginVertical: 16,
              color: colors.muted,
            }}
          >
            ----------------------------------- Or Login With
            ---------------------------------
          </Text>
          <View
            style={{ flexDirection: 'row', justifyContent: 'center', gap: 20 }}
          >
            <View>
              <TouchableOpacity
                style={{
                  alignSelf: 'center',
                  marginBottom: 16,
                  width: 50,
                  height: 50,
                  borderRadius: 25,
                  backgroundColor: colors.blue,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 8,
                }}
                onPress={() => navigation.navigate('PhoneOtpLogin')}
              >
                <Smartphone color={colors.white} size={26} />
              </TouchableOpacity>
              <Text
                style={{
                  color: colors.muted,
                  marginTop: 0,
                  textAlign: 'center',
                }}
              >
                Phone
              </Text>
            </View>
          </View>
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
    width: '100%',
    height: 120,
    alignSelf: 'center',
    marginBottom: 24,
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
  link: {
    textAlign: 'center',
    color: colors.white,
    fontWeight: '700',
  },
  forgot: {
    textAlign: 'right',
    color: colors.blue,
    fontWeight: '700',
    marginTop: 25,
  },
  signinview: {
    backgroundColor: colors.blue,
    padding: 15,
    borderRadius: 5,
    marginTop: 5,
  },
});
