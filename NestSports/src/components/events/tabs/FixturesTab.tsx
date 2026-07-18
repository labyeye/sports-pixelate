import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, Alert, StyleSheet } from 'react-native';
import { Shuffle, RotateCcw, Check, X } from 'lucide-react-native';
import { Card, useToast } from '../../ui';
import { colors, FONT } from '../../../theme/colors';
import { eventAPI } from '../../../api/client';

function knockoutRoundLabel(roundIndex: number, totalRounds: number): string {
  const fromEnd = totalRounds - roundIndex;
  if (fromEnd === 1) return 'Final';
  if (fromEnd === 2) return 'Semifinal';
  if (fromEnd === 3) return 'Quarterfinal';
  return `Round ${roundIndex + 1}`;
}

// Mirrors backend/services/fixtureService.js#previewRounds — describes the
// round-by-round shape an event will have once fixtures are generated,
// purely from the current team count and format (no fixtures needed yet).
function previewRounds(teamCount: number, format: string) {
  if (!teamCount || teamCount < 2) return [];
  if (format === 'round_robin') {
    const n = teamCount % 2 !== 0 ? teamCount + 1 : teamCount;
    const totalRounds = n - 1;
    const matchesPerRound = n / 2 - (teamCount % 2 !== 0 ? 1 : 0);
    return Array.from({ length: totalRounds }, (_, i) => ({
      round: i + 1,
      label: `Round ${i + 1}`,
      matchCount: matchesPerRound,
      byes: teamCount % 2 !== 0 ? 1 : 0,
    }));
  }
  let size = 1;
  while (size < teamCount) size *= 2;
  const totalRounds = Math.log2(size);
  const byesNeeded = size - teamCount;
  const preview: any[] = [];
  let matchCount = size / 2;
  for (let roundIdx = 0; roundIdx < totalRounds; roundIdx++) {
    preview.push({ round: roundIdx + 1, label: knockoutRoundLabel(roundIdx, totalRounds), matchCount, byes: roundIdx === 0 ? byesNeeded : 0 });
    matchCount /= 2;
  }
  return preview;
}

function FixtureRow({ fixture, onSave }: { fixture: any; onSave: (id: string, scoreA: number, scoreB: number) => Promise<void> }) {
  const { toast } = useToast() as any;
  const [editing, setEditing] = useState(false);
  const [scoreA, setScoreA] = useState(fixture.scoreA !== undefined ? String(fixture.scoreA) : '');
  const [scoreB, setScoreB] = useState(fixture.scoreB !== undefined ? String(fixture.scoreB) : '');
  const [saving, setSaving] = useState(false);

  const bothSet = !!fixture.teamA?.team && !!fixture.teamB?.team;
  const canRecord = bothSet && fixture.status === 'scheduled';

  const save = async () => {
    if (scoreA === '' || scoreB === '' || Number(scoreA) === Number(scoreB)) {
      toast.error('Enter two different scores');
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
        { slot: fixture.teamA, isWinner: fixture.winner === 'A', score: fixture.scoreA },
        { slot: fixture.teamB, isWinner: fixture.winner === 'B', score: fixture.scoreB },
      ].map((row, i) => (
        <View key={i} style={[styles.teamRow, row.isWinner && styles.teamRowWinner]}>
          <Text style={[styles.teamName, row.isWinner && styles.teamNameWinner]} numberOfLines={1}>
            {row.slot?.name || (fixture.status === 'bye' ? '—' : 'TBD')}
          </Text>
          {fixture.status === 'completed' && <Text style={styles.teamScore}>{row.score}</Text>}
        </View>
      ))}

      {fixture.status === 'bye' && <Text style={styles.byeHint}>Bye — advances automatically</Text>}

      {canRecord && !editing && (
        <TouchableOpacity onPress={() => setEditing(true)} style={styles.recordBtn}>
          <Text style={styles.recordBtnText}>Record Result</Text>
        </TouchableOpacity>
      )}

      {editing && (
        <View style={{ marginTop: 8 }}>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
            <TextInput style={styles.scoreInput} value={scoreA} onChangeText={setScoreA} placeholder="Score" keyboardType="numeric" />
            <TextInput style={styles.scoreInput} value={scoreB} onChangeText={setScoreB} placeholder="Score" keyboardType="numeric" />
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity onPress={save} disabled={saving} style={styles.saveBtn}>
              {saving ? <ActivityIndicator color={colors.white} size="small" /> : (
                <>
                  <Check size={14} color={colors.white} strokeWidth={2.5} />
                  <Text style={styles.saveBtnText}>Save</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setEditing(false)} style={styles.cancelBtn}>
              <X size={14} color={colors.black} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </Card>
  );
}

export default function FixturesTab({ event, onChanged }: { event: any; onChanged: () => void }) {
  const { toast } = useToast() as any;
  const [fixtures, setFixtures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const load = () => {
    setLoading(true);
    eventAPI
      .getFixtures(event._id)
      .then((r: any) => setFixtures(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, [event._id]);

  const roundsPreview = useMemo(() => previewRounds(event.teams?.length ?? 0, event.format ?? 'knockout'), [event.teams?.length, event.format]);

  const roundsGrouped = useMemo(() => {
    const map = new Map<number, any[]>();
    fixtures.forEach(f => {
      if (!map.has(f.round)) map.set(f.round, []);
      map.get(f.round)!.push(f);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([round, list]) => ({ round, label: list[0].roundLabel, list: list.sort((a, b) => a.matchIndex - b.matchIndex) }));
  }, [fixtures]);

  const generateFixtures = (regenerate: boolean) => {
    const run = async () => {
      setGenerating(true);
      try {
        const res: any = await eventAPI.generateFixtures(event._id, { regenerate, shuffle: true });
        setFixtures(res.data || []);
        onChanged();
      } catch (e: any) {
        toast.error(e?.message || 'Could not generate fixtures');
      } finally {
        setGenerating(false);
      }
    };
    if (regenerate) {
      Alert.alert('Regenerate fixtures?', 'All recorded results will be lost.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Regenerate', style: 'destructive', onPress: run },
      ]);
    } else {
      run();
    }
  };

  const recordResult = async (fixtureId: string, scoreA: number, scoreB: number) => {
    try {
      await eventAPI.recordResult(fixtureId, { scoreA, scoreB });
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Could not save result');
    }
  };

  return (
    <View>
      <Card>
        {!event.fixturesGenerated && roundsPreview.length > 0 && (
          <View style={styles.previewSection}>
            <Text style={styles.previewTitle}>
              Structure Preview ({roundsPreview.length} round{roundsPreview.length === 1 ? '' : 's'})
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {roundsPreview.map((r: any) => (
                  <View key={r.round} style={styles.previewChip}>
                    <Text style={styles.previewChipLabel}>{r.label}</Text>
                    <Text style={styles.previewChipMeta}>
                      {r.matchCount} match{r.matchCount === 1 ? '' : 'es'}
                      {r.byes > 0 ? ` · ${r.byes} bye${r.byes === 1 ? '' : 's'}` : ''}
                    </Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        )}
        <View style={styles.genRow}>
          {!event.fixturesGenerated ? (
            <TouchableOpacity
              onPress={() => generateFixtures(false)}
              disabled={event.teams.length < 2 || generating}
              style={[styles.genBtn, (event.teams.length < 2 || generating) && { opacity: 0.5 }]}
            >
              {generating ? <ActivityIndicator color={colors.white} size="small" /> : <Shuffle size={16} color={colors.white} strokeWidth={2.5} />}
              <Text style={styles.genBtnText}>Generate Fixtures</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => generateFixtures(true)} disabled={generating} style={styles.regenBtn}>
              {generating ? <ActivityIndicator color={colors.black} size="small" /> : <RotateCcw size={16} color={colors.black} strokeWidth={2.5} />}
              <Text style={styles.regenBtnText}>Regenerate Fixtures</Text>
            </TouchableOpacity>
          )}
        </View>
        {event.teams.length < 2 && <Text style={styles.emptyHint}>Add at least 2 teams to generate fixtures.</Text>}
      </Card>

      {!loading &&
        roundsGrouped.map(({ round, label, list }) => (
          <View key={round} style={{ marginTop: 12 }}>
            <Text style={styles.roundLabel}>{label}</Text>
            {list.map((f: any) => (
              <FixtureRow key={f._id} fixture={f} onSave={recordResult} />
            ))}
          </View>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  emptyHint: { fontFamily: FONT.medium, fontSize: 12, color: colors.muted },
  previewSection: { marginBottom: 12 },
  previewTitle: { fontFamily: FONT.bold, fontWeight: '700', fontSize: 11, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 8 },
  previewChip: { borderWidth: 2, borderColor: '#00000033', paddingHorizontal: 10, paddingVertical: 8, minWidth: 110 },
  previewChipLabel: { fontFamily: FONT.bold, fontWeight: '700', fontSize: 12, color: colors.black },
  previewChipMeta: { fontFamily: FONT.medium, fontSize: 11, color: colors.muted, marginTop: 2 },
  genRow: {},
  genBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.blue, borderWidth: 2, borderColor: colors.black, paddingVertical: 12 },
  genBtnText: { color: colors.white, fontFamily: FONT.bold, fontWeight: '800', fontSize: 13, textTransform: 'uppercase' },
  regenBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.white, borderWidth: 2, borderColor: colors.black, paddingVertical: 12 },
  regenBtnText: { color: colors.black, fontFamily: FONT.bold, fontWeight: '800', fontSize: 13, textTransform: 'uppercase' },
  roundLabel: { fontFamily: FONT.bold, fontWeight: '700', fontSize: 11, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 8 },
  teamRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 2, borderColor: '#0000001A', paddingHorizontal: 10, paddingVertical: 8, marginBottom: 6 },
  teamRowWinner: { borderColor: colors.green, backgroundColor: '#00C48C1A' },
  teamName: { fontFamily: FONT.medium, fontSize: 13, color: colors.black, flex: 1 },
  teamNameWinner: { fontFamily: FONT.bold, fontWeight: '700' },
  teamScore: { fontFamily: FONT.bold, fontWeight: '800', fontSize: 13, color: colors.black },
  byeHint: { fontFamily: FONT.medium, fontSize: 11, color: colors.muted, marginTop: 2 },
  recordBtn: { marginTop: 6, borderWidth: 2, borderColor: colors.black, paddingVertical: 8, alignItems: 'center' },
  recordBtnText: { fontFamily: FONT.bold, fontWeight: '700', fontSize: 12, color: colors.black },
  scoreInput: { flex: 1, borderWidth: 2, borderColor: colors.black, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, fontFamily: FONT.medium },
  saveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.blue, borderWidth: 2, borderColor: colors.black, paddingVertical: 9 },
  saveBtnText: { color: colors.white, fontFamily: FONT.bold, fontWeight: '700', fontSize: 12 },
  cancelBtn: { width: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.black },
});
