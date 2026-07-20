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
import { Button } from '../../components/ui';
import { colors } from '../../theme/colors';
import LottieView from 'lottie-react-native';
import { Smartphone } from 'lucide-react-native';
export default function ForgotPasswordScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    setError('');
    if (!email.trim()) {
      setError('Please enter your email');
      return;
    }
    setLoading(true);
    try {
      await authAPI.forgotPassword(email.trim());
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset link');
    } finally {
      setLoading(false);
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
          <Text style={styles.title}>Reset your password</Text>

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

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {success ? (
            <Text style={styles.success}>
              If an account exists for that email, a reset link has been sent.
            </Text>
          ) : null}

          <Button
            title="Send Reset Link"
            onPress={onSubmit}
            loading={loading}
          />

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
                onPress={() => navigation.navigate('Login')}
              >
                <Mail color={colors.white} size={26} />
              </TouchableOpacity>
              <Text
                style={{
                  color: colors.muted,
                  marginTop: 0,
                  textAlign: 'center',
                }}
              >
                Email
              </Text>
            </View>
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
  success: { color: colors.green, marginBottom: 12, fontWeight: '600' },
  link: {
    textAlign: 'center',
    marginTop: 16,
    color: colors.blue,
    fontWeight: '700',
  },
});
