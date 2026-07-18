import { IndianRupee } from "lucide-react";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { DateTimePicker } from "@/components/ui/DateTimePicker";
import type { EventFees } from "@/types/hrms";

interface Props {
  value: EventFees;
  onChange: (patch: Partial<EventFees>) => void;
}

const inputClass = "w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none bg-white";
const labelClass = "block text-xs font-bold uppercase mb-1";

export function FeesSection({ value, onChange }: Props) {
  return (
    <CollapsibleSection title="Fees" icon={IndianRupee}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Entry Fee (₹)</label>
          <input
            type="number"
            min={0}
            className={inputClass}
            value={value.entryFee ?? ""}
            onChange={(e) => onChange({ entryFee: e.target.value ? Number(e.target.value) : undefined })}
          />
        </div>
        <div>
          <label className={labelClass}>Currency</label>
          <input className={inputClass} value={value.currency || "INR"} onChange={(e) => onChange({ currency: e.target.value })} />
        </div>
        <div>
          <label className={labelClass}>Early Bird Discount (₹)</label>
          <input
            type="number"
            min={0}
            className={inputClass}
            value={value.earlyBirdDiscount ?? ""}
            onChange={(e) => onChange({ earlyBirdDiscount: e.target.value ? Number(e.target.value) : undefined })}
          />
        </div>
        <DateTimePicker
          label="Early Bird Deadline"
          value={value.earlyBirdDeadline}
          onChange={(v) => onChange({ earlyBirdDeadline: v })}
        />
        <div>
          <label className={labelClass}>Late Registration Fee (₹)</label>
          <input
            type="number"
            min={0}
            className={inputClass}
            value={value.lateRegistrationFee ?? ""}
            onChange={(e) => onChange({ lateRegistrationFee: e.target.value ? Number(e.target.value) : undefined })}
          />
        </div>
        <DateTimePicker
          label="Registration Deadline"
          value={value.registrationDeadline}
          onChange={(v) => onChange({ registrationDeadline: v })}
        />
        <label className="flex items-center gap-2 text-sm font-bold">
          <input
            type="checkbox"
            checked={!!value.onlinePaymentEnabled}
            onChange={(e) => onChange({ onlinePaymentEnabled: e.target.checked })}
          />
          Online Payment Enabled
        </label>
      </div>
    </CollapsibleSection>
  );
}
