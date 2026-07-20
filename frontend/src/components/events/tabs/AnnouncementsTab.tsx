import { useEffect, useState } from "react";
import { Megaphone, Loader2 } from "lucide-react";
import { eventAPI } from "@/services/api";
import { useToast } from "@/hooks/use-toast";

interface Announcement {
  _id: string;
  title: string;
  message: string;
  createdAt: string;
}

interface Props {
  eventId: string;
}

const inputClass =
  "w-full border-2 border-black px-2 py-1.5 text-sm font-medium outline-none bg-white";

// Shell tab: list + simple create, no edit/delete/scheduling yet.
export function AnnouncementsTab({ eventId }: Props) {
  const { toast } = useToast();
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [posting, setPosting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await eventAPI.getAnnouncements(eventId);
      setItems(res.data || []);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const post = async () => {
    if (!title.trim() || !message.trim() || posting) return;
    setPosting(true);
    try {
      await eventAPI.createAnnouncement(eventId, {
        title: title.trim(),
        message: message.trim(),
      });
      setTitle("");
      setMessage("");
      await load();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="border-2 border-black bg-white p-4">
      <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
        <Megaphone className="w-4 h-4" /> Announcements ({items.length})
      </h3>
      <div className="space-y-2 mb-4">
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            No announcements posted yet.
          </p>
        ) : (
          items.map((a) => (
            <div key={a._id} className="border-2 border-black/10 px-3 py-2">
              <p className="text-sm font-bold">{a.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {a.message}
              </p>
            </div>
          ))
        )}
      </div>
      <div className="grid grid-cols-1 gap-2">
        <input
          placeholder="Title"
          className={inputClass}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          placeholder="Message"
          className={inputClass}
          rows={2}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <button
          onClick={post}
          disabled={posting || !title.trim() || !message.trim()}
          className="border-2 border-black bg-[#024BAB] text-white px-3 py-1.5 text-xs font-bold self-start disabled:opacity-50"
        >
          {posting ? "Posting..." : "Post Announcement"}
        </button>
      </div>
    </div>
  );
}
