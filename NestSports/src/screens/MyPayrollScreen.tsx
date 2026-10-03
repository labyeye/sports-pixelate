import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { payrollAPI } from '../api/client';
import { Card, Row, Badge, EmptyState, LoadingView } from '../components/ui';
import { colors } from '../theme/colors';
import { formatCurrency } from '../utils/format';
import { notifyError } from '../utils/notifyError';

const STATUS_COLORS: Record<string, string> = {
  draft: colors.muted,
  processed: colors.blue,
  paid: colors.green,
};

const MONTH_NAMES = [
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

export default function MyPayrollScreen() {
  const [payslips, setPayslips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    () =>
      payrollAPI
        .getMy()
        .then((res: any) => res.success && setPayslips(res.data || [])),
    [],
  );

  useEffect(() => {
    load()
      .catch(notifyError)
      .finally(() => setLoading(false));
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load().catch(notifyError);
    setRefreshing(false);
  };

  if (loading) return <LoadingView />;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Card>
          {payslips.length === 0 ? (
            <EmptyState title="No payroll records found" />
          ) : (
            payslips.map((p: any) => (
              <Row
                key={p._id}
                title={`${MONTH_NAMES[(p.month || 1) - 1]} ${p.year}`}
                subtitle={formatCurrency(p.netSalary)}
                right={
                  <Badge
                    label={p.status}
                    color={STATUS_COLORS[p.status] || colors.blue}
                  />
                }
              />
            ))
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
});
