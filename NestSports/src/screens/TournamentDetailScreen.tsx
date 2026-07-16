import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Plus,
  Trash2,
  Shuffle,
  RotateCcw,
  Check,
  X,
  Trash,
  UserPlus,
  UserMinus,
} from 'lucide-react-native';
import { tournamentAPI, studentAPI } from '../api/client';
import { Card, SectionTitle, LoadingView } from '../components/ui';
import { colors, FONT } from '../theme/colors';
import { useAuth } from '../contexts/AuthContext';

// Parent-facing card: register/unregister their own children (filtered to
// this tournament's sport) instead of the staff bracket-management tools.
function RegistrationCard({
  tournament,
  onChanged,
}: {
  tournament: any;
  onChanged: () => void;
}) {
  const [children, setChildren] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    studentAPI
      .getAll()
      .then((res: any) => setChildren(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const registeredIds = useMemo(
    () =>
      new Set((tournament.registrations || []).map((r: any) => r.student?._id)),
    [tournament.registrations],
  );

  const eligible = children.filter(c => c.sport === tournament.sport);

  const toggle = async (studentId: string, isRegistered: boolean) => {
    setBusyId(studentId);
    try {
      if (isRegistered)
        await tournamentAPI.unregister(tournament._id, studentId);
      else await tournamentAPI.register(tournament._id, studentId);
      onChanged();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not update registration');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return null;

  return (
    <Card style={{ marginTop: 14 }}>
      <SectionTitle title="Register" />
      {eligible.length === 0 ? (
        <Text style={styles.emptyHint}>
          None of your children are enrolled in {tournament.sport} to register
          for this tournament.
        </Text>
      ) : (
        eligible.map(c => {
          const isRegistered = registeredIds.has(c._id);
          const busy = busyId === c._id;
          return (
            <View key={c._id} style={styles.regRow}>
              <Text style={styles.regName}>
                {c.firstName} {c.lastName}
              </Text>
              <TouchableOpacity
                onPress={() => toggle(c._id, isRegistered)}
                disabled={
                  busy || (!isRegistered && !tournament.registrationOpen)
                }
                style={[
                  styles.regBtn,
                  isRegistered ? styles.regBtnRemove : styles.regBtnAdd,
                ]}
              >
                {busy ? (
                  <ActivityIndicator
                    color={isRegistered ? colors.red : colors.white}
                    size="small"
                  />
                ) : isRegistered ? (
                  <>
                    <UserMinus size={13} color={colors.red} strokeWidth={2.5} />
                    <Text style={styles.regBtnRemoveText}>Unregister</Text>
                  </>
                ) : (
                  <>
                    <UserPlus
                      size={13}
                      color={colors.white}
                      strokeWidth={2.5}
                    />
                    <Text style={styles.regBtnAddText}>Register</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          );
        })
      )}
      {!tournament.registrationOpen && (
        <Text style={styles.emptyHint}>
          Registration is closed for this tournament.
        </Text>
      )}
    </Card>
  );
}

function FixtureRow({
  fixture,
  onSave,
}: {
  fixture: any;
  onSave: (id: string, scoreA: number, scoreB: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [scoreA, setScoreA] = useState(
    fixture.scoreA !== undefined ? String(fixture.scoreA) : '',
  );
  const [scoreB, setScoreB] = useState(
    fixture.scoreB !== undefined ? String(fixture.scoreB) : '',
  );
  const [saving, setSaving] = useState(false);

  const bothSet = !!fixture.teamA?.team && !!fixture.teamB?.team;
  const canRecord = bothSet && fixture.status === 'scheduled';

  const save = async () => {
    if (scoreA === '' || scoreB === '' || Number(scoreA) === Number(scoreB)) {
      Alert.alert('Invalid score', 'Enter two different scores');
      return;
    }
    setSaving(true);
    try {
      await onSave(fixture._id, Number(scoreA), Number(scoreB));
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card style={{ marginBottom: 10 }}>
      {[
        {
          slot: fixture.teamA,
          isWinner: fixture.winner === 'A',
          score: fixture.scoreA,
        },
        {
          slot: fixture.teamB,
          isWinner: fixture.winner === 'B',
          score: fixture.scoreB,
        },
      ].map((row, i) => (
        <View
          key={i}
          style={[styles.teamRow, row.isWinner && styles.teamRowWinner]}
        >
          <Text
            style={[styles.teamName, row.isWinner && styles.teamNameWinner]}
            numberOfLines={1}
          >
            {row.slot?.name || (fixture.status === 'bye' ? '—' : 'TBD')}
          </Text>
          {fixture.status === 'completed' && (
            <Text style={styles.teamScore}>{row.score}</Text>
          )}
        </View>
      ))}

      {fixture.status === 'bye' && (
        <Text style={styles.byeHint}>Bye — advances automatically</Text>
      )}

      {canRecord && !editing && (
        <TouchableOpacity
          onPress={() => setEditing(true)}
          style={styles.recordBtn}
        >
          <Text style={styles.recordBtnText}>Record Result</Text>
        </TouchableOpacity>
      )}

      {editing && (
        <View style={{ marginTop: 8 }}>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
            <TextInput
              style={styles.scoreInput}
              value={scoreA}
              onChangeText={setScoreA}
              placeholder="Score"
              keyboardType="numeric"
            />
            <TextInput
              style={styles.scoreInput}
              value={scoreB}
              onChangeText={setScoreB}
              placeholder="Score"
              keyboardType="numeric"
            />
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              onPress={save}
              disabled={saving}
              style={styles.saveBtn}
            >
              {saving ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <>
                  <Check size={14} color={colors.white} strokeWidth={2.5} />
                  <Text style={styles.saveBtnText}>Save</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setEditing(false)}
              style={styles.cancelBtn}
            >
              <X size={14} color={colors.black} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </Card>
  );
}

export default function TournamentDetailScreen({ route, navigation }: any) {
  const { id } = route.params;
  const { user } = useAuth();
  const isParent = user?.role === 'parent';
  const [tournament, setTournament] = useState<any>(null);
  const [fixtures, setFixtures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newTeam, setNewTeam] = useState('');
  const [addingTeam, setAddingTeam] = useState(false);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    const [tRes, fRes]: any[] = await Promise.all([
      tournamentAPI.getOne(id),
      tournamentAPI.getFixtures(id).catch(() => ({ data: [] })),
    ]);
    setTournament(tRes.data);
    setFixtures(fRes.data || []);
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

  const addTeam = async () => {
    if (!newTeam.trim()) return;
    setAddingTeam(true);
    try {
      const res: any = await tournamentAPI.addTeam(id, newTeam.trim());
      setTournament(res.data);
      setNewTeam('');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not add team');
    } finally {
      setAddingTeam(false);
    }
  };

  const removeTeam = async (teamId: string) => {
    try {
      const res: any = await tournamentAPI.removeTeam(id, teamId);
      setTournament(res.data);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not remove team');
    }
  };

  const generateFixtures = (regenerate: boolean) => {
    const run = async () => {
      setGenerating(true);
      try {
        const res: any = await tournamentAPI.generateFixtures(id, {
          regenerate,
          shuffle: true,
        });
        setFixtures(res.data || []);
        const tRes: any = await tournamentAPI.getOne(id);
        setTournament(tRes.data);
      } catch (e: any) {
        Alert.alert('Error', e?.message || 'Could not generate fixtures');
      } finally {
        setGenerating(false);
      }
    };
    if (regenerate) {
      Alert.alert(
        'Regenerate fixtures?',
        'All recorded results will be lost.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Regenerate', style: 'destructive', onPress: run },
        ],
      );
    } else {
      run();
    }
  };

  const recordResult = async (
    fixtureId: string,
    scoreA: number,
    scoreB: number,
  ) => {
    try {
      await tournamentAPI.recordResult(fixtureId, { scoreA, scoreB });
      const res: any = await tournamentAPI.getFixtures(id);
      setFixtures(res.data || []);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not save result');
    }
  };

  const deleteTournament = () => {
    Alert.alert(
      'Delete tournament?',
      'This removes the tournament and all its fixtures.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await tournamentAPI.delete(id);
              navigation.goBack();
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Could not delete tournament');
            }
          },
        },
      ],
    );
  };

  const roundsGrouped = useMemo(() => {
    const map = new Map<number, any[]>();
    fixtures.forEach(f => {
      if (!map.has(f.round)) map.set(f.round, []);
      map.get(f.round)!.push(f);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([round, list]) => ({
        round,
        label: list[0].roundLabel,
        list: list.sort((a, b) => a.matchIndex - b.matchIndex),
      }));
  }, [fixtures]);

  if (loading || !tournament) return <LoadingView />;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Text style={styles.title}>{tournament.name}</Text>
        <Text style={styles.subtitle}>
          {tournament.sport} ·{' '}
          {tournament.format === 'knockout' ? 'Knockout' : 'Round Robin'}
          {tournament.venue ? ` · ${tournament.venue}` : ''}
        </Text>

        {isParent ? (
          <RegistrationCard tournament={tournament} onChanged={load} />
        ) : (
          <Card style={{ marginTop: 14 }}>
            <SectionTitle title={`Teams (${tournament.teams.length})`} />
            <View style={styles.teamChips}>
              {tournament.teams.map((t: any) => (
                <View key={t._id} style={styles.teamChip}>
                  <Text style={styles.teamChipText}>{t.name}</Text>
                  {!tournament.fixturesGenerated && (
                    <TouchableOpacity
                      onPress={() => removeTeam(t._id)}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Trash2 size={12} color={colors.red} strokeWidth={2.5} />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              {tournament.teams.length === 0 && (
                <Text style={styles.emptyHint}>No teams added yet</Text>
              )}
            </View>

            {!tournament.fixturesGenerated && (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                <TextInput
                  style={styles.teamInput}
                  value={newTeam}
                  onChangeText={setNewTeam}
                  placeholder="Team name"
                  onSubmitEditing={addTeam}
                />
                <TouchableOpacity
                  onPress={addTeam}
                  disabled={addingTeam || !newTeam.trim()}
                  style={styles.addTeamBtn}
                >
                  {addingTeam ? (
                    <ActivityIndicator color={colors.blue} size="small" />
                  ) : (
                    <Plus size={16} color={colors.blue} strokeWidth={2.5} />
                  )}
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.genRow}>
              {!tournament.fixturesGenerated ? (
                <TouchableOpacity
                  onPress={() => generateFixtures(false)}
                  disabled={tournament.teams.length < 2 || generating}
                  style={[
                    styles.genBtn,
                    (tournament.teams.length < 2 || generating) && {
                      opacity: 0.5,
                    },
                  ]}
                >
                  {generating ? (
                    <ActivityIndicator color={colors.white} size="small" />
                  ) : (
                    <Shuffle size={16} color={colors.white} strokeWidth={2.5} />
                  )}
                  <Text style={styles.genBtnText}>Generate Fixtures</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={() => generateFixtures(true)}
                  disabled={generating}
                  style={styles.regenBtn}
                >
                  {generating ? (
                    <ActivityIndicator color={colors.black} size="small" />
                  ) : (
                    <RotateCcw
                      size={16}
                      color={colors.black}
                      strokeWidth={2.5}
                    />
                  )}
                  <Text style={styles.regenBtnText}>Regenerate Fixtures</Text>
                </TouchableOpacity>
              )}
            </View>
            {tournament.teams.length < 2 && (
              <Text style={styles.emptyHint}>
                Add at least 2 teams to generate fixtures.
              </Text>
            )}
          </Card>
        )}

        {roundsGrouped.map(({ round, label, list }) => (
          <View key={round} style={{ marginTop: 16 }}>
            <Text style={styles.roundLabel}>{label}</Text>
            {list.map((f: any) => (
              <FixtureRow key={f._id} fixture={f} onSave={recordResult} />
            ))}
          </View>
        ))}

        {!isParent && (
          <TouchableOpacity onPress={deleteTournament} style={styles.deleteBtn}>
            <Trash size={14} color={colors.red} strokeWidth={2.5} />
            <Text style={styles.deleteBtnText}>Delete Tournament</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  title: {
    fontFamily: FONT.bold,
    fontWeight: '800',
    fontSize: 22,
    color: colors.black,
  },
  subtitle: {
    fontFamily: FONT.medium,
    fontSize: 13,
    color: colors.muted,
    marginTop: 4,
  },
  teamChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  teamChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 2,
    borderColor: colors.black,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  teamChipText: {
    fontFamily: FONT.bold,
    fontWeight: '700',
    fontSize: 12,
    color: colors.black,
  },
  emptyHint: { fontFamily: FONT.medium, fontSize: 12, color: colors.muted },
  regRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: '#0000001A',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  regName: {
    fontFamily: FONT.bold,
    fontWeight: '700',
    fontSize: 13,
    color: colors.black,
  },
  regBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 2,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  regBtnAdd: { backgroundColor: colors.blue, borderColor: colors.black },
  regBtnRemove: { backgroundColor: colors.white, borderColor: colors.red },
  regBtnAddText: {
    color: colors.white,
    fontFamily: FONT.bold,
    fontWeight: '700',
    fontSize: 12,
  },
  regBtnRemoveText: {
    color: colors.red,
    fontFamily: FONT.bold,
    fontWeight: '700',
    fontSize: 12,
  },
  teamInput: {
    flex: 1,
    borderWidth: 2,
    borderColor: colors.black,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    fontFamily: FONT.medium,
  },
  addTeamBtn: {
    width: 40,
    borderWidth: 2,
    borderColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  genRow: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#0000001A',
  },
  genBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.blue,
    borderWidth: 2,
    borderColor: colors.black,
    paddingVertical: 12,
  },
  genBtnText: {
    color: colors.white,
    fontFamily: FONT.bold,
    fontWeight: '800',
    fontSize: 13,
    textTransform: 'uppercase',
  },
  regenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.black,
    paddingVertical: 12,
  },
  regenBtnText: {
    color: colors.black,
    fontFamily: FONT.bold,
    fontWeight: '800',
    fontSize: 13,
    textTransform: 'uppercase',
  },
  roundLabel: {
    fontFamily: FONT.bold,
    fontWeight: '700',
    fontSize: 11,
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 2,
    borderColor: '#0000001A',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 6,
  },
  teamRowWinner: { borderColor: colors.green, backgroundColor: '#00C48C1A' },
  teamName: {
    fontFamily: FONT.medium,
    fontSize: 13,
    color: colors.black,
    flex: 1,
  },
  teamNameWinner: { fontFamily: FONT.bold, fontWeight: '700' },
  teamScore: {
    fontFamily: FONT.bold,
    fontWeight: '800',
    fontSize: 13,
    color: colors.black,
  },
  byeHint: {
    fontFamily: FONT.medium,
    fontSize: 11,
    color: colors.muted,
    marginTop: 2,
  },
  recordBtn: {
    marginTop: 6,
    borderWidth: 2,
    borderColor: colors.black,
    paddingVertical: 8,
    alignItems: 'center',
  },
  recordBtnText: {
    fontFamily: FONT.bold,
    fontWeight: '700',
    fontSize: 12,
    color: colors.black,
  },
  scoreInput: {
    flex: 1,
    borderWidth: 2,
    borderColor: colors.black,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    fontFamily: FONT.medium,
  },
  saveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.blue,
    borderWidth: 2,
    borderColor: colors.black,
    paddingVertical: 9,
  },
  saveBtnText: {
    color: colors.white,
    fontFamily: FONT.bold,
    fontWeight: '700',
    fontSize: 12,
  },
  cancelBtn: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.black,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 2,
    borderColor: colors.red,
    paddingVertical: 12,
    marginTop: 20,
  },
  deleteBtnText: {
    color: colors.red,
    fontFamily: FONT.bold,
    fontWeight: '700',
    fontSize: 13,
  },
});
