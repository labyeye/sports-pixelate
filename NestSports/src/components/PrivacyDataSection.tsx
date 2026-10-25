import React, { useState } from 'react';
import { Alert, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { privacyAPI } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui';
import { colors, FONT } from '../theme/colors';
import { getErrorMessage } from '../utils/format';

// "Your data" card: download a copy of everything stored about you, or delete
// your account (password-confirmed). Academy owners are pointed to support.
export default function PrivacyDataSection() {
  const { user, logout } = useAuth();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState('');

  const share = async () => {
    setBusy(true);
    try {
      const r: any = await privacyAPI.exportMyData();
      await Share.share({
        title: 'My data',
        message: JSON.stringify(r.data, null, 2),
      });
    } catch (e: unknown) {
      Alert.alert('Error', getErrorMessage(e));
    }
    setBusy(false);
  };

  const remove = async () => {
    setBusy(true);
    try {
      await privacyAPI.deleteAccount(password);
      Alert.alert('Account deleted', 'Your account has been deleted.');
      logout();
    } catch (e: unknown) {
      Alert.alert('Could not delete', getErrorMessage(e));
    }
    setBusy(false);
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Your data</Text>
      <Text style={styles.sub}>
        Get a copy of the personal data we hold about you, or delete your
        account.
      </Text>
      <Button
        title="Download my data"
        variant="outline"
        onPress={share}
        loading={busy && !confirming}
      />
      {user?.role !== 'super_admin' && (
        <View style={{ marginTop: 10 }}>
          {confirming ? (
            <>
              <Text style={styles.warn}>
                This permanently removes your sign-in and personal details.
                Enter your password to confirm.
              </Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="Password"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
              />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Button
                    title="Delete account"
                    color={colors.red}
                    onPress={remove}
                    loading={busy}
                    disabled={!password}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    title="Cancel"
                    variant="outline"
                    onPress={() => {
                      setConfirming(false);
                      setPassword('');
                    }}
                  />
                </View>
              </View>
            </>
          ) : (
            <Button
              title="Delete my account"
              color={colors.red}
              variant="outline"
              onPress={() => setConfirming(true)}
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderColor: colors.black,
    borderRadius: 8,
    padding: 14,
    gap: 10,
  },
  title: { fontFamily: FONT.bold, fontSize: 16, color: colors.black },
  sub: { fontSize: 12, color: colors.muted },
  warn: { fontSize: 12, color: colors.red, marginBottom: 8 },
  input: {
    borderWidth: 2,
    borderColor: colors.black,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.black,
    marginBottom: 10,
  },
});
