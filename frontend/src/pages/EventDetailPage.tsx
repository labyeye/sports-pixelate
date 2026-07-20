import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { eventAPI } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  EventDetailTabs,
  type EventTabDef,
} from "@/components/events/EventDetailTabs";
import { OverviewTab } from "@/components/events/tabs/OverviewTab";
import { ScheduleTab } from "@/components/events/tabs/ScheduleTab";
import { ParticipantsTeamsTab } from "@/components/events/tabs/ParticipantsTeamsTab";
import { FixturesTab } from "@/components/events/tabs/FixturesTab";
import { PointsTableTab } from "@/components/events/tabs/PointsTableTab";
import { AwardsTab } from "@/components/events/tabs/AwardsTab";
import { JudgesTab } from "@/components/events/tabs/JudgesTab";
import { DocumentsTab } from "@/components/events/tabs/DocumentsTab";
import { SettingsTab } from "@/components/events/tabs/SettingsTab";
import { GalleryTab } from "@/components/events/tabs/GalleryTab";
import { AnnouncementsTab } from "@/components/events/tabs/AnnouncementsTab";
import { PaymentsTab } from "@/components/events/tabs/PaymentsTab";
import { AttendanceTab } from "@/components/events/tabs/AttendanceTab";
import { eventTypes } from "@/config/eventTypeConfig";
import type { Event } from "@/types/hrms";
import { Loader2 } from "lucide-react";

const STATUS_COLOR: Record<Event["status"], string> = {
  draft: "#6B7280",
  registration_open: "#00C48C",
  registration_closed: "#FBBF24",
  upcoming: "#024BAB",
  live: "#EF4444",
  completed: "#A855F7",
  cancelled: "#6B7280",
};

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const canManage = user?.role === "super_admin" || user?.role === "hr_manager";

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview");

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const res = await eventAPI.getOne(id);
      setEvent(res.data);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
      navigate("/events");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading || !event) {
    return (
      <AppLayout title="Event">
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      </AppLayout>
    );
  }

  const isSports = event.activityCategory === "sports";
  const isTeamParticipation = (event.participation?.type || "team") === "team";

  const tabs: EventTabDef[] = [
    { key: "overview", label: "Overview" },
    { key: "schedule", label: "Schedule" },
    {
      key: "participants",
      label: isTeamParticipation ? "Teams" : "Participants",
    },
    ...(isSports ? [{ key: "fixtures", label: "Fixtures" }] : []),
    ...(isSports && event.format === "round_robin"
      ? [{ key: "points", label: "Points Table" }]
      : []),
    { key: "awards", label: "Awards" },
    { key: "judges", label: "Judges" },
    { key: "documents", label: "Documents" },
    { key: "gallery", label: "Gallery" },
    { key: "announcements", label: "Announcements" },
    { key: "payments", label: "Payments" },
    { key: "attendance", label: "Attendance" },
    ...(canManage ? [{ key: "settings", label: "Settings" }] : []),
  ];

  return (
    <AppLayout title={event.name}>
      <div className="space-y-4">
        {(event.coverImageUrl || event.bannerImageUrl) && (
          <div className="border-2 border-black h-40 overflow-hidden bg-gray-100">
            <img
              src={event.bannerImageUrl || event.coverImageUrl}
              alt={event.name}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="border-2 border-black bg-white p-4 flex flex-wrap items-center gap-2 justify-between">
          <div>
            <h1 className="text-xl font-bold">{event.name}</h1>
            <p className="text-xs text-muted-foreground mt-1">
              {eventTypes[event.eventType as keyof typeof eventTypes]?.label ||
                event.eventType}{" "}
              · {event.activity}
            </p>
          </div>
          <span
            className="text-xs font-bold uppercase px-2 py-1 border-2"
            style={{
              borderColor: STATUS_COLOR[event.status],
              color: STATUS_COLOR[event.status],
            }}
          >
            {event.status.replace(/_/g, " ")}
          </span>
        </div>

        <EventDetailTabs tabs={tabs} active={tab} onChange={setTab} />

        {tab === "overview" && <OverviewTab event={event} />}
        {tab === "schedule" && <ScheduleTab event={event} />}
        {tab === "participants" && (
          <ParticipantsTeamsTab event={event} onChanged={load} />
        )}
        {tab === "fixtures" && isSports && (
          <FixturesTab event={event} onChanged={load} />
        )}
        {tab === "points" && isSports && <PointsTableTab event={event} />}
        {tab === "awards" && (
          <AwardsTab event={event} onGoToSettings={() => setTab("settings")} />
        )}
        {tab === "judges" && <JudgesTab event={event} onChanged={load} />}
        {tab === "documents" && <DocumentsTab event={event} onChanged={load} />}
        {tab === "gallery" && <GalleryTab eventId={event._id} />}
        {tab === "announcements" && <AnnouncementsTab eventId={event._id} />}
        {tab === "payments" && <PaymentsTab eventId={event._id} />}
        {tab === "attendance" && <AttendanceTab eventId={event._id} />}
        {tab === "settings" && canManage && (
          <SettingsTab event={event} onChanged={load} canManage={canManage} />
        )}
      </div>
    </AppLayout>
  );
}
