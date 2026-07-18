import { Users } from "lucide-react";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import type { EventParticipation } from "@/types/hrms";

interface Props {
  value: EventParticipation;
  onChange: (patch: Partial<EventParticipation>) => void;
}

const inputClass = "w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none bg-white";
const labelClass = "block text-xs font-bold uppercase mb-1";

export function ParticipationSection({ value, onChange }: Props) {
  return (
    <CollapsibleSection title="Participation" icon={Users}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Type</label>
          <select
            className={inputClass}
            value={value.type}
            onChange={(e) => onChange({ type: e.target.value as EventParticipation["type"] })}
          >
            <option value="individual">Individual</option>
            <option value="team">Team</option>
            <option value="group">Group</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Max Registrations</label>
          <input
            type="number"
            min={0}
            className={inputClass}
            value={value.maxRegistrations ?? ""}
            onChange={(e) => onChange({ maxRegistrations: e.target.value ? Number(e.target.value) : undefined })}
          />
        </div>
        <div>
          <label className={labelClass}>Min Participants</label>
          <input
            type="number"
            min={0}
            className={inputClass}
            value={value.minParticipants ?? ""}
            onChange={(e) => onChange({ minParticipants: e.target.value ? Number(e.target.value) : undefined })}
          />
        </div>
        <div>
          <label className={labelClass}>Max Participants</label>
          <input
            type="number"
            min={0}
            className={inputClass}
            value={value.maxParticipants ?? ""}
            onChange={(e) => onChange({ maxParticipants: e.target.value ? Number(e.target.value) : undefined })}
          />
        </div>
        <label className="flex items-center gap-2 text-sm font-bold">
          <input
            type="checkbox"
            checked={!!value.waitingListEnabled}
            onChange={(e) => onChange({ waitingListEnabled: e.target.checked })}
          />
          Waiting List Enabled
        </label>
        <label className="flex items-center gap-2 text-sm font-bold">
          <input
            type="checkbox"
            checked={!!value.onlineRegistration}
            onChange={(e) => onChange({ onlineRegistration: e.target.checked })}
          />
          Online Registration
        </label>
        <label className="flex items-center gap-2 text-sm font-bold">
          <input
            type="checkbox"
            checked={!!value.approvalRequired}
            onChange={(e) => onChange({ approvalRequired: e.target.checked })}
          />
          Approval Required
        </label>
      </div>
    </CollapsibleSection>
  );
}
