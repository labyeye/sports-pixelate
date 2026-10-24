import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import AnimatedNumber from '../motion/AnimatedNumber';

// Same palette names NestHR's components were written with, on NestSports' tokens.
const C = {
  primary: colors.blue,
  secondary: colors.orange,
  success: colors.green,
  warning: '#F59E0B',
  danger: colors.red,
  black: colors.black,
  white: colors.white,
  textMuted: colors.black,
  textLight: '#94a3b8',
};

interface Props {
  label: string;
  value: string | number;
  color?: string;
  icon?: React.ComponentType<{ size?: number; color?: string }>;
  sub?: string;
  /** Percentage of the row the tile should take, default two tiles per row. */
  width?: `${number}%`;
  /** Stacked layout (icon above the number) so four fit in one row. */
  compact?: boolean;
}

/** Summary card in the same look as the Dashboard stat cards (tinted icon chip + big number + caps label). */
export default function StatTile({
  label,
  value,
  color = C.primary,
  icon: Icon,
  sub,
  width = '48.5%',
  compact,
}: Props) {
  return (
    <View style={[styles.card, compact && styles.cardCompact, { width }]}>
      {Icon ? (
        <View
          style={[
            styles.chip,
            compact && styles.chipCompact,
            { backgroundColor: color + '1A', borderColor: color },
            compact && { borderRightColor: color, borderBottomColor: color },
          ]}
        >
          <Icon size={compact ? 14 : 18} color={color} />
        </View>
      ) : null}
      <View style={compact ? styles.bodyCompact : styles.body}>
        <Text
          style={[styles.label, compact && styles.labelCompact]}
          numberOfLines={compact ? 2 : 1}
        >
          {label}
        </Text>
        {typeof value === 'number' ? (
          <AnimatedNumber
            style={[styles.value, compact && styles.valueCompact]}
            value={value}
          />
        ) : (
          <Text
            style={[styles.value, compact && styles.valueCompact]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {value}
          </Text>
        )}
        {sub ? (
          <Text style={styles.sub} numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export const tileGrid = {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: 10,
} as const;

const styles = StyleSheet.create({
  body: { flex: 1, minWidth: 0 },
  bodyCompact: { alignSelf: 'stretch', minWidth: 0, alignItems: 'center' },
  cardCompact: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
    padding: 12,
  },
  chipCompact: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderRightWidth: 2,
    borderBottomWidth: 2,
  },
  labelCompact: {
    fontSize: 8,
    letterSpacing: 0.6,
    textAlign: 'center',
  },
  valueCompact: { fontSize: 19, fontWeight: '700', textAlign: 'center' },
  card: {
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: C.black,
    backgroundColor: C.white,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  chip: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderRadius: 8,
  },
  value: { fontSize: 22, fontWeight: '800', color: C.black },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: C.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sub: { fontSize: 10, color: C.textMuted },
});
