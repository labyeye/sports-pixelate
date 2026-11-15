import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C } from '../../theme';
import FadeInUp from '../motion/FadeInUp';
import AnimatedValue from '../motion/AnimatedValue';

interface Props {
  label: string;
  value: string | number;
  color?: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  /** Position in its row; each card enters a little after the previous one. */
  index?: number;
}

/** Summary card matching the Dashboard "Overview" cards (round icon, caps label, big number). Put several in a `dashStatRow` so they share the full width equally. */
export default function DashStatCard({
  label,
  value,
  color = C.primary,
  icon: Icon,
  index = 0,
}: Props) {
  return (
    <FadeInUp delay={Math.min(index, 8) * 70} style={styles.card}>
      <View
        style={[
          styles.iconWrap,
          { backgroundColor: color + '1A', borderColor: color },
        ]}
      >
        <Icon size={14} color={color} />
      </View>
      <View style={styles.body}>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
        <AnimatedValue style={styles.value} value={value} />
      </View>
    </FadeInUp>
  );
}

export const dashStatRow = { flexDirection: 'row', gap: 10 } as const;

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: C.black,
    backgroundColor: C.white,
    padding: 12,
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
  },
  body: { minWidth: 0, alignItems: 'center' },
  iconWrap: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderRadius: 50,
  },
  value: { fontSize: 19, fontWeight: '400', color: C.black },
  label: {
    fontSize: 8,
    fontWeight: '400',
    color: C.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    textAlign: 'center',
  },
});
