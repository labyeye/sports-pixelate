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
  Search,
  SlidersHorizontal,
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
  FileText,
  CreditCard,
} from 'lucide-react-native';
import { studentAPI } from '../api/client';
import {
  EmptyState,
  LoadingView,
  LoadMoreFooter,
  SortOption,
} from '../components/ui';
import {
  ImportExportModal,
  ImportHeader,
} from '../components/ImportExportModal';
import { exportRowsToExcel } from '../utils/excelImportExport';
import DashStatCard, { dashStatRow } from '../components/common/DashStatCard';
import {
  Users as StatUsers,
  UserCheck as StatUserCheck,
  CalendarDays as StatCalendar,
  UserPlus as StatUserPlus,
  CheckCircle2 as StatCheck,
  XCircle as StatX,
  Clock as StatClock,
} from 'lucide-react-native';
import { colors, FONT } from '../theme/colors';
import { BackTitle, headerBtn } from '../components/ScreenHeader';
import { notifyError } from '../utils/notifyError';
import { printAdmissionForm } from '../admission/print';
import HeaderIconBtn from '../components/common/HeaderIconBtn';
import SearchModal from '../components/common/SearchModal';
import FilterSortModal from '../components/common/FilterSortModal';
import {
  AttendanceTableFooter,
  AttendanceTableHeader,
  AttendanceTableRow,
  TableCol,
} from '../components/common/AttendanceTable';
import SlideInCard from '../components/motion/SlideInCard';
import PrintIdCardModal from '../idcard/PrintIdCardModal';

const STUDENT_COLS: TableCol[] = [
  { key: 'name', label: 'Student', flex: 1, icon: 'users' },
  { key: 'sport', label: 'Sport', width: 56 },
  { key: 'status', label: 'Status', width: 64 },
  { key: 'kebab', label: '', width: 56 },
];

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
  const [idPrint, setIdPrint] = useState<any[] | null>(null);
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
  const [searchVisible, setSearchVisible] = useState(false);
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
      .catch(notifyError)
      .finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => clearTimeout(searchDebounce);
  }, [searchInput]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load().catch(notifyError);
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
            } catch (e: unknown) {
              Alert.alert(
                'Error',
                (e as Error)?.message || 'Could not delete student',
              );
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
        <BackTitle title="Students" />
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
            style={headerBtn}
            hitSlop={8}
          >
            <Download size={22} color={colors.black} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setImportVisible(true)}
            style={headerBtn}
            hitSlop={8}
          >
            <FileSpreadsheet size={22} color={colors.black} />
          </TouchableOpacity>
          <HeaderIconBtn
            label="Search"
            onPress={() => setSearchVisible(true)}
            dot={!!search}
            icon={<Search size={22} color={colors.black} />}
          />
          <HeaderIconBtn
            label="Filter and sort"
            onPress={() => setSortVisible(true)}
            dot={!!status}
            icon={
              <SlidersHorizontal size={22} color={colors.black} />
            }
          />
          <TouchableOpacity
            onPress={() => navigation.navigate('AddStudent')}
            style={headerBtn}
            hitSlop={8}
          >
            <Plus size={24} color={colors.blue} />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={students}
        keyExtractor={s => s._id}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
        onEndReached={onLoadMore}
        onEndReachedThreshold={0.4}
        ListFooterComponent={
          <>
            <AttendanceTableFooter />
            <LoadMoreFooter loading={loadingMore} hasMore={hasMore} />
          </>
        }
        ListHeaderComponent={
          <>
            <View style={dashStatRow}>
              <DashStatCard
                index={0}
                label="Total"
                value={Object.values(counts).reduce((a, b) => a + b, 0)}
                icon={StatUsers}
                color={colors.blue}
              />
              <DashStatCard
                index={1}
                label="Active"
                value={counts.active || 0}
                icon={StatUserCheck}
                color={colors.green}
              />
              <DashStatCard
                index={2}
                label="On Hold"
                value={counts.on_hold || 0}
                icon={StatClock}
                color={colors.orange}
              />
              <DashStatCard
                index={3}
                label="Inactive"
                value={counts.inactive || 0}
                icon={StatX}
                color={colors.muted}
              />
            </View>
            <AttendanceTableHeader cols={STUDENT_COLS} />
          </>
        }
        ListEmptyComponent={<EmptyState title="No students found" />}
        renderItem={({ item: s, index }) => {
          const sc = STATUS_CONFIG[s.status];
          const color = sc?.color || colors.muted;
          return (
            <AttendanceTableRow
              index={index}
              cols={STUDENT_COLS}
              avatar={s.avatar}
              initials={`${s.firstName?.[0] || ''}${
                s.lastName?.[0] || ''
              }`.toUpperCase()}
              name={`${s.firstName} ${s.lastName}`}
              sub={s.studentId}
              status={{
                label: (sc?.label || s.status || '').toUpperCase(),
                color,
                bg: color + '1A',
              }}
              cells={{ sport: s.sport || '—', batch: s.batch || '—' }}
              details={[
                {
                  label: 'Coach',
                  value: s.coach
                    ? `${s.coach.firstName} ${s.coach.lastName}`
                    : '',
                },
                { label: 'Blood Group', value: s.bloodGroup },
                {
                  label: 'Enrolled',
                  value: s.enrollmentDate
                    ? new Date(s.enrollmentDate).toLocaleDateString('en-IN')
                    : '',
                },
                {
                  label: 'Experience',
                  value: s.sportsProfile?.experienceLevel,
                },
                {
                  label: 'Playing Level',
                  value: s.sportsProfile?.playingLevel,
                },
                {
                  label: 'Guardians',
                  value: (s.guardians || [])
                    .map((g: any) => `${g.name} (${g.relation})`)
                    .join(', '),
                },
                {
                  label: 'Guardian Phone',
                  value: (s.guardians || [])
                    .map((g: any) => g.phone)
                    .filter(Boolean)
                    .join(', '),
                },
                {
                  label: 'Emergency Contact',
                  value: s.emergencyContactPerson?.name
                    ? `${s.emergencyContactPerson.name} · ${
                        s.emergencyContactPerson.phone || ''
                      }`
                    : '',
                },
                {
                  label: 'Address',
                  value: [
                    s.address?.line1,
                    s.address?.city,
                    s.address?.state,
                    s.address?.pincode,
                  ]
                    .filter(Boolean)
                    .join(', '),
                },
              ]}
              menu={[
                {
                  label: 'Admission form',
                  icon: FileText,
                  onPress: () =>
                    printAdmissionForm(s).catch(e => notifyError(e)),
                },
                {
                  label: 'Print ID Card',
                  icon: CreditCard,
                  onPress: () => setIdPrint([s]),
                },
                {
                  label: 'Edit',
                  icon: Edit2,
                  onPress: () =>
                    navigation.navigate('AddStudent', { student: s }),
                },
                {
                  label: 'Delete',
                  icon: Trash2,
                  color: colors.red,
                  onPress: () => onDelete(s),
                },
              ]}
            />
          );
        }}
      />

      <SearchModal
        visible={searchVisible}
        onClose={() => setSearchVisible(false)}
        value={searchInput}
        onChange={setSearchInput}
        placeholder="Search by name or student ID..."
        items={students.map(st => ({
          key: st._id,
          title: `${st.firstName} ${st.lastName}`,
          subtitle: st.studentId,
        }))}
      />

      <FilterSortModal
        visible={sortVisible}
        onClose={() => setSortVisible(false)}
        filterTitle="Status"
        filterOptions={[
          { key: '', label: 'All' },
          { key: 'active', label: 'Active' },
          { key: 'on_hold', label: 'On Hold' },
          { key: 'inactive', label: 'Inactive' },
        ]}
        filterValue={status}
        onFilter={setStatus}
        sortOptions={SORT_OPTIONS.map(o => ({ key: o.key, label: o.label }))}
        sortValue={sortBy}
        onSort={key => {
          setSortBy(key);
          setSortDir(/date|created/i.test(key) ? 'desc' : 'asc');
        }}
        onReset={() => {
          setStatus('');
          setSortBy('createdAt');
          setSortDir('desc');
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
        onImport={rows =>
          new Promise((resolve, reject) =>
            Alert.alert(
              'Guardian consent',
              "Do the parents/guardians of ALL these students agree to the Terms & Privacy Policy and to the academy storing their child's data?",
              [
                {
                  text: 'Cancel',
                  style: 'cancel',
                  onPress: () => reject(new Error('Import cancelled')),
                },
                {
                  text: 'Yes, import',
                  onPress: () => resolve(studentAPI.bulkImport(rows)),
                },
              ],
            ),
          ) as any
        }
        onImported={load}
      />
      <PrintIdCardModal
        employees={idPrint}
        kind="student"
        onClose={() => setIdPrint(null)}
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
    fontWeight: '400',
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
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,

    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  addBtnText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '400',
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
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
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
    fontWeight: '400',
    fontSize: 14,
    fontFamily: FONT.bold,
  },
  empName: {
    fontSize: 15,
    fontWeight: '400',
    color: colors.black,
    fontFamily: FONT.bold,
  },
  empId: { fontSize: 12, color: colors.muted, fontFamily: 'monospace' },
  empDesig: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: '400',
  },
  statusBadge: {
    borderWidth: 2,
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderRadius: 999,
    borderColor: colors.black,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '400',
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
  metaText: { fontSize: 12, color: colors.muted, fontWeight: '400', flex: 1 },
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
    borderRightWidth: 4,
    borderBottomWidth: 4,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderRadius: 999,
    borderColor: colors.blue,
    backgroundColor: colors.background,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  typePillText: {
    fontSize: 9,
    fontWeight: '400',
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
