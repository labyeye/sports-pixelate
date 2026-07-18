import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { CreditCard } from 'lucide-react-native';
import { Card, SectionTitle, EmptyState } from '../../ui';
import { colors, FONT } from '../../../theme/colors';
import { eventAPI } from '../../../api/client';

const STATUS_COLOR: Record<string, string> = { paid: colors.green, pending: colors.yellow, failed: colors.red };

// Read-only shell — no payment gateway wired up yet.
export default function PaymentsTab({ eventId }: { eventId: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    eventAPI
      .getPayments(eventId)
      .then((r: any) => setItems(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [eventId]);

  return (
    <Card>
      <SectionTitle title={`Payments (${items.length})`} />
      {loading ? (
        <ActivityIndicator color={colors.blue} />
      ) : items.length === 0 ? (
        <EmptyState title="No payment records yet" sub="Enable Online Payments in Settings to start collecting fees" icon={CreditCard} />
      ) : (
        items.map(p => (
          <View key={p._id} style={styles.row}>
            <Text style={styles.amount}>₹{p.amount}</Text>
            <Text style={[styles.status, { color: STATUS_COLOR[p.status] || colors.muted }]}>{p.status}</Text>
          </View>
        ))
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 2, borderColor: '#0000001A', paddingHorizontal: 10, paddingVertical: 8, marginBottom: 8 },
  amount: { fontFamily: FONT.bold, fontWeight: '700', fontSize: 13, color: colors.black },
  status: { fontFamily: FONT.bold, fontWeight: '700', fontSize: 11, textTransform: 'uppercase' },
});
