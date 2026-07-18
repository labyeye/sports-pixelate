import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChipSelect, TextField } from '../ui';
import { activityCategories, ActivityCategoryKey } from '../../config/eventTypeConfig';
import { colors, FONT } from '../../theme/colors';

export default function ActivityPicker({
  activityCategory,
  value,
  onChange,
}: {
  activityCategory: ActivityCategoryKey | string | null;
  value: string;
  onChange: (v: string) => void;
}) {
  const isSports = activityCategory === 'sports';
  const suggestions =
    (activityCategory &&
      (activityCategories as any)[activityCategory]?.activities) ||
    [];

  if (isSports) {
    return (
      <ChipSelect
        label="Activity"
        options={suggestions as readonly string[]}
        value={value}
        onChange={onChange}
      />
    );
  }

  return (
    <View style={{ marginBottom: 14 }}>
      <TextField
        label="Activity"
        value={value}
        onChangeText={onChange}
        placeholder="e.g. Classical Dance"
        required
      />
      {suggestions.length > 0 ? (
        <View style={styles.suggestRow}>
          {suggestions.map((s: string) => (
            <TouchableOpacity
              key={s}
              onPress={() => onChange(s)}
              style={[styles.chip, value === s && styles.chipActive]}
            >
              <Text
                style={[styles.chipText, value === s && styles.chipTextActive]}
              >
                {s}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  suggestRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: {
    borderWidth: 2,
    borderColor: '#D1D5DB',
    backgroundColor: colors.white,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipActive: { backgroundColor: colors.blue, borderColor: colors.black },
  chipText: {
    fontFamily: FONT.bold,
    fontWeight: '700',
    fontSize: 11,
    color: colors.black,
  },
  chipTextActive: { color: colors.white },
});
