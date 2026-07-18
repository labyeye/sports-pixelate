import { useEffect, useState } from "react";
import { Users, Plus, Trash2, Loader2, UserPlus, UserMinus } from "lucide-react";
import { eventAPI, studentAPI } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { Event } from "@/types/hrms";

interface Props {
  event: Event;
  onChanged: () => void;
}

// Parent-facing panel: register/unregister their own children instead of the
// staff team-management tools. Only enforces the activity/sport match when
// activityCategory === "sports" — dance/other event types don't require a
// Student's `sport` field to match an arbitrary activity string.
function RegistrationPanel({ event, onChanged }: Props) {
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

  const registeredIds = new Set(
    event.registrations.map((r) => (typeof r.student === "string" ? r.student : r.student._id)),
  );
  const eligible =
    event.activityCategory === "sports" ? children.filter((c) => c.sport === event.activity) : children;

  const toggle = async (studentId: string, isRegistered: boolean) => {
    setBusyId(studentId);
    try {
      if (isRegistered) await eventAPI.unregister(event._id, studentId);
      else await eventAPI.register(event._id, studentId);
      onChanged();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return null;

  return (
    <div className="border-2 border-black bg-white p-4">
      <h3 className="font-bold text-sm mb-3">Register</h3>
      {eligible.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          None of your children are eligible ({event.activity}) to register for this event.
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
                  disabled={busy || (!isRegistered && !event.registrationOpen)}
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
      {!event.registrationOpen && (
        <p className="text-xs text-muted-foreground mt-2">Registration is closed for this event.</p>
      )}
    </div>
  );
}

function TeamsPanel({ event, onChanged }: Props) {
  const { toast } = useToast();
  const [newTeam, setNewTeam] = useState("");
  const [addingTeam, setAddingTeam] = useState(false);

  const addTeam = async () => {
    if (!newTeam.trim() || addingTeam) return;
    setAddingTeam(true);
    try {
      await eventAPI.addTeam(event._id, newTeam.trim());
      setNewTeam("");
      onChanged();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setAddingTeam(false);
    }
  };

  const removeTeam = async (teamId: string) => {
    try {
      await eventAPI.removeTeam(event._id, teamId);
      onChanged();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="border-2 border-black bg-white p-4">
      <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
        <Users className="w-4 h-4" /> Teams ({event.teams.length})
      </h3>
      <div className="flex flex-wrap gap-2 mb-3">
        {event.teams.map((t) => (
          <span key={t._id} className="flex items-center gap-1.5 border-2 border-black px-2.5 py-1 text-xs font-bold">
            {t.name}
            {!event.fixturesGenerated && (
              <button onClick={() => removeTeam(t._id)} className="text-red-500 hover:text-red-700">
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </span>
        ))}
        {event.teams.length === 0 && <p className="text-xs text-muted-foreground">No teams added yet</p>}
      </div>
      {!event.fixturesGenerated && (
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
            {addingTeam ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add
          </button>
        </div>
      )}
    </div>
  );
}

function ParticipantsList({ event }: { event: Event }) {
  return (
    <div className="border-2 border-black bg-white p-4">
      <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
        <Users className="w-4 h-4" /> Participants ({event.registrations.length})
      </h3>
      {event.registrations.length === 0 ? (
        <p className="text-xs text-muted-foreground">No one has registered yet.</p>
      ) : (
        <div className="space-y-2">
          {event.registrations.map((r) => {
            const s = typeof r.student === "string" ? null : r.student;
            return (
              <div key={r._id} className="flex items-center justify-between border-2 border-black/10 px-3 py-2">
                <span className="text-sm font-bold text-black">{s ? `${s.firstName} ${s.lastName}` : r.student}</span>
                <span className="text-[10px] font-bold uppercase text-muted-foreground">{r.status}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ParticipantsTeamsTab({ event, onChanged }: Props) {
  const { user } = useAuth();
  const isParent = user?.role === "parent";
  const isTeamEvent = event.participation?.type === "team";

  if (isParent) return <RegistrationPanel event={event} onChanged={onChanged} />;
  if (isTeamEvent) return <TeamsPanel event={event} onChanged={onChanged} />;
  return <ParticipantsList event={event} />;
}
