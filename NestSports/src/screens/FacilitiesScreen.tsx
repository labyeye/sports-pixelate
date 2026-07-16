import React, { useCallback, useEffect, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { facilityAPI } from '../api/client';
import { Card, EmptyState, LoadingView, Badge } from '../components/ui';
import { colors } from '../theme/colors';

export default function FacilitiesScreen() {
  const [facilities, setFacilities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const res: any = await facilityAPI.getAll();
    setFacilities(res.data || []);
  }, []);

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
        <Text style={styles.title}>Facilities</Text>
        <Text style={styles.subtitle}>Sports facilities and hourly rates</Text>

        {facilities.length === 0 ? (
          <Card>
            <EmptyState title="No facilities found" />
          </Card>
        ) : (
          facilities.map(f => (
            <Card key={f._id}>
              <View style={styles.headerRow}>
                <Text style={styles.name}>{f.name}</Text>
                <Badge label={f.type} color={colors.purple} />
              </View>
              {f.sport ? <Text style={styles.sub}>{f.sport}</Text> : null}
              <Text style={styles.fee}>
                {f.hourlyFee > 0
                  ? `₹${f.hourlyFee.toLocaleString('en-IN')}/hr`
                  : 'Free'}
              </Text>
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  title: { fontSize: 24, fontWeight: '800', color: colors.black },
  subtitle: { color: colors.muted, marginTop: 2, marginBottom: 16 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: { fontSize: 16, fontWeight: '800', color: colors.black },
  sub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  fee: { fontWeight: '800', color: colors.blue, fontSize: 15, marginTop: 8 },
});
