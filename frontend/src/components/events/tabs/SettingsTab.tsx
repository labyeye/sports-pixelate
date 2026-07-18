import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Trash2 } from "lucide-react";
import { eventAPI } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { EventForm, type EventFormPayload } from "@/components/events/EventForm";
import type { Event } from "@/types/hrms";

interface Props {
  event: Event;
  onChanged: () => void;
  canManage: boolean;
}

// Renders the shared EventForm in edit mode — one source of truth for the
// form UI shared with EventCreatePage, prefilled with the current event.
export function SettingsTab({ event, onChanged, canManage }: Props) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleSubmit = async (
    payload: EventFormPayload,
    files: { coverImage?: File; bannerImage?: File },
  ) => {
    setSaving(true);
    try {
      await eventAPI.update(event._id, payload);
      if (files.coverImage || files.bannerImage) {
        await eventAPI.uploadImages(event._id, files);
      }
      toast({ title: "Saved", description: "Event updated successfully" });
      onChanged();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${event.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await eventAPI.delete(event._id);
      toast({ title: "Deleted", description: "Event deleted" });
      navigate("/events");
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <EventForm mode="edit" initialValue={event} onSubmit={handleSubmit} onCancel={onChanged} saving={saving} />
      {canManage && (
        <div className="border-2 border-black bg-white p-4">
          <h3 className="font-bold text-sm mb-2 text-red-600">Danger Zone</h3>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="border-2 border-black bg-red-500 text-white px-3 py-1.5 text-xs font-bold flex items-center gap-2 disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" /> {deleting ? "Deleting..." : "Delete Event"}
          </button>
        </div>
      )}
    </div>
  );
}
