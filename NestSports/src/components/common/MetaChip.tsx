import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { C } from '../../theme';

type Props = {
  icon?: React.ReactNode;
  text: string;
  bg?: string;
  grow?: boolean;
  style?: ViewStyle;
};

// Neo-brutalist info chip: thick black border, hard bottom/right shadow edge, pastel fill.
export default function MetaChip({
  icon,
  text,
  bg = '#FFFFFF',
  grow,
  style,
}: Props) {
  return (
    <View
      style={[
        styles.chip,
        { backgroundColor: bg },
        grow ? { flex: 1 } : { flexShrink: 0 },
        style,
      ]}
    >
      {icon}
      <Text style={styles.text} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

export const CHIP = {
  blue: '#FFFFFF',
  red: '#FFFFFF',
  green: '#FFFFFF',
  yellow: '#FFFFFF',
  pink: '#FFFFFF',
  orange: '#FFFFFF',
  purple: '#FFFFFF',
};

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderWidth: 2,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderColor: C.black,
    borderRadius: 6,
    flexShrink: 1,
  },
  text: { fontSize: 11, fontWeight: '400', color: C.black, flexShrink: 1 },
});
