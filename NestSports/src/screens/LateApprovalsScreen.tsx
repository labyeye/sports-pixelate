import React, { useCallback, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { AlertOctagon, Clock, ListChecks, Timer } from 'lucide-react-native';
import { lateApprovalAPI } from '../api/client';
import { Card, EmptyState, LoadingView, KpiTile } from '../components/ui';
import { colors, FONT } from '../theme/colors';

const RESOLUTIONS: { key: string; label: string; color: string }[] = [
  { key: 'present', label: 'Present', color: colors.green },
  { key: 'late', label: 'Late', color: colors.orange },
  { key: 'absent', label: 'Absent', color: colors.red },
  { key: 'half_day', label: 'Half Day', color: colors.blue },
];

export default function LateApprovalsScreen() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await lateApprovalAPI.getAll();
      setItems(res?.data || []);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not load late approvals');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const resolve = async (id: string, resolvedStatus: string) => {
    setResolvingId(id);
    try {
      await lateApprovalAPI.resolve(id, resolvedStatus);
      setItems(prev => prev.filter(i => i._id !== id));
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not resolve this approval');
    } finally {
      setResolvingId(null);
    }
  };

  if (loading) return <LoadingView />;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.blue} />
        }
        showsVerticalScrollIndicator={false}
      >
        {items.length > 0 && (
          <View style={styles.kpiGrid}>
            <KpiTile
              label="Pending Requests"
              value={items.length}
              sub="Awaiting resolution"
              color={colors.orange}
              icon={ListChecks}
            />
            <KpiTile
              label="Total Minutes Late"
              value={items.reduce((sum, i) => sum + (i.minutesLate || 0), 0)}
              sub="Across all requests"
              color={colors.red}
              icon={Clock}
            />
            <KpiTile
              label="Avg Minutes Late"
              value={Math.round(
                items.reduce((sum, i) => sum + (i.minutesLate || 0), 0) / items.length,
              )}
              sub="Per request"
              color={colors.blue}
              icon={Timer}
            />
          </View>
        )}
        {items.length === 0 ? (
          <EmptyState
            icon={AlertOctagon}
            title="No pending approvals"
            sub="Late check-ins beyond an employee's monthly allowance show up here"
          />
        ) : (
          items.map(item => {
            const emp = item.employee as any;
            return (
              <Card key={item._id} style={styles.card} accentColor={colors.orange}>
                <Text style={styles.empName}>
                  {emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown employee'}
                </Text>
                <Text style={styles.empSub}>
                  {emp?.employeeId || ''}
                  {emp?.employeeId ? ' · ' : ''}
                  {new Date(item.date).toLocaleDateString('en-IN')}
                </Text>
                <View style={styles.metaRow}>
                  <Clock size={12} color={colors.orange} />
                  <Text style={styles.metaText}>
                    {item.minutesLate} min late
                    {item.checkInTime
                      ? ` · checked in ${new Date(item.checkInTime).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}`
                      : ''}
                  </Text>
                </View>
                {!!item.reason && <Text style={styles.reason}>"{item.reason}"</Text>}

                <View style={styles.actionRow}>
                  {RESOLUTIONS.map(r => (
                    <TouchableOpacity
                      key={r.key}
                      style={[styles.actionBtn, { backgroundColor: r.color }]}
                      onPress={() => resolve(item._id, r.key)}
                      disabled={resolvingId === item._id}
                      activeOpacity={0.8}
                    >
                      {resolvingId === item._id ? (
                        <ActivityIndicator size="small" color={colors.white} />
                      ) : (
                        <Text style={styles.actionBtnText}>{r.label}</Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: -4,
  },
  card: { padding: 14 },
  empName: { fontFamily: FONT.bold, fontWeight: '800', fontSize: 15, color: colors.black },
  empSub: { fontFamily: FONT.medium, fontSize: 11, color: colors.muted, marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  metaText: { fontFamily: FONT.medium, fontSize: 12, fontWeight: '600', color: colors.orange },
  reason: { fontFamily: FONT.regular, fontSize: 12, color: colors.muted, fontStyle: 'italic', marginTop: 6 },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  actionBtn: {
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 2,
    borderColor: colors.black,
    minWidth: '45%',
  },
  actionBtnText: {
    fontFamily: FONT.bold,
    color: colors.white,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
});
