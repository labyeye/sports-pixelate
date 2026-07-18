import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  View,
  Text,
  Alert,
  Modal,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Plus,
  ArrowUpDown,
  Edit2,
  Trash2,
  X,
  Users,
  Building2,
  Wallet,
} from 'lucide-react-native';
import { departmentAPI } from '../api/client';
import {
  EmptyState,
  LoadingView,
  SearchBar,
  SortSheet,
  LoadMoreFooter,
  SortOption,
  TextField,
  Button,
  SectionTitle,
  KpiTile,
} from '../components/ui';
import { colors, FONT } from '../theme/colors';

const SORT_OPTIONS: SortOption[] = [
  { key: 'name', label: 'Name' },
  { key: 'code', label: 'Code' },
  { key: 'budget', label: 'Budget' },
  { key: 'createdAt', label: 'Date Added' },
];

const EMPTY_FORM = {
  name: '',
  code: '',
  description: '',
  budget: '',
  shiftStartTime: '',
  shiftEndTime: '',
};

let searchDebounce: ReturnType<typeof setTimeout>;

export default function DepartmentsScreen() {
  const [departments, setDepartments] = useState<any[]>([]);
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

  const [formVisible, setFormVisible] = useState(false);
  const [editingDept, setEditingDept] = useState<any>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const fetchPage = useCallback(
    (pageNum: number) =>
      departmentAPI.getAll({
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
      if (res.success) {
        setDepartments(res.data || []);
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
        setDepartments(prev => [...prev, ...(res.data || [])]);
        setPage(next);
        setHasMore(next < (res.pages || 1));
      }
    } catch {
      // ignore, user can retry by scrolling again
    } finally {
      setLoadingMore(false);
    }
  };

  const openAdd = () => {
    setEditingDept(null);
    setForm(EMPTY_FORM);
    setFormVisible(true);
  };

  const openEdit = (d: any) => {
    setEditingDept(d);
    setForm({
      name: d.name || '',
      code: d.code || '',
      description: d.description || '',
      budget: d.budget ? String(d.budget) : '',
      shiftStartTime: d.shiftStartTime || '',
      shiftEndTime: d.shiftEndTime || '',
    });
    setFormVisible(true);
  };

  const save = async () => {
    if (!form.name.trim() || !form.code.trim()) {
      Alert.alert('Missing fields', 'Department name and code are required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        description: form.description.trim() || undefined,
        budget: form.budget ? Number(form.budget) : 0,
        shiftStartTime: form.shiftStartTime.trim() || undefined,
        shiftEndTime: form.shiftEndTime.trim() || undefined,
      };
      if (editingDept) {
        await departmentAPI.update(editingDept._id, payload);
      } else {
        await departmentAPI.create(payload);
      }
      setFormVisible(false);
      await load();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not save department');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = (d: any) => {
    Alert.alert(
      'Delete Department',
      `Deactivate ${d.name}? Staff assigned to it stay assigned.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await departmentAPI.delete(d._id);
              setDepartments(prev => prev.filter(x => x._id !== d._id));
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Could not delete department');
            }
          },
        },
      ],
    );
  };

  if (loading) return <LoadingView />;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Departments</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => setSortVisible(true)}
            style={styles.iconBtn}
            hitSlop={8}
          >
            <ArrowUpDown size={18} color={colors.black} strokeWidth={2.5} />
          </TouchableOpacity>
          <TouchableOpacity onPress={openAdd} style={styles.addBtn} hitSlop={8}>
            <Plus size={14} color={colors.white} strokeWidth={2.5} />
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <SearchBar
          value={searchInput}
          onChangeText={setSearchInput}
          placeholder="Search departments..."
        />
      </View>

      <View style={styles.kpiGrid}>
        <KpiTile
          label="Departments"
          value={departments.length}
          sub="Total"
          color={colors.blue}
          icon={Building2}
        />
        <KpiTile
          label="Headcount"
          value={departments.reduce((sum, d) => sum + (d.headcount || 0), 0)}
          sub="Across all departments"
          color={colors.purple}
          icon={Users}
        />
        <KpiTile
          label="Total Budget"
          value={`₹${departments
            .reduce((sum, d) => sum + (d.budget || 0), 0)
            .toLocaleString('en-IN')}`}
          sub="Combined annual budget"
          color={colors.green}
          icon={Wallet}
        />
      </View>

      <FlatList
        data={departments}
        keyExtractor={d => d._id}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
        onEndReached={onLoadMore}
        onEndReachedThreshold={0.4}
        ListFooterComponent={
          <LoadMoreFooter loading={loadingMore} hasMore={hasMore} />
        }
        ListEmptyComponent={<EmptyState title="No departments found" />}
        renderItem={({ item: d }) => (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.85}
            onPress={() => openEdit(d)}
          >
            <View style={styles.cardTop}>
              <View style={styles.deptIcon}>
                <Users size={18} color={colors.white} strokeWidth={2.5} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.empName}>{d.name}</Text>
                <Text style={styles.empId}>{d.code}</Text>
              </View>
              <View style={styles.headcountPill}>
                <Text style={styles.headcountText}>{d.headcount ?? 0} staff</Text>
              </View>
            </View>
            <View style={styles.cardBottom}>
              <Text style={styles.empDesig} numberOfLines={1}>
                {d.description || 'No description'}
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(d)}>
                  <Edit2 size={14} color={colors.blue} strokeWidth={2.5} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => onDelete(d)}>
                  <Trash2 size={14} color={colors.red} strokeWidth={2.5} />
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>
        )}
      />

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
              {editingDept ? 'Edit Department' : 'Add Department'}
            </Text>
            <TouchableOpacity onPress={() => setFormVisible(false)} hitSlop={8}>
              <X size={22} color={colors.black} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
            <SectionTitle title="Department Details" />
            <TextField
              label="Name"
              value={form.name}
              onChangeText={v => setForm(p => ({ ...p, name: v }))}
              placeholder="e.g. Engineering"
              required
            />
            <TextField
              label="Code"
              value={form.code}
              onChangeText={v => setForm(p => ({ ...p, code: v.toUpperCase() }))}
              placeholder="e.g. ENG"
              required
            />
            <TextField
              label="Description"
              value={form.description}
              onChangeText={v => setForm(p => ({ ...p, description: v }))}
              placeholder="Optional description"
              multiline
            />
            <TextField
              label="Budget (₹)"
              value={form.budget}
              onChangeText={v => setForm(p => ({ ...p, budget: v }))}
              placeholder="Annual budget"
              keyboardType="numeric"
            />
            <TextField
              label="Shift Start Time"
              value={form.shiftStartTime}
              onChangeText={v => setForm(p => ({ ...p, shiftStartTime: v }))}
              placeholder="e.g. 09:00"
            />
            <TextField
              label="Shift End Time"
              value={form.shiftEndTime}
              onChangeText={v => setForm(p => ({ ...p, shiftEndTime: v }))}
              placeholder="e.g. 18:00"
            />
            <Button
              title={saving ? 'Saving...' : editingDept ? 'Update Department' : 'Save Department'}
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
  screen: { flex: 1, backgroundColor: colors.white },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.white,
    borderBottomWidth: 2,
    borderBottomColor: colors.black,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.black,
    fontFamily: FONT.bold,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.black,
  },
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
  searchWrap: {
    backgroundColor: colors.white,
    borderBottomWidth: 2,
    borderBottomColor: colors.black,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
  },
  card: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.black,
    padding: 14,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start' },
  empName: { fontSize: 15, fontWeight: '700', color: colors.black, fontFamily: FONT.bold },
  empId: { fontSize: 11, color: colors.muted, fontFamily: 'monospace' },
  empDesig: { fontSize: 12, color: colors.muted, fontWeight: '500', flex: 1 },
  headcountPill: {
    borderWidth: 2,
    borderColor: colors.black,
    backgroundColor: colors.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  headcountText: { fontSize: 10, fontWeight: '700', color: colors.black, fontFamily: FONT.bold },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  editBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: colors.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deptIcon: {
    width: 44,
    height: 44,
    borderWidth: 2,
    borderColor: colors.black,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
