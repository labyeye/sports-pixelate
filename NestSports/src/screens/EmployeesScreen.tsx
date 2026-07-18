import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  View,
  Text,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Plus,
  ArrowUpDown,
  Edit2,
  Trash2,
  Mail,
  Phone,
  Download,
  FileSpreadsheet,
} from 'lucide-react-native';
import { employeeAPI, departmentAPI } from '../api/client';
import {
  EmptyState,
  LoadingView,
  SearchBar,
  StatPills,
  FilterPills,
  SortSheet,
  LoadMoreFooter,
  SortOption,
} from '../components/ui';
import { ImportExportModal, ImportHeader } from '../components/ImportExportModal';
import { exportRowsToExcel } from '../utils/excelImportExport';
import { colors, FONT } from '../theme/colors';

const EMPLOYEE_IMPORT_HEADERS: ImportHeader[] = [
  { key: 'firstName', label: 'First Name', required: true, example: 'Rahul' },
  { key: 'lastName', label: 'Last Name', required: true, example: 'Sharma' },
  { key: 'email', label: 'Email', required: true, example: 'rahul@sportsclub.com' },
  { key: 'designation', label: 'Designation', required: true, example: 'Software Engineer' },
  { key: 'joinDate', label: 'Join Date', required: true, example: '2024-01-15' },
  { key: 'phone', label: 'Phone', required: false, example: '9876543210' },
  { key: 'department', label: 'Department', required: false, example: 'Engineering' },
  { key: 'employmentType', label: 'Employment Type', required: false, example: 'full_time' },
  { key: 'gender', label: 'Gender', required: false, example: 'male' },
  { key: 'salary', label: 'Salary', required: false, example: '35000' },
];

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  active: { color: colors.green, label: 'Active' },
  on_leave: { color: colors.orange, label: 'On Leave' },
  inactive: { color: colors.muted, label: 'Inactive' },
  terminated: { color: colors.red, label: 'Terminated' },
};
const STATUS_ORDER = ['active', 'on_leave', 'inactive', 'terminated'];

const SORT_OPTIONS: SortOption[] = [
  { key: 'firstName', label: 'Name' },
  { key: 'designation', label: 'Designation' },
  { key: 'joinDate', label: 'Join Date' },
  { key: 'createdAt', label: 'Date Added' },
];

let searchDebounce: ReturnType<typeof setTimeout>;

export default function EmployeesScreen({ navigation }: any) {
  const [employees, setEmployees] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [status, setStatus] = useState('');
  const [department, setDepartment] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [sortVisible, setSortVisible] = useState(false);
  const [importVisible, setImportVisible] = useState(false);

  useEffect(() => {
    departmentAPI
      .getAll({ limit: '200' })
      .then((r: any) => setDepartments(r.data || []))
      .catch(() => {});
  }, []);

  const fetchPage = useCallback(
    (pageNum: number) =>
      employeeAPI.getAll({
        page: String(pageNum),
        limit: '20',
        ...(search ? { search } : {}),
        ...(status ? { status } : {}),
        ...(department ? { department } : {}),
        sortBy,
        sortDir,
      }),
    [search, status, department, sortBy, sortDir],
  );

  const load = useCallback(() => {
    return fetchPage(1).then((res: any) => {
      if (res.success) {
        setEmployees(res.data || []);
        setCounts(res.counts || {});
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
        setEmployees(prev => [...prev, ...(res.data || [])]);
        setPage(next);
        setHasMore(next < (res.pages || 1));
      }
    } catch {
      // ignore, user can retry by scrolling again
    } finally {
      setLoadingMore(false);
    }
  };

  const onDelete = (emp: any) => {
    Alert.alert(
      'Remove Staff',
      `Remove ${emp.firstName} ${emp.lastName}? This marks them terminated.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await employeeAPI.delete(emp._id);
              setEmployees(prev => prev.filter(e => e._id !== emp._id));
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Could not delete staff member');
            }
          },
        },
      ],
    );
  };

  const totalCount = Object.values(counts).reduce((a, b) => a + b, 0);
  const statPillOptions = [
    { value: '', label: 'All', count: totalCount, color: colors.blue },
    ...STATUS_ORDER.map(s => ({
      value: s,
      label: STATUS_CONFIG[s].label,
      count: counts[s] || 0,
      color: STATUS_CONFIG[s].color,
    })),
  ];

  if (loading) return <LoadingView />;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Staff</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() =>
              exportRowsToExcel(
                EMPLOYEE_IMPORT_HEADERS.map(h => ({ key: h.key, label: h.label })),
                employees,
                'employees_export.xlsx',
                'Employees',
              )
            }
            style={styles.iconBtn}
            hitSlop={8}
          >
            <Download size={18} color={colors.black} strokeWidth={2.5} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setImportVisible(true)}
            style={styles.iconBtn}
            hitSlop={8}
          >
            <FileSpreadsheet size={18} color={colors.black} strokeWidth={2.5} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setSortVisible(true)}
            style={styles.iconBtn}
            hitSlop={8}
          >
            <ArrowUpDown size={18} color={colors.black} strokeWidth={2.5} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => navigation.navigate('AddEmployee')}
            style={styles.addBtn}
            hitSlop={8}
          >
            <Plus size={14} color={colors.white} strokeWidth={2.5} />
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <SearchBar
          value={searchInput}
          onChangeText={setSearchInput}
          placeholder="Search by name, ID or email..."
        />
      </View>

      <View style={styles.pillWrap}>
        <StatPills options={statPillOptions} value={status} onChange={setStatus} />
      </View>

      {departments.length > 0 && (
        <View style={styles.deptPillWrap}>
          <FilterPills
            options={[
              { value: '', label: 'All Departments' },
              ...departments.map((d: any) => ({ value: d._id, label: d.name })),
            ]}
            value={department}
            onChange={setDepartment}
          />
        </View>
      )}

      <FlatList
        data={employees}
        keyExtractor={e => e._id}
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
        ListEmptyComponent={<EmptyState title="No staff found" />}
        renderItem={({ item: e }) => {
          const statusColor = STATUS_CONFIG[e.status]?.color || colors.muted;
          return (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('AddEmployee', { employee: e })}
            >
              <View style={styles.cardTop}>
                {e.avatar ? (
                  <Image
                    source={{ uri: e.avatar }}
                    style={[styles.avatarImg, { borderColor: statusColor }]}
                  />
                ) : (
                  <View style={[styles.avatar, { borderColor: statusColor }]}>
                    <Text style={styles.avatarText}>
                      {(e.firstName?.[0] || '').toUpperCase()}
                      {(e.lastName?.[0] || '').toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.empName}>
                    {e.firstName} {e.lastName}
                  </Text>
                  <Text style={styles.empId}>{e.employeeId}</Text>
                  <Text style={styles.empDesig} numberOfLines={1}>
                    {e.designation || e.department?.name || ''}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
                  <Text style={styles.statusText}>
                    {(STATUS_CONFIG[e.status]?.label || e.status || '').toUpperCase()}
                  </Text>
                </View>
              </View>

              {(e.email || e.phone) && (
                <View style={styles.cardMeta}>
                  {e.email ? (
                    <View style={styles.metaItem}>
                      <Mail size={11} color={colors.muted} />
                      <Text style={styles.metaText} numberOfLines={1}>
                        {e.email}
                      </Text>
                    </View>
                  ) : null}
                  {e.phone ? (
                    <View style={styles.metaItem}>
                      <Phone size={11} color={colors.muted} />
                      <Text style={styles.metaText}>{e.phone}</Text>
                    </View>
                  ) : null}
                </View>
              )}

              <View style={styles.cardBottom}>
                <View style={styles.typePill}>
                  <Text style={styles.typePillText}>
                    {(e.employmentType || '').replace('_', ' ').toUpperCase()}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    style={styles.editBtn}
                    onPress={() =>
                      navigation.navigate('AddEmployee', { employee: e })
                    }
                  >
                    <Edit2 size={14} color={colors.blue} strokeWidth={2.5} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.deleteBtn} onPress={() => onDelete(e)}>
                    <Trash2 size={14} color={colors.red} strokeWidth={2.5} />
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
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

      <ImportExportModal
        visible={importVisible}
        onClose={() => setImportVisible(false)}
        entityLabel="Employee"
        headers={EMPLOYEE_IMPORT_HEADERS}
        templateFilename="employees_import_template.xlsx"
        notes={[
          'Join Date must be in YYYY-MM-DD format.',
          'Employment Type must be one of: full_time, part_time, contract, intern.',
          'Department must exactly match a department already created.',
          'Maximum 200 employees per import.',
        ]}
        previewLine={r => `${r.firstName} ${r.lastName} — ${r.designation || '—'}`}
        onImport={rows => employeeAPI.bulkImport(rows) as any}
        onImported={load}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
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
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  pillWrap: {
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  deptPillWrap: {
    backgroundColor: colors.white,
    borderBottomWidth: 2,
    borderBottomColor: colors.black,
    paddingHorizontal: 12,
    paddingTop: 6,
  },
  card: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.black,
    padding: 14,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start' },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    backgroundColor: colors.blue,
  },
  avatarImg: { width: 44, height: 44, borderRadius: 22, borderWidth: 2 },
  avatarText: { color: colors.white, fontWeight: '700', fontSize: 14, fontFamily: FONT.bold },
  empName: { fontSize: 15, fontWeight: '700', color: colors.black, fontFamily: FONT.bold },
  empId: { fontSize: 11, color: colors.muted, fontFamily: 'monospace' },
  empDesig: { fontSize: 12, color: colors.muted, fontWeight: '500', marginTop: 1 },
  statusBadge: { borderWidth: 2, borderColor: colors.black, paddingHorizontal: 6, paddingVertical: 2 },
  statusText: { fontSize: 9, fontWeight: '700', color: colors.white, fontFamily: FONT.bold },
  cardMeta: { marginTop: 10, gap: 4 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 12, color: colors.muted, fontWeight: '500', flex: 1 },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  typePill: {
    borderWidth: 2,
    borderColor: colors.blue,
    backgroundColor: colors.background,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  typePillText: { fontSize: 9, fontWeight: '700', color: colors.blue, fontFamily: FONT.bold },
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
});
