import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  View,
  Text,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, ArrowUpDown, Edit2, Trash2, X } from 'lucide-react-native';
import { facilityAPI } from '../api/client';
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
  TextField,
  ChipSelect,
  Button,
  SectionTitle,
} from '../components/ui';
import { colors, FONT } from '../theme/colors';
import { useAuth } from '../contexts/AuthContext';

const TYPES = ['court', 'pool', 'turf', 'gym', 'equipment', 'other'] as const;

const SORT_OPTIONS: SortOption[] = [
  { key: 'name', label: 'Name' },
  { key: 'type', label: 'Type' },
  { key: 'capacity', label: 'Capacity' },
  { key: 'hourlyFee', label: 'Hourly Fee' },
];

const EMPTY_FORM = {
  name: '',
  type: 'court' as (typeof TYPES)[number],
  sport: '',
  capacity: '1',
  hourlyFee: '0',
};

let searchDebounce: ReturnType<typeof setTimeout>;

export default function FacilitiesScreen() {
  const { user } = useAuth();
  const isOwner = user?.role === 'super_admin' || user?.role === 'hr_manager';

  const [facilities, setFacilities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [type, setType] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [sortVisible, setSortVisible] = useState(false);

  const [formVisible, setFormVisible] = useState(false);
  const [editingFacility, setEditingFacility] = useState<any>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const fetchPage = useCallback(
    (pageNum: number) =>
      facilityAPI.getAll({
        page: String(pageNum),
        limit: '20',
        ...(search ? { search } : {}),
        ...(type ? { type } : {}),
        sortBy,
        sortDir,
      }),
    [search, type, sortBy, sortDir],
  );

  const load = useCallback(() => {
    return fetchPage(1).then((res: any) => {
      setFacilities(res.data || []);
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
      setFacilities(prev => [...prev, ...(res.data || [])]);
      setPage(next);
      setHasMore(next < (res.pages || 1));
    } catch {
      // ignore, user can retry by scrolling again
    } finally {
      setLoadingMore(false);
    }
  };

  const openAdd = () => {
    setEditingFacility(null);
    setForm(EMPTY_FORM);
    setFormVisible(true);
  };

  const openEdit = (f: any) => {
    setEditingFacility(f);
    setForm({
      name: f.name || '',
      type: f.type || 'court',
      sport: f.sport || '',
      capacity: String(f.capacity ?? '1'),
      hourlyFee: String(f.hourlyFee ?? '0'),
    });
    setFormVisible(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      Alert.alert('Missing field', 'Facility name is required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type,
        sport: form.sport.trim(),
        capacity: Number(form.capacity) || 1,
        hourlyFee: Number(form.hourlyFee) || 0,
      };
      if (editingFacility) {
        await facilityAPI.update(editingFacility._id, payload);
      } else {
        await facilityAPI.create(payload);
      }
      setFormVisible(false);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not save facility');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = (f: any) => {
    Alert.alert('Delete Facility', `Deactivate "${f.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await facilityAPI.delete(f._id);
            setFacilities(prev => prev.filter(x => x._id !== f._id));
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Could not delete facility');
          }
        },
      },
    ]);
  };

  if (loading) return <LoadingView />;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={{ padding: 16, paddingBottom: 0, flex: 1 }}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Facilities</Text>
            <Text style={styles.subtitle}>Sports facilities and hourly rates</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TouchableOpacity
              onPress={() => setSortVisible(true)}
              style={styles.iconBtn}
              hitSlop={8}
            >
              <ArrowUpDown size={18} color={colors.black} strokeWidth={2.5} />
            </TouchableOpacity>
            {isOwner && (
              <TouchableOpacity onPress={openAdd} style={styles.iconBtn} hitSlop={8}>
                <Plus size={20} color={colors.blue} strokeWidth={2.5} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <SearchBar
          value={searchInput}
          onChangeText={setSearchInput}
          placeholder="Search facilities..."
        />
        <FilterPills
          options={[
            { value: '', label: 'All' },
            ...TYPES.map(t => ({ value: t, label: t })),
          ]}
          value={type}
          onChange={setType}
        />

        <FlatList
          data={facilities}
          keyExtractor={f => f._id}
          contentContainerStyle={{ paddingBottom: 24, gap: 12 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          onEndReached={onLoadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            <LoadMoreFooter loading={loadingMore} hasMore={hasMore} />
          }
          ListEmptyComponent={<EmptyState title="No facilities found" />}
          renderItem={({ item: f }) => (
            <Card>
              <View style={styles.headerRowInner}>
                <Text style={styles.name}>{f.name}</Text>
                <Badge label={f.type} color={colors.purple} />
              </View>
              {f.sport ? <Text style={styles.sub}>{f.sport}</Text> : null}
              <Text style={styles.fee}>
                {f.hourlyFee > 0
                  ? `₹${f.hourlyFee.toLocaleString('en-IN')}/hr`
                  : 'Free'}
              </Text>
              {isOwner && (
                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    onPress={() => openEdit(f)}
                    style={styles.actionBtn}
                    hitSlop={8}
                  >
                    <Edit2 size={14} color={colors.blue} strokeWidth={2.5} />
                    <Text style={[styles.actionText, { color: colors.blue }]}>
                      Edit
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => onDelete(f)}
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

      <Modal
        visible={formVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setFormVisible(false)}
      >
        <SafeAreaView edges={['top']} style={styles.screen}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>
              {editingFacility ? 'Edit Facility' : 'Add Facility'}
            </Text>
            <TouchableOpacity onPress={() => setFormVisible(false)} hitSlop={8}>
              <X size={22} color={colors.black} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            <SectionTitle title="Facility Details" />
            <TextField
              label="Name"
              value={form.name}
              onChangeText={v => setForm(p => ({ ...p, name: v }))}
              placeholder="e.g. Court 1"
              required
            />
            <ChipSelect
              label="Type"
              options={TYPES}
              value={form.type}
              onChange={v => setForm(p => ({ ...p, type: v }))}
            />
            <TextField
              label="Sport"
              value={form.sport}
              onChangeText={v => setForm(p => ({ ...p, sport: v }))}
              placeholder="e.g. Tennis"
            />
            <TextField
              label="Capacity"
              value={form.capacity}
              onChangeText={v => setForm(p => ({ ...p, capacity: v }))}
              keyboardType="numeric"
            />
            <TextField
              label="Hourly Fee (₹, 0 = free)"
              value={form.hourlyFee}
              onChangeText={v => setForm(p => ({ ...p, hourlyFee: v }))}
              keyboardType="numeric"
            />
            <Button
              title={saving ? 'Saving...' : editingFacility ? 'Update Facility' : 'Save Facility'}
              onPress={save}
              disabled={saving}
            />
            {saving && <ActivityIndicator style={{ marginTop: 12 }} color={colors.blue} />}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 10,
  },
  title: { fontSize: 24, fontWeight: '800', color: colors.black, fontFamily: FONT.bold },
  subtitle: { color: colors.muted, marginTop: 2 },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.black,
  },
  headerRowInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: { fontSize: 16, fontWeight: '800', color: colors.black, fontFamily: FONT.bold },
  sub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  fee: { fontWeight: '800', color: colors.blue, fontSize: 15, marginTop: 8 },
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
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: colors.black,
    backgroundColor: colors.white,
  },
  formTitle: { fontSize: 17, fontWeight: '800', color: colors.black, fontFamily: FONT.bold },
});
