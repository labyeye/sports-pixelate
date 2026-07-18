import { useEffect, useMemo, useState } from "react";
import { Shuffle, RotateCcw, Loader2, Check, X, Trophy } from "lucide-react";
import { eventAPI } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { Event, EventFixture } from "@/types/hrms";

interface Props {
  event: Event;
  onChanged: () => void;
}

function knockoutRoundLabel(roundIndex: number, totalRounds: number): string {
  const fromEnd = totalRounds - roundIndex; // 1 = final, 2 = semifinal, ...
  if (fromEnd === 1) return "Final";
  if (fromEnd === 2) return "Semifinal";
  if (fromEnd === 3) return "Quarterfinal";
  return `Round ${roundIndex + 1}`;
}

// Mirrors backend/services/fixtureService.js#previewRounds — describes the
// round-by-round shape an event will have once fixtures are generated,
// purely from the current team count and format (no fixtures needed yet).
// Kept as a client-side duplicate rather than a network round-trip since
// it's a pure, cheap calculation used only for a preview before generation.
function previewRounds(
  teamCount: number,
  format: string,
): { round: number; label: string; matchCount: number; byes: number }[] {
  if (!teamCount || teamCount < 2) return [];

  if (format === "round_robin") {
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
  const preview: { round: number; label: string; matchCount: number; byes: number }[] = [];
  let matchCount = size / 2;
  for (let roundIdx = 0; roundIdx < totalRounds; roundIdx++) {
    preview.push({
      round: roundIdx + 1,
      label: knockoutRoundLabel(roundIdx, totalRounds),
      matchCount,
      byes: roundIdx === 0 ? byesNeeded : 0,
    });
    matchCount /= 2;
  }
  return preview;
}

function FixtureCard({
  fixture,
  onSave,
}: {
  fixture: EventFixture;
  onSave: (id: string, scoreA: number, scoreB: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [scoreA, setScoreA] = useState(String(fixture.scoreA ?? ""));
  const [scoreB, setScoreB] = useState(String(fixture.scoreB ?? ""));
  const [saving, setSaving] = useState(false);

  const bothSet = !!fixture.teamA.team && !!fixture.teamB.team;
  const canEdit = bothSet && fixture.status !== "bye";

  const save = async () => {
    if (scoreA === "" || scoreB === "" || Number(scoreA) === Number(scoreB)) return;
    setSaving(true);
    try {
      await onSave(fixture._id, Number(scoreA), Number(scoreB));
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border-2 border-black bg-white p-3 w-56 shrink-0">
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">{fixture.roundLabel}</p>
      {[
        { slot: fixture.teamA, isWinner: fixture.winner === "A", score: fixture.scoreA },
        { slot: fixture.teamB, isWinner: fixture.winner === "B", score: fixture.scoreB },
      ].map((row, i) => (
        <div
          key={i}
          className={cn(
            "flex items-center justify-between px-2 py-1.5 border-2",
            row.isWinner ? "border-[#00C48C] bg-[#00C48C]/10" : "border-black/10",
          )}
        >
          <span className={cn("text-xs truncate", row.isWinner ? "font-bold text-black" : "text-black/80")}>
            {row.slot.name || (fixture.status === "bye" ? "—" : "TBD")}
          </span>
          {fixture.status === "completed" && <span className="text-xs font-bold ml-2">{row.score}</span>}
        </div>
      ))}

      {fixture.status === "bye" && <p className="text-[10px] text-muted-foreground mt-1.5">Bye — advances automatically</p>}

      {canEdit && fixture.status === "scheduled" && !editing && (
        <button
          onClick={() => setEditing(true)}
          className="w-full mt-2 text-[11px] font-bold border-2 border-black py-1 hover:bg-gray-50"
        >
          Record Result
        </button>
      )}

      {editing && (
        <div className="mt-2 space-y-1.5">
          <div className="flex gap-1.5">
            <input
              type="number"
              value={scoreA}
              onChange={(e) => setScoreA(e.target.value)}
              placeholder="Score"
              className="w-1/2 border-2 border-black px-1.5 py-1 text-xs outline-none"
            />
            <input
              type="number"
              value={scoreB}
              onChange={(e) => setScoreB(e.target.value)}
              placeholder="Score"
              className="w-1/2 border-2 border-black px-1.5 py-1 text-xs outline-none"
            />
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={save}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-1 bg-[#024BAB] text-white border-2 border-black py-1 text-[11px] font-bold disabled:opacity-60"
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Save
            </button>
            <button onClick={() => setEditing(false)} className="px-2 border-2 border-black text-[11px] font-bold">
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Sports-only, gated on there being teams. If activityCategory isn't sports
// this tab isn't rendered at all (see EventDetailPage tab list).
export function FixturesTab({ event, onChanged }: Props) {
  const { toast } = useToast();
  const [fixtures, setFixtures] = useState<EventFixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const load = async () => {
    try {
      const r: any = await eventAPI.getFixtures(event._id);
      setFixtures(r.data || []);
    } catch {
      setFixtures([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event._id]);

  const generateFixtures = async (regenerate: boolean) => {
    if (regenerate && !confirm("Regenerate fixtures? All recorded results will be lost.")) return;
    setGenerating(true);
    try {
      const r: any = await eventAPI.generateFixtures(event._id, { regenerate, shuffle: true });
      setFixtures(r.data || []);
      onChanged();
      toast({ title: "Fixtures generated" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const recordResult = async (fixtureId: string, scoreA: number, scoreB: number) => {
    try {
      await eventAPI.recordResult(fixtureId, { scoreA, scoreB });
      await load();
      onChanged();
      toast({ title: "Result saved" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const roundsPreview = useMemo(
    () => previewRounds(event.teams.length, event.format),
    [event.teams.length, event.format],
  );

  const roundsGrouped = useMemo(() => {
    const map = new Map<number, EventFixture[]>();
    fixtures.forEach((f) => {
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

  const formatSupported = event.format === "knockout" || event.format === "round_robin";

  if (loading) return <p className="text-sm text-muted-foreground">Loading fixtures...</p>;

  return (
    <div className="space-y-4">
      {!formatSupported && (
        <div className="border-2 border-black bg-white p-4 text-xs text-muted-foreground">
          Fixture generation is coming soon for the "{event.format}" format. Only Knockout and Round Robin support
          automatic bracket generation today.
        </div>
      )}

      {formatSupported && (
        <div className="border-2 border-black bg-white p-4">
          {!event.fixturesGenerated && roundsPreview.length > 0 && (
            <div className="mb-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Structure Preview ({roundsPreview.length} round{roundsPreview.length === 1 ? "" : "s"})
              </h4>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {roundsPreview.map((r) => (
                  <div key={r.round} className="border-2 border-black/20 px-3 py-2 shrink-0 min-w-32">
                    <p className="text-xs font-bold text-black">{r.label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {r.matchCount} match{r.matchCount === 1 ? "" : "es"}
                      {r.byes > 0 ? ` · ${r.byes} bye${r.byes === 1 ? "" : "s"}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {!event.fixturesGenerated ? (
            <button
              onClick={() => generateFixtures(false)}
              disabled={event.teams.length < 2 || generating}
              className="flex items-center gap-2 bg-[#024BAB] text-white border-2 border-black px-4 py-2 font-bold text-sm uppercase disabled:opacity-50"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shuffle className="w-4 h-4" />} Generate Fixtures
            </button>
          ) : (
            <button
              onClick={() => generateFixtures(true)}
              disabled={generating}
              className="flex items-center gap-2 bg-white border-2 border-black px-4 py-2 font-bold text-sm uppercase disabled:opacity-50 hover:bg-gray-50"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />} Regenerate Fixtures
            </button>
          )}
          {event.teams.length < 2 && (
            <p className="text-xs text-muted-foreground mt-2">Add at least 2 teams to generate fixtures.</p>
          )}
        </div>
      )}

      {roundsGrouped.length > 0 ? (
        <div className="border-2 border-black bg-white p-4">
          <h3 className="font-bold text-sm mb-3">Fixtures</h3>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {roundsGrouped.map(({ round, label, list }) => (
              <div key={round} className="flex flex-col gap-3">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
                <div className="flex flex-col gap-3">
                  {list.map((f) => (
                    <FixtureCard key={f._id} fixture={f} onSave={recordResult} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        formatSupported && (
          <div className="border-2 border-black bg-white p-12 flex flex-col items-center justify-center">
            <Trophy className="w-10 h-10 text-muted-foreground/30 mb-3" />
            <p className="font-bold text-black">No fixtures yet</p>
            <p className="text-sm text-muted-foreground mt-1">Generate fixtures once teams are added.</p>
          </div>
        )
      )}
    </div>
  );
}
