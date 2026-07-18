import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Linking, ActivityIndicator, StyleSheet } from 'react-native';
import { Trash2, FileText } from 'lucide-react-native';
import { Card, SectionTitle, ChipSelect, FilePicker, useToast, type PickedFile } from '../../ui';
import { colors, FONT } from '../../../theme/colors';
import { eventAPI } from '../../../api/client';

const KIND_OPTIONS = ['rule_book', 'guidelines', 'consent_form', 'medical_form', 'performance_music', 'fixture_pdf', 'other'] as const;
const KIND_LABELS: Record<string, string> = {
  rule_book: 'Rule Book',
  guidelines: 'Guidelines',
  consent_form: 'Consent Form',
  medical_form: 'Medical Form',
  performance_music: 'Performance Music',
  fixture_pdf: 'Fixture PDF',
  other: 'Other',
};

export default function DocumentsTab({ event, onChanged }: { event: any; onChanged: () => void }) {
  const { toast } = useToast() as any;
  const [kind, setKind] = useState<(typeof KIND_OPTIONS)[number]>('rule_book');
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const upload = async (file: PickedFile) => {
    setUploading(true);
    try {
      await eventAPI.addDocument(event._id, file, { kind });
      onChanged();
    } catch (e: any) {
      toast.error(e?.message || 'Could not upload document');
    } finally {
      setUploading(false);
    }
  };

  const remove = async (docId: string) => {
    setBusyId(docId);
    try {
      await eventAPI.removeDocument(event._id, docId);
      onChanged();
    } catch (e: any) {
      toast.error(e?.message || 'Could not remove document');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card>
      <SectionTitle title={`Documents (${event.documents.length})`} />
      {event.documents.map((d: any) => (
        <View key={d._id} style={styles.row}>
          <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }} onPress={() => Linking.openURL(d.url)}>
            <FileText size={14} color={colors.black} strokeWidth={2.5} />
            <Text style={styles.name} numberOfLines={1}>
              {d.label || KIND_LABELS[d.kind] || d.kind}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => remove(d._id)} disabled={busyId === d._id} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            {busyId === d._id ? <ActivityIndicator size="small" color={colors.red} /> : <Trash2 size={14} color={colors.red} strokeWidth={2.5} />}
          </TouchableOpacity>
        </View>
      ))}
      {event.documents.length === 0 && <Text style={styles.meta}>No documents uploaded yet</Text>}

      <View style={{ marginTop: 10 }}>
        <ChipSelect label="Document Type" options={KIND_OPTIONS} value={kind} onChange={setKind} labels={KIND_LABELS} />
        <FilePicker label="Upload document" onChange={upload} />
        {uploading && <ActivityIndicator color={colors.blue} style={{ marginTop: 6 }} />}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 2, borderColor: '#0000001A', paddingHorizontal: 10, paddingVertical: 8, marginBottom: 8 },
  name: { fontFamily: FONT.bold, fontWeight: '700', fontSize: 13, color: colors.black, flexShrink: 1 },
  meta: { fontFamily: FONT.medium, fontSize: 12, color: colors.muted },
});
