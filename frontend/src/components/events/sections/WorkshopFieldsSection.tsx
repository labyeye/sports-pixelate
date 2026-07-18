import { GraduationCap } from "lucide-react";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import type { WorkshopFields } from "@/types/hrms";

interface Props {
  value: WorkshopFields;
  onChange: (patch: Partial<WorkshopFields>) => void;
}

const inputClass = "w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none bg-white";
const labelClass = "block text-xs font-bold uppercase mb-1";

export function WorkshopFieldsSection({ value, onChange }: Props) {
  return (
    <CollapsibleSection title="Workshop Details" icon={GraduationCap}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Instructor</label>
          <input className={inputClass} value={value.instructor || ""} onChange={(e) => onChange({ instructor: e.target.value })} />
        </div>
        <div>
          <label className={labelClass}>Max Seats</label>
          <input
            type="number"
            min={0}
            className={inputClass}
            value={value.maxSeats ?? ""}
            onChange={(e) => onChange({ maxSeats: e.target.value ? Number(e.target.value) : undefined })}
          />
        </div>
        <div>
          <label className={labelClass}>Session Duration (min)</label>
          <input
            type="number"
            min={0}
            className={inputClass}
            value={value.sessionDurationMinutes ?? ""}
            onChange={(e) => onChange({ sessionDurationMinutes: e.target.value ? Number(e.target.value) : undefined })}
          />
        </div>
        <label className="flex items-center gap-2 text-sm font-bold">
          <input
            type="checkbox"
            checked={!!value.certificateAvailable}
            onChange={(e) => onChange({ certificateAvailable: e.target.checked })}
          />
          Certificate Available
        </label>
        <div className="md:col-span-2">
          <label className={labelClass}>Materials Required</label>
          <textarea
            className={inputClass}
            rows={2}
            value={value.materialsRequired || ""}
            onChange={(e) => onChange({ materialsRequired: e.target.value })}
          />
        </div>
      </div>
    </CollapsibleSection>
  );
}
