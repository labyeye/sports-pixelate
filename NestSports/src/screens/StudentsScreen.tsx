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
  User,
  Download,
  FileSpreadsheet,
  Mars,
  Venus,
  Check,
  X,
  Droplet,
} from 'lucide-react-native';
import { studentAPI } from '../api/client';
import {
  EmptyState,
  LoadingView,
  SearchBar,
  StatPills,
  SortSheet,
  LoadMoreFooter,
  SortOption,
} from '../components/ui';
import {
  ImportExportModal,
  ImportHeader,
} from '../components/ImportExportModal';
import { exportRowsToExcel } from '../utils/excelImportExport';
import { colors, FONT } from '../theme/colors';

const STUDENT_IMPORT_HEADERS: ImportHeader[] = [
  { key: 'firstName', label: 'First Name', required: true, example: 'Aarav' },
  { key: 'lastName', label: 'Last Name', required: true, example: 'Mehta' },
  { key: 'sport', label: 'Sport', required: true, example: 'Tennis' },
  { key: 'batch', label: 'Batch', required: false, example: 'Morning U-12' },
  {
    key: 'dateOfBirth',
    label: 'Date of Birth',
    required: false,
    example: '2014-05-10',
  },
  { key: 'gender', label: 'Gender', required: false, example: 'male' },
  {
    key: 'enrollmentDate',
    label: 'Enrollment Date',
    required: false,
    example: '2024-01-15',
  },
  {
    key: 'coach',
    label: 'Coach Name',
    required: false,
    example: 'Rahul Sharma',
  },
  {
    key: 'emergencyContact',
    label: 'Emergency Contact',
    required: false,
    example: '9876500000',
  },
  {
    key: 'guardianName',
    label: 'Guardian Name',
    required: false,
    example: 'Priya Mehta',
  },
  {
    key: 'guardianRelation',
    label: 'Guardian Relation',
    required: false,
    example: 'mother',
  },
  {
    key: 'guardianPhone',
    label: 'Guardian Phone',
    required: false,
    example: '9876543210',
  },
];

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  active: { color: colors.green, label: 'Active' },
  on_hold: { color: colors.orange, label: 'On Hold' },
  inactive: { color: colors.muted, label: 'Inactive' },
};
const STATUS_ORDER = ['active', 'on_hold', 'inactive'];

const SORT_OPTIONS: SortOption[] = [
  { key: 'firstName', label: 'Name' },
  { key: 'sport', label: 'Sport' },
  { key: 'batch', label: 'Batch' },
  { key: 'enrollmentDate', label: 'Enrollment Date' },
  { key: 'createdAt', label: 'Date Added' },
];

// The specific guardian entry (if any) matching this student + relation, so
// callers can show whose name was actually entered, not just yes/no.
function getGuardianName(s: any, relation: 'father' | 'mother') {
  return (s.guardians || []).find(
    (g: any) => g.relation === relation && g.name?.trim(),
  )?.name as string | undefined;
}

// Male/female glyph with a tick/cross corner badge, plus the actual
// father/mother name entered for this student (or "Not entered").
function ParentIndicator({
  icon: Icon,
  name,
  color,
}: {
  icon: any;
  name?: string;
  color: string;
}) {
  const present = !!name;
  return (
    <View style={styles.parentRow}>
      <View style={styles.parentIndicator}>
        <Icon size={14} color={present ? color : '#D1D5DB'} strokeWidth={2.5} />
        <View
          style={[
            styles.parentBadge,
            { backgroundColor: present ? colors.green : colors.red },
          ]}
        >
          {present ? (
            <Check size={7} color={colors.white} strokeWidth={3} />
          ) : (
            <X size={7} color={colors.white} strokeWidth={3} />
          )}
        </View>
      </View>
      <Text style={styles.metaText} numberOfLines={1}>
        {present ? name : 'Not entered'}
      </Text>
    </View>
  );
}

let searchDebounce: ReturnType<typeof setTimeout>;

export default function StudentsScreen({ navigation }: any) {
  const [students, setStudents] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
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
  const [importVisible, setImportVisible] = useState(false);

  const fetchPage = useCallback(
    (pageNum: number) =>
      studentAPI.getAll({
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
        setStudents(res.data || []);
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
        setStudents(prev => [...prev, ...(res.data || [])]);
        setPage(next);
        setHasMore(next < (res.pages || 1));
      }
    } catch {
      // ignore, user can retry by scrolling again
    } finally {
      setLoadingMore(false);
    }
  };

  const onDelete = (student: any) => {
    Alert.alert(
      'Delete Student',
      `Remove ${student.firstName} ${student.lastName}? This marks them inactive.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await studentAPI.delete(student._id);
              setStudents(prev => prev.filter(s => s._id !== student._id));
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Could not delete student');
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
        <Text style={styles.headerTitle}>Students</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() =>
              exportRowsToExcel(
                STUDENT_IMPORT_HEADERS.map(h => ({
                  key: h.key,
                  label: h.label,
                })),
                students,
                'students_export.xlsx',
                'Students',
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
            onPress={() => navigation.navigate('AddStudent')}
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
          placeholder="Search by name or student ID..."
        />
      </View>

      <View style={styles.pillWrap}>
        <StatPills
          options={statPillOptions}
          value={status}
          onChange={setStatus}
        />
      </View>

      <FlatList
        data={students}
        keyExtractor={s => s._id}
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
        ListEmptyComponent={<EmptyState title="No students found" />}
        renderItem={({ item: s }) => {
          const statusColor = STATUS_CONFIG[s.status]?.color || colors.muted;
          return (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('AddStudent', { student: s })}
            >
              <View style={styles.cardTop}>
                {s.avatar ? (
                  <Image
                    source={{ uri: s.avatar }}
                    style={[styles.avatarImg, { borderColor: statusColor }]}
                  />
                ) : (
                  <View style={[styles.avatar, { borderColor: statusColor }]}>
                    <Text style={styles.avatarText}>
                      {(s.firstName?.[0] || '?').toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.empName}>
                    {s.firstName} {s.lastName}
                  </Text>
                  <Text style={styles.empId}>{s.studentId}</Text>
                  <Text style={styles.empDesig} numberOfLines={1}>
                    {s.batch || 'No batch'}
                  </Text>
                </View>
                <View
                  style={[styles.statusBadge, { backgroundColor: statusColor }]}
                >
                  <Text style={styles.statusText}>
                    {(
                      STATUS_CONFIG[s.status]?.label ||
                      s.status ||
                      ''
                    ).toUpperCase()}
                  </Text>
                </View>
              </View>

              <View style={styles.cardMeta}>
                {s.coach ? (
                  <View style={styles.metaItem}>
                    <User size={11} color={colors.muted} />
                    <Text style={styles.metaText} numberOfLines={1}>
                      Coach: {s.coach.firstName} {s.coach.lastName}
                    </Text>
                  </View>
                ) : null}
                {s.bloodGroup ? (
                  <View style={styles.metaItem}>
                    <Droplet size={11} color={colors.red} />
                    <Text style={styles.metaText}>
                      Blood Group: {s.bloodGroup}
                    </Text>
                  </View>
                ) : null}
                <View style={{ marginTop: 4, gap: 3 }}>
                  <ParentIndicator
                    icon={Mars}
                    name={getGuardianName(s, 'father')}
                    color={colors.blue}
                  />
                  <ParentIndicator
                    icon={Venus}
                    name={getGuardianName(s, 'mother')}
                    color={colors.purple}
                  />
                </View>
              </View>

              <View style={styles.cardBottom}>
                <View style={styles.typePill}>
                  <Text style={styles.typePillText}>
                    {(s.sport || '').toUpperCase()}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    style={styles.editBtn}
                    onPress={() =>
                      navigation.navigate('AddStudent', { student: s })
                    }
                  >
                    <Edit2 size={14} color={colors.blue} strokeWidth={2.5} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => onDelete(s)}
                  >
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
        entityLabel="Student"
        headers={STUDENT_IMPORT_HEADERS}
        templateFilename="students_import_template.xlsx"
        notes={[
          'Date of Birth and Enrollment Date must be in YYYY-MM-DD format.',
          "Coach Name must exactly match an existing employee's full name.",
          'Guardian Relation must be one of: father, mother, guardian, other.',
          'Maximum 200 students per import.',
        ]}
        previewLine={r => `${r.firstName} ${r.lastName} — ${r.sport || '—'}`}
        onImport={rows => studentAPI.bulkImport(rows) as any}
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
    borderBottomWidth: 2,
    borderBottomColor: colors.black,
    paddingHorizontal: 12,
    paddingTop: 10,
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
  avatarText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 14,
    fontFamily: FONT.bold,
  },
  empName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.black,
    fontFamily: FONT.bold,
  },
  empId: { fontSize: 11, color: colors.muted, fontFamily: 'monospace' },
  empDesig: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: '500',
    marginTop: 1,
  },
  statusBadge: {
    borderWidth: 2,
    borderColor: colors.black,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.white,
    fontFamily: FONT.bold,
  },
  cardMeta: { marginTop: 10, gap: 4 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  parentRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  parentIndicator: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  parentBadge: {
    position: 'absolute',
    bottom: -1,
    right: -3,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  typePillText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.blue,
    fontFamily: FONT.bold,
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
});
