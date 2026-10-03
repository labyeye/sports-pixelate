import React from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import { colors, FONT } from '../theme/colors';

export interface FeeOverdueStudent {
  _id?: string;
  name: string;
  studentId?: string;
  overdueDays: number;
  planName?: string;
  amountDue?: number;
}

// Shown when attendance is refused because the student's fee is overdue past
// the grace period set in Attendance Settings.
export default function FeeOverdueModal({
  students,
  onClose,
}: {
  students: FeeOverdueStudent[] | null;
  onClose: () => void;
}) {
  const list = students || [];
  return (
    <Modal visible={list.length > 0} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.box}>
          <View style={styles.head}>
            <AlertTriangle size={20} color="#DC2626" />
            <Text style={styles.title}>Fee not paid</Text>
          </View>
          <Text style={styles.body}>
            {list.length === 1
              ? 'Attendance was not taken because this student has not paid their fee.'
              : 'Attendance was not taken for these students because they have not paid their fee.'}
          </Text>
          <ScrollView style={{ maxHeight: 240 }}>
            {list.map((s, i) => (
              <View key={s._id || i} style={styles.row}>
                <Text style={styles.name}>
                  {s.name}
                  {s.studentId ? ` (${s.studentId})` : ''}
                </Text>
                <Text style={styles.meta}>
                  Overdue by {s.overdueDays} day{s.overdueDays === 1 ? '' : 's'}
                  {s.amountDue ? ` · ₹${s.amountDue} due` : ''}
                  {s.planName ? ` · ${s.planName}` : ''}
                </Text>
              </View>
            ))}
          </ScrollView>
          <TouchableOpacity style={styles.btn} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.btnText}>OK</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  box: { backgroundColor: colors.white, borderWidth: 2, borderColor: colors.black, padding: 16 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  title: { fontFamily: FONT.bold, fontSize: 18, color: colors.black },
  body: { fontSize: 13, color: '#374151', marginBottom: 12 },
  row: { borderWidth: 1, borderColor: '#E5E7EB', padding: 10, marginBottom: 6 },
  name: { fontFamily: FONT.bold, fontSize: 14, color: colors.black },
  meta: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  btn: { backgroundColor: colors.blue, borderWidth: 2, borderColor: colors.black, paddingVertical: 10, alignItems: 'center', marginTop: 12 },
  btnText: { fontFamily: FONT.bold, color: colors.white, fontSize: 14 },
});
