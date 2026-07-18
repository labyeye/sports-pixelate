import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  View,
  Text,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Plus,
  ArrowUpDown,
  Edit2,
  Trash2,
  ListChecks,
  Trophy,
  IndianRupee,
  CalendarClock,
  Download,
  FileSpreadsheet,
} from 'lucide-react-native';
import { sportsPlanAPI } from '../api/client';
import {
  Card,
  EmptyState,
  LoadingView,
  Badge,
  SearchBar,
  SortSheet,
  LoadMoreFooter,
  SortOption,
  KpiTile,
} from '../components/ui';
import { ImportExportModal, ImportHeader } from '../components/ImportExportModal';
import { exportRowsToExcel } from '../utils/excelImportExport';
import { useAuth } from '../contexts/AuthContext';
import { colors, FONT } from '../theme/colors';

const PLAN_IMPORT_HEADERS: ImportHeader[] = [
  { key: 'name', label: 'Plan Name', required: true, example: 'Elite Tennis' },
  { key: 'sport', label: 'Sport', required: true, example: 'Tennis' },
  { key: 'monthlyPrice', label: 'Monthly Price', required: true, example: '2500' },
  { key: 'yearlyPrice', label: 'Yearly Price', required: true, example: '25000' },
  { key: 'sessionsPerWeek', label: 'Sessions Per Week', required: false, example: '3' },
  { key: 'description', label: 'Description', required: false, example: '' },
];

function formatCurrency(n: number) {
  return `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
}

const SORT_OPTIONS: SortOption[] = [
  { key: 'name', label: 'Name' },
  { key: 'sport', label: 'Sport' },
  { key: 'monthlyPrice', label: 'Monthly Price' },
  { key: 'sessionsPerWeek', label: 'Sessions/Week' },
];

let searchDebounce: ReturnType<typeof setTimeout>;

export default function PlansScreen({ navigation }: any) {
  const { user } = useAuth();
  const isOwner = user?.role === 'super_admin' || user?.role === 'hr_manager';

  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [sortVisible, setSortVisible] = useState(false);
  const [importVisible, setImportVisible] = useState(false);

  const fetchPage = useCallback(
    (pageNum: number) =>
      sportsPlanAPI.getAll({
        page: String(pageNum),
        limit: '20',
        ...(search ? { search } : {}),
        sortBy,
        sortDir,
      }),
    [search, sortBy, sortDir],
  );

  const load = useCallback(() => {
    return fetchPage(1).then((res: any) => {
      setPlans(res.data || []);
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

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      load().catch(() => {});
    });
    return unsubscribe;
  }, [navigation, load]);

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
      setPlans(prev => [...prev, ...(res.data || [])]);
      setPage(next);
      setHasMore(next < (res.pages || 1));
    } catch {
      // ignore, user can retry by scrolling again
    } finally {
      setLoadingMore(false);
    }
  };

  const onDelete = (plan: any) => {
    Alert.alert('Delete Plan', `Deactivate "${plan.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await sportsPlanAPI.delete(plan._id);
            setPlans(prev => prev.filter(p => p._id !== plan._id));
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Could not delete plan');
          }
        },
      },
    ]);
  };

  if (loading) return <LoadingView />;

  const uniqueSports = new Set(plans.map(p => p.sport).filter(Boolean)).size;
  const avgMonthlyPrice = plans.length
    ? plans.reduce((sum, p) => sum + (p.monthlyPrice || 0), 0) / plans.length
    : 0;
  const avgSessionsPerWeek = plans.length
    ? plans.reduce((sum, p) => sum + (p.sessionsPerWeek || 0), 0) / plans.length
    : 0;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={{ padding: 16, paddingBottom: 0, flex: 1 }}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Coaching Plans</Text>
            <Text style={styles.subtitle}>Available sports coaching plans</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TouchableOpacity
              onPress={() =>
                exportRowsToExcel(
                  PLAN_IMPORT_HEADERS.map(h => ({ key: h.key, label: h.label })),
                  plans,
                  'coaching_plans_export.xlsx',
                  'Plans',
                )
              }
              style={styles.sortBtn}
              hitSlop={8}
            >
              <Download size={18} color={colors.black} strokeWidth={2.5} />
            </TouchableOpacity>
            {isOwner && (
              <TouchableOpacity
                onPress={() => setImportVisible(true)}
                style={styles.sortBtn}
                hitSlop={8}
              >
                <FileSpreadsheet size={18} color={colors.black} strokeWidth={2.5} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => setSortVisible(true)}
              style={styles.sortBtn}
              hitSlop={8}
            >
              <ArrowUpDown size={18} color={colors.black} strokeWidth={2.5} />
            </TouchableOpacity>
            {isOwner && (
              <TouchableOpacity
                onPress={() => navigation.navigate('AddPlan')}
                style={styles.addBtn}
                hitSlop={8}
              >
                <Plus size={14} color={colors.white} strokeWidth={2.5} />
                <Text style={styles.addBtnText}>Add</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.kpiGrid}>
          <KpiTile
            label="Total Plans"
            value={plans.length}
            sub="Coaching plans"
            color={colors.blue}
            icon={ListChecks}
          />
          <KpiTile
            label="Sports Offered"
            value={uniqueSports}
            sub="Unique sports"
            color={colors.purple}
            icon={Trophy}
          />
          <KpiTile
            label="Avg Monthly Price"
            value={formatCurrency(avgMonthlyPrice)}
            sub="Per plan"
            color={colors.orange}
            icon={IndianRupee}
          />
          <KpiTile
            label="Avg Sessions/Week"
            value={avgSessionsPerWeek.toFixed(1)}
            sub="Per plan"
            color={colors.green}
            icon={CalendarClock}
          />
        </View>

        <SearchBar
          value={searchInput}
          onChangeText={setSearchInput}
          placeholder="Search plans by name or sport..."
        />

        <FlatList
          data={plans}
          keyExtractor={p => p._id}
          contentContainerStyle={{ paddingBottom: 24, gap: 12 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          onEndReached={onLoadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            <LoadMoreFooter loading={loadingMore} hasMore={hasMore} />
          }
          ListEmptyComponent={<EmptyState title="No coaching plans found" />}
          renderItem={({ item: p }) => (
            <Card>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.name}>{p.name}</Text>
                <Badge label={p.sport} color={colors.blue} />
              </View>
              <Text style={styles.sub}>{p.sessionsPerWeek} sessions/week</Text>
              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>MONTHLY</Text>
                  <Text style={styles.statValue}>
                    {formatCurrency(p.monthlyPrice)}
                  </Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>YEARLY</Text>
                  <Text style={styles.statValue}>
                    {formatCurrency(p.yearlyPrice)}
                  </Text>
                </View>
              </View>
              {isOwner && (
                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    onPress={() => navigation.navigate('AddPlan', { plan: p })}
                    style={styles.actionBtn}
                    hitSlop={8}
                  >
                    <Edit2 size={14} color={colors.blue} strokeWidth={2.5} />
                    <Text style={[styles.actionText, { color: colors.blue }]}>
                      Edit
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => onDelete(p)}
                    style={styles.actionBtn}
                    hitSlop={8}
                  >
                    <Trash2 size={14} color={colors.red} strokeWidth={2.5} />
                    <Text style={[styles.actionText, { color: colors.red }]}>
                      Delete
                    </Text>
                  </TouchableOpacity>
                </View>
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

      <ImportExportModal
        visible={importVisible}
        onClose={() => setImportVisible(false)}
        entityLabel="Plan"
        headers={PLAN_IMPORT_HEADERS}
        templateFilename="coaching_plans_import_template.xlsx"
        notes={['Maximum 200 plans per import.']}
        previewLine={r => `${r.name} — ${r.sport || '—'}`}
        onImport={rows => sportsPlanAPI.bulkImport(rows) as any}
        onImported={load}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 10,
  },
  title: { fontSize: 24, fontWeight: '800', color: colors.black },
  subtitle: { color: colors.muted, marginTop: 2 },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 12,
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
  actionsRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionText: { fontFamily: FONT.bold, fontWeight: '700', fontSize: 12 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.blue,
    borderWidth: 2,
    borderColor: colors.black,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  addBtnText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FONT.bold,
    textTransform: 'uppercase',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: { fontSize: 16, fontWeight: '800', color: colors.black },
  sub: { color: colors.muted, fontSize: 12, marginTop: 2, marginBottom: 10 },
  statsRow: { flexDirection: 'row', gap: 10 },
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
