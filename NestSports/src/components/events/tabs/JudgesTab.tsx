import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Plus, Trash2 } from 'lucide-react-native';
import { Card, SectionTitle, useToast } from '../../ui';
import { colors, FONT } from '../../../theme/colors';
import { eventAPI } from '../../../api/client';

// Full CRUD for officials/judges — uses the officials endpoints directly.
export default function JudgesTab({ event, onChanged }: { event: any; onChanged: () => void }) {
  const { toast } = useToast() as any;
  const [draft, setDraft] = useState({ name: '', role: '', phone: '', email: '' });
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const add = async () => {
    if (!draft.name.trim() || adding) return;
    setAdding(true);
    try {
      await eventAPI.addOfficial(event._id, { ...draft, name: draft.name.trim() });
      setDraft({ name: '', role: '', phone: '', email: '' });
      onChanged();
    } catch (e: any) {
      toast.error(e?.message || 'Could not add official');
    } finally {
      setAdding(false);
    }
  };

  const remove = async (id: string) => {
    setBusyId(id);
    try {
      await eventAPI.removeOfficial(event._id, id);
      onChanged();
    } catch (e: any) {
      toast.error(e?.message || 'Could not remove official');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card>
      <SectionTitle title={`Officials / Judges (${event.officials.length})`} />
      {event.officials.map((o: any) => (
        <View key={o._id} style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{o.name}</Text>
            {o.role ? <Text style={styles.meta}>{o.role}</Text> : null}
            {(o.phone || o.email) && <Text style={styles.meta}>{[o.phone, o.email].filter(Boolean).join(' · ')}</Text>}
          </View>
          <TouchableOpacity onPress={() => remove(o._id)} disabled={busyId === o._id} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            {busyId === o._id ? <ActivityIndicator size="small" color={colors.red} /> : <Trash2 size={14} color={colors.red} strokeWidth={2.5} />}
          </TouchableOpacity>
        </View>
      ))}
      {event.officials.length === 0 && <Text style={styles.meta}>No officials added yet</Text>}

      <View style={{ marginTop: 10, gap: 8 }}>
        <TextInput style={styles.input} placeholder="Name *" value={draft.name} onChangeText={t => setDraft(p => ({ ...p, name: t }))} />
        <TextInput style={styles.input} placeholder="Role" value={draft.role} onChangeText={t => setDraft(p => ({ ...p, role: t }))} />
        <TextInput style={styles.input} placeholder="Phone" value={draft.phone} onChangeText={t => setDraft(p => ({ ...p, phone: t }))} />
        <TextInput style={styles.input} placeholder="Email" value={draft.email} onChangeText={t => setDraft(p => ({ ...p, email: t }))} />
        <TouchableOpacity onPress={add} disabled={adding || !draft.name.trim()} style={[styles.addBtn, (adding || !draft.name.trim()) && { opacity: 0.5 }]}>
          {adding ? <ActivityIndicator color={colors.white} size="small" /> : <Plus size={16} color={colors.white} strokeWidth={2.5} />}
          <Text style={styles.addBtnText}>Add Official</Text>
        </TouchableOpacity>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 2, borderColor: '#0000001A', paddingHorizontal: 10, paddingVertical: 8, marginBottom: 8 },
  name: { fontFamily: FONT.bold, fontWeight: '700', fontSize: 13, color: colors.black },
  meta: { fontFamily: FONT.medium, fontSize: 11, color: colors.muted },
  input: { borderWidth: 2, borderColor: colors.black, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, fontFamily: FONT.medium },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.blue, borderWidth: 2, borderColor: colors.black, paddingVertical: 10 },
  addBtnText: { color: colors.white, fontFamily: FONT.bold, fontWeight: '700', fontSize: 12 },
});
