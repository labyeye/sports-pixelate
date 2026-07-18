import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Card, SectionTitle, EmptyState } from '../../ui';
import { colors, FONT } from '../../../theme/colors';
import { eventAPI } from '../../../api/client';
import { ListOrdered } from 'lucide-react-native';

// Sports + round_robin only — derived client-side from fixtures, no new
// endpoint needed. Knockout has no points table.
export default function PointsTableTab({ event }: { event: any }) {
  const [fixtures, setFixtures] = useState<any[]>([]);

  useEffect(() => {
    eventAPI
      .getFixtures(event._id)
      .then((r: any) => setFixtures(r.data || []))
      .catch(() => {});
  }, [event._id]);

  const table = useMemo(() => {
    const stats = new Map<string, { name: string; played: number; won: number; lost: number; points: number }>();
    const ensure = (id: string, name: string) => {
      if (!stats.has(id)) stats.set(id, { name, played: 0, won: 0, lost: 0, points: 0 });
      return stats.get(id)!;
    };
    fixtures
      .filter((f: any) => f.status === 'completed')
      .forEach((f: any) => {
        if (!f.teamA?.team || !f.teamB?.team) return;
        const a = ensure(f.teamA.team, f.teamA.name);
        const b = ensure(f.teamB.team, f.teamB.name);
        a.played++;
        b.played++;
        if (f.winner === 'A') {
          a.won++;
          a.points += 3;
          b.lost++;
        } else if (f.winner === 'B') {
          b.won++;
          b.points += 3;
          a.lost++;
        }
      });
    return Array.from(stats.values()).sort((x, y) => y.points - x.points || y.won - x.won);
  }, [fixtures]);

  if (event.format !== 'round_robin') {
    return (
      <Card>
        <EmptyState title="Not applicable" sub="Points tables are only available for Round Robin events." icon={ListOrdered} />
      </Card>
    );
  }

  return (
    <Card>
      <SectionTitle title="Points Table" />
      {table.length === 0 ? (
        <Text style={styles.emptyHint}>No results recorded yet.</Text>
      ) : (
        <>
          <View style={[styles.row, styles.headerRow]}>
            <Text style={[styles.cell, styles.teamCell, styles.headerText]}>Team</Text>
            <Text style={[styles.cell, styles.headerText]}>P</Text>
            <Text style={[styles.cell, styles.headerText]}>W</Text>
            <Text style={[styles.cell, styles.headerText]}>L</Text>
            <Text style={[styles.cell, styles.headerText]}>Pts</Text>
          </View>
          {table.map((t, i) => (
            <View key={i} style={styles.row}>
              <Text style={[styles.cell, styles.teamCell]} numberOfLines={1}>
                {t.name}
              </Text>
              <Text style={styles.cell}>{t.played}</Text>
              <Text style={styles.cell}>{t.won}</Text>
              <Text style={styles.cell}>{t.lost}</Text>
              <Text style={[styles.cell, styles.pointsCell]}>{t.points}</Text>
            </View>
          ))}
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  emptyHint: { fontFamily: FONT.medium, fontSize: 12, color: colors.muted },
  row: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#0000001A', paddingVertical: 8 },
  headerRow: { borderBottomWidth: 2, borderBottomColor: colors.black },
  cell: { flex: 1, textAlign: 'center', fontFamily: FONT.medium, fontSize: 12, color: colors.black },
  teamCell: { flex: 2, textAlign: 'left', fontFamily: FONT.bold, fontWeight: '700' },
  headerText: { fontFamily: FONT.bold, fontWeight: '700', textTransform: 'uppercase', fontSize: 10, color: colors.muted },
  pointsCell: { fontFamily: FONT.bold, fontWeight: '800', color: colors.blue },
});
