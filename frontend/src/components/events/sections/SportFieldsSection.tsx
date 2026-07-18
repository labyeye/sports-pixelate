import { Dumbbell } from "lucide-react";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import type { SportFields } from "@/types/hrms";

interface Props {
  value: SportFields;
  onChange: (patch: Partial<SportFields>) => void;
  format: string;
  onFormatChange: (format: string) => void;
}

const inputClass = "w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none bg-white";
const labelClass = "block text-xs font-bold uppercase mb-1";

// format stays top-level on the Event, not duplicated into sportFields —
// this section reads/writes event.format directly to avoid drift.
export function SportFieldsSection({ value, onChange, format, onFormatChange }: Props) {
  return (
    <CollapsibleSection title="Sport Details" icon={Dumbbell}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Format</label>
          <select className={inputClass} value={format} onChange={(e) => onFormatChange(e.target.value)}>
            <option value="knockout">Knockout</option>
            <option value="round_robin">Round Robin</option>
            <option value="single_elimination">Single Elimination</option>
            <option value="double_elimination">Double Elimination</option>
            <option value="league">League</option>
            <option value="group_stage">Group Stage</option>
            <option value="swiss">Swiss</option>
            <option value="best_of_series">Best of Series</option>
          </select>
          {format !== "knockout" && format !== "round_robin" && (
            <p className="text-[11px] text-muted-foreground mt-1">
              Fixture generation is coming soon for this format.
            </p>
          )}
        </div>
        <div>
          <label className={labelClass}>Max Teams</label>
          <input
            type="number"
            min={0}
            className={inputClass}
            value={value.maxTeams ?? ""}
            onChange={(e) => onChange({ maxTeams: e.target.value ? Number(e.target.value) : undefined })}
          />
        </div>
        <div>
          <label className={labelClass}>Match Duration (min)</label>
          <input
            type="number"
            min={0}
            className={inputClass}
            value={value.matchDurationMinutes ?? ""}
            onChange={(e) => onChange({ matchDurationMinutes: e.target.value ? Number(e.target.value) : undefined })}
          />
        </div>
        <div>
          <label className={labelClass}>Player Limit</label>
          <input
            type="number"
            min={0}
            className={inputClass}
            value={value.playerLimit ?? ""}
            onChange={(e) => onChange({ playerLimit: e.target.value ? Number(e.target.value) : undefined })}
          />
        </div>
        <div>
          <label className={labelClass}>Substitutes Allowed</label>
          <input
            type="number"
            min={0}
            className={inputClass}
            value={value.substitutesAllowed ?? ""}
            onChange={(e) => onChange({ substitutesAllowed: e.target.value ? Number(e.target.value) : undefined })}
          />
        </div>
        <div className="md:col-span-2">
          <label className={labelClass}>Tie Break Rules</label>
          <input className={inputClass} value={value.tieBreakRules || ""} onChange={(e) => onChange({ tieBreakRules: e.target.value })} />
        </div>
        <div className="md:col-span-2">
          <label className={labelClass}>Penalty Rules</label>
          <input className={inputClass} value={value.penaltyRules || ""} onChange={(e) => onChange({ penaltyRules: e.target.value })} />
        </div>
        <label className="flex items-center gap-2 text-sm font-bold">
          <input type="checkbox" checked={!!value.groupsEnabled} onChange={(e) => onChange({ groupsEnabled: e.target.checked })} />
          Groups Enabled
        </label>
        <label className="flex items-center gap-2 text-sm font-bold">
          <input
            type="checkbox"
            checked={!!value.extraTimeAllowed}
            onChange={(e) => onChange({ extraTimeAllowed: e.target.checked })}
          />
          Extra Time Allowed
        </label>
        <label className="flex items-center gap-2 text-sm font-bold">
          <input
            type="checkbox"
            checked={!!value.seedingEnabled}
            onChange={(e) => onChange({ seedingEnabled: e.target.checked })}
          />
          Seeding Enabled
        </label>
        <label className="flex items-center gap-2 text-sm font-bold">
          <input type="checkbox" checked={!!value.randomDraw} onChange={(e) => onChange({ randomDraw: e.target.checked })} />
          Random Draw
        </label>
      </div>
    </CollapsibleSection>
  );
}
