import React, { useEffect, useState } from 'react';
import {
  Linking,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { API_BASE_URL } from '../config';
import { colors, FONT } from '../theme/colors';
import { APP_VERSION } from '../config/version';

type Info = {
  latestVersion: string;
  minVersion: string;
  androidUrl: string;
  iosUrl: string;
  message?: string;
};

// "1.10" is newer than "1.9": compare numerically part by part.
const isOlder = (a: string, b: string) => {
  const x = a.split('.').map(Number);
  const y = b.split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] || 0) - (y[i] || 0);
    if (d !== 0) return d < 0;
  }
  return false;
};

// On launch, asks the server for the newest/minimum version. Older than the
// minimum: a blocking prompt. Older than the latest: a dismissable nudge.
export default function UpdatePrompt() {
  const [info, setInfo] = useState<Info | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE_URL}/app-version`)
      .then(r => r.json())
      .then(j => j?.data && setInfo(j.data))
      .catch(() => {});
  }, []);

  if (!info) return null;
  const store = Platform.OS === 'ios' ? info.iosUrl : info.androidUrl;
  const forced = isOlder(APP_VERSION, info.minVersion);
  const nudge = !forced && isOlder(APP_VERSION, info.latestVersion);
  if (!store || (!forced && (!nudge || dismissed))) return null;

  return (
    <Modal transparent animationType="fade" visible>
      <View style={s.backdrop}>
        <View style={s.card}>
          <Text style={s.title}>
            {forced ? 'Update required' : 'Update available'}
          </Text>
          <Text style={s.body}>
            {info.message ||
              (forced
                ? 'Please update NestAcademy to keep using the app.'
                : 'A newer version of NestAcademy is available.')}
          </Text>
          <TouchableOpacity
            style={s.primary}
            onPress={() => Linking.openURL(store)}
          >
            <Text style={s.primaryText}>Update now</Text>
          </TouchableOpacity>
          {!forced && (
            <TouchableOpacity onPress={() => setDismissed(true)}>
              <Text style={s.later}>Later</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    backgroundColor: colors.white,
    borderWidth: 2,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderColor: colors.black,
    borderRadius: 8,
    padding: 20,
    gap: 12,
  },
  title: { fontFamily: FONT.bold, fontSize: 18, color: colors.black },
  body: { fontSize: 14, color: colors.black },
  primary: {
    backgroundColor: colors.blue,
    borderWidth: 2,
    borderColor: colors.black,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryText: {
    color: colors.white,
    fontFamily: FONT.bold,
    textTransform: 'uppercase',
    fontSize: 13,
  },
  later: { textAlign: 'center', color: colors.muted, fontSize: 13 },
});
