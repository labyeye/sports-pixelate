import React, { useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  launchCamera,
  launchImageLibrary,
  Asset,
} from 'react-native-image-picker';
import { authAPI } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import {
  Card,
  SectionTitle,
  TextField,
  Button,
  Avatar,
} from '../components/ui';
import { colors } from '../theme/colors';

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

function pickAvatar(onPicked: (uri: string) => void) {
  Alert.alert('Change Photo', 'Choose a source', [
    {
      text: 'Camera',
      onPress: () =>
        launchCamera({ mediaType: 'photo', quality: 0.7 }, r => {
          const a: Asset | undefined = r.assets?.[0];
          if (a?.uri) onPicked(a.uri);
        }),
    },
    {
      text: 'Gallery',
      onPress: () =>
        launchImageLibrary({ mediaType: 'photo', quality: 0.7 }, r => {
          const a: Asset | undefined = r.assets?.[0];
          if (a?.uri) onPicked(a.uri);
        }),
    },
    { text: 'Cancel', style: 'cancel' },
  ]);
}

export default function ProfileScreen({ navigation }: any) {
  const { user, updateUser } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

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
      } catch (e: any) {
        Alert.alert('Upload failed', e?.message || 'Could not update photo');
      } finally {
        setUploadingAvatar(false);
      }
    });
  };

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      Alert.alert('Required Field Missing', 'Please enter your name');
      return;
    }
    setSavingProfile(true);
    try {
      await authAPI.updateProfile({ name, phone });
      updateUser({ name, phone });
      Alert.alert('Saved', 'Profile updated successfully');
    } catch (e: any) {
      Alert.alert('Save failed', e?.message || 'Could not update profile');
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
      return;
    }
    if (nextPassword !== confirmPassword) {
      Alert.alert(
        "Passwords don't match",
        'New password and confirmation must match',
      );
      return;
    }
    setChangingPassword(true);
    try {
      await authAPI.updateProfile({ currentPassword, password: nextPassword });
      setCurrentPassword('');
      setNextPassword('');
      setConfirmPassword('');
      Alert.alert('Success', 'Password changed successfully');
    } catch (e: any) {
      Alert.alert('Change failed', e?.message || 'Could not change password');
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView style={styles.screen} contentContainerStyle={{ padding: 16 }}>
        <Text style={styles.title}>My Profile</Text>
        <Text style={styles.subtitle}>Manage your account details</Text>

        <Card>
          <View style={{ alignItems: 'center', marginBottom: 16 }}>
            <Avatar
              uri={avatar}
              name={name}
              size={84}
              onPress={handleAvatarPick}
            />
            {uploadingAvatar ? (
              <Text style={styles.uploadingText}>Uploading…</Text>
            ) : null}
          </View>
          <TextField
            label="Full Name"
            required
            value={name}
            onChangeText={setName}
          />
          <TextField
            label="Phone"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
          <View style={{ marginBottom: 14 }}>
            <Text style={styles.fieldLabel}>Email</Text>
            <Text style={styles.readonlyValue}>{user?.email || '—'}</Text>
          </View>
          <Button
            title="Save Profile"
            onPress={handleSaveProfile}
            loading={savingProfile}
          />
        </Card>

        <Card>
          <SectionTitle title="Change Password" />
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
            onPress={handleChangePassword}
            loading={changingPassword}
            variant="outline"
          />
        </Card>

        <TouchableOpacity
          onPress={() => navigation.navigate('TwoFactor')}
          style={styles.linkRow}
        >
          <Text style={styles.linkText}>2FA Security →</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  title: { fontSize: 24, fontWeight: '800', color: colors.black },
  subtitle: { color: colors.muted, marginTop: 2, marginBottom: 16 },
  uploadingText: { color: colors.muted, fontSize: 12, marginTop: 6 },
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
    borderColor: '#D1D5DB',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.muted,
  },
  linkRow: {
    borderWidth: 2,
    borderColor: colors.black,
    backgroundColor: colors.white,
    padding: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  linkText: { fontWeight: '700', fontSize: 14, color: colors.blue },
});
