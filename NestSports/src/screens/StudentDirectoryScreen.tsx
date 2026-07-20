import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  View,
  Text,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
  Modal,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Users, X, Share2, Trophy } from 'lucide-react-native';
import { studentAPI, sportAPI, reportAPI } from '../api/client';
import {
  Card,
  Row,
  Badge,
  SearchBar,
  FilterPills,
  KpiTile,
  CollapsibleSection,
  EmptyState,
  LoadingView,
} from '../components/ui';
import { exportRowsToExcel } from '../utils/excelImportExport';
import { colors, FONT } from '../theme/colors';

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
        studentAPI.getAll({ limit: '1000' }),
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
    const res: any = await studentAPI.getAll({
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

  const openProfile = async (studentId: string) => {
    setSelectedId(studentId);
    setProfile(null);
    setProfileLoading(true);
    try {
      const res: any = await reportAPI.studentProfile(studentId);
      setProfile(res.data);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not load profile');
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
        options={[
          { value: '', label: 'All Sports' },
          ...sports.map(s => ({ value: s, label: s })),
        ]}
        value={sport}
        onChange={setSport}
      />
      <FilterPills
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
        <SafeAreaView edges={['top']} style={styles.screen}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Student Profile</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {profile ? (
                <TouchableOpacity
                  onPress={onExportProfile}
                  style={styles.iconBtn}
                  hitSlop={8}
                >
                  <Share2 size={18} color={colors.black} strokeWidth={2.5} />
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                onPress={closeProfile}
                style={styles.iconBtn}
                hitSlop={8}
              >
                <X size={18} color={colors.black} strokeWidth={2.5} />
              </TouchableOpacity>
            </View>
          </View>

          {profileLoading || !profile ? (
            <LoadingView />
          ) : (
            <ScrollView
              contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
              showsVerticalScrollIndicator={false}
            >
              <ProfileContent profile={profile} />
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function ProfileContent({ profile }: { profile: any }) {
  const st = profile.student || {};
  const att = profile.attendance || {};
  const subs: any[] = profile.subscriptions || [];
  const tournaments: any[] = profile.tournaments || [];
  const statusColor = STATUS_CONFIG[st.status]?.color || colors.muted;

  return (
    <>
      <CollapsibleSection title="Profile" defaultOpen>
        <Text style={styles.profileName}>
          {st.firstName} {st.lastName}
        </Text>
        <Text style={styles.profileLine}>ID: {st.studentId}</Text>
        <Text style={styles.profileLine}>Sport: {st.sport || '—'}</Text>
        <Text style={styles.profileLine}>Batch: {st.batch || '—'}</Text>
        <Text style={styles.profileLine}>
          Coach: {st.coach ? `${st.coach.firstName} ${st.coach.lastName}` : '—'}
        </Text>
        <Text style={styles.profileLine}>
          Enrollment Date:{' '}
          {st.enrollmentDate ? st.enrollmentDate.slice(0, 10) : '—'}
        </Text>
        <View style={{ marginTop: 8 }}>
          <Badge
            label={STATUS_CONFIG[st.status]?.label || st.status || ''}
            color={statusColor}
          />
        </View>
      </CollapsibleSection>

      <CollapsibleSection title="Guardians">
        {(st.guardians || []).length === 0 ? (
          <Text style={styles.emptyText}>No guardians on file</Text>
        ) : (
          st.guardians.map((g: any, i: number) => (
            <Text key={i} style={styles.profileLine}>
              {g.relation.charAt(0).toUpperCase() + g.relation.slice(1)}:{' '}
              {g.name} — {g.phone}
            </Text>
          ))
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Attendance Summary">
        <View style={styles.kpiGrid}>
          <KpiTile
            label="Present"
            value={att.present || 0}
            color={colors.green}
          />
          <KpiTile label="Late" value={att.late || 0} color={colors.yellow} />
          <KpiTile label="Absent" value={att.absent || 0} color={colors.red} />
          <KpiTile
            label="Excused"
            value={att.excused || 0}
            color={colors.blue}
          />
        </View>
        <Text style={styles.rateText}>Attendance Rate: {att.rate || 0}%</Text>
      </CollapsibleSection>

      <CollapsibleSection title="Subscriptions">
        {subs.length === 0 ? (
          <Text style={styles.emptyText}>No subscriptions</Text>
        ) : (
          subs.map((s: any, i: number) => (
            <View key={s._id || i} style={styles.subRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.subPlan}>{s.planName}</Text>
                <Text style={styles.profileLine}>
                  ₹{s.amountPaid || 0} / ₹{s.amount || 0}
                </Text>
              </View>
              <Badge label={s.status} color={colors.blue} />
            </View>
          ))
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Tournaments">
        {tournaments.length === 0 ? (
          <Text style={styles.emptyText}>No tournament history</Text>
        ) : (
          tournaments.map((t: any, i: number) => (
            <View key={i} style={styles.tourRow}>
              <Trophy size={14} color={colors.purple} strokeWidth={2.5} />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.subPlan}>{t.eventName}</Text>
                <Text style={styles.profileLine}>
                  {t.activity} · {t.team || 'Individual'} · {t.status}
                </Text>
              </View>
            </View>
          ))
        )}
      </CollapsibleSection>
    </>
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
