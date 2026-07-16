import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { employeeAPI } from '../api/client';
import {
  Card,
  Row,
  Badge,
  Avatar,
  EmptyState,
  LoadingView,
} from '../components/ui';
import { colors } from '../theme/colors';

export default function EmployeesScreen() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    () =>
      employeeAPI
        .getAll()
        .then((res: any) => res.success && setEmployees(res.data || [])),
    [],
  );

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
          {employees.length === 0 ? (
            <EmptyState title="No staff found" />
          ) : (
            employees.map((e: any) => (
              <Row
                key={e._id}
                title={`${e.firstName} ${e.lastName}`}
                subtitle={`${e.designation || '-'} · ${
                  e.department?.name || '-'
                }`}
                left={<Avatar uri={e.avatar} name={e.firstName} size={36} />}
                right={
                  <Badge
                    label={e.status || '-'}
                    color={e.status === 'active' ? colors.green : colors.red}
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
  screen: { flex: 1, backgroundColor: colors.background },
});
