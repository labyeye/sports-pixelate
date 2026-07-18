import { CalendarClock } from "lucide-react";
import type { Event } from "@/types/hrms";

interface Props {
  event: Event;
}

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between border-2 border-black/10 px-3 py-2">
      <span className="text-xs font-bold uppercase text-muted-foreground">{label}</span>
      <span className="text-sm font-bold text-black">{value}</span>
    </div>
  );
}

// Read view of the schedule sub-object plus the legacy top-level dates.
export function ScheduleTab({ event }: Props) {
  const s = event.schedule || {};
  const hasAny =
    event.startDate ||
    event.endDate ||
    s.eventDate ||
    s.registrationOpensAt ||
    s.registrationClosesAt ||
    s.startTime ||
    s.endTime ||
    s.checkInTime ||
    s.openingCeremonyTime ||
    s.closingCeremonyTime;

  if (!hasAny) {
    return (
      <div className="border-2 border-black bg-white p-12 flex flex-col items-center justify-center">
        <CalendarClock className="w-10 h-10 text-muted-foreground/30 mb-3" />
        <p className="font-bold text-black">No schedule set</p>
        <p className="text-sm text-muted-foreground mt-1">Add schedule details from Settings.</p>
      </div>
    );
  }

  return (
    <div className="border-2 border-black bg-white p-4 space-y-2">
      <Row label="Start Date" value={event.startDate?.slice(0, 10)} />
      <Row label="End Date" value={event.endDate?.slice(0, 10)} />
      <Row label="Event Date" value={s.eventDate} />
      <Row label="Registration Opens" value={s.registrationOpensAt} />
      <Row label="Registration Closes" value={s.registrationClosesAt} />
      <Row label="Start Time" value={s.startTime} />
      <Row label="End Time" value={s.endTime} />
      <Row label="Check-in Time" value={s.checkInTime} />
      <Row label="Opening Ceremony" value={s.openingCeremonyTime} />
      <Row label="Closing Ceremony" value={s.closingCeremonyTime} />
    </div>
  );
}
