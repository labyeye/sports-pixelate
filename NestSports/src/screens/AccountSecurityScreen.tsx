import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Passkey } from 'react-native-passkey';
import {
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  KeyRound,
  Smartphone,
  Mail,
  FileText,
  Trash2,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react-native';
import { authAPI } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import WhatsAppIcon from '../components/common/WhatsAppIcon';
import { colors } from '../theme/colors';

// Same palette names the Nest Play screen was written with, mapped onto NestSports' tokens.
const C = {
  primary: colors.blue,
  secondary: colors.orange,
  danger: colors.red,
  black: colors.black,
  white: colors.white,
  bg: colors.background,
};

type Section =
  | 'authenticator'
  | 'passkey'
  | 'devices'
  | 'trusted'
  | 'email'
  | 'phone'
  | 'backup';

const timeAgo = (iso: string) => {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 2) return 'Active now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'Yesterday' : `${d} days ago`;
};

export default function AccountSecurityScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const [open, setOpen] = useState<Section | null>(null);
  const [me, setMe] = useState<any>(user || {});

  const loadMe = useCallback(async () => {
    try {
      const r: any = await authAPI.getMe();
      setMe(r.data || {});
    } catch {
      /* keep what we have */
    }
  }, []);
  useEffect(() => {
    loadMe();
  }, [loadMe]);

  const sections: {
    key: Section;
    Icon: any;
    color: string;
    title: string;
    status: string;
    on: boolean;
    body: React.ReactNode;
  }[] = [
    {
      key: 'authenticator',
      Icon: ShieldCheck,
      color: C.primary,
      title: 'Authenticator App',
      status: me.twoFactorEnabled
        ? 'Enabled — tap to remove'
        : 'Not set up',
      on: !!me.twoFactorEnabled,
      body: <AuthenticatorBody me={me} onChanged={loadMe} />,
    },
    {
      key: 'passkey',
      Icon: KeyRound,
      color: C.secondary,
      title: 'Passkey',
      status: 'Sign in with Face ID or fingerprint',
      on: false,
      body: <PasskeyBody />,
    },
    {
      key: 'devices',
      Icon: Smartphone,
      color: '#0EA5E9',
      title: 'Signed-in Devices',
      status: 'See where you are logged in',
      on: false,
      body: <DevicesBody />,
    },
    {
      key: 'trusted',
      Icon: CheckCircle2,
      color: C.primary,
      title: 'Trusted Devices',
      status: 'Devices that skip the authenticator code',
      on: false,
      body: <TrustedBody />,
    },
    {
      key: 'email',
      Icon: Mail,
      color: C.primary,
      title: 'Email Verification',
      status: me.emailVerified
        ? 'Email verified'
        : 'Confirm your email address',
      on: !!me.emailVerified,
      body: <EmailBody me={me} onChanged={loadMe} />,
    },
    {
      key: 'phone',
      Icon: WhatsAppIcon,
      color: '#FFFFFF',
      title: 'WhatsApp Number',
      status: me.phoneVerified
        ? 'Number verified'
        : 'Verify your number for OTP login',
      on: !!me.phoneVerified,
      body: <PhoneBody me={me} onChanged={loadMe} />,
    },
    {
      key: 'backup',
      Icon: FileText,
      color: '#E11D48',
      title: 'Backup Codes',
      status: 'One-time codes if you lose access',
      on: false,
      body: <BackupBody />,
    },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <ChevronLeft size={20} color={C.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Account Security</Text>
      </View>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 14 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.intro}>
          Choose how you sign in and keep your account protected.
        </Text>
        {sections.map(sec => {
          const isOpen = open === sec.key;
          return (
            <View key={sec.key} style={styles.section}>
              <TouchableOpacity
                style={styles.sectionHead}
                activeOpacity={0.8}
                onPress={() => setOpen(o => (o === sec.key ? null : sec.key))}
              >
                <View style={[styles.iconBox, { backgroundColor: sec.color }]}>
                  <sec.Icon
                    size={sec.key === 'phone' ? 26 : 18}
                    color={C.white}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>{sec.title}</Text>
                  <Text
                    style={[
                      styles.sectionStatus,
                      sec.on && { color: '#00A676' },
                    ]}
                    numberOfLines={1}
                  >
                    {sec.status}
                  </Text>
                </View>
                {isOpen ? (
                  <ChevronUp size={18} color={C.black} />
                ) : (
                  <ChevronDown size={18} color={C.black} />
                )}
              </TouchableOpacity>
              {isOpen && <View style={styles.sectionBody}>{sec.body}</View>}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Passkey ───────────────────────────────────────────────────────────────
function PasskeyBody() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      const r: any = await authAPI.passkeyList();
      setList(r.data || []);
    } catch {
      /* keep */
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    if (!Passkey.isSupported()) {
      return Alert.alert(
        'Not supported',
        'Passkeys are not supported on this device.',
      );
    }
    setAdding(true);
    try {
      const { data: o }: any = await authAPI.passkeyRegisterOptions();
      const result = await Passkey.create({
        rp: o.rp,
        user: o.user,
        challenge: o.challenge,
        pubKeyCredParams: o.pubKeyCredParams,
        timeout: o.timeout,
        excludeCredentials: o.excludeCredentials,
        authenticatorSelection: o.authenticatorSelection,
        attestation: o.attestation,
      } as any);
      await authAPI.passkeyRegister({
        challengeToken: o.challengeToken,
        name: Platform.OS === 'ios' ? 'iPhone' : 'Android phone',
        id: result.id,
        rawId: result.rawId,
        type: 'public-key',
        response: {
          clientDataJSON: result.response.clientDataJSON,
          attestationObject: result.response.attestationObject,
        },
        clientExtensionResults: {},
      });
      Alert.alert('Passkey added', 'You can now sign in with your passkey.');
      await load();
    } catch (e: any) {
      const cancelled =
        e?.error === 'UserCancelled' || e?.name === 'NotAllowedError';
      if (!cancelled)
        Alert.alert('Error', e?.message || 'Could not add passkey');
    } finally {
      setAdding(false);
    }
  };

  const remove = (id: string) =>
    Alert.alert('Remove passkey', 'You will no longer be able to use it.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await authAPI.passkeyDelete(id);
            await load();
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Failed to remove passkey');
          }
        },
      },
    ]);

  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.desc}>
        A passkey lets you sign in with Face ID, Touch ID or your screen lock —
        no password to type or remember.
      </Text>
      {loading ? (
        <ActivityIndicator color={C.primary} style={{ marginTop: 8 }} />
      ) : (
        list.map(p => (
          <View key={p._id} style={styles.row}>
            <KeyRound size={16} color={C.secondary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowName}>{p.name}</Text>
              <Text style={styles.rowMeta}>
                Added {new Date(p.createdAt).toLocaleDateString()}
                {p.lastUsedAt
                  ? ` · Used ${new Date(p.lastUsedAt).toLocaleDateString()}`
                  : ''}
              </Text>
            </View>
            <TouchableOpacity onPress={() => remove(p._id)} hitSlop={8}>
              <Trash2 size={18} color={C.danger} />
            </TouchableOpacity>
          </View>
        ))
      )}
      <Primary title="Add a Passkey" busy={adding} onPress={add} />
    </View>
  );
}

// ── Devices ───────────────────────────────────────────────────────────────
function DevicesBody() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r: any = await authAPI.sessions();
      setList(r.data || []);
    } catch {
      /* keep */
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const remove = (d: any) =>
    Alert.alert('Sign out device', `${d.deviceName} will be logged out.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await authAPI.removeSession(d._id);
            await load();
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Failed to remove device');
          }
        },
      },
    ]);

  const removeOthers = () =>
    Alert.alert('Sign out other devices', 'Log out everywhere except here?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out all',
        style: 'destructive',
        onPress: async () => {
          try {
            await authAPI.removeOtherSessions();
            await load();
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Failed');
          }
        },
      },
    ]);

  if (loading)
    return <ActivityIndicator color={C.primary} style={{ margin: 8 }} />;
  return (
    <View style={{ gap: 8 }}>
      {list.length === 0 && (
        <Text style={styles.desc}>
          Devices appear here the next time you sign in.
        </Text>
      )}
      {list.map(d => (
        <View key={d._id} style={styles.row}>
          <Smartphone size={18} color="#0EA5E9" />
          <View style={{ flex: 1 }}>
            <Text style={styles.rowName}>
              {d.deviceName}
              {d.current ? '  · This device' : ''}
            </Text>
            <Text style={styles.rowMeta}>
              {timeAgo(d.lastActiveAt)}
              {d.ip ? ` · ${d.ip}` : ''}
            </Text>
          </View>
          {!d.current && (
            <TouchableOpacity onPress={() => remove(d)} hitSlop={8}>
              <Trash2 size={18} color={C.danger} />
            </TouchableOpacity>
          )}
        </View>
      ))}
      {list.some(d => !d.current) && (
        <TouchableOpacity style={styles.dangerBtn} onPress={removeOthers}>
          <Text style={styles.dangerBtnText}>Sign out all other devices</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Email verification ────────────────────────────────────────────────────
function EmailBody({ me, onChanged }: { me: any; onChanged: () => void }) {
  const [value, setValue] = useState(me.email || '');
  const [sent, setSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => setValue(me.email || ''), [me.email]);

  const changed =
    value.trim().toLowerCase() !== String(me.email || '').toLowerCase();
  const needs = changed || !me.emailVerified;

  const send = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()))
      return Alert.alert('Invalid email', 'Enter a valid email address');
    setBusy(true);
    try {
      await authAPI.sendEmailVerifyOtp(value.trim().toLowerCase());
      setSent(true);
      Alert.alert('Code sent', 'Check your email inbox.');
    } catch (e: any) {
      Alert.alert('Could not send code', e?.message);
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true);
    try {
      await authAPI.verifyEmailVerifyOtp(otp.trim());
      setSent(false);
      setOtp('');
      await onChanged();
      Alert.alert('Verified', 'Your email is verified.');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Invalid code');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.desc}>
        We email a code to the address to prove it is yours. Change the address
        here and verify it to update your login email.
      </Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={t => {
          setValue(t);
          setSent(false);
        }}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
      />
      {!needs && (
        <View style={styles.okPill}>
          <CheckCircle2 size={14} color="#00A676" />
          <Text style={styles.okText}>Verified</Text>
        </View>
      )}
      {needs &&
        (!sent ? (
          <Primary
            title={changed ? 'Verify new email' : 'Verify email'}
            busy={busy}
            onPress={send}
          />
        ) : (
          <>
            <TextInput
              style={[styles.input, styles.otpInput]}
              value={otp}
              onChangeText={t => setOtp(t.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              placeholder="6-digit code"
              placeholderTextColor="#9CA3AF"
            />
            <Primary title="Verify" busy={busy} onPress={verify} />
          </>
        ))}
    </View>
  );
}

// ── WhatsApp number verification ──────────────────────────────────────────
function PhoneBody({ me, onChanged }: { me: any; onChanged: () => void }) {
  const [sent, setSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);

  if (!me.phone)
    return (
      <Text style={styles.desc}>
        Add your phone number in Profile first, then come back to verify it.
      </Text>
    );
  if (me.phoneVerified)
    return (
      <View style={styles.okPill}>
        <CheckCircle2 size={14} color="#00A676" />
        <Text style={styles.okText}>{me.phone} is verified</Text>
      </View>
    );

  const send = async () => {
    setBusy(true);
    try {
      await authAPI.sendPhoneVerifyOtp();
      setSent(true);
    } catch (e: any) {
      Alert.alert('Could not send code', e?.message);
    } finally {
      setBusy(false);
    }
  };
  const verify = async () => {
    setBusy(true);
    try {
      await authAPI.verifyPhoneVerifyOtp(otp.trim());
      setSent(false);
      setOtp('');
      await onChanged();
      Alert.alert('Verified', 'Your WhatsApp number is verified.');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Invalid code');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.desc}>
        Verify {me.phone} to sign in or recover your account with a WhatsApp
        code.
      </Text>
      {!sent ? (
        <Primary title="Send code on WhatsApp" busy={busy} onPress={send} />
      ) : (
        <>
          <TextInput
            style={[styles.input, styles.otpInput]}
            value={otp}
            onChangeText={t => setOtp(t.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            placeholder="6-digit code"
            placeholderTextColor="#9CA3AF"
          />
          <Primary title="Verify" busy={busy} onPress={verify} />
        </>
      )}
    </View>
  );
}

// ── Authenticator app (TOTP) ──────────────────────────────────────────────
function AuthenticatorBody({
  me,
  onChanged,
}: {
  me: any;
  onChanged: () => void;
}) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  if (!me.twoFactorEnabled)
    return (
      <Text style={styles.desc}>
        No authenticator app is linked to your account.
      </Text>
    );

  const confirmRemove = () =>
    Alert.alert(
      'Remove authenticator app',
      'Your account will no longer ask for an authenticator code, and backup codes and trusted devices will be cleared.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await authAPI.disable2FA(code.trim());
              setCode('');
              await onChanged();
              Alert.alert('Removed', 'Authenticator app has been removed.');
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Invalid code');
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );

  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.desc}>
        Enter the current 6-digit code from your authenticator app to remove it.
      </Text>
      <TextInput
        style={[styles.input, styles.otpInput]}
        value={code}
        onChangeText={t => setCode(t.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        placeholder="6-digit code"
        placeholderTextColor="#9CA3AF"
      />
      <Primary
        title="Remove authenticator app"
        busy={busy || code.length !== 6}
        onPress={confirmRemove}
      />
    </View>
  );
}

// ── Trusted devices ("Keep me signed in") ─────────────────────────────────
function TrustedBody() {
  const [list, setList] = useState<any[]>([]);
  const load = useCallback(async () => {
    try {
      const r: any = await authAPI.trustedDevices();
      setList(r.data || []);
    } catch {
      /* keep */
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const forgetAll = () =>
    Alert.alert(
      'Forget trusted devices',
      'The authenticator code will be asked again on every device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Forget all',
          style: 'destructive',
          onPress: async () => {
            try {
              await authAPI.forgetTrustedDevices();
              await load();
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Failed');
            }
          },
        },
      ],
    );
  return (
    <View style={{ gap: 8 }}>
      {list.length === 0 ? (
        <Text style={styles.desc}>
          None yet. Keep "Keep me signed in on this device" ticked when you
          enter an authenticator code to add this device.
        </Text>
      ) : (
        list.map(d => (
          <View key={d._id} style={styles.row}>
            <Smartphone size={18} color={C.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowName}>{d.name}</Text>
              <Text style={styles.desc}>
                {d.lastUsedAt ? timeAgo(d.lastUsedAt) : 'Never used'}
              </Text>
            </View>
          </View>
        ))
      )}
      {list.length > 0 && (
        <Primary
          title="Forget all trusted devices"
          busy={false}
          onPress={forgetAll}
        />
      )}
    </View>
  );
}

// ── Backup codes ──────────────────────────────────────────────────────────
function BackupBody() {
  const [status, setStatus] = useState<any>(null);
  const [password, setPassword] = useState('');
  const [codes, setCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r: any = await authAPI.backupCodesStatus();
      setStatus(r.data);
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const generate = async () => {
    if (!password) return Alert.alert('Password needed', 'Enter your password');
    setBusy(true);
    try {
      const r: any = await authAPI.generateBackupCodes(password);
      setCodes(r.data.codes);
      setPassword('');
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not generate codes');
    } finally {
      setBusy(false);
    }
  };

  const share = () =>
    Share.share({
      message: `Nest Play backup codes (each works once):\n\n${codes?.join(
        '\n',
      )}`,
    }).catch(() => {});

  return (
    <View style={{ gap: 8 }}>
      <Text style={styles.desc}>
        Backup codes let you sign in or reset your password if you lose your
        phone or other methods. Each code works once. Generating new codes
        replaces any old ones.
      </Text>
      {status && !codes && (
        <Text style={styles.rowMeta}>
          {status.generatedAt
            ? `${status.remaining} of 10 codes left · created ${new Date(
                status.generatedAt,
              ).toLocaleDateString()}`
            : 'No backup codes yet'}
        </Text>
      )}
      {codes ? (
        <>
          <View style={styles.codesBox}>
            {codes.map(c => (
              <Text key={c} style={styles.codeText} selectable>
                {c}
              </Text>
            ))}
          </View>
          <Text style={styles.desc}>
            Save these now — they won't be shown again.
          </Text>
          <Primary title="Copy / Save Codes" busy={false} onPress={share} />
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => setCodes(null)}
          >
            <Text style={styles.secondaryBtnText}>Done</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Confirm your password"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="none"
          />
          <Primary
            title={
              status?.generatedAt ? 'Generate New Codes' : 'Generate Codes'
            }
            busy={busy}
            onPress={generate}
          />
        </>
      )}
    </View>
  );
}

function Primary({
  title,
  busy,
  onPress,
}: {
  title: string;
  busy: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.primaryBtn, busy && { opacity: 0.6 }]}
      disabled={busy}
      onPress={onPress}
    >
      {busy ? (
        <ActivityIndicator size="small" color={C.white} />
      ) : (
        <Text style={styles.primaryBtnText}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const shadow = {
  borderWidth: 2,
  borderRadius: 8,
  borderRightWidth: 5,
  borderBottomWidth: 5,
  borderRightColor: '#0A0A0A',
  borderBottomColor: '#0A0A0A',
  borderColor: '#000',
} as const;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#000',
  },
  backBtn: {
    width: 34,
    height: 34,
    borderWidth: 2,
    borderRadius: 8,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: C.black },
  intro: { fontSize: 12, color: '#64748b' },
  section: { ...shadow, backgroundColor: '#fff', overflow: 'hidden' },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: C.black },
  sectionStatus: { fontSize: 11, color: '#64748b', marginTop: 2 },
  sectionBody: { borderTopWidth: 2, borderTopColor: '#000', padding: 14 },
  desc: { fontSize: 12, color: '#64748b', lineHeight: 18 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 8,
    padding: 10,
  },
  rowName: { fontSize: 13, fontWeight: '700', color: C.black },
  rowMeta: { fontSize: 10, color: '#64748b', marginTop: 2 },
  input: {
    ...shadow,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: C.black,
  },
  otpInput: { textAlign: 'center', letterSpacing: 6, fontWeight: '700' },
  primaryBtn: {
    ...shadow,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 6,
  },
  primaryBtnText: { fontSize: 12, fontWeight: '600', color: '#fff' },
  secondaryBtn: {
    borderWidth: 2,
    borderRadius: 8,
    borderColor: C.primary,
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 6,
  },
  secondaryBtnText: { fontSize: 12, fontWeight: '600', color: C.primary },
  dangerBtn: {
    borderWidth: 2,
    borderRadius: 8,
    borderColor: C.danger,
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 6,
  },
  dangerBtnText: { fontSize: 12, fontWeight: '600', color: C.danger },
  okPill: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  okText: { fontSize: 11, fontWeight: '800', color: '#00A676' },
  codesBox: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderWidth: 2,
    borderColor: '#000',
    borderRadius: 8,
    padding: 10,
    rowGap: 8,
    backgroundColor: '#FFF8E7',
  },
  codeText: {
    width: '50%',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
    color: C.black,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
