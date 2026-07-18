import React, { useState } from 'react';
import { TouchableOpacity, Text, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { Pencil, Trash2 } from 'lucide-react-native';
import { Card, SectionTitle, useToast } from '../../ui';
import { colors, FONT } from '../../../theme/colors';
import { eventAPI } from '../../../api/client';

// Navigates to the shared EventFormScreen in edit mode rather than
// duplicating the big form here — one source of truth for the form UI.
export default function SettingsTab({ event, navigation, canManage }: { event: any; navigation: any; canManage: boolean }) {
  const { toast } = useToast() as any;
  const [deleting, setDeleting] = useState(false);

  const handleDelete = () => {
    Alert.alert('Delete event?', `"${event.name}" and all its data will be removed. This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await eventAPI.delete(event._id);
            toast.success('Event deleted');
            navigation.goBack();
          } catch (e: any) {
            toast.error(e?.message || 'Could not delete event');
            setDeleting(false);
          }
        },
      },
    ]);
  };

  return (
    <>
      <Card>
        <SectionTitle title="Edit Event" />
        <TouchableOpacity style={styles.editBtn} onPress={() => navigation.navigate('EventForm', { id: event._id })}>
          <Pencil size={16} color={colors.white} strokeWidth={2.5} />
          <Text style={styles.editBtnText}>Edit Details</Text>
        </TouchableOpacity>
      </Card>
      {canManage && (
        <Card>
          <SectionTitle title="Danger Zone" />
          <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} disabled={deleting}>
            {deleting ? <ActivityIndicator color={colors.red} size="small" /> : <Trash2 size={16} color={colors.red} strokeWidth={2.5} />}
            <Text style={styles.deleteBtnText}>Delete Event</Text>
          </TouchableOpacity>
        </Card>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  editBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.blue, borderWidth: 2, borderColor: colors.black, paddingVertical: 12 },
  editBtnText: { color: colors.white, fontFamily: FONT.bold, fontWeight: '800', fontSize: 13, textTransform: 'uppercase' },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 2, borderColor: colors.red, paddingVertical: 12 },
  deleteBtnText: { color: colors.red, fontFamily: FONT.bold, fontWeight: '700', fontSize: 13 },
});
