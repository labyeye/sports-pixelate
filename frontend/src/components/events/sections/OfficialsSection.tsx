import { useState } from "react";
import { Shield, Plus, Trash2 } from "lucide-react";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import type { EventOfficial } from "@/types/hrms";

interface Props {
  value: (EventOfficial | Omit<EventOfficial, "_id">)[];
  onAdd: (o: {
    name: string;
    role?: string;
    phone?: string;
    email?: string;
  }) => void;
  onRemove: (index: number) => void;
}

const inputClass =
  "border-2 border-black px-2 py-1.5 text-sm font-medium outline-none bg-white";

// Officials/Judges — same officials array is shown here (form-time, staged
// only) and fully CRUD-managed live on the Judges tab post-creation.
export function OfficialsSection({ value, onAdd, onRemove }: Props) {
  const [draft, setDraft] = useState({
    name: "",
    role: "",
    phone: "",
    email: "",
  });

  const add = () => {
    if (!draft.name.trim()) return;
    onAdd({ ...draft, name: draft.name.trim() });
    setDraft({ name: "", role: "", phone: "", email: "" });
  };

  return (
    <CollapsibleSection title="Officials / Judges" icon={Shield}>
      <div className="space-y-2 mb-3">
        {value.map((o, i) => (
          <div
            key={i}
            className="flex items-center justify-between border-2 border-black/10 px-3 py-2"
          >
            <span className="text-sm font-bold">
              {o.name} {o.role ? `· ${o.role}` : ""}
            </span>
            <button
              type="button"
              onClick={() => onRemove(i)}
              className="text-red-500 hover:text-red-700"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        {value.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No officials added yet
          </p>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
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
        <div className="flex gap-2">
          <input
            placeholder="Email"
            className={inputClass + " flex-1"}
            value={draft.email}
            onChange={(e) => setDraft((p) => ({ ...p, email: e.target.value }))}
          />
          <button
            type="button"
            onClick={add}
            className="border-2 border-black px-2 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </CollapsibleSection>
  );
}
