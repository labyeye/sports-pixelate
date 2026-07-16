import React, { useCallback, useEffect, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { inventoryAPI } from '../api/client';
import { Card, EmptyState, LoadingView, Badge } from '../components/ui';
import { colors } from '../theme/colors';

const CATEGORY_COLORS: Record<string, string> = {
  equipment: colors.blue,
  apparel: colors.purple,
  consumable: colors.orange,
};

export default function InventoryScreen() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const res: any = await inventoryAPI.getAll();
    setItems(res.data || []);
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
        <Text style={styles.title}>Inventory</Text>
        <Text style={styles.subtitle}>Sports equipment and stock levels</Text>

        {items.length === 0 ? (
          <Card>
            <EmptyState title="No inventory items found" />
          </Card>
        ) : (
          items.map(i => {
            const low = i.availableQuantity <= (i.reorderThreshold ?? 0);
            return (
              <Card key={i._id}>
                <View style={styles.headerRow}>
                  <Text style={styles.name}>{i.name}</Text>
                  <Badge
                    label={i.category}
                    color={CATEGORY_COLORS[i.category] || colors.blue}
                  />
                </View>
                {i.sport ? <Text style={styles.sub}>{i.sport}</Text> : null}
                <Text style={[styles.qty, low && { color: colors.red }]}>
                  {i.availableQuantity} / {i.totalQuantity} available
                </Text>
              </Card>
            );
          })
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
  qty: { fontWeight: '800', color: colors.black, fontSize: 15, marginTop: 8 },
});
