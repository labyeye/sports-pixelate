import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { Gavel, Plus, Trash2 } from 'lucide-react-native';
import { CollapsibleSection } from '../../ui';
import { colors, FONT } from '../../../theme/colors';
import { eventAPI } from '../../../api/client';

export interface Official {
  _id: string;
  name: string;
  role?: string;
  phone?: string;
  email?: string;
}

// Officials are managed via dedicated /api/events/:id/officials endpoints
// (not part of the create/update body), so this section is only functional
// once the event exists — in create mode it just hints to come back after
// saving. Same CRUD logic backs the standalone JudgesTab on the detail screen.
export default function OfficialsSection({
  eventId,
  officials,
  onChanged,
}: {
  eventId?: string;
  officials: Official[];
  onChanged: (officials: Official[]) => void;
}) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [saving, setSaving] = useState(false);

  const add = async () => {
    if (!eventId || !name.trim()) return;
    setSaving(true);
    try {
      const res: any = await eventAPI.addOfficial(eventId, {
        name: name.trim(),
        role: role.trim() || undefined,
      });
      onChanged(res.data?.officials || []);
      setName('');
      setRole('');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not add official');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (officialId: string) => {
    if (!eventId) return;
    try {
      const res: any = await eventAPI.removeOfficial(eventId, officialId);
      onChanged(res.data?.officials || []);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not remove official');
    }
  };

  return (
    <CollapsibleSection title="Officials / Judges" icon={Gavel}>
      {!eventId ? (
        <Text style={styles.hint}>
          Save the event first, then add officials from this section.
        </Text>
      ) : (
        <>
          {officials.map(o => (
            <View key={o._id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{o.name}</Text>
                {o.role ? <Text style={styles.role}>{o.role}</Text> : null}
              </View>
              <TouchableOpacity onPress={() => remove(o._id)} hitSlop={8}>
                <Trash2 size={16} color={colors.red} strokeWidth={2.5} />
              </TouchableOpacity>
            </View>
          ))}
          {officials.length === 0 ? (
            <Text style={styles.hint}>No officials added yet.</Text>
          ) : null}
          <View style={styles.addRow}>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Name"
              placeholderTextColor={colors.muted}
            />
            <TextInput
              style={styles.input}
              value={role}
              onChangeText={setRole}
              placeholder="Role"
              placeholderTextColor={colors.muted}
            />
            <TouchableOpacity
              onPress={add}
              disabled={saving || !name.trim()}
              style={styles.addBtn}
            >
              {saving ? (
                <ActivityIndicator color={colors.blue} size="small" />
              ) : (
                <Plus size={16} color={colors.blue} strokeWidth={2.5} />
              )}
            </TouchableOpacity>
          </View>
        </>
      )}
    </CollapsibleSection>
  );
}

const styles = StyleSheet.create({
  hint: { fontFamily: FONT.medium, fontSize: 12, color: colors.muted },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#0000001A',
    paddingVertical: 8,
  },
  name: { fontFamily: FONT.bold, fontWeight: '700', fontSize: 13, color: colors.black },
  role: { fontFamily: FONT.medium, fontSize: 11, color: colors.muted, marginTop: 1 },
  addRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  input: {
    flex: 1,
    borderWidth: 2,
    borderColor: colors.black,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    fontFamily: FONT.medium,
    color: colors.black,
  },
  addBtn: {
    width: 40,
    borderWidth: 2,
    borderColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
