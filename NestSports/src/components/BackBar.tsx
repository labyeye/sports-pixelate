import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import type { NativeStackHeaderProps } from '@react-navigation/native-stack';
import { colors, FONT } from '../theme/colors';

// Thin neo-brutalist bar with just a back button. Every screen draws its own
// title header, so this only adds the missing way back; it renders nothing on
// the first screen of a stack (no `back`).
export default function BackBar({ navigation, back }: NativeStackHeaderProps) {
  const insets = useSafeAreaInsets();
  if (!back) return null;
  return (
    <View style={[styles.bar, { paddingTop: insets.top + 6 }]}>
      <TouchableOpacity
        style={styles.btn}
        onPress={navigation.goBack}
        activeOpacity={0.8}
        hitSlop={8}
      >
        <ArrowLeft size={16} color={colors.white} strokeWidth={2.5} />
        <Text style={styles.text}>Back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingBottom: 6,
    borderBottomWidth: 2,
    borderBottomColor: colors.black,
  },
  btn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.blue,
    borderWidth: 2,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderColor: colors.black,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  text: {
    fontFamily: FONT.bold,
    fontSize: 12,
    fontWeight: '700',
    color: colors.white,
    textTransform: 'uppercase',
  },
});
