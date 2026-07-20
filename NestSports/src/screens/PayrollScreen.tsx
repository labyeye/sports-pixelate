import React, { useCallback, useEffect, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Play } from 'lucide-react-native';
import { payrollAPI } from '../api/client';
import { Card, EmptyState, LoadingView, Badge, Button } from '../components/ui';
import { colors, FONT } from '../theme/colors';

function formatCurrency(n: number) {
  return `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const now = new Date();

export default function PayrollScreen() {
  const [payrolls, setPayrolls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [bulkMarking, setBulkMarking] = useState(false);

  const [month] = useState(now.getMonth() + 1);
  const [year] = useState(now.getFullYear());

  const load = useCallback(async () => {
    const res: any = await payrollAPI.getAll({
      month: String(month),
      year: String(year),
    });
    setPayrolls(res.data || []);
  }, [month, year]);

  useEffect(() => {
    load()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load().catch(() => {});
    setRefreshing(false);
  };

  const handleMarkPaid = (id: string) => {
    Alert.alert('Mark as Paid', 'Confirm this payroll has been paid?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: async () => {
          setMarkingId(id);
          try {
            await payrollAPI.markPaid(id);
            await load();
          } catch (e: any) {
            Alert.alert('Error', e.message || 'Failed to mark as paid');
          } finally {
            setMarkingId(null);
          }
        },
      },
    ]);
  };

  const handleProcess = () => {
    Alert.alert(
      'Process Payroll',
      `Generate payroll records for ${MONTHS[month - 1]} ${year}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Process',
          onPress: async () => {
            setProcessing(true);
            try {
              const res: any = await payrollAPI.process({ month, year });
              Alert.alert(
                'Payroll Processed',
                res.message || 'Payroll processed successfully.',
              );
              await load();
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Failed to process payroll');
            } finally {
              setProcessing(false);
            }
          },
        },
      ],
    );
  };

  const handleBulkMarkPaid = () => {
    Alert.alert(
      'Mark All Paid',
      `Mark all unpaid payroll records as paid for ${
        MONTHS[month - 1]
      } ${year}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setBulkMarking(true);
            try {
              await payrollAPI.bulkMarkPaid(month, year);
              await load();
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Failed to bulk mark paid');
            } finally {
              setBulkMarking(false);
            }
          },
        },
      ],
    );
  };

  if (loading) return <LoadingView />;

  const unpaidCount = payrolls.filter(p => p.status !== 'paid').length;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Payroll</Text>
            <Text style={styles.subtitle}>
              {MONTHS[month - 1]} {year} · Employee salary records
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleProcess}
            style={styles.processBtn}
            hitSlop={8}
          >
            {processing ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <>
                <Play size={12} color={colors.white} strokeWidth={2.5} />
                <Text style={styles.processBtnText}>Process</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {unpaidCount > 0 && (
          <View style={styles.bulkBar}>
            <Button
              title={
                bulkMarking
                  ? 'Marking...'
                  : `Mark All ${unpaidCount} Unpaid as Paid`
              }
              onPress={handleBulkMarkPaid}
              color={colors.green}
              disabled={bulkMarking}
            />
          </View>
        )}

        {payrolls.length === 0 ? (
          <Card>
            <EmptyState title="No payroll records found" />
          </Card>
        ) : (
          payrolls.map(p => {
            const isPaid = p.status === 'paid';
            return (
              <Card key={p._id}>
                <View style={styles.headerRowInner}>
                  <Text style={styles.name}>
                    {p.employee
                      ? `${p.employee.firstName} ${p.employee.lastName}`
                      : '—'}
                  </Text>
                  <Badge
                    label={p.status}
                    color={isPaid ? colors.green : colors.orange}
                  />
                </View>
                <Text style={styles.sub}>
                  {p.month ? `${MONTHS[p.month - 1]} ${p.year}` : '—'}
                </Text>
                <Text style={styles.amount}>{formatCurrency(p.netSalary)}</Text>
                {!isPaid && (
                  <Button
                    title="Mark Paid"
                    onPress={() => handleMarkPaid(p._id)}
                    color={colors.green}
                    loading={markingId === p._id}
                  />
                )}
              </Card>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  title: { fontSize: 24, fontWeight: '800', color: colors.black },
  subtitle: { color: colors.muted, marginTop: 2 },
  processBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.blue,
    borderWidth: 2,
    borderColor: colors.black,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 4,
  },
  processBtnText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FONT.bold,
    textTransform: 'uppercase',
  },
  bulkBar: { marginBottom: 12 },
  headerRowInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: { fontSize: 16, fontWeight: '800', color: colors.black },
  sub: { color: colors.muted, fontSize: 12, marginTop: 4 },
  amount: {
    fontWeight: '800',
    color: colors.black,
    fontSize: 16,
    marginTop: 8,
    marginBottom: 12,
  },
});
