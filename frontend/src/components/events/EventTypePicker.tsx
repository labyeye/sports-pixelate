import { eventTypes, type EventTypeKey } from "@/config/eventTypeConfig";
import { cn } from "@/lib/utils";

interface EventTypePickerProps {
  value: string;
  onChange: (eventType: EventTypeKey) => void;
}

// First field in EventForm — chip grid reading the client-side config
// registry, no API call needed.
export function EventTypePicker({ value, onChange }: EventTypePickerProps) {
  return (
    <div>
      <label className="block text-xs font-bold uppercase mb-1">Event Type *</label>
      <div className="flex flex-wrap gap-2">
        {(Object.entries(eventTypes) as [EventTypeKey, (typeof eventTypes)[EventTypeKey]][]).map(
          ([key, cfg]) => (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key)}
              className={cn(
                "border-2 border-black px-3 py-1.5 text-xs font-bold uppercase transition-colors",
                value === key
                  ? "bg-[#024BAB] text-white"
                  : "bg-white text-black hover:bg-gray-50",
              )}
            >
              {cfg.label}
            </button>
          ),
        )}
      </div>
    </div>
  );
}
