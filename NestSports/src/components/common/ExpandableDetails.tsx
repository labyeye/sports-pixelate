import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { colors } from '../../theme/colors';

export type DetailRow = { label: string; value?: string | number | null };

// Card-footer "Details" dropdown — the mobile counterpart of the web tables'
// expandable row. Keeps its own open/closed state so lists need no extra state.
export default function ExpandableDetails({
  rows,
  children,
}: {
  rows: DetailRow[];
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const Chevron = open ? ChevronUp : ChevronDown;
  return (
    <View>
      <TouchableOpacity
        style={styles.toggle}
        onPress={() => setOpen(o => !o)}
        activeOpacity={0.7}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <Text style={styles.toggleText}>{open ? 'Hide details' : 'Details'}</Text>
        <Chevron size={14} color={colors.blue} strokeWidth={2.5} />
      </TouchableOpacity>
      {open && (
        <View style={styles.panel}>
          <View style={styles.grid}>
            {rows.map(r => (
              <View key={r.label} style={styles.cell}>
                <Text style={styles.label}>{r.label.toUpperCase()}</Text>
                <Text style={styles.value}>
                  {r.value === undefined || r.value === null || r.value === ''
                    ? '—'
                    : String(r.value)}
                </Text>
              </View>
            ))}
          </View>
          {children}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  toggleText: { fontSize: 12, fontWeight: '700', color: colors.blue },
  panel: {
    marginTop: 8,
    padding: 10,
    backgroundColor: '#F8FAFF',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 10 },
  cell: { width: '50%', paddingRight: 8 },
  label: { fontSize: 9, fontWeight: '700', color: colors.muted, letterSpacing: 0.6 },
  value: { fontSize: 13, fontWeight: '700', color: colors.black, marginTop: 2 },
});
