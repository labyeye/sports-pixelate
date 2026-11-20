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
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Plus,
  Search,
  SlidersHorizontal,
  Edit2,
  Trash2,
  MoreHorizontal,
  Mail,
  Phone,
  Download,
  FileSpreadsheet,
} from 'lucide-react-native';
import { employeeAPI, departmentAPI } from '../api/client';
import PrintIdCardModal from '../idcard/PrintIdCardModal';
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

const EMPLOYEE_COLS: TableCol[] = [
  { key: 'name', label: 'Employee', flex: 1, icon: 'users' },
  { key: 'desig', label: 'Role', width: 62 },
  { key: 'status', label: 'Status', width: 64 },
  { key: 'kebab', label: '', width: 56 },
];

const EMPLOYEE_IMPORT_HEADERS: ImportHeader[] = [
  { key: 'firstName', label: 'First Name', required: true, example: 'Rahul' },
  { key: 'lastName', label: 'Last Name', required: true, example: 'Sharma' },
  {
    key: 'email',
    label: 'Email',
    required: true,
    example: 'rahul@sportsclub.com',
  },
  {
    key: 'designation',
    label: 'Designation',
    required: true,
    example: 'Software Engineer',
  },
  {
    key: 'joinDate',
    label: 'Join Date',
    required: true,
    example: '2024-01-15',
  },
  { key: 'phone', label: 'Phone', required: false, example: '9876543210' },
  {
    key: 'department',
    label: 'Department',
    required: false,
    example: 'Engineering',
  },
  {
    key: 'employmentType',
    label: 'Employment Type',
    required: false,
    example: 'full_time',
  },
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
  const [actionEmp, setActionEmp] = useState<any>(null);
  const [idPrint, setIdPrint] = useState<any[] | null>(null);
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
  const [searchVisible, setSearchVisible] = useState(false);
  const [importVisible, setImportVisible] = useState(false);

  useEffect(() => {
    departmentAPI
      .getAll({ limit: '200' })
      .then((r: any) => setDepartments(r.data || []))
      .catch(notifyError);
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
            } catch (e: unknown) {
              Alert.alert(
                'Error',
                (e as Error)?.message || 'Could not delete staff member',
              );
            }
          },
        },
      ],
    );
  };

  const totalCount = Object.values(counts).reduce((a, b) => a + b, 0);

  if (loading) return <LoadingView />;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.header}>
        <BackTitle title="Staff" />
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() =>
              exportRowsToExcel(
                EMPLOYEE_IMPORT_HEADERS.map(h => ({
                  key: h.key,
                  label: h.label,
                })),
                employees,
                'employees_export.xlsx',
                'Employees',
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
            dot={!!status || !!department}
            icon={
              <SlidersHorizontal size={22} color={colors.black} />
            }
          />
          <TouchableOpacity
            onPress={() => navigation.navigate('AddEmployee')}
            style={headerBtn}
            hitSlop={8}
          >
            <Plus size={24} color={colors.blue} />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={employees}
        keyExtractor={e => e._id}
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
                value={totalCount}
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
                label="On Leave"
                value={counts.on_leave || 0}
                icon={StatCalendar}
                color={colors.orange}
              />
              <DashStatCard
                index={3}
                label="Inactive"
                value={counts.inactive || 0}
                icon={StatUserPlus}
                color={colors.muted}
              />
            </View>
            <AttendanceTableHeader cols={EMPLOYEE_COLS} />
          </>
        }
        ListEmptyComponent={<EmptyState title="No staff found" />}
        renderItem={({ item: e, index }) => {
          const color = STATUS_CONFIG[e.status]?.color || colors.muted;
          return (
            <AttendanceTableRow
              index={index}
              cols={EMPLOYEE_COLS}
              avatar={e.avatar}
              initials={`${e.firstName?.[0] || ''}${
                e.lastName?.[0] || ''
              }`.toUpperCase()}
              name={`${e.firstName} ${e.lastName}`}
              sub={e.designation || e.employeeId}
              status={{
                label: (
                  STATUS_CONFIG[e.status]?.label ||
                  e.status ||
                  ''
                ).toUpperCase(),
                color,
                bg: color + '1A',
              }}
              cells={{ desig: e.designation || e.department?.name || '—' }}
              details={[
                { label: 'Department', value: e.department?.name },
                { label: 'Designation', value: e.designation },
                {
                  label: 'Type',
                  value: (e.employmentType || '').replace('_', ' '),
                },
                { label: 'Phone', value: e.phone },
                { label: 'Email', value: e.email },
                {
                  label: 'Joined',
                  value: e.joinDate
                    ? new Date(e.joinDate).toLocaleDateString('en-IN')
                    : '',
                },
              ]}
              menu={[
                {
                  label: 'Edit',
                  icon: Edit2,
                  onPress: () =>
                    navigation.navigate('AddEmployee', { employee: e }),
                },
                {
                  label: 'Print ID card',
                  icon: MoreHorizontal,
                  onPress: () => setIdPrint([e]),
                },
                {
                  label: 'Delete',
                  icon: Trash2,
                  color: colors.red,
                  onPress: () => onDelete(e),
                },
              ]}
            />
          );
        }}
      />

      <Modal
        visible={!!actionEmp}
        transparent
        animationType="fade"
        onRequestClose={() => setActionEmp(null)}
      >
        <TouchableOpacity
          style={styles.sheetBackdrop}
          activeOpacity={1}
          onPress={() => setActionEmp(null)}
        >
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>
              {actionEmp?.firstName} {actionEmp?.lastName}
            </Text>
            {ROW_ACTIONS.map(a => (
              <TouchableOpacity
                key={a.label}
                style={styles.sheetRow}
                onPress={() => {
                  const emp = actionEmp;
                  setActionEmp(null);
                  if (a.label === 'Print ID Card') setIdPrint([emp]);
                  else if (a.screen) navigation.navigate(a.screen);
                  else navigation.navigate('AddEmployee', { employee: emp });
                }}
              >
                <Text style={styles.sheetRowText}>{a.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      <PrintIdCardModal employees={idPrint} onClose={() => setIdPrint(null)} />

      <SearchModal
        visible={searchVisible}
        onClose={() => setSearchVisible(false)}
        value={searchInput}
        onChange={setSearchInput}
        placeholder="Search by name, ID or email..."
        items={employees.map(e => ({
          key: e._id,
          title: `${e.firstName} ${e.lastName}`,
          subtitle: e.employeeId,
        }))}
      />

      <FilterSortModal
        visible={sortVisible}
        onClose={() => setSortVisible(false)}
        filterTitle="Status"
        filterOptions={[
          { key: '', label: 'All' },
          ...STATUS_ORDER.map(k => ({ key: k, label: STATUS_CONFIG[k].label })),
        ]}
        filterValue={status}
        onFilter={setStatus}
        filter2Title="Department"
        filter2Options={
          departments.length
            ? [
                { key: '', label: 'All Departments' },
                ...departments.map((d: any) => ({ key: d._id, label: d.name })),
              ]
            : undefined
        }
        filter2Value={department}
        onFilter2={setDepartment}
        sortOptions={SORT_OPTIONS.map(o => ({ key: o.key, label: o.label }))}
        sortValue={sortBy}
        onSort={key => {
          setSortBy(key);
          setSortDir(/date|created|join/i.test(key) ? 'desc' : 'asc');
        }}
        onReset={() => {
          setStatus('');
          setDepartment('');
          setSortBy('createdAt');
          setSortDir('desc');
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
        previewLine={r =>
          `${r.firstName} ${r.lastName} — ${r.designation || '—'}`
        }
        onImport={rows => employeeAPI.bulkImport(rows) as any}
        onImported={load}
      />
    </SafeAreaView>
  );
}

// Same shortcuts as the web staff profile menu. Screens open unfiltered.
const ROW_ACTIONS: { label: string; screen?: string }[] = [
  { label: 'Edit Profile' },
  { label: 'Print ID Card' },
  { label: 'Pay Salary', screen: 'Payroll' },
  { label: 'Loan / Advance Entry', screen: 'Loans' },
  { label: 'Leave Balance', screen: 'Leave' },
  { label: 'Credentials', screen: 'EmployeeCredentials' },
  { label: 'Attendance Log', screen: 'Attendance' },
  { label: 'Attendance Settings', screen: 'AttendanceSettings' },
];

const styles = StyleSheet.create({
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopWidth: 2,
    borderColor: colors.black,
    padding: 16,
  },
  sheetTitle: { fontFamily: FONT.bold, fontSize: 16, marginBottom: 8 },
  sheetRow: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  sheetRowText: { fontFamily: FONT.semiBold, fontSize: 14 },
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
    borderRadius: 8,
    borderRightWidth: 5,
    borderBottomWidth: 5,
    borderRightColor: '#0A0A0A',
    borderBottomColor: '#0A0A0A',
    borderColor: colors.black,
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
  empId: { fontSize: 11, color: colors.muted, fontFamily: 'monospace' },
  empDesig: {
    fontSize: 12,
    color: colors.muted,
    fontWeight: '400',
    marginTop: 1,
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
