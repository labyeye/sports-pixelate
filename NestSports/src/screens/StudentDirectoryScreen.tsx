import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  View,
  Text,
  RefreshControl,
  ScrollView,
  Modal,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Users, X, Share2 } from 'lucide-react-native';
import { studentAPI, sportAPI, reportAPI } from '../api/client';
import {
  Card,
  Row,
  Badge,
  SearchBar,
  FilterPills,
  EmptyState,
  LoadingView,
} from '../components/ui';
import { StudentProfileView } from '../components/StudentProfileView';
import { SOFT } from '../components/profile';
import { exportRowsToExcel } from '../utils/excelImportExport';
import { colors, FONT } from '../theme/colors';
import { fetchAllPages } from '../utils/fetchAllPages';
import { getErrorMessage } from '../utils/format';
import { notifyError } from '../utils/notifyError';

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  active: { color: colors.green, label: 'Active' },
  on_hold: { color: colors.orange, label: 'On Hold' },
  inactive: { color: colors.muted, label: 'Inactive' },
};

let searchDebounce: ReturnType<typeof setTimeout>;

export default function StudentDirectoryScreen() {
  const [students, setStudents] = useState<any[]>([]);
  const [batches, setBatches] = useState<string[]>([]);
  const [sports, setSports] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [sport, setSport] = useState('');
  const [batch, setBatch] = useState('');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const loadFilters = useCallback(async () => {
    try {
      const [stRes, spRes]: any[] = await Promise.all([
        fetchAllPages(studentAPI.getAll, { limit: '1000' }),
        sportAPI.getAll(),
      ]);
      const all: any[] = stRes.data || [];
      setBatches(
        Array.from(new Set(all.map(s => s.batch).filter(Boolean))) as string[],
      );
      const sportList: any[] = spRes.data || [];
      setSports(sportList.map(s => s.name || s));
    } catch {
      // filters are optional
    }
  }, []);

  const load = useCallback(async () => {
    const res: any = await fetchAllPages(studentAPI.getAll, {
      limit: '200',
      ...(search ? { search } : {}),
      ...(sport ? { sport } : {}),
      ...(batch ? { batch } : {}),
    });
    setStudents(res.data || []);
  }, [search, sport, batch]);

  useEffect(() => {
    loadFilters();
  }, [loadFilters]);

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

  const openProfile = async (studentId: string) => {
    setSelectedId(studentId);
    setProfile(null);
    setProfileLoading(true);
    try {
      const res: any = await reportAPI.studentProfile(studentId);
      setProfile(res.data);
    } catch (e: unknown) {
      Alert.alert('Error', getErrorMessage(e) || 'Could not load profile');
      setSelectedId(null);
    } finally {
      setProfileLoading(false);
    }
  };

  const closeProfile = () => {
    setSelectedId(null);
    setProfile(null);
  };

  const onExportProfile = () => {
    if (!profile) return;
    const st = profile.student;
    const att = profile.attendance || {};
    exportRowsToExcel(
      [
        { key: 'field', label: 'Field' },
        { key: 'value', label: 'Value' },
      ],
      [
        { field: 'Name', value: `${st?.firstName} ${st?.lastName}` },
        { field: 'Student ID', value: st?.studentId },
        { field: 'Sport', value: st?.sport },
        { field: 'Batch', value: st?.batch },
        { field: 'Status', value: st?.status },
        {
          field: 'Coach',
          value: st?.coach ? `${st.coach.firstName} ${st.coach.lastName}` : '',
        },
        { field: 'Enrollment Date', value: st?.enrollmentDate?.slice(0, 10) },
        { field: 'Attendance Present', value: att.present },
        { field: 'Attendance Late', value: att.late },
        { field: 'Attendance Absent', value: att.absent },
        { field: 'Attendance Excused', value: att.excused },
        { field: 'Attendance Rate', value: `${att.rate || 0}%` },
        ...(st?.guardians || []).map((g: any, i: number) => ({
          field: `Guardian ${i + 1}`,
          value: `${g.relation}: ${g.name} (${g.phone})`,
        })),
      ],
      `student_profile_${st?.studentId || 'export'}.xlsx`,
      'Profile',
    );
  };

  if (loading) return <LoadingView />;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Student Directory</Text>
      </View>

      <View style={styles.searchWrap}>
        <SearchBar
          value={searchInput}
          onChangeText={setSearchInput}
          placeholder="Search by name or student ID..."
        />
      </View>

      <FilterPills
        inset
        options={[
          { value: '', label: 'All Sports' },
          ...sports.map(s => ({ value: s, label: s })),
        ]}
        value={sport}
        onChange={setSport}
      />
      <FilterPills
        inset
        options={[
          { value: '', label: 'All Batches' },
          ...batches.map(b => ({ value: b, label: b })),
        ]}
        value={batch}
        onChange={setBatch}
      />

      <FlatList
        data={students}
        keyExtractor={s => s._id}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState title="No students found" icon={Users} />
        }
        renderItem={({ item: s }) => {
          const statusColor = STATUS_CONFIG[s.status]?.color || colors.muted;
          return (
            <Card accentColor={statusColor} style={{ padding: 0 }}>
              <Row
                title={`${s.firstName} ${s.lastName}`}
                subtitle={`${s.studentId} · ${s.sport || 'No sport'} · ${
                  s.batch || 'No batch'
                }`}
                onPress={() => openProfile(s._id)}
                noBorder
                right={
                  <Badge
                    label={STATUS_CONFIG[s.status]?.label || s.status || ''}
                    color={statusColor}
                  />
                }
              />
            </Card>
          );
        }}
      />

      <Modal
        visible={!!selectedId}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeProfile}
      >
        <SafeAreaView
          edges={['top']}
          style={[styles.screen, { backgroundColor: SOFT.screenBg }]}
        >
          {profileLoading || !profile ? (
            <LoadingView />
          ) : (
            <ScrollView
              contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
              showsVerticalScrollIndicator={false}
            >
              <StudentProfileView
                profile={profile}
                statusLabel={
                  STATUS_CONFIG[profile.student?.status]?.label ||
                  profile.student?.status
                }
                statusColor={STATUS_CONFIG[profile.student?.status]?.color}
                backIcon={X}
                onBack={closeProfile}
                shareIcon={Share2}
                onShare={onExportProfile}
              />
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
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
    fontSize: 18,
    fontWeight: '800',
    color: colors.black,
    fontFamily: FONT.bold,
    flex: 1,
  },
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
  searchWrap: {
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  profileName: {
    fontFamily: FONT.bold,
    fontWeight: '800',
    fontSize: 16,
    color: colors.black,
    marginBottom: 4,
  },
  profileLine: {
    fontFamily: FONT.medium,
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  emptyText: { fontFamily: FONT.medium, fontSize: 12, color: colors.muted },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  rateText: {
    fontFamily: FONT.bold,
    fontWeight: '700',
    fontSize: 13,
    color: colors.black,
    marginTop: 4,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#0000001A',
  },
  subPlan: {
    fontFamily: FONT.bold,
    fontWeight: '700',
    fontSize: 13,
    color: colors.black,
  },
  tourRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#0000001A',
  },
});
