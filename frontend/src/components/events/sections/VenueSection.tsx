import { MapPin } from "lucide-react";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import type { EventVenue } from "@/types/hrms";

interface Props {
  value: EventVenue;
  onChange: (patch: Partial<EventVenue>) => void;
}

const inputClass = "w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none bg-white";
const labelClass = "block text-xs font-bold uppercase mb-1";

export function VenueSection({ value, onChange }: Props) {
  return (
    <CollapsibleSection title="Venue" icon={MapPin}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Venue Name</label>
          <input className={inputClass} value={value.name || ""} onChange={(e) => onChange({ name: e.target.value })} />
        </div>
        <div>
          <label className={labelClass}>Hall / Ground / Court / Stage</label>
          <input
            className={inputClass}
            value={value.hallGroundCourtStage || ""}
            onChange={(e) => onChange({ hallGroundCourtStage: e.target.value })}
          />
        </div>
        <div className="md:col-span-2">
          <label className={labelClass}>Address</label>
          <input className={inputClass} value={value.address || ""} onChange={(e) => onChange({ address: e.target.value })} />
        </div>
        <div>
          <label className={labelClass}>City</label>
          <input className={inputClass} value={value.city || ""} onChange={(e) => onChange({ city: e.target.value })} />
        </div>
        <div>
          <label className={labelClass}>State</label>
          <input className={inputClass} value={value.state || ""} onChange={(e) => onChange({ state: e.target.value })} />
        </div>
        <div>
          <label className={labelClass}>Pincode</label>
          <input className={inputClass} value={value.pincode || ""} onChange={(e) => onChange({ pincode: e.target.value })} />
        </div>
        <div>
          <label className={labelClass}>Indoor / Outdoor</label>
          <select
            className={inputClass}
            value={value.indoorOutdoor || ""}
            onChange={(e) => onChange({ indoorOutdoor: e.target.value })}
          >
            <option value="">Select...</option>
            <option value="indoor">Indoor</option>
            <option value="outdoor">Outdoor</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label className={labelClass}>Maps URL</label>
          <input className={inputClass} value={value.mapsUrl || ""} onChange={(e) => onChange({ mapsUrl: e.target.value })} />
        </div>
      </div>
    </CollapsibleSection>
  );
}
