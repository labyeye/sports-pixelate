import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  View,
  Text,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowUpDown } from 'lucide-react-native';
import { subscriptionAPI } from '../api/client';
import {
  Card,
  EmptyState,
  LoadingView,
  Badge,
  Button,
  FilterPills,
  SortSheet,
  LoadMoreFooter,
  SortOption,
} from '../components/ui';
import { colors, FONT } from '../theme/colors';

function formatCurrency(n: number) {
  return `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
}

const STATUS_COLORS: Record<string, string> = {
  active: colors.green,
  pending_renewal: colors.orange,
  inactive: colors.orange,
  cancelled: colors.red,
};

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'pending_renewal', label: 'Pending Renewal' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'cancelled', label: 'Cancelled' },
];

const SORT_OPTIONS: SortOption[] = [
  { key: 'renewalDate', label: 'Renewal Date' },
  { key: 'amount', label: 'Amount' },
  { key: 'createdAt', label: 'Date Added' },
];

export default function SubscriptionsScreen({ navigation }: any) {
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const [status, setStatus] = useState('');
  const [sortBy, setSortBy] = useState('renewalDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [sortVisible, setSortVisible] = useState(false);

  const fetchPage = useCallback(
    (pageNum: number) =>
      subscriptionAPI.getAll({
        page: String(pageNum),
        limit: '20',
        ...(status ? { status } : {}),
        sortBy,
        sortDir,
      }),
    [status, sortBy, sortDir],
  );

  const load = useCallback(() => {
    return fetchPage(1).then((res: any) => {
      setSubscriptions(res.data || []);
      setPage(1);
      setHasMore((res.page || 1) < (res.pages || 1));
    });
  }, [fetchPage]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load().catch(() => {});
    setRefreshing(false);
  };

  const onLoadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const res: any = await fetchPage(next);
      setSubscriptions(prev => [...prev, ...(res.data || [])]);
      setPage(next);
      setHasMore(next < (res.pages || 1));
    } catch {
      // ignore, user can retry by scrolling again
    } finally {
      setLoadingMore(false);
    }
  };

  const handleCancel = (id: string) => {
    Alert.alert(
      'Cancel Subscription',
      'Are you sure you want to cancel this subscription?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setCancellingId(id);
            try {
              await subscriptionAPI.cancel(id);
              await load();
            } catch (e: any) {
              Alert.alert(
                'Error',
                e.message || 'Failed to cancel subscription',
              );
            } finally {
              setCancellingId(null);
            }
          },
        },
      ],
    );
  };

  if (loading) return <LoadingView />;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={{ padding: 16, paddingBottom: 0, flex: 1 }}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Subscriptions</Text>
            <Text style={styles.subtitle}>
              Coaching plan subscriptions and renewals
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setSortVisible(true)}
            style={styles.sortBtn}
            hitSlop={8}
          >
            <ArrowUpDown size={18} color={colors.black} strokeWidth={2.5} />
          </TouchableOpacity>
        </View>

        <FilterPills options={STATUS_OPTIONS} value={status} onChange={setStatus} />

        <FlatList
          data={subscriptions}
          keyExtractor={s => s._id}
          contentContainerStyle={{ paddingBottom: 24, gap: 12 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          onEndReached={onLoadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            <LoadMoreFooter loading={loadingMore} hasMore={hasMore} />
          }
          ListEmptyComponent={<EmptyState title="No subscriptions found" />}
          renderItem={({ item: s }) => (
            <Card>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.name}>
                  {s.student?.firstName} {s.student?.lastName}
                </Text>
                <Badge
                  label={s.status?.replace('_', ' ')}
                  color={STATUS_COLORS[s.status] || colors.muted}
                />
              </View>
              <Text style={styles.planName}>{s.planName}</Text>
              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>AMOUNT</Text>
                  <Text style={styles.statValue}>
                    {formatCurrency(s.amount)}
                  </Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>RENEWAL</Text>
                  <Text style={styles.statValue}>
                    {s.renewalDate
                      ? new Date(s.renewalDate).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })
                      : '—'}
                  </Text>
                </View>
              </View>
              {s.status !== 'active' && s.status !== 'cancelled' && (
                <Button
                  title={
                    s.paymentMethod === 'qr' && s.paymentStatus === 'pending'
                      ? 'Awaiting Confirmation'
                      : 'Renew'
                  }
                  onPress={() =>
                    navigation.navigate('QrRenewal', { subscription: s })
                  }
                  color={colors.blue}
                  disabled={
                    s.paymentMethod === 'qr' && s.paymentStatus === 'pending'
                  }
                />
              )}
              {s.status === 'active' && (
                <Button
                  title="Cancel Subscription"
                  onPress={() => handleCancel(s._id)}
                  color={colors.red}
                  variant="outline"
                  loading={cancellingId === s._id}
                />
              )}
            </Card>
          )}
        />
      </View>

      <SortSheet
        visible={sortVisible}
        onClose={() => setSortVisible(false)}
        options={SORT_OPTIONS}
        sortBy={sortBy}
        sortDir={sortDir}
        onApply={(key, dir) => {
          setSortBy(key);
          setSortDir(dir);
          setSortVisible(false);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  title: { fontSize: 24, fontWeight: '800', color: colors.black, fontFamily: FONT.bold },
  subtitle: { color: colors.muted, marginTop: 2 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 10,
  },
  sortBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.black,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: { fontSize: 16, fontWeight: '800', color: colors.black },
  planName: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 2,
    marginBottom: 10,
  },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  statBox: {
    flex: 1,
    borderWidth: 2,
    borderColor: colors.black,
    backgroundColor: colors.background,
    padding: 10,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.muted,
    marginBottom: 4,
  },
  statValue: { fontSize: 15, fontWeight: '800', color: colors.black },
});
