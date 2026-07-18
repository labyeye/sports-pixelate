import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { eventAPI } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { EventForm, type EventFormPayload, type StagedOfficial } from "@/components/events/EventForm";

export default function EventCreatePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (
    payload: EventFormPayload,
    files: { coverImage?: File; bannerImage?: File },
    stagedOfficials: StagedOfficial[],
  ) => {
    setSaving(true);
    try {
      const res = await eventAPI.create(payload);
      const id = res.data._id;
      if (files.coverImage || files.bannerImage) {
        await eventAPI.uploadImages(id, files);
      }
      for (const official of stagedOfficials) {
        await eventAPI.addOfficial(id, official);
      }
      toast({ title: "Event created", description: `"${payload.name}" is ready.` });
      navigate(`/events/${id}`);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout title="New Event">
      <h1 className="font-display font-bold text-2xl text-black mb-4">Create Event</h1>
      <EventForm mode="create" onSubmit={handleSubmit} onCancel={() => navigate("/events")} saving={saving} />
    </AppLayout>
  );
}
