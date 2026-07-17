import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
} from 'react';
import {
  FlatList,
  View,
  Text,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, Trophy, Users, ChevronRight, ArrowUpDown } from 'lucide-react-native';
import { tournamentAPI } from '../api/client';
import {
  Card,
  EmptyState,
  LoadingView,
  Badge,
  SearchBar,
  FilterPills,
  SortSheet,
  LoadMoreFooter,
  SortOption,
} from '../components/ui';
import { colors, FONT } from '../theme/colors';
import { useAuth } from '../contexts/AuthContext';

const STATUS_COLORS: Record<string, string> = {
  draft: colors.muted,
  upcoming: colors.blue,
  ongoing: colors.green,
  completed: colors.muted,
};

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'ongoing', label: 'Ongoing' },
  { value: 'completed', label: 'Completed' },
];

const SORT_OPTIONS: SortOption[] = [
  { key: 'createdAt', label: 'Date Added' },
  { key: 'name', label: 'Name' },
  { key: 'startDate', label: 'Start Date' },
];

let searchDebounce: ReturnType<typeof setTimeout>;

export default function TournamentsScreen({ navigation }: any) {
  const { user } = useAuth();
  const isParent = user?.role === 'parent';
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [status, setStatus] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [sortVisible, setSortVisible] = useState(false);

  const fetchPage = useCallback(
    (pageNum: number) =>
      tournamentAPI.getAll({
        page: String(pageNum),
        limit: '20',
        ...(search ? { search } : {}),
        ...(status ? { status } : {}),
        sortBy,
        sortDir,
      }),
    [search, status, sortBy, sortDir],
  );

  const load = useCallback(() => {
    return fetchPage(1).then((res: any) => {
      if (res.success) {
        setTournaments(res.data || []);
        setPage(1);
        setHasMore((res.page || 1) < (res.pages || 1));
      }
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

  useLayoutEffect(() => {
    if (isParent) return;
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate('CreateTournament')}
          style={styles.addBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Plus size={20} color={colors.blue} strokeWidth={2.5} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, isParent]);

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
      if (res.success) {
        setTournaments(prev => [...prev, ...(res.data || [])]);
        setPage(next);
        setHasMore(next < (res.pages || 1));
      }
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
        <View style={styles.headerRow}>
          <SearchBar
            value={searchInput}
            onChangeText={setSearchInput}
            placeholder="Search tournaments..."
          />
        </View>
        <View style={styles.sortRow}>
          <View style={{ flex: 1 }}>
            <FilterPills options={STATUS_OPTIONS} value={status} onChange={setStatus} />
          </View>
          <TouchableOpacity
            onPress={() => setSortVisible(true)}
            style={styles.sortBtn}
            hitSlop={8}
          >
            <ArrowUpDown size={18} color={colors.black} strokeWidth={2.5} />
          </TouchableOpacity>
        </View>

        <FlatList
          data={tournaments}
          keyExtractor={t => t._id}
          contentContainerStyle={{ paddingBottom: 24, gap: 12 }}
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
              <EmptyState
                title="No tournaments found"
                sub="Try adjusting your filters"
                icon={Trophy}
              />
            </Card>
          }
          renderItem={({ item: t }) => (
            <TouchableOpacity
              onPress={() => navigation.navigate('TournamentDetail', { id: t._id })}
            >
              <Card>
                <View style={styles.topRow}>
                  <View style={styles.iconChip}>
                    <Trophy size={16} color={colors.blue} strokeWidth={2.5} />
                  </View>
                  <Badge
                    label={t.status?.replace(/_/g, ' ') || '-'}
                    color={STATUS_COLORS[t.status] || colors.blue}
                  />
                </View>
                <Text style={styles.name}>{t.name}</Text>
                <Text style={styles.meta}>
                  {t.sport} ·{' '}
                  {t.format === 'knockout' ? 'Knockout' : 'Round Robin'}
                </Text>
                <View style={styles.bottomRow}>
                  <View style={styles.teamsCount}>
                    <Users size={13} color={colors.black} strokeWidth={2.5} />
                    <Text style={styles.teamsCountText}>
                      {isParent
                        ? `${t.registrationCount || 0} registered`
                        : `${t.teams?.length || 0} team${
                            t.teams?.length === 1 ? '' : 's'
                          }`}
                    </Text>
                  </View>
                  <ChevronRight size={16} color={colors.muted} />
                </View>
              </Card>
            </TouchableOpacity>
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
  addBtn: { paddingHorizontal: 4 },
  headerRow: { marginBottom: 0 },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sortBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.black,
    marginBottom: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  iconChip: {
    width: 32,
    height: 32,
    borderWidth: 2,
    borderColor: colors.blue,
    backgroundColor: '#024BAB1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontFamily: FONT.bold,
    fontWeight: '700',
    fontSize: 15,
    color: colors.black,
  },
  meta: {
    fontFamily: FONT.medium,
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#0000001A',
  },
  teamsCount: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  teamsCountText: {
    fontFamily: FONT.bold,
    fontWeight: '700',
    fontSize: 12,
    color: colors.black,
  },
});
