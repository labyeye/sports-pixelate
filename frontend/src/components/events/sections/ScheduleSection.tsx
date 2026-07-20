import { CalendarClock } from "lucide-react";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import { DateTimePicker } from "@/components/ui/DateTimePicker";
import type { EventSchedule } from "@/types/hrms";

interface Props {
  value: EventSchedule;
  onChange: (patch: Partial<EventSchedule>) => void;
  startDate: string;
  endDate: string;
  onDatesChange: (patch: { startDate?: string; endDate?: string }) => void;
}

export function ScheduleSection({
  value,
  onChange,
  startDate,
  endDate,
  onDatesChange,
}: Props) {
  return (
    <CollapsibleSection title="Schedule" icon={CalendarClock}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DateTimePicker
          label="Start Date"
          type="date"
          value={startDate}
          onChange={(v) => onDatesChange({ startDate: v })}
        />
        <DateTimePicker
          label="End Date"
          type="date"
          value={endDate}
          onChange={(v) => onDatesChange({ endDate: v })}
        />
        <DateTimePicker
          label="Event Date"
          type="date"
          value={value.eventDate}
          onChange={(v) => onChange({ eventDate: v })}
        />
        <DateTimePicker
          label="Registration Opens"
          type="date"
          value={value.registrationOpensAt}
          onChange={(v) => onChange({ registrationOpensAt: v })}
        />
        <DateTimePicker
          label="Registration Closes"
          type="date"
          value={value.registrationClosesAt}
          onChange={(v) => onChange({ registrationClosesAt: v })}
        />
        <DateTimePicker
          label="Start Time"
          type="time"
          value={value.startTime}
          onChange={(v) => onChange({ startTime: v })}
        />
        <DateTimePicker
          label="End Time"
          type="time"
          value={value.endTime}
          onChange={(v) => onChange({ endTime: v })}
        />
        <DateTimePicker
          label="Check-in Time"
          type="time"
          value={value.checkInTime}
          onChange={(v) => onChange({ checkInTime: v })}
        />
        <DateTimePicker
          label="Opening Ceremony Time"
          type="time"
          value={value.openingCeremonyTime}
          onChange={(v) => onChange({ openingCeremonyTime: v })}
        />
        <DateTimePicker
          label="Closing Ceremony Time"
          type="time"
          value={value.closingCeremonyTime}
          onChange={(v) => onChange({ closingCeremonyTime: v })}
        />
      </div>
    </CollapsibleSection>
  );
}
