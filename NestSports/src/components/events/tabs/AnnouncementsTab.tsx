import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Megaphone } from 'lucide-react-native';
import { Card, SectionTitle, EmptyState, useToast } from '../../ui';
import { colors, FONT } from '../../../theme/colors';
import { eventAPI } from '../../../api/client';

// Shell tab: list + simple create, no edit/delete/scheduling yet.
export default function AnnouncementsTab({ eventId }: { eventId: string }) {
  const { toast } = useToast() as any;
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [posting, setPosting] = useState(false);

  const load = () => {
    setLoading(true);
    eventAPI
      .getAnnouncements(eventId)
      .then((r: any) => setItems(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, [eventId]);

  const post = async () => {
    if (!title.trim() || !message.trim() || posting) return;
    setPosting(true);
    try {
      await eventAPI.addAnnouncement(eventId, { title: title.trim(), message: message.trim() });
      setTitle('');
      setMessage('');
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Could not post announcement');
    } finally {
      setPosting(false);
    }
  };

  return (
    <Card>
      <SectionTitle title={`Announcements (${items.length})`} />
      {loading ? (
        <ActivityIndicator color={colors.blue} />
      ) : items.length === 0 ? (
        <EmptyState title="No announcements yet" icon={Megaphone} />
      ) : (
        items.map(a => (
          <View key={a._id} style={styles.item}>
            <Text style={styles.title}>{a.title}</Text>
            <Text style={styles.message}>{a.message}</Text>
          </View>
        ))
      )}
      <View style={{ marginTop: 10, gap: 8 }}>
        <TextInput style={styles.input} placeholder="Title" value={title} onChangeText={setTitle} />
        <TextInput style={[styles.input, { height: 70 }]} placeholder="Message" value={message} onChangeText={setMessage} multiline />
        <TouchableOpacity onPress={post} disabled={posting || !title.trim() || !message.trim()} style={[styles.postBtn, (posting || !title.trim() || !message.trim()) && { opacity: 0.5 }]}>
          {posting ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={styles.postBtnText}>Post Announcement</Text>}
        </TouchableOpacity>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  item: { borderWidth: 2, borderColor: '#0000001A', paddingHorizontal: 10, paddingVertical: 8, marginBottom: 8 },
  title: { fontFamily: FONT.bold, fontWeight: '700', fontSize: 13, color: colors.black },
  message: { fontFamily: FONT.medium, fontSize: 12, color: colors.muted, marginTop: 2 },
  input: { borderWidth: 2, borderColor: colors.black, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, fontFamily: FONT.medium },
  postBtn: { backgroundColor: colors.blue, borderWidth: 2, borderColor: colors.black, paddingVertical: 10, alignItems: 'center' },
  postBtnText: { color: colors.white, fontFamily: FONT.bold, fontWeight: '700', fontSize: 12 },
});
