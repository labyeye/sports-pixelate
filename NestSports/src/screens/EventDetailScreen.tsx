import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, View, Text, Image, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LoadingView, Badge } from '../components/ui';
import { colors, FONT } from '../theme/colors';
import { eventAPI } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { eventTypes } from '../config/eventTypeConfig';
import EventDetailTabBar, { DetailTab } from '../components/events/EventDetailTabBar';
import OverviewTab from '../components/events/tabs/OverviewTab';
import ScheduleTab from '../components/events/tabs/ScheduleTab';
import ParticipantsTeamsTab from '../components/events/tabs/ParticipantsTeamsTab';
import FixturesTab from '../components/events/tabs/FixturesTab';
import PointsTableTab from '../components/events/tabs/PointsTableTab';
import AwardsTab from '../components/events/tabs/AwardsTab';
import JudgesTab from '../components/events/tabs/JudgesTab';
import DocumentsTab from '../components/events/tabs/DocumentsTab';
import SettingsTab from '../components/events/tabs/SettingsTab';
import GalleryTab from '../components/events/tabs/GalleryTab';
import AnnouncementsTab from '../components/events/tabs/AnnouncementsTab';
import PaymentsTab from '../components/events/tabs/PaymentsTab';
import AttendanceTab from '../components/events/tabs/AttendanceTab';

const STATUS_COLORS: Record<string, string> = {
  draft: colors.muted,
  registration_open: colors.green,
  registration_closed: colors.yellow,
  upcoming: colors.blue,
  live: colors.red,
  completed: colors.muted,
  cancelled: colors.muted,
};

export default function EventDetailScreen({ route, navigation }: any) {
  const { id } = route.params;
  const { user } = useAuth();
  const canManage = user?.role === 'super_admin' || user?.role === 'hr_manager';
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('overview');

  const load = useCallback(async () => {
    const res: any = await eventAPI.getOne(id);
    setEvent(res.data);
  }, [id]);

  useEffect(() => {
    load()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load().catch(() => {});
    setRefreshing(false);
  };

  if (loading || !event) return <LoadingView />;

  const isSports = event.activityCategory === 'sports';
  const isTeam = (event.participation?.type || 'team') === 'team';

  const tabs: DetailTab[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'schedule', label: 'Schedule' },
    { key: 'participants', label: isTeam ? 'Teams' : 'Participants' },
    ...(isSports ? [{ key: 'fixtures', label: 'Fixtures' }] : []),
    ...(isSports && event.format === 'round_robin' ? [{ key: 'points', label: 'Points Table' }] : []),
    { key: 'awards', label: 'Awards' },
    { key: 'judges', label: 'Judges' },
    { key: 'documents', label: 'Documents' },
    { key: 'gallery', label: 'Gallery' },
    { key: 'announcements', label: 'Announcements' },
    { key: 'payments', label: 'Payments' },
    { key: 'attendance', label: 'Attendance' },
    ...(canManage ? [{ key: 'settings', label: 'Settings' }] : []),
  ];

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {(event.coverImageUrl || event.bannerImageUrl) && (
          <Image source={{ uri: event.bannerImageUrl || event.coverImageUrl }} style={styles.banner} />
        )}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{event.name}</Text>
            <Text style={styles.subtitle}>
              {(eventTypes as any)[event.eventType]?.label || event.eventType} · {event.activity}
            </Text>
          </View>
          <Badge label={event.status?.replace(/_/g, ' ') || '-'} color={STATUS_COLORS[event.status] || colors.blue} />
        </View>

        <EventDetailTabBar tabs={tabs} value={tab} onChange={setTab} />

        <View style={{ paddingHorizontal: 16 }}>
          {tab === 'overview' && <OverviewTab event={event} />}
          {tab === 'schedule' && <ScheduleTab event={event} />}
          {tab === 'participants' && <ParticipantsTeamsTab event={event} onChanged={load} />}
          {tab === 'fixtures' && isSports && <FixturesTab event={event} onChanged={load} />}
          {tab === 'points' && isSports && <PointsTableTab event={event} />}
          {tab === 'awards' && <AwardsTab event={event} onGoToSettings={() => setTab('settings')} />}
          {tab === 'judges' && <JudgesTab event={event} onChanged={load} />}
          {tab === 'documents' && <DocumentsTab event={event} onChanged={load} />}
          {tab === 'gallery' && <GalleryTab eventId={event._id} />}
          {tab === 'announcements' && <AnnouncementsTab eventId={event._id} />}
          {tab === 'payments' && <PaymentsTab eventId={event._id} />}
          {tab === 'attendance' && <AttendanceTab eventId={event._id} />}
          {tab === 'settings' && canManage && <SettingsTab event={event} navigation={navigation} canManage={canManage} />}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  banner: { width: '100%', height: 140, backgroundColor: '#E5E7EB' },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', padding: 16, gap: 8 },
  title: { fontFamily: FONT.bold, fontWeight: '800', fontSize: 20, color: colors.black },
  subtitle: { fontFamily: FONT.medium, fontSize: 12, color: colors.muted, marginTop: 4 },
});
