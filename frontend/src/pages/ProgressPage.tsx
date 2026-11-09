// Skill progress: coaches/owners record 1–5 skill ratings + level + remarks per
// student; parents see their own children's history (filtered server-side).
import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { coachingAPI, studentAPI } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { notifyError } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils";
import { TrendingUp, Plus, Trash2, Loader2 } from "lucide-react";

const input =
  "border-2 border-black px-3 py-2 text-sm font-medium bg-white outline-none";

export default function ProgressPage() {
  const { user } = useAuth();
  const isParent = user?.role === "parent";
  const isOwner = user?.role === "super_admin" || user?.role === "hr_manager";
  const [students, setStudents] = useState<any[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentId, setStudentId] = useState("");
  const [level, setLevel] = useState("");
  const [remarks, setRemarks] = useState("");
  const [skills, setSkills] = useState([{ skill: "", score: 3 }]);

  const load = useCallback(
    () =>
      coachingAPI
        .assessments(studentId || undefined)
        .then((r: any) => setRows(r.data || []))
        .catch(notifyError)
        .finally(() => setLoading(false)),
    [studentId],
  );
  useEffect(() => {
    studentAPI
      .getAll({ limit: "500" } as any)
      .then((r: any) => setStudents(r.data || []))
      .catch(notifyError);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await coachingAPI.createAssessment({
        student: studentId,
        level,
        remarks,
        ratings: skills.filter((s) => s.skill.trim()),
      });
      setLevel("");
      setRemarks("");
      setSkills([{ skill: "", score: 3 }]);
      await load();
    } catch (err) {
      notifyError(err);
    }
  };

  const nameOf = (id: string) => {
    const s = students.find((x) => x._id === id);
    return s ? `${s.firstName} ${s.lastName}` : "Student";
  };
  const setSkill = (i: number, patch: object) =>
    setSkills(skills.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  return (
    <AppLayout title="Progress">
      <h1 className="font-display font-bold text-2xl text-black mb-1">
        Skill Progress
      </h1>
      <p className="text-sm text-muted-foreground mb-4">
        Coach assessments and levels over time.
      </p>

      <select
        value={studentId}
        onChange={(e) => setStudentId(e.target.value)}
        className={`${input} mb-4 min-w-[220px]`}
      >
        <option value="">{isParent ? "All my children" : "All students"}</option>
        {students.map((s) => (
          <option key={s._id} value={s._id}>
            {s.firstName} {s.lastName}
          </option>
        ))}
      </select>

      {!isParent && studentId && (
        <form onSubmit={save} className="border-2 border-black p-3 mb-4 grid gap-2">
          <input
            placeholder="Level / belt (optional)"
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className={input}
          />
          {skills.map((s, i) => (
            <div key={i} className="flex gap-2">
              <input
                placeholder="Skill (e.g. Backhand)"
                value={s.skill}
                onChange={(e) => setSkill(i, { skill: e.target.value })}
                className={`${input} flex-1`}
              />
              <select
                value={s.score}
                onChange={(e) => setSkill(i, { score: +e.target.value })}
                className={input}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setSkills([...skills, { skill: "", score: 3 }])}
            className="text-xs font-bold text-left underline"
          >
            + Add skill
          </button>
          <textarea
            placeholder="Remarks"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            className={input}
            maxLength={1000}
          />
          <button className="border-2 border-black bg-[#A3E635] px-3 py-2 text-sm font-bold flex items-center gap-1 w-fit">
            <Plus className="w-4 h-4" /> Save assessment
          </button>
        </form>
      )}

      {loading ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No assessments yet.</p>
      ) : (
        <div className="grid gap-2">
          {rows.map((a) => (
            <div key={a._id} className="border-2 border-black p-3">
              <div className="flex items-center justify-between">
                <p className="font-bold flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#024BAB]" />
                  {nameOf(a.student)} · {formatDate(a.date)}
                  {a.level ? ` · ${a.level}` : ""}
                </p>
                {isOwner && (
                  <button
                    onClick={() =>
                      coachingAPI
                        .deleteAssessment(a._id)
                        .then(load)
                        .catch(notifyError)
                    }
                    aria-label="Delete"
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {a.ratings.map((r: any) => (
                  <span
                    key={r.skill}
                    className="border-2 border-black px-2 py-0.5 text-xs font-bold"
                  >
                    {r.skill}: {r.score}/5
                  </span>
                ))}
              </div>
              {a.remarks && <p className="text-sm mt-2">{a.remarks}</p>}
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
