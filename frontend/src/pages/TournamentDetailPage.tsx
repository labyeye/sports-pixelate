import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import nesthrlogo from "../../assets/nesthr.png";
import { AppLayout } from "@/components/layout/AppLayout";
import { tournamentAPI, studentAPI } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Trophy,
  Plus,
  X,
  Loader2,
  Users,
  Trash2,
  Shuffle,
  RotateCcw,
  Check,
  Trash,
  UserPlus,
  UserMinus,
} from "lucide-react";

interface Team {
  _id: string;
  name: string;
}

interface Registration {
  _id: string;
  student: { _id: string; firstName: string; lastName: string; sport: string };
  registeredAt: string;
}

interface Tournament {
  _id: string;
  name: string;
  sport: string;
  format: "knockout" | "round_robin";
  startDate?: string;
  endDate?: string;
  venue?: string;
  teams: Team[];
  registrations: Registration[];
  registrationOpen: boolean;
  registrationCount?: number;
  status: "draft" | "upcoming" | "ongoing" | "completed";
  fixturesGenerated: boolean;
}

// Parent-facing panel: register/unregister their own children (filtered to
// this tournament's sport) instead of the staff bracket-management tools.
function RegistrationPanel({ tournament, onChanged }: { tournament: Tournament; onChanged: () => void }) {
  const { toast } = useToast();
  const [children, setChildren] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    studentAPI
      .getAll()
      .then((r: any) => setChildren(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const registeredIds = new Set(tournament.registrations.map((r) => r.student._id));
  const eligible = children.filter((c) => c.sport === tournament.sport);

  const toggle = async (studentId: string, isRegistered: boolean) => {
    setBusyId(studentId);
    try {
      if (isRegistered) await tournamentAPI.unregister(tournament._id, studentId);
      else await tournamentAPI.register(tournament._id, studentId);
      onChanged();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return null;

  return (
    <div className="border-2 border-black bg-white p-4 mb-6">
      <h3 className="font-bold text-sm mb-3">Register</h3>
      {eligible.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          None of your children are enrolled in {tournament.sport} to register for this tournament.
        </p>
      ) : (
        <div className="space-y-2">
          {eligible.map((c) => {
            const isRegistered = registeredIds.has(c._id);
            const busy = busyId === c._id;
            return (
              <div key={c._id} className="flex items-center justify-between border-2 border-black/10 px-3 py-2">
                <span className="text-sm font-bold text-black">
                  {c.firstName} {c.lastName}
                </span>
                <button
                  onClick={() => toggle(c._id, isRegistered)}
                  disabled={busy || (!isRegistered && !tournament.registrationOpen)}
                  className={cn(
                    "flex items-center gap-1.5 border-2 px-3 py-1.5 text-xs font-bold disabled:opacity-50",
                    isRegistered
                      ? "border-red-500 text-red-600 bg-white hover:bg-red-50"
                      : "border-black bg-[#024BAB] text-white hover:bg-[#01368A]",
                  )}
                >
                  {busy ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : isRegistered ? (
                    <UserMinus className="w-3 h-3" />
                  ) : (
                    <UserPlus className="w-3 h-3" />
                  )}
                  {isRegistered ? "Unregister" : "Register"}
                </button>
              </div>
            );
          })}
        </div>
      )}
      {!tournament.registrationOpen && (
        <p className="text-xs text-muted-foreground mt-2">Registration is closed for this tournament.</p>
      )}
    </div>
  );
}

interface Slot {
  team: string | null;
  name: string | null;
}

interface Fixture {
  _id: string;
  round: number;
  roundLabel: string;
  matchIndex: number;
  teamA: Slot;
  teamB: Slot;
  scoreA?: number;
  scoreB?: number;
  winner?: "A" | "B" | null;
  status: "scheduled" | "completed" | "bye";
}

function FixtureCard({
  fixture,
  onSave,
}: {
  fixture: Fixture;
  onSave: (id: string, scoreA: number, scoreB: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [scoreA, setScoreA] = useState(String(fixture.scoreA ?? ""));
  const [scoreB, setScoreB] = useState(String(fixture.scoreB ?? ""));
  const [saving, setSaving] = useState(false);

  const bothSet = !!fixture.teamA.team && !!fixture.teamB.team;
  const canEdit = bothSet && fixture.status !== "bye";

  const save = async () => {
    if (scoreA === "" || scoreB === "" || Number(scoreA) === Number(scoreB))
      return;
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
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
        {fixture.roundLabel}
      </p>
      {[
        {
          slot: fixture.teamA,
          isWinner: fixture.winner === "A",
          score: fixture.scoreA,
        },
        {
          slot: fixture.teamB,
          isWinner: fixture.winner === "B",
          score: fixture.scoreB,
        },
      ].map((row, i) => (
        <div
          key={i}
          className={cn(
            "flex items-center justify-between px-2 py-1.5 border-2",
            row.isWinner
              ? "border-[#00C48C] bg-[#00C48C]/10"
              : "border-black/10",
          )}
        >
          <span
            className={cn(
              "text-xs truncate",
              row.isWinner ? "font-bold text-black" : "text-black/80",
            )}
          >
            {row.slot.name || (fixture.status === "bye" ? "—" : "TBD")}
          </span>
          {fixture.status === "completed" && (
            <span className="text-xs font-bold ml-2">{row.score}</span>
          )}
        </div>
      ))}

      {fixture.status === "bye" && (
        <p className="text-[10px] text-muted-foreground mt-1.5">
          Bye — advances automatically
        </p>
      )}

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
              {saving ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Check className="w-3 h-3" />
              )}{" "}
              Save
            </button>
            <button
              onClick={() => setEditing(false)}
              className="px-2 border-2 border-black text-[11px] font-bold"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TournamentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const isParent = user?.role === "parent";
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [fixtures, setFixtures] = useState<Fixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTeam, setNewTeam] = useState("");
  const [addingTeam, setAddingTeam] = useState(false);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [tRes, fRes] = await Promise.all([
        tournamentAPI.getOne(id),
        tournamentAPI.getFixtures(id).catch(() => ({ data: [] })),
      ]);
      setTournament(tRes.data);
      setFixtures(fRes.data);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const addTeam = async () => {
    if (!id || !newTeam.trim() || addingTeam) return;
    setAddingTeam(true);
    try {
      const r = await tournamentAPI.addTeam(id, newTeam.trim());
      setTournament(r.data);
      setNewTeam("");
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setAddingTeam(false);
    }
  };

  const removeTeam = async (teamId: string) => {
    if (!id) return;
    try {
      const r = await tournamentAPI.removeTeam(id, teamId);
      setTournament(r.data);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const generateFixtures = async (regenerate: boolean) => {
    if (!id) return;
    if (
      regenerate &&
      !confirm("Regenerate fixtures? All recorded results will be lost.")
    )
      return;
    setGenerating(true);
    try {
      const r = await tournamentAPI.generateFixtures(id, {
        regenerate,
        shuffle: true,
      });
      setFixtures(r.data);
      const tRes = await tournamentAPI.getOne(id);
      setTournament(tRes.data);
      toast({ title: "Fixtures generated" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const recordResult = async (
    fixtureId: string,
    scoreA: number,
    scoreB: number,
  ) => {
    try {
      await tournamentAPI.recordResult(fixtureId, { scoreA, scoreB });
      const r = await tournamentAPI.getFixtures(id!);
      setFixtures(r.data);
      toast({ title: "Result saved" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const deleteTournament = async () => {
    if (!id || !confirm("Delete this tournament and all its fixtures?")) return;
    try {
      await tournamentAPI.delete(id);
      navigate("/tournaments");
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const roundsGrouped = useMemo(() => {
    const map = new Map<number, Fixture[]>();
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

  if (loading || !tournament) {
    return (
      <AppLayout title="Tournament">
        <div className="flex items-center justify-center h-64">
          <img src={nesthrlogo} alt="NestSports" className="h-16 w-auto" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title={tournament.name}>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="font-display font-bold text-2xl text-black flex items-center gap-2">
            <Trophy className="w-6 h-6 text-[#024BAB]" /> {tournament.name}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tournament.sport} ·{" "}
            {tournament.format === "knockout" ? "Knockout" : "Round Robin"}
            {tournament.venue ? ` · ${tournament.venue}` : ""}
          </p>
        </div>
        {!isParent && (
          <button
            onClick={deleteTournament}
            className="border-2 border-black bg-white px-3 py-2 text-xs font-bold flex items-center gap-1.5 hover:bg-red-50 hover:border-red-500 hover:text-red-600 transition-colors"
          >
            <Trash className="w-3.5 h-3.5" /> Delete Tournament
          </button>
        )}
      </div>

      {isParent ? (
        <RegistrationPanel tournament={tournament} onChanged={load} />
      ) : (
        <div className="border-2 border-black bg-white p-4 mb-6">
          <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
            <Users className="w-4 h-4" /> Teams ({tournament.teams.length})
          </h3>
          <div className="flex flex-wrap gap-2 mb-3">
            {tournament.teams.map((t) => (
              <span
                key={t._id}
                className="flex items-center gap-1.5 border-2 border-black px-2.5 py-1 text-xs font-bold"
              >
                {t.name}
                {!tournament.fixturesGenerated && (
                  <button
                    onClick={() => removeTeam(t._id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </span>
            ))}
            {tournament.teams.length === 0 && (
              <p className="text-xs text-muted-foreground">No teams added yet</p>
            )}
          </div>
          {!tournament.fixturesGenerated && (
            <div className="flex gap-2">
              <input
                value={newTeam}
                onChange={(e) => setNewTeam(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addTeam()}
                placeholder="Team name"
                className="flex-1 border-2 border-black px-3 py-2 text-sm font-medium outline-none max-w-xs"
              />
              <button
                onClick={addTeam}
                disabled={addingTeam || !newTeam.trim()}
                className="border-2 border-black bg-white px-3 py-2 text-sm font-bold flex items-center gap-1 disabled:opacity-50"
              >
                {addingTeam ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}{" "}
                Add
              </button>
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-black/10">
            {!tournament.fixturesGenerated ? (
              <button
                onClick={() => generateFixtures(false)}
                disabled={tournament.teams.length < 2 || generating}
                className="flex items-center gap-2 bg-[#024BAB] text-white border-2 border-black px-4 py-2 font-bold text-sm uppercase disabled:opacity-50"
              >
                {generating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Shuffle className="w-4 h-4" />
                )}{" "}
                Generate Fixtures
              </button>
            ) : (
              <button
                onClick={() => generateFixtures(true)}
                disabled={generating}
                className="flex items-center gap-2 bg-white border-2 border-black px-4 py-2 font-bold text-sm uppercase disabled:opacity-50 hover:bg-gray-50"
              >
                {generating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RotateCcw className="w-4 h-4" />
                )}{" "}
                Regenerate Fixtures
              </button>
            )}
            {tournament.teams.length < 2 && (
              <p className="text-xs text-muted-foreground mt-2">
                Add at least 2 teams to generate fixtures.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Fixtures */}
      {roundsGrouped.length > 0 && (
        <div className="border-2 border-black bg-white p-4">
          <h3 className="font-bold text-sm mb-3">Fixtures</h3>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {roundsGrouped.map(({ round, label, list }) => (
              <div key={round} className="flex flex-col gap-3">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {label}
                </p>
                <div className="flex flex-col gap-3">
                  {list.map((f) => (
                    <FixtureCard
                      key={f._id}
                      fixture={f}
                      onSave={recordResult}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
