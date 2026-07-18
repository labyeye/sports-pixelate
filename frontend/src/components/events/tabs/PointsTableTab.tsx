import { useEffect, useMemo, useState } from "react";
import { ListOrdered } from "lucide-react";
import { eventAPI } from "@/services/api";
import type { Event, EventFixture } from "@/types/hrms";

interface Props {
  event: Event;
}

interface Row {
  team: string;
  name: string;
  played: number;
  won: number;
  lost: number;
  drawn: number;
  points: number;
}

// Sports + round_robin only. Derived client-side from the fixtures list —
// no new backend endpoint, standard 2/1/0 (win/draw/loss) points scheme.
export function PointsTableTab({ event }: Props) {
  const [fixtures, setFixtures] = useState<EventFixture[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    eventAPI
      .getFixtures(event._id)
      .then((r: any) => setFixtures(r.data || []))
      .catch(() => setFixtures([]))
      .finally(() => setLoading(false));
  }, [event._id]);

  const rows = useMemo<Row[]>(() => {
    const table = new Map<string, Row>();
    event.teams.forEach((t) => {
      table.set(t._id, { team: t._id, name: t.name, played: 0, won: 0, lost: 0, drawn: 0, points: 0 });
    });
    fixtures
      .filter((f) => f.status === "completed" && f.teamA.team && f.teamB.team)
      .forEach((f) => {
        const a = table.get(f.teamA.team!);
        const b = table.get(f.teamB.team!);
        if (!a || !b) return;
        a.played += 1;
        b.played += 1;
        if (f.winner === "A") {
          a.won += 1;
          a.points += 2;
          b.lost += 1;
        } else if (f.winner === "B") {
          b.won += 1;
          b.points += 2;
          a.lost += 1;
        } else {
          a.drawn += 1;
          b.drawn += 1;
          a.points += 1;
          b.points += 1;
        }
      });
    return Array.from(table.values()).sort((x, y) => y.points - x.points);
  }, [fixtures, event.teams]);

  if (loading) return <p className="text-sm text-muted-foreground">Loading points table...</p>;

  if (event.format !== "round_robin") {
    return (
      <div className="border-2 border-black bg-white p-4 text-xs text-muted-foreground">
        Points table is only available for Round Robin events.
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="border-2 border-black bg-white p-12 flex flex-col items-center justify-center">
        <ListOrdered className="w-10 h-10 text-muted-foreground/30 mb-3" />
        <p className="font-bold text-black">No standings yet</p>
        <p className="text-sm text-muted-foreground mt-1">Standings appear once fixture results are recorded.</p>
      </div>
    );
  }

  return (
    <div className="border-2 border-black bg-white overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-black bg-gray-50">
            <th className="text-left px-3 py-2 text-xs font-bold uppercase">Team</th>
            <th className="text-center px-3 py-2 text-xs font-bold uppercase">P</th>
            <th className="text-center px-3 py-2 text-xs font-bold uppercase">W</th>
            <th className="text-center px-3 py-2 text-xs font-bold uppercase">D</th>
            <th className="text-center px-3 py-2 text-xs font-bold uppercase">L</th>
            <th className="text-center px-3 py-2 text-xs font-bold uppercase">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.team} className="border-b border-black/10">
              <td className="px-3 py-2 font-bold">{r.name}</td>
              <td className="text-center px-3 py-2">{r.played}</td>
              <td className="text-center px-3 py-2">{r.won}</td>
              <td className="text-center px-3 py-2">{r.drawn}</td>
              <td className="text-center px-3 py-2">{r.lost}</td>
              <td className="text-center px-3 py-2 font-bold text-[#024BAB]">{r.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
