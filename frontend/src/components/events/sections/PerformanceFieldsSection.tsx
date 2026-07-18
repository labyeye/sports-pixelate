import { Mic2 } from "lucide-react";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { DateTimePicker } from "@/components/ui/DateTimePicker";
import type { PerformanceFields } from "@/types/hrms";

interface Props {
  value: PerformanceFields;
  onChange: (patch: Partial<PerformanceFields>) => void;
}

const inputClass = "w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none bg-white";
const labelClass = "block text-xs font-bold uppercase mb-1";

export function PerformanceFieldsSection({ value, onChange }: Props) {
  return (
    <CollapsibleSection title="Performance Details" icon={Mic2}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Performance Order</label>
          <input
            className={inputClass}
            value={value.performanceOrder || ""}
            onChange={(e) => onChange({ performanceOrder: e.target.value })}
          />
        </div>
        <div>
          <label className={labelClass}>Stage Manager</label>
          <input
            className={inputClass}
            value={value.stageManager || ""}
            onChange={(e) => onChange({ stageManager: e.target.value })}
          />
        </div>
        <DateTimePicker
          label="Sound Check Time"
          type="time"
          value={value.soundCheckTime}
          onChange={(v) => onChange({ soundCheckTime: v })}
        />
        <label className="flex items-center gap-2 text-sm font-bold">
          <input
            type="checkbox"
            checked={!!value.greenRoomRequired}
            onChange={(e) => onChange({ greenRoomRequired: e.target.checked })}
          />
          Green Room Required
        </label>
        <div className="md:col-span-2">
          <label className={labelClass}>Lighting Notes</label>
          <textarea
            className={inputClass}
            rows={2}
            value={value.lightingNotes || ""}
            onChange={(e) => onChange({ lightingNotes: e.target.value })}
          />
        </div>
      </div>
    </CollapsibleSection>
  );
}
