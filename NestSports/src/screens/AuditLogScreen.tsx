import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, View, Text, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auditAPI } from '../api/client';
import {
  Card,
  SectionTitle,
  Row,
  LoadingView,
  EmptyState,
  SearchBar,
  FilterPills,
  LoadMoreFooter,
} from '../components/ui';
import { colors } from '../theme/colors';

function actionLabel(action: string) {
  return action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function fmt(d: string) {
  return new Date(d).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const ENTITY_OPTIONS = [
  { value: '', label: 'All entities' },
  { value: 'Employee', label: 'Employee' },
  { value: 'Leave', label: 'Leave' },
  { value: 'ExitManagement', label: 'Exit Management' },
];

let searchDebounce: ReturnType<typeof setTimeout>;

export default function AuditLogScreen() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [entity, setEntity] = useState('');

  const fetchPage = useCallback(
    (pageNum: number) => {
      const params: Record<string, string> = { page: String(pageNum), limit: '20' };
      if (search) params.action = search;
      if (entity) params.entity = entity;
      return auditAPI.getLogs(params);
    },
    [search, entity],
  );

  const load = useCallback(() => {
    return fetchPage(1).then((res: any) => {
      setLogs(res.data || []);
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

  useEffect(() => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => clearTimeout(searchDebounce);
  }, [searchInput]);

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
      setLogs(prev => [...prev, ...(res.data || [])]);
      setPage(next);
      setHasMore(next < (res.pages || 1));
    } catch {
      // ignore, user can retry by scrolling again
    } finally {
      setLoadingMore(false);
    }
  };

  if (loading) return <LoadingView />;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={{ padding: 16, paddingBottom: 0, flex: 1 }}>
        <Text style={styles.title}>Audit Log</Text>
        <Text style={styles.subtitle}>Track who changed what and when</Text>

        <SearchBar
          value={searchInput}
          onChangeText={setSearchInput}
          placeholder="Search by action..."
        />
        <FilterPills options={ENTITY_OPTIONS} value={entity} onChange={setEntity} />

        <FlatList
          data={logs}
          keyExtractor={(l, i) => l._id || String(i)}
          contentContainerStyle={{ paddingBottom: 24 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          onEndReached={onLoadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            <LoadMoreFooter loading={loadingMore} hasMore={hasMore} />
          }
          ListEmptyComponent={
            <Card>
              <EmptyState title="No audit logs found" />
            </Card>
          }
          ListHeaderComponent={
            logs.length > 0 ? (
              <Card>
                <SectionTitle title={`${logs.length} recent activities`} />
              </Card>
            ) : null
          }
          renderItem={({ item: log }) => (
            <Card>
              <Row
                title={actionLabel(log.action)}
                subtitle={`${log.entity || '—'} · ${
                  log.user?.name || log.userName || 'System'
                } · ${fmt(log.createdAt)}`}
              />
            </Card>
          )}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  title: { fontSize: 24, fontWeight: '800', color: colors.black },
  subtitle: { color: colors.muted, marginTop: 2, marginBottom: 16 },
});
