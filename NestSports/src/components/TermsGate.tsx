// Fallback for sessions that were already open when the Terms/Privacy version changed. New sign-ins and registrations
// record acceptance on the login/register screens (they show the links), once per account, so this stays hidden then.
// A slim bar with links — no modal. Backend: /api/legal.
import React, { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { legalAPI } from '../api/client';

const SITE = 'https://www.pixelatenest.com/legal';
type Status = { version: string; required: boolean; accepted: boolean };

export default function TermsGate() {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);

  const check = useCallback(() => {
    legalAPI
      .status()
      .then(setStatus)
      .catch(() => {});
  }, []);
  useEffect(check, [check]);

  if (!status || !status.required || status.accepted) return null;

  const accept = async () => {
    setBusy(true);
    try {
      setStatus(await legalAPI.accept());
    } catch {
      /* stays visible; user can retry */
    } finally {
      setBusy(false);
    }
  };

  const link = {
    fontWeight: '400' as const,
    textDecorationLine: 'underline' as const,
    color: '#000',
  };
  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        backgroundColor: '#F59E0B',
        paddingTop: 44,
        paddingBottom: 8,
        paddingHorizontal: 12,
        zIndex: 999,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <Text style={{ flex: 1, color: '#000', fontSize: 12 }}>
        Please accept the updated{' '}
        <Text
          style={link}
          onPress={() => Linking.openURL(`${SITE}/terms-of-service.html`)}
        >
          Terms of Service
        </Text>{' '}
        and{' '}
        <Text
          style={link}
          onPress={() => Linking.openURL(`${SITE}/privacy-policy.html`)}
        >
          Privacy Policy
        </Text>
        .
      </Text>
      <Pressable
        disabled={busy}
        onPress={accept}
        style={{
          backgroundColor: '#000',
          paddingVertical: 8,
          paddingHorizontal: 12,
          opacity: busy ? 0.5 : 1,
        }}
      >
        <Text style={{ color: '#fff', fontWeight: '400' }}>
          {busy ? 'Saving…' : 'I agree'}
        </Text>
      </Pressable>
    </View>
  );
}
