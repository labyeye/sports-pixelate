import { SportPicker } from "@/components/SportPicker";
import { activityCategories } from "@/config/eventTypeConfig";

interface ActivityPickerProps {
  value: string;
  onChange: (activity: string) => void;
  activityCategory: string | null;
  required?: boolean;
}

// Wraps the existing per-academy SportPicker when activityCategory is
// "sports" (keeps the existing Sport list/counts intact); otherwise a
// free-text input with a <datalist> of suggestions from the registry.
export function ActivityPicker({
  value,
  onChange,
  activityCategory,
  required,
}: ActivityPickerProps) {
  if (activityCategory === "sports") {
    return (
      <div>
        <label className="block text-xs font-bold uppercase mb-1">
          Activity (Sport){required ? " *" : ""}
        </label>
        <SportPicker value={value} onChange={onChange} required={required} />
      </div>
    );
  }

  const suggestions =
    activityCategory && (activityCategories as any)[activityCategory]
      ? ((activityCategories as any)[activityCategory].activities as string[])
      : Object.values(activityCategories).flatMap((c) => c.activities);

  return (
    <div>
      <label className="block text-xs font-bold uppercase mb-1">
        Activity{required ? " *" : ""}
      </label>
      <input
        list="activity-suggestions"
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. Hip Hop, Yoga, Music"
        className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none bg-white"
      />
      <datalist id="activity-suggestions">
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </div>
  );
}
