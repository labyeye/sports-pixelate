import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { documentAPI } from '../api/client';
import { registerDocOtpPrompt, setDocAccessToken } from '../api/docAccess';
import { colors, FONT } from '../theme/colors';

// Mounted once: asks for the WhatsApp OTP whenever a confidential document is
// opened without a live access token.
export default function DocOtpHost() {
  const [open, setOpen] = useState(false);
  const [otp, setOtp] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const resolver = useRef<((t: string | null) => void) | null>(null);

  const send = async () => {
    setBusy(true);
    setMsg('');
    try {
      const r: any = await documentAPI.sendOtp();
      setMsg(r?.message || 'OTP sent on WhatsApp');
    } catch (e: any) {
      setMsg(e?.message || 'Could not send OTP');
    }
    setBusy(false);
  };

  useEffect(() => {
    registerDocOtpPrompt(
      () =>
        new Promise<string | null>(resolve => {
          resolver.current = resolve;
          setOtp('');
          setOpen(true);
          send();
        }),
    );
    return () => registerDocOtpPrompt(null);
  }, []);

  const close = (t: string | null) => {
    setOpen(false);
    resolver.current?.(t);
    resolver.current = null;
  };

  const verify = async () => {
    setBusy(true);
    try {
      const r: any = await documentAPI.verifyOtp(otp);
      setDocAccessToken(r.data.docAccessToken, r.data.expiresInSec);
      setBusy(false);
      close(r.data.docAccessToken);
    } catch (e: any) {
      setMsg(e?.message || 'Incorrect OTP');
      setBusy(false);
    }
  };

  return (
    <Modal visible={open} transparent animationType="fade">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <View style={styles.card}>
          <Text style={styles.title}>Confidential document</Text>
          <Text style={styles.sub}>
            Enter the 6-digit OTP we sent to your WhatsApp number to open it.
          </Text>
          <TextInput
            value={otp}
            onChangeText={v => setOtp(v.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            maxLength={6}
            placeholder="000000"
            placeholderTextColor={colors.muted}
            style={styles.input}
            autoFocus
          />
          {!!msg && <Text style={styles.msg}>{msg}</Text>}
          <View style={styles.row}>
            <TouchableOpacity
              style={[
                styles.btn,
                styles.primary,
                (busy || otp.length !== 6) && { opacity: 0.5 },
              ]}
              disabled={busy || otp.length !== 6}
              onPress={verify}
            >
              {busy ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={[styles.btnText, { color: colors.white }]}>
                  Verify
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.btn} disabled={busy} onPress={send}>
              <Text style={styles.btnText}>Resend</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btn} onPress={() => close(null)}>
              <Text style={styles.btnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    backgroundColor: colors.white,
    borderWidth: 2,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderColor: colors.black,
    borderRadius: 8,
    padding: 18,
  },
  title: { fontFamily: FONT.bold, fontSize: 18, color: colors.black },
  sub: { fontSize: 13, color: colors.muted, marginTop: 4 },
  input: {
    marginTop: 12,
    borderWidth: 2,
    borderColor: colors.black,
    borderRadius: 8,
    paddingVertical: 10,
    textAlign: 'center',
    fontSize: 24,
    letterSpacing: 8,
    color: colors.black,
  },
  msg: { fontSize: 12, color: colors.muted, marginTop: 8 },
  row: { flexDirection: 'row', gap: 8, marginTop: 14 },
  btn: {
    borderWidth: 2,
    borderColor: colors.black,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { flex: 1, backgroundColor: colors.blue },
  btnText: {
    fontFamily: FONT.bold,
    fontSize: 12,
    textTransform: 'uppercase',
    color: colors.black,
  },
});
