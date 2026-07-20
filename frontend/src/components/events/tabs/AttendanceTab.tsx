import { useEffect, useState } from "react";
import { ClipboardCheck, Loader2 } from "lucide-react";
import { eventAPI } from "@/services/api";
import { useToast } from "@/hooks/use-toast";

interface AttendanceRecord {
  _id: string;
  student?: { firstName: string; lastName: string } | string;
  status: "present" | "absent";
  markedAt: string;
}

interface Props {
  eventId: string;
}

// Read-only shell tab — no QR check-in / attendance-marking subsystem yet.
export function AttendanceTab({ eventId }: Props) {
  const { toast } = useToast();
  const [items, setItems] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await eventAPI.getAttendance(eventId);
        setItems(res.data || []);
      } catch (e: any) {
        toast({
          title: "Error",
          description: e.message,
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    })();
  }, [eventId]);

  return (
    <div className="border-2 border-black bg-white p-4">
      <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
        <ClipboardCheck className="w-4 h-4" /> Attendance ({items.length})
      </h3>
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">
          No attendance recorded yet. Enable QR Check-in / Attendance Tracking
          in Settings to start.
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((r) => (
            <div
              key={r._id}
              className="flex items-center justify-between border-2 border-black/10 px-3 py-2"
            >
              <span className="text-sm font-bold">
                {typeof r.student === "object"
                  ? `${r.student.firstName} ${r.student.lastName}`
                  : "Participant"}
              </span>
              <span
                className={`text-xs font-bold uppercase ${r.status === "present" ? "text-[#00C48C]" : "text-red-500"}`}
              >
                {r.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
