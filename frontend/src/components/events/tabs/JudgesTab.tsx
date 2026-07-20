import { useState } from "react";
import { Shield, Plus, Trash2, Pencil, Check, X, Loader2 } from "lucide-react";
import { eventAPI } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import type { Event } from "@/types/hrms";

interface Props {
  event: Event;
  onChanged: () => void;
}

const inputClass =
  "border-2 border-black px-2 py-1.5 text-sm font-medium outline-none bg-white";

// Full CRUD for officials/judges — uses the officials endpoints directly
// (doesn't go through the big EventForm since the backend strips officials
// from PUT payloads anyway).
export function JudgesTab({ event, onChanged }: Props) {
  const { toast } = useToast();
  const [draft, setDraft] = useState({
    name: "",
    role: "",
    phone: "",
    email: "",
  });
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({
    name: "",
    role: "",
    phone: "",
    email: "",
  });
  const [busyId, setBusyId] = useState<string | null>(null);

  const add = async () => {
    if (!draft.name.trim() || adding) return;
    setAdding(true);
    try {
      await eventAPI.addOfficial(event._id, {
        ...draft,
        name: draft.name.trim(),
      });
      setDraft({ name: "", role: "", phone: "", email: "" });
      onChanged();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (o: Event["officials"][number]) => {
    setEditingId(o._id);
    setEditDraft({
      name: o.name,
      role: o.role || "",
      phone: o.phone || "",
      email: o.email || "",
    });
  };

  const saveEdit = async (id: string) => {
    setBusyId(id);
    try {
      await eventAPI.updateOfficial(event._id, id, editDraft);
      setEditingId(null);
      onChanged();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: string) => {
    setBusyId(id);
    try {
      await eventAPI.removeOfficial(event._id, id);
      onChanged();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="border-2 border-black bg-white p-4">
      <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
        <Shield className="w-4 h-4" /> Officials / Judges (
        {event.officials.length})
      </h3>
      <div className="space-y-2 mb-4">
        {event.officials.map((o) =>
          editingId === o._id ? (
            <div
              key={o._id}
              className="grid grid-cols-1 md:grid-cols-5 gap-2 items-center border-2 border-black/20 px-3 py-2"
            >
              <input
                className={inputClass}
                value={editDraft.name}
                onChange={(e) =>
                  setEditDraft((p) => ({ ...p, name: e.target.value }))
                }
              />
              <input
                className={inputClass}
                value={editDraft.role}
                onChange={(e) =>
                  setEditDraft((p) => ({ ...p, role: e.target.value }))
                }
              />
              <input
                className={inputClass}
                value={editDraft.phone}
                onChange={(e) =>
                  setEditDraft((p) => ({ ...p, phone: e.target.value }))
                }
              />
              <input
                className={inputClass}
                value={editDraft.email}
                onChange={(e) =>
                  setEditDraft((p) => ({ ...p, email: e.target.value }))
                }
              />
              <div className="flex gap-1.5">
                <button
                  onClick={() => saveEdit(o._id)}
                  disabled={busyId === o._id}
                  className="border-2 border-black p-1.5"
                >
                  {busyId === o._id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="border-2 border-black p-1.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div
              key={o._id}
              className="flex items-center justify-between border-2 border-black/10 px-3 py-2"
            >
              <div>
                <span className="text-sm font-bold">{o.name}</span>
                {o.role && (
                  <span className="text-xs text-muted-foreground ml-2">
                    {o.role}
                  </span>
                )}
                {(o.phone || o.email) && (
                  <p className="text-[11px] text-muted-foreground">
                    {[o.phone, o.email].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => startEdit(o)}
                  className="text-[#024BAB] hover:opacity-70"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => remove(o._id)}
                  disabled={busyId === o._id}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ),
        )}
        {event.officials.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No officials added yet
          </p>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
        <input
          placeholder="Name *"
          className={inputClass}
          value={draft.name}
          onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
        />
        <input
          placeholder="Role"
          className={inputClass}
          value={draft.role}
          onChange={(e) => setDraft((p) => ({ ...p, role: e.target.value }))}
        />
        <input
          placeholder="Phone"
          className={inputClass}
          value={draft.phone}
          onChange={(e) => setDraft((p) => ({ ...p, phone: e.target.value }))}
        />
        <input
          placeholder="Email"
          className={inputClass}
          value={draft.email}
          onChange={(e) => setDraft((p) => ({ ...p, email: e.target.value }))}
        />
        <button
          onClick={add}
          disabled={adding || !draft.name.trim()}
          className="border-2 border-black bg-[#024BAB] text-white px-2 py-1.5 text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-50"
        >
          {adding ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Plus className="w-3.5 h-3.5" />
          )}{" "}
          Add
        </button>
      </div>
    </div>
  );
}
