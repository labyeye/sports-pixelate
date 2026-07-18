import { useEffect, useState } from "react";
import { Users, UserCheck, CalendarCheck, CalendarClock, IndianRupee, Award } from "lucide-react";
import { eventAPI } from "@/services/api";
import type { Event, EventDashboard } from "@/types/hrms";

interface Props {
  event: Event;
}

function KpiTile({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) {
  return (
    <div className="border-2 border-black bg-white p-4 flex items-center gap-3">
      <div
        className="w-10 h-10 border-2 flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${color}1A`, borderColor: color }}
      >
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <div>
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold text-black">{value}</p>
      </div>
    </div>
  );
}

export function OverviewTab({ event }: Props) {
  const [dash, setDash] = useState<EventDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    eventAPI
      .getDashboard(event._id)
      .then((r: any) => setDash(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [event._id]);

  if (loading) return <p className="text-sm text-muted-foreground">Loading overview...</p>;
  if (!dash) return <p className="text-sm text-muted-foreground">Overview unavailable.</p>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiTile icon={Users} label="Total Registrations" value={dash.totalRegistrations} color="#024BAB" />
        <KpiTile icon={UserCheck} label="Total Participants" value={dash.totalParticipants} color="#00C48C" />
        <KpiTile icon={CalendarClock} label="Upcoming Sessions" value={dash.upcomingSessions} color="#FBBF24" />
        <KpiTile icon={CalendarCheck} label="Completed Sessions" value={dash.completedSessions} color="#A855F7" />
        <KpiTile icon={IndianRupee} label="Revenue" value={`₹${dash.revenue}`} color="#024BAB" />
        <KpiTile icon={Award} label="Certificates Issued" value={dash.certificatesIssued} color="#00C48C" />
      </div>
      {event.description && (
        <div className="border-2 border-black bg-white p-4">
          <h3 className="font-bold text-sm mb-2">About this event</h3>
          <p className="text-sm text-muted-foreground whitespace-pre-line">{event.description}</p>
        </div>
      )}
    </div>
  );
}
