import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  Pencil,
  KeyRound,
  MessageCircle,
  ShieldCheck,
  X,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  launchCamera,
  launchImageLibrary,
  Asset,
} from 'react-native-image-picker';
import { cropFile } from '../utils/cropImage';
import { authAPI } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { Card, SectionTitle, TextField, Button, Badge } from '../components/ui';
import { ActionTile, ProfileHero, SOFT } from '../components/profile';
import { colors, FONT } from '../theme/colors';
import { notifyError } from '../utils/notifyError';

function uriToBase64(uri: string): Promise<string> {
  return fetch(uri)
    .then(res => res.blob())
    .then(
      blob =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        }),
    );
}

// Caps dimensions so the re-encoded JPEG stays well under the backend's
// 3MB avatar limit, even for large camera photos.
const AVATAR_PICKER_OPTS = {
  mediaType: 'photo' as const,
  quality: 0.7 as const,
  maxWidth: 1024,
  maxHeight: 1024,
};

function pickAvatar(onPicked: (uri: string) => void) {
  Alert.alert('Change Photo', 'Choose a source', [
    {
      text: 'Camera',
      onPress: () =>
        launchCamera(AVATAR_PICKER_OPTS, r => {
          const a: Asset | undefined = r.assets?.[0];
          if (a?.uri)
            cropFile({
              uri: a.uri,
              name: a.fileName || `photo_${Date.now()}.jpg`,
              type: a.type || 'image/jpeg',
            }).then(c => c && onPicked(c.uri));
        }),
    },
    {
      text: 'Gallery',
      onPress: () =>
        launchImageLibrary(AVATAR_PICKER_OPTS, r => {
          const a: Asset | undefined = r.assets?.[0];
          if (a?.uri)
            cropFile({
              uri: a.uri,
              name: a.fileName || `photo_${Date.now()}.jpg`,
              type: a.type || 'image/jpeg',
            }).then(c => c && onPicked(c.uri));
        }),
    },
    { text: 'Cancel', style: 'cancel' },
  ]);
}

// Proves the user owns their saved phone via a WhatsApp code; unlocks WhatsApp
// password reset on the forgot-password screen.
function PhoneVerifyCard({ phone }: { phone: string }) {
  const [verified, setVerified] = useState(false);
  const [sent, setSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSent(false);
    authAPI
      .getMe()
      .then((r: any) => setVerified(!!r?.data?.phoneVerified))
      .catch(notifyError);
  }, [phone]);

  if (!phone) return null;

  const send = async () => {
    setBusy(true);
    try {
      await authAPI.sendPhoneVerifyOtp();
      setSent(true);
      Alert.alert('Code sent', 'Check WhatsApp for your 6-digit code');
    } catch (e: unknown) {
      Alert.alert('Failed', (e as Error)?.message || 'Could not send code');
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true);
    try {
      await authAPI.verifyPhoneVerifyOtp(otp.trim());
      setVerified(true);
      setSent(false);
      setOtp('');
      Alert.alert('Verified', 'WhatsApp number verified');
    } catch (e: unknown) {
      Alert.alert(
        'Verification failed',
        (e as Error)?.message || 'Invalid code',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <SectionTitle
        title="WhatsApp Verification"
        sub="Verify your number to reset your password with a WhatsApp code"
      />
      {verified ? (
        <Badge label="Verified" color={colors.green} />
      ) : sent ? (
        <>
          <TextField
            label="6-Digit Code"
            value={otp}
            onChangeText={setOtp}
            keyboardType="number-pad"
            placeholder="123456"
          />
          <Button title="Verify" onPress={verify} loading={busy} />
        </>
      ) : (
        <Button title="Send Verification Code" onPress={send} loading={busy} />
      )}
    </Card>
  );
}

export default function ProfileScreen({ navigation }: any) {
  const { user, updateUser } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [me, setMe] = useState<any>(null);
  const [editField, setEditField] = useState<'name' | 'phone'>('name');
  const [sheet, setSheet] = useState<
    'profile' | 'password' | 'whatsapp' | null
  >(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    authAPI
      .getMe()
      .then((r: any) => setMe(r?.data || null))
      .catch(notifyError);
  }, []);

  const handleAvatarPick = () => {
    pickAvatar(async uri => {
      setUploadingAvatar(true);
      try {
        const base64 = await uriToBase64(uri);
        const res: any = await authAPI.updateProfile({ avatar: base64 });
        if (res?.data) {
          setAvatar(res.data.avatar || base64);
          updateUser({ avatar: res.data.avatar || base64 });
        }
      } catch (e: unknown) {
        Alert.alert(
          'Upload failed',
          (e as Error)?.message || 'Could not update photo',
        );
      } finally {
        setUploadingAvatar(false);
      }
    });
  };

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      Alert.alert('Required Field Missing', 'Please enter your name');
      return false;
    }
    setSavingProfile(true);
    try {
      await authAPI.updateProfile({ name, phone });
      updateUser({ name, phone });
      Alert.alert('Saved', 'Profile updated successfully');
      return true;
    } catch (e: unknown) {
      Alert.alert(
        'Save failed',
        (e as Error)?.message || 'Could not update profile',
      );
      return false;
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !nextPassword) {
      Alert.alert(
        'Required Field Missing',
        'Please fill in both password fields',
      );
      return false;
    }
    if (nextPassword !== confirmPassword) {
      Alert.alert(
        "Passwords don't match",
        'New password and confirmation must match',
      );
      return false;
    }
    setChangingPassword(true);
    try {
      await authAPI.updateProfile({ currentPassword, password: nextPassword });
      setCurrentPassword('');
      setNextPassword('');
      setConfirmPassword('');
      Alert.alert('Success', 'Password changed successfully');
      return true;
    } catch (e: unknown) {
      Alert.alert(
        'Change failed',
        (e as Error)?.message || 'Could not change password',
      );
      return false;
    } finally {
      setChangingPassword(false);
    }
  };

  const roleLabel = ROLE_LABEL[user?.role || ''] || user?.role || '';
  const fmtDate = (d?: string) =>
    d
      ? new Date(d).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      : '';
  const deptName =
    typeof me?.department === 'object' ? me.department?.name : me?.department;
  // `field` marks what the backend lets a user change; the rest is managed by
  // the academy, so their pencil only explains that.
  const details: {
    label: string;
    value: string;
    field?: 'name' | 'phone';
  }[] = [
    { label: 'Name', value: name, field: 'name' },
    { label: 'Phone', value: phone, field: 'phone' },
    { label: 'Email', value: me?.email || user?.email || '' },
    { label: 'Role', value: roleLabel },
    { label: 'Employee ID', value: me?.employeeId || '' },
    { label: 'Department', value: deptName || '' },
    { label: 'Academy', value: me?.company?.name || user?.company?.name || '' },
    ...(me?.role === 'parent'
      ? [{ label: 'Children', value: String(me?.children?.length ?? 0) }]
      : []),
    {
      label: 'Status',
      value: me?.status ? String(me.status).toUpperCase() : '',
    },
    { label: '2FA', value: me?.twoFactorEnabled ? 'Enabled' : 'Off' },
    {
      label: 'WhatsApp',
      value: me?.phoneVerified ? 'Verified' : 'Not verified',
    },
    { label: 'Member since', value: fmtDate(me?.createdAt) },
    { label: 'Last login', value: fmtDate(me?.lastLogin) },
  ];

  const onPencil = (d: { label: string; field?: 'name' | 'phone' }) => {
    if (d.field) {
      setEditField(d.field);
      setSheet('profile');
    } else {
      Alert.alert(
        d.label,
        'This detail is managed by your academy and cannot be changed here.',
      );
    }
  };

  return (
    <SafeAreaView
      edges={['top']}
      style={[styles.screen, { backgroundColor: colors.white }]}
    >
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <ProfileHero
          uri={avatar}
          name={name || 'Your name'}
          subtitle={roleLabel}
          onCamera={handleAvatarPick}
        />
        {uploadingAvatar ? (
          <Text style={styles.uploadingText}>Uploading photo…</Text>
        ) : null}

        <View style={styles.detailsBox}>
          {details.map((d, i) => (
            <View
              key={d.label}
              style={[
                styles.detailRow,
                i === details.length - 1 && styles.detailRowLast,
              ]}
            >
              <View style={styles.detailText}>
                <Text style={styles.detailLabel}>{d.label}</Text>
                <Text style={styles.detailValue}>{d.value || '—'}</Text>
              </View>
              <TouchableOpacity
                style={styles.pencilBtn}
                onPress={() => onPencil(d)}
                hitSlop={8}
                activeOpacity={0.8}
              >
                <Pencil size={14} color={colors.white} strokeWidth={2.5} />
              </TouchableOpacity>
            </View>
          ))}
        </View>

        <View style={styles.tileRow}>
          <ActionTile
            brutal
            icon={KeyRound}
            title="Password"
            sub="Change password"
            onPress={() => setSheet('password')}
          />
          <ActionTile
            brutal
            icon={MessageCircle}
            title="WhatsApp"
            sub="Verify your number"
            onPress={() => setSheet('whatsapp')}
          />
        </View>
        <View style={styles.tileRow}>
          <ActionTile
            brutal
            icon={ShieldCheck}
            title="2FA Security"
            sub="Authenticator app"
            onPress={() => navigation.navigate('TwoFactor')}
          />
          <View style={{ flex: 1 }} />
        </View>
      </ScrollView>

      <Sheet
        visible={sheet === 'profile'}
        title={editField === 'name' ? 'Edit Name' : 'Edit Phone'}
        onClose={() => setSheet(null)}
      >
        {editField === 'name' ? (
          <TextField
            label="Full Name"
            required
            value={name}
            onChangeText={setName}
          />
        ) : (
          <TextField
            label="Phone"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
        )}
        <Button
          title="Save"
          onPress={async () => {
            if (await handleSaveProfile()) {
              setSheet(null);
              authAPI
                .getMe()
                .then((r: any) => setMe(r?.data || null))
                .catch(notifyError);
            }
          }}
          loading={savingProfile}
        />
      </Sheet>

      <Sheet
        visible={sheet === 'password'}
        title="Change Password"
        onClose={() => setSheet(null)}
      >
        <TextField
          label="Current Password"
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
        />
        <TextField
          label="New Password"
          value={nextPassword}
          onChangeText={setNextPassword}
          secureTextEntry
        />
        <TextField
          label="Confirm New Password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
        />
        <Button
          title="Change Password"
          onPress={async () => {
            if (await handleChangePassword()) setSheet(null);
          }}
          loading={changingPassword}
        />
      </Sheet>

      <Sheet
        visible={sheet === 'whatsapp'}
        title="WhatsApp Verification"
        onClose={() => setSheet(null)}
      >
        {user?.phone ? (
          <PhoneVerifyCard phone={user.phone} />
        ) : (
          <Text style={styles.readonlyValue}>
            Save a phone number first, then come back to verify it.
          </Text>
        )}
      </Sheet>
    </SafeAreaView>
  );
}

// Bottom sheet that holds the forms, so the profile page itself stays a clean
// card layout instead of a long stack of inputs.
function Sheet({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.sheetWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <X size={20} color={SOFT.text} />
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Owner',
  hr_manager: 'Manager',
  hr_executive: 'Executive',
  department_head: 'Department Head',
  employee: 'Staff / Coach',
  parent: 'Parent',
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  content: { padding: 16, paddingBottom: 32 },
  uploadingText: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  tileRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  emailBlock: { marginBottom: 14 },
  sheetWrap: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: '#0F172A66',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderWidth: 2,
    borderBottomWidth: 0,
    borderColor: colors.black,
    padding: 20,
    paddingBottom: 32,
    maxHeight: '85%',
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    fontFamily: FONT.bold,
    fontSize: 18,
    fontWeight: '700',
    color: SOFT.text,
    textTransform: 'uppercase',
  },
  detailsBox: {
    marginTop: 14,
    borderWidth: 2,
    borderColor: colors.black,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRadius: 8,
    backgroundColor: colors.white,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: colors.black,
  },
  detailRowLast: { borderBottomWidth: 0 },
  detailText: { flex: 1 },
  detailLabel: {
    fontFamily: FONT.medium,
    fontSize: 11,
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  detailValue: {
    fontFamily: FONT.bold,
    fontSize: 15,
    fontWeight: '700',
    color: colors.black,
    marginTop: 2,
  },
  pencilBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.black,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldLabel: {
    fontWeight: '700',
    fontSize: 11,
    color: colors.black,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  readonlyValue: {
    borderWidth: 2,
    borderRadius: 8,
    borderColor: '#D1D5DB',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.muted,
  },
  linkRow: {
    borderWidth: 2,
    borderRadius: 8,
    borderColor: colors.black,
    backgroundColor: colors.white,
    padding: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  linkText: { fontWeight: '700', fontSize: 14, color: colors.blue },
});
