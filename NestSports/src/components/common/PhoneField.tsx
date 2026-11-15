import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  Pressable,
  StyleSheet,
} from 'react-native';
import { C } from '../../theme';
import { modalCenter } from './PickerField';

// Two-letter country codes instead of emoji flags: emoji can render as "?" boxes with the app's custom font.
export const COUNTRIES = [
  { flag: 'IN', dial: '+91', name: 'India' },
  { flag: 'AE', dial: '+971', name: 'UAE' },
  { flag: 'US', dial: '+1', name: 'USA' },
  { flag: 'GB', dial: '+44', name: 'UK' },
  { flag: 'SA', dial: '+966', name: 'Saudi Arabia' },
  { flag: 'QA', dial: '+974', name: 'Qatar' },
  { flag: 'NP', dial: '+977', name: 'Nepal' },
  { flag: 'BD', dial: '+880', name: 'Bangladesh' },
  { flag: 'LK', dial: '+94', name: 'Sri Lanka' },
  { flag: 'SG', dial: '+65', name: 'Singapore' },
  { flag: 'AU', dial: '+61', name: 'Australia' },
  { flag: 'CA', dial: '+1', name: 'Canada' },
];

/** "+919876543210" -> [country, national digits]; bare numbers default to India. */
export function splitPhone(v: string): [(typeof COUNTRIES)[number], string] {
  const s = (v || '').replace(/[^\d+]/g, '');
  const hit = [...COUNTRIES]
    .sort((a, b) => b.dial.length - a.dial.length)
    .find(c => s.startsWith(c.dial));
  return hit
    ? [hit, s.slice(hit.dial.length)]
    : [COUNTRIES[0], s.replace(/^\+/, '').slice(-10)];
}

interface Props {
  value: string;
  onChange: (full: string) => void;
  placeholder?: string;
}

/** Country-code picker (flag + dial code) with the number input. Value is "<dial><digits>". */
export default function PhoneField({
  value,
  onChange,
  placeholder = 'Phone number',
}: Props) {
  const [open, setOpen] = useState(false);
  const [country, digits] = splitPhone(value);
  const set = (c: typeof country, d: string) =>
    onChange(d ? `${c.dial}${d}` : '');
  return (
    <>
      <View style={styles.row}>
        <TouchableOpacity style={styles.code} onPress={() => setOpen(true)}>
          <Text style={styles.flag}>{country.flag}</Text>
          <Text style={styles.dial}>{country.dial}</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          value={digits}
          onChangeText={t => set(country, t.replace(/\D/g, '').slice(0, 12))}
          placeholder={placeholder}
          placeholderTextColor="#6B7280"
          keyboardType="phone-pad"
        />
      </View>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={modalCenter.overlay} onPress={() => setOpen(false)}>
          <Pressable style={modalCenter.card} onPress={() => {}}>
            <Text style={styles.title}>Country code</Text>
            <FlatList
              data={COUNTRIES}
              keyExtractor={c => c.name}
              style={{ maxHeight: 360 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.option}
                  onPress={() => {
                    set(item, digits);
                    setOpen(false);
                  }}
                >
                  <Text style={styles.flag}>{item.flag}</Text>
                  <Text style={styles.optName}>{item.name}</Text>
                  <Text style={styles.optDial}>{item.dial}</Text>
                </TouchableOpacity>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    borderWidth: 2,
    borderRadius: 8,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: C.black,
    backgroundColor: C.white,
    overflow: 'hidden',
  },
  code: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    backgroundColor: '#F3F4F6',
    borderRightWidth: 2,
    borderRightColor: C.black,
  },
  flag: { fontSize: 12, fontWeight: '400', color: '#000' },
  dial: { fontSize: 14, fontWeight: '400', color: C.black },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: '400',
    color: C.black,
  },
  title: {
    fontSize: 14,
    fontWeight: '400',
    padding: 16,
    borderBottomWidth: 2,
    borderBottomColor: C.black,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  optName: { flex: 1, fontSize: 15, fontWeight: '400', color: C.black },
  optDial: { fontSize: 14, color: '#6B7280', fontWeight: '400' },
});
