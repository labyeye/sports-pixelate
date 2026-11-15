import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { C } from '../../theme';

export interface FilterOption {
  key: string;
  label: string;
}

interface Props {
  options: FilterOption[];
  value: string;
  onChange: (key: string) => void;
  /** Tapping the selected option clears it (back to ''). Default true. */
  toggle?: boolean;
}

/** White pills with black border; the selected one is blue. */
export default function FilterBar({
  options,
  value,
  onChange,
  toggle = true,
}: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.bar}
      contentContainerStyle={styles.content}
    >
      {options.map(o => {
        const selected = value === o.key;
        return (
          <TouchableOpacity
            key={o.key || 'all'}
            style={[styles.pill, selected && styles.pillActive]}
            onPress={() => onChange(toggle && selected ? '' : o.key)}
            activeOpacity={0.8}
          >
            <Text style={[styles.text, selected && styles.textActive]}>
              {o.label.replace(/_/g, ' ')}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexGrow: 0,
    flexShrink: 0,
    backgroundColor: C.white,
    borderBottomWidth: 2,
    borderBottomColor: C.black,
  },
  content: { paddingHorizontal: 12, paddingVertical: 12, gap: 8 },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 2,
    borderColor: C.black,
    borderRadius: 8,
    backgroundColor: C.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: { backgroundColor: C.primary },
  text: {
    fontSize: 12,
    fontWeight: '400',
    color: C.black,
  },
  textActive: { color: C.white },
});
