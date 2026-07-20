import React, { useCallback, useEffect, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Share2, Trophy, FileText } from 'lucide-react-native';
import { studentAPI, reportAPI } from '../api/client';
import {
  Card,
  Avatar,
  Badge,
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

// Lets a parent generate the same "student report card" the academy can
// generate from Student Directory (see StudentDirectoryScreen.tsx's
// openProfile/onExportProfile/ProfileContent), scoped to their own
// children — reportAPI.studentProfile(studentId) enforces that server-side.
export default function ParentReportScreen() {
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChild, setSelectedChild] = useState('');
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadChildren = useCallback(async () => {
    const res: any = await studentAPI.getAll();
    const data = res.data || [];
    setChildren(data);
    setSelectedChild(prev => prev || data[0]?._id || '');
    return data;
  }, []);

  const loadProfile = useCallback(async (studentId: string) => {
    if (!studentId) {
      setProfile(null);
      return;
    }
    setProfileLoading(true);
    try {
      const res: any = await reportAPI.studentProfile(studentId);
      setProfile(res.data);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not load report');
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    loadChildren()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [loadChildren]);

  useEffect(() => {
    if (selectedChild) loadProfile(selectedChild);
  }, [selectedChild, loadProfile]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadChildren().catch(() => {});
    if (selectedChild) await loadProfile(selectedChild).catch(() => {});
    setRefreshing(false);
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
        ...(profile.subscriptions || []).map((s: any, i: number) => ({
          field: `Subscription ${i + 1}`,
          value: `${s.planName} — ${s.status}, paid ${s.amountPaid || 0}/${
            s.amount || 0
          }`,
        })),
        ...(profile.tournaments || []).map((t: any, i: number) => ({
          field: `Tournament ${i + 1}`,
          value: `${t.eventName} (${t.activity}) — ${t.team || 'Individual'}`,
        })),
      ],
      `student_report_${st?.studentId || 'export'}.xlsx`,
      'Report',
    );
  };

  if (loading) return <LoadingView />;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Student Report</Text>
        {profile ? (
          <TouchableOpacity
            onPress={onExportProfile}
            style={styles.iconBtn}
            hitSlop={8}
          >
            <Share2 size={18} color={colors.black} strokeWidth={2.5} />
          </TouchableOpacity>
        ) : null}
      </View>

      {children.length === 0 ? (
        <EmptyState
          title="No children linked to your account yet"
          sub="Contact the academy to link your child's profile."
          icon={FileText}
        />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {children.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, marginBottom: 14 }}
            >
              {children.map(c => {
                const selected = c._id === selectedChild;
                return (
                  <TouchableOpacity
                    key={c._id}
                    onPress={() => setSelectedChild(c._id)}
                    style={[
                      styles.childChip,
                      selected && styles.childChipActive,
                    ]}
                  >
                    <Avatar uri={c.avatar} name={c.firstName} size={22} />
                    <Text
                      style={[
                        styles.childChipText,
                        selected && styles.childChipTextActive,
                      ]}
                    >
                      {c.firstName}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {profileLoading || !profile ? (
            <LoadingView />
          ) : (
            <ProfileContent profile={profile} />
          )}
        </ScrollView>
      )}
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
  childChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 2,
    borderColor: colors.black,
    backgroundColor: colors.white,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  childChipActive: { backgroundColor: colors.blue },
  childChipText: { fontSize: 12, fontWeight: '700', color: colors.black },
  childChipTextActive: { color: colors.white },
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
