// Groups (web): the classes/programs an academy runs under one roof — e.g.
// Dance, Art, Cricket. Each group is a Sport record (students, coaches and
// coaching plans already key off its name); this page adds the owner-facing
// view: headcount plus fees collected / remaining for the current month.
// Backend: sportAPI.

import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { sportAPI } from "@/services/api";
import { notifyError, useToast } from "@/hooks/use-toast";
import { formatCurrency, getErrorMessage } from "@/lib/utils";
import type { Sport } from "@/types/hrms";
import { Layers, Plus, Loader2, Users, UserCheck, Power } from "lucide-react";

export default function GroupsPage() {
  const { toast } = useToast();
  const [groups, setGroups] = useState<Sport[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    return sportAPI
      .getAll()
      .then((res: any) => setGroups(res.data || []))
      .catch(notifyError)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await sportAPI.create({ name: trimmed });
      setName("");
      toast({ title: "Group added" });
      await load();
    } catch (err) {
      toast({
        title: "Could not add group",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (g: Sport) => {
    try {
      await sportAPI.update(g._id, { active: !g.active });
      await load();
    } catch (err) {
      notifyError(err);
    }
  };

  const active = groups.filter((g) => g.active !== false);
  const inactive = groups.filter((g) => g.active === false);
  const totalCollected = active.reduce((s, g) => s + (g.collectedThisMonth || 0), 0);
  const totalRemaining = active.reduce((s, g) => s + (g.remainingThisMonth || 0), 0);

  return (
    <AppLayout title="Groups">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="font-display font-bold text-2xl text-black">Groups</h1>
          <p className="text-sm text-muted-foreground">
            Run Dance, Art, Cricket… side by side. Each group has its own
            students, coaches, plans and fee collection.
          </p>
        </div>
        <form onSubmit={handleAdd} className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New group name (e.g. Dance)"
            maxLength={60}
            className="border-2 border-black px-3 py-2 text-sm font-medium outline-none bg-white"
          />
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="border-2 border-black bg-[#A3E635] px-3 text-sm font-bold flex items-center gap-1 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add
          </button>
        </form>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="border-2 border-black p-3 bg-[#00C48C]/10">
          <p className="text-xs font-bold uppercase text-muted-foreground">Collected this month</p>
          <p className="font-display font-bold text-xl text-[#00A070]">{formatCurrency(totalCollected)}</p>
        </div>
        <div className="border-2 border-black p-3 bg-[#FA731C]/10">
          <p className="text-xs font-bold uppercase text-muted-foreground">Remaining</p>
          <p className="font-display font-bold text-xl text-[#FA731C]">{formatCurrency(totalRemaining)}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : active.length === 0 ? (
        <div className="border-2 border-dashed p-10 text-center text-muted-foreground">
          <Layers className="w-8 h-8 mx-auto mb-2" />
          No groups yet — add your first one above.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {active.map((g) => (
            <GroupCard key={g._id} group={g} onToggle={() => toggleActive(g)} />
          ))}
        </div>
      )}

      {inactive.length > 0 && (
        <div className="mt-6">
          <h2 className="font-bold text-sm text-muted-foreground mb-2">Inactive groups</h2>
          <div className="flex flex-wrap gap-2">
            {inactive.map((g) => (
              <button
                key={g._id}
                onClick={() => toggleActive(g)}
                className="border-2 px-3 py-1 text-sm font-medium text-muted-foreground"
                title="Reactivate"
              >
                {g.name} · Reactivate
              </button>
            ))}
          </div>
        </div>
      )}
    </AppLayout>
  );
}

function GroupCard({ group, onToggle }: { group: Sport; onToggle: () => void }) {
  const collected = group.collectedThisMonth || 0;
  const remaining = group.remainingThisMonth || 0;
  const expected = collected + remaining;
  const pct = expected > 0 ? Math.round((collected / expected) * 100) : 0;
  return (
    <div className="border-2 bg-white p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-display font-bold text-lg text-black">{group.name}</h3>
        <button
          onClick={onToggle}
          title="Deactivate group"
          className="text-muted-foreground hover:text-red-600"
        >
          <Power className="w-4 h-4" />
        </button>
      </div>
      <div className="flex gap-4 text-sm mb-3">
        <Link to={`/students?sport=${encodeURIComponent(group.name)}`} className="flex items-center gap-1 hover:underline">
          <Users className="w-4 h-4" /> {group.studentCount} students
        </Link>
        <span className="flex items-center gap-1">
          <UserCheck className="w-4 h-4" /> {group.coachCount} coaches
        </span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-[#00A070] font-bold">{formatCurrency(collected)} collected</span>
        <span className="text-[#FA731C] font-bold">{formatCurrency(remaining)} remaining</span>
      </div>
      <div className="h-2 border border-black mt-2 bg-white">
        <div className="h-full bg-[#00C48C]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
