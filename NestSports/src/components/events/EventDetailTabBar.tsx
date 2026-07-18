import React from 'react';
import { ScrollView, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { colors, FONT } from '../../theme/colors';

export interface DetailTab {
  key: string;
  label: string;
}

// Horizontally-scrollable pill tab bar, reusing FilterPills' visual pattern —
// mobile's Event Detail screen is one scrollable screen (not separate stack
// screens per tab), so this switches which tab component renders below it.
export default function EventDetailTabBar({
  tabs,
  value,
  onChange,
}: {
  tabs: DetailTab[];
  value: string;
  onChange: (key: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
      style={styles.scroll}
    >
      {tabs.map(t => {
        const selected = value === t.key;
        return (
          <TouchableOpacity
            key={t.key}
            onPress={() => onChange(t.key)}
            style={[styles.pill, selected && styles.pillActive]}
          >
            <Text style={[styles.pillText, selected && styles.pillTextActive]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0, marginBottom: 12 },
  content: { gap: 8, paddingVertical: 2, paddingHorizontal: 16 },
  pill: {
    borderWidth: 2,
    borderColor: colors.black,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  pillActive: { backgroundColor: colors.blue },
  pillText: {
    fontFamily: FONT.bold,
    fontWeight: '700',
    fontSize: 12,
    color: colors.black,
    textTransform: 'uppercase',
  },
  pillTextActive: { color: colors.white },
});
