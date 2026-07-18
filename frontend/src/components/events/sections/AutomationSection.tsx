import { Zap } from "lucide-react";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import type { EventAutomation } from "@/types/hrms";

interface Props {
  value: EventAutomation;
  onChange: (patch: Partial<EventAutomation>) => void;
}

const FIELDS: { key: keyof EventAutomation; label: string }[] = [
  { key: "notifications", label: "Notifications" },
  { key: "onlinePayments", label: "Online Payments" },
  { key: "autoPublishResults", label: "Auto-publish Results" },
  { key: "qrCheckIn", label: "QR Check-in" },
  { key: "attendanceTracking", label: "Attendance Tracking" },
  { key: "liveUpdates", label: "Live Updates" },
  { key: "certificates", label: "Certificates" },
];

export function AutomationSection({ value, onChange }: Props) {
  return (
    <CollapsibleSection title="Automation" icon={Zap}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {FIELDS.map((f) => (
          <label key={f.key} className="flex items-center gap-2 text-sm font-bold">
            <input
              type="checkbox"
              checked={!!value[f.key]}
              onChange={(e) => onChange({ [f.key]: e.target.checked } as Partial<EventAutomation>)}
            />
            {f.label}
          </label>
        ))}
      </div>
    </CollapsibleSection>
  );
}
