import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { departmentAPI } from '../api/client';
import { Card, Row, EmptyState, LoadingView } from '../components/ui';
import { colors } from '../theme/colors';

export default function DepartmentsScreen() {
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    () =>
      departmentAPI
        .getAll()
        .then((res: any) => res.success && setDepartments(res.data || [])),
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
          {departments.length === 0 ? (
            <EmptyState title="No departments found" />
          ) : (
            departments.map((d: any) => (
              <Row
                key={d._id}
                title={d.name}
                subtitle={`${d.code || '-'} · ${d.headcount ?? 0} staff`}
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
