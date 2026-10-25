import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LottieView from 'lottie-react-native';
import { User, Mail, Lock, ArrowLeft } from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import { colors } from '../../theme/colors';
import PasswordChecklist from '../../components/PasswordChecklist';
import { passwordOk } from '../../utils/passwordRules';

// Same palette names NestAcademy's auth screens were written with, on NestSports' tokens.
const C = {
  primary: colors.blue,
  success: colors.green,
  black: colors.black,
  white: colors.white,
  textMuted: colors.black,
  textLight: '#94a3b8',
};

const loginAnim = require('../../assets/lottie/login.json');

export default function RegisterScreen({ navigation }: any) {
  const { register } = useAuth();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Validation', 'All fields are required');
      return;
    }
    if (!passwordOk(password)) {
      Alert.alert('Validation', 'Please meet every point in the password checklist');
      return;
    }
    setLoading(true);
    const result = await register({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
    });
    setLoading(false);
    if (!result.success)
      Alert.alert(
        'Registration Failed',
        result.error || 'Something went wrong',
      );
  };

  return (
    <KeyboardAvoidingView
      style={styles.safe}
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
        <LottieView source={loginAnim} autoPlay loop style={styles.lottie} />
        <Text style={styles.title}>Create Account</Text>

        <View style={styles.card}>
          {[
            {
              label: 'Full Name',
              icon: <User size={16} color={C.textMuted} />,
              value: name,
              setter: setName,
              placeholder: 'John Doe',
              keyboard: 'default' as const,
            },
            {
              label: 'Work Email',
              icon: <Mail size={16} color={C.textMuted} />,
              value: email,
              setter: setEmail,
              placeholder: 'Enter Email Address',
              keyboard: 'email-address' as const,
            },
            {
              label: 'Password',
              icon: <Lock size={16} color={C.textMuted} />,
              value: password,
              setter: setPassword,
              placeholder: '••••••••',
              keyboard: 'default' as const,
              secure: true,
            },
          ].map(f => (
            <View key={f.label} style={styles.field}>
              <Text style={styles.label}>{f.label}</Text>
              <View style={styles.inputRow}>
                <View style={styles.inputIcon}>{f.icon}</View>
                <TextInput
                  style={styles.input}
                  value={f.value}
                  onChangeText={f.setter}
                  placeholder={f.placeholder}
                  placeholderTextColor={C.textLight}
                  keyboardType={f.keyboard}
                  autoCapitalize={
                    f.keyboard === 'email-address' ? 'none' : 'words'
                  }
                  secureTextEntry={f.secure}
                />
              </View>
              {f.secure && !!f.value && <PasswordChecklist password={f.value} />}
            </View>
          ))}

          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={C.white} />
            ) : (
              <Text style={styles.btnPrimaryText}>Create Account</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.backLink}
            onPress={() => navigation.navigate('Login')}
          >
            <ArrowLeft size={14} color={C.primary} />
            <Text style={styles.backLinkText}>Back to Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  scroll: { flexGrow: 1, paddingHorizontal: 24, backgroundColor: '#fff' },
  lottie: { width: '100%', height: 220, alignSelf: 'center' },
  title: {
    fontSize: 36,
    fontWeight: '600',
    color: C.black,
    marginTop: 12,
    marginBottom: 18,
  },
  card: {},
  field: { marginBottom: 16 },
  label: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: C.black,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: C.black,
  },
  inputIcon: { marginHorizontal: 10 },
  input: {
    flex: 1,
    paddingVertical: 12,
    paddingRight: 12,
    fontSize: 14,
    fontWeight: '500',
    color: C.black,
  },
  btnPrimary: {
    backgroundColor: C.primary,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: C.black,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  btnPrimaryText: {
    color: C.white,
    fontWeight: '700',
    fontSize: 14,
    textTransform: 'uppercase',
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 20,
  },
  backLinkText: { fontSize: 13, color: C.primary, fontWeight: '700' },
});
