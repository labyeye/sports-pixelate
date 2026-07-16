import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useState,
} from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, Trophy, Users, ChevronRight } from 'lucide-react-native';
import { tournamentAPI } from '../api/client';
import { Card, EmptyState, LoadingView, Badge } from '../components/ui';
import { colors, FONT } from '../theme/colors';
import { useAuth } from '../contexts/AuthContext';

const STATUS_COLORS: Record<string, string> = {
  draft: colors.muted,
  upcoming: colors.blue,
  ongoing: colors.green,
  completed: colors.muted,
};

export default function TournamentsScreen({ navigation }: any) {
  const { user } = useAuth();
  const isParent = user?.role === 'parent';
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    () =>
      tournamentAPI
        .getAll()
        .then((res: any) => res.success && setTournaments(res.data || [])),
    [],
  );

  useEffect(() => {
    load()
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [load]);

  useLayoutEffect(() => {
    if (isParent) return;
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate('CreateTournament')}
          style={styles.addBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Plus size={20} color={colors.blue} strokeWidth={2.5} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, isParent]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load().catch(() => {});
    setRefreshing(false);
  };

  if (loading) return <LoadingView />;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {tournaments.length === 0 ? (
          <Card>
            <EmptyState
              title="No tournaments yet"
              sub="Create one to start building fixtures"
              icon={Trophy}
            />
          </Card>
        ) : (
          tournaments.map((t: any) => (
            <TouchableOpacity
              key={t._id}
              onPress={() =>
                navigation.navigate('TournamentDetail', { id: t._id })
              }
            >
              <Card>
                <View style={styles.topRow}>
                  <View style={styles.iconChip}>
                    <Trophy size={16} color={colors.blue} strokeWidth={2.5} />
                  </View>
                  <Badge
                    label={t.status?.replace(/_/g, ' ') || '-'}
                    color={STATUS_COLORS[t.status] || colors.blue}
                  />
                </View>
                <Text style={styles.name}>{t.name}</Text>
                <Text style={styles.meta}>
                  {t.sport} ·{' '}
                  {t.format === 'knockout' ? 'Knockout' : 'Round Robin'}
                </Text>
                <View style={styles.bottomRow}>
                  <View style={styles.teamsCount}>
                    <Users size={13} color={colors.black} strokeWidth={2.5} />
                    <Text style={styles.teamsCountText}>
                      {isParent
                        ? `${t.registrationCount || 0} registered`
                        : `${t.teams?.length || 0} team${
                            t.teams?.length === 1 ? '' : 's'
                          }`}
                    </Text>
                  </View>
                  <ChevronRight size={16} color={colors.muted} />
                </View>
              </Card>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  addBtn: { paddingHorizontal: 4 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  iconChip: {
    width: 32,
    height: 32,
    borderWidth: 2,
    borderColor: colors.blue,
    backgroundColor: '#024BAB1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontFamily: FONT.bold,
    fontWeight: '700',
    fontSize: 15,
    color: colors.black,
  },
  meta: {
    fontFamily: FONT.medium,
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#0000001A',
  },
  teamsCount: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  teamsCountText: {
    fontFamily: FONT.bold,
    fontWeight: '700',
    fontSize: 12,
    color: colors.black,
  },
});
