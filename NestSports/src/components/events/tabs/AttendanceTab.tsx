import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { ClipboardCheck } from 'lucide-react-native';
import { Card, SectionTitle, EmptyState } from '../../ui';
import { colors, FONT } from '../../../theme/colors';
import { eventAPI } from '../../../api/client';

// Read-only shell — no QR check-in / attendance-marking subsystem yet.
export default function AttendanceTab({ eventId }: { eventId: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    eventAPI
      .getAttendance(eventId)
      .then((r: any) => setItems(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [eventId]);

  return (
    <Card>
      <SectionTitle title={`Attendance (${items.length})`} />
      {loading ? (
        <ActivityIndicator color={colors.blue} />
      ) : items.length === 0 ? (
        <EmptyState title="No attendance recorded yet" sub="Enable QR Check-in in Settings to start" icon={ClipboardCheck} />
      ) : (
        items.map(r => (
          <View key={r._id} style={styles.row}>
            <Text style={styles.name}>
              {typeof r.student === 'object' ? `${r.student.firstName} ${r.student.lastName}` : 'Participant'}
            </Text>
            <Text style={[styles.status, { color: r.status === 'present' ? colors.green : colors.red }]}>{r.status}</Text>
          </View>
        ))
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 2, borderColor: '#0000001A', paddingHorizontal: 10, paddingVertical: 8, marginBottom: 8 },
  name: { fontFamily: FONT.bold, fontWeight: '700', fontSize: 13, color: colors.black },
  status: { fontFamily: FONT.bold, fontWeight: '700', fontSize: 11, textTransform: 'uppercase' },
});
