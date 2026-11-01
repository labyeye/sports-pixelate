import React, { useEffect, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { colors } from '../theme/colors';

/** Covers the UI while the app is inactive/backgrounded so the app-switcher snapshot shows no data. */
export default function PrivacyShield() {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const sub = AppState.addEventListener('change', s =>
      setHidden(s !== 'active'),
    );
    return () => sub.remove();
  }, []);
  if (!hidden) return null;
  return <View style={styles.cover} pointerEvents="none" />;
}

const styles = StyleSheet.create({
  cover: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.blue,
    zIndex: 9999,
    elevation: 9999,
  },
});
