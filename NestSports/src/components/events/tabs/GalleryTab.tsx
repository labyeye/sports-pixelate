import React, { useEffect, useState } from 'react';
import { View, Image, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Image as ImageIcon, Trash2 } from 'lucide-react-native';
import { Card, SectionTitle, EmptyState, ImagePicker, useToast, type PickedImage } from '../../ui';
import { colors } from '../../../theme/colors';
import { eventAPI } from '../../../api/client';

// Shell tab: basic grid + upload wired to a real endpoint, no albums/reorder.
export default function GalleryTab({ eventId }: { eventId: string }) {
  const { toast } = useToast() as any;
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    eventAPI
      .getGallery(eventId)
      .then((r: any) => setItems(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, [eventId]);

  const upload = async (file: PickedImage) => {
    try {
      await eventAPI.addGalleryPhoto(eventId, file);
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Could not upload photo');
    }
  };

  const remove = async (itemId: string) => {
    setBusyId(itemId);
    try {
      await eventAPI.removeGalleryItem(eventId, itemId);
      setItems(prev => prev.filter(i => i._id !== itemId));
    } catch (e: any) {
      toast.error(e?.message || 'Could not remove photo');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card>
      <SectionTitle title={`Gallery (${items.length})`} />
      <ImagePicker label="Add photo" onChange={upload} />
      {loading ? (
        <ActivityIndicator color={colors.blue} style={{ marginTop: 10 }} />
      ) : items.length === 0 ? (
        <EmptyState title="No photos yet" sub="Upload one above" icon={ImageIcon} />
      ) : (
        <View style={styles.grid}>
          {items.map(item => (
            <View key={item._id} style={styles.thumbWrap}>
              <Image source={{ uri: item.url }} style={styles.thumb} />
              <TouchableOpacity onPress={() => remove(item._id)} disabled={busyId === item._id} style={styles.removeBtn}>
                {busyId === item._id ? <ActivityIndicator size="small" color={colors.red} /> : <Trash2 size={12} color={colors.red} strokeWidth={2.5} />}
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  thumbWrap: { width: '31%', aspectRatio: 1, borderWidth: 2, borderColor: colors.black, overflow: 'hidden' },
  thumb: { width: '100%', height: '100%' },
  removeBtn: { position: 'absolute', top: 2, right: 2, backgroundColor: colors.white, borderWidth: 2, borderColor: colors.black, padding: 2 },
});
