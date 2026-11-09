// Batch timetable: owners add weekly slots per (sport, batch); staff see all;
// parents see only their children's batches (filtered server-side).
import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { coachingAPI } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { notifyError } from "@/hooks/use-toast";
import { CalendarDays, Plus, Trash2, Loader2 } from "lucide-react";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const input =
  "border-2 border-black px-3 py-2 text-sm font-medium bg-white outline-none";

export default function TimetablePage() {
  const { user } = useAuth();
  const canEdit = user?.role === "super_admin" || user?.role === "hr_manager";
  const [slots, setSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [f, setF] = useState({
    sport: "",
    batch: "",
    startTime: "17:00",
    endTime: "18:00",
    venue: "",
  });
  const [days, setDays] = useState<number[]>([]);

  const load = useCallback(
    () =>
      coachingAPI
        .schedules()
        .then((r: any) => setSlots(r.data || []))
        .catch(notifyError)
        .finally(() => setLoading(false)),
    [],
  );
  useEffect(() => {
    load();
  }, [load]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await coachingAPI.createSchedule({ ...f, days });
      setDays([]);
      await load();
    } catch (err) {
      notifyError(err);
    }
  };
  const remove = (id: string) =>
    coachingAPI.deleteSchedule(id).then(load).catch(notifyError);

  return (
    <AppLayout title="Timetable">
      <h1 className="font-display font-bold text-2xl text-black mb-1">
        Batch Timetable
      </h1>
      <p className="text-sm text-muted-foreground mb-4">
        Weekly training slots for each batch.
      </p>

      {canEdit && (
        <form
          onSubmit={add}
          className="border-2 border-black p-3 mb-4 flex flex-wrap gap-2 items-end"
        >
          <input
            required
            placeholder="Sport"
            value={f.sport}
            onChange={(e) => setF({ ...f, sport: e.target.value })}
            className={input}
          />
          <input
            required
            placeholder="Batch (as on student)"
            value={f.batch}
            onChange={(e) => setF({ ...f, batch: e.target.value })}
            className={input}
          />
          <input
            type="time"
            required
            value={f.startTime}
            onChange={(e) => setF({ ...f, startTime: e.target.value })}
            className={input}
          />
          <input
            type="time"
            required
            value={f.endTime}
            onChange={(e) => setF({ ...f, endTime: e.target.value })}
            className={input}
          />
          <input
            placeholder="Venue"
            value={f.venue}
            onChange={(e) => setF({ ...f, venue: e.target.value })}
            className={input}
          />
          <div className="flex gap-1">
            {DAYS.map((d, i) => (
              <button
                type="button"
                key={d}
                onClick={() =>
                  setDays(
                    days.includes(i)
                      ? days.filter((x) => x !== i)
                      : [...days, i],
                  )
                }
                className={`border-2 border-black px-2 py-1 text-xs font-bold ${days.includes(i) ? "bg-[#A3E635]" : "bg-white"}`}
              >
                {d}
              </button>
            ))}
          </div>
          <button
            disabled={!days.length}
            className="border-2 border-black bg-[#A3E635] px-3 py-2 text-sm font-bold flex items-center gap-1 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" /> Add slot
          </button>
        </form>
      )}

      {loading ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : slots.length === 0 ? (
        <p className="text-sm text-muted-foreground">No timetable yet.</p>
      ) : (
        <div className="grid gap-2">
          {slots.map((s) => (
            <div
              key={s._id}
              className="border-2 border-black p-3 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3">
                <CalendarDays className="w-5 h-5 text-[#024BAB]" />
                <div>
                  <p className="font-bold">
                    {s.sport} · {s.batch}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {s.days.map((d: number) => DAYS[d]).join(", ")} ·{" "}
                    {s.startTime}–{s.endTime}
                    {s.venue ? ` · ${s.venue}` : ""}
                    {s.coach
                      ? ` · Coach ${s.coach.firstName} ${s.coach.lastName}`
                      : ""}
                  </p>
                </div>
              </div>
              {canEdit && (
                <button onClick={() => remove(s._id)} aria-label="Delete slot">
                  <Trash2 className="w-4 h-4 text-red-600" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
