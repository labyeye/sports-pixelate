import { useState } from "react";
import { FileText, Trash2, Loader2 } from "lucide-react";
import { eventAPI } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { FileUpload } from "@/components/ui/FileUpload";
import type { Event, EventDocument } from "@/types/hrms";

interface Props {
  event: Event;
  onChanged: () => void;
}

const KIND_LABELS: Record<EventDocument["kind"], string> = {
  rule_book: "Rule Book",
  guidelines: "Guidelines",
  consent_form: "Consent Form",
  medical_form: "Medical Form",
  performance_music: "Performance Music",
  fixture_pdf: "Fixture PDF",
  other: "Other Document",
};

export function DocumentsTab({ event, onChanged }: Props) {
  const { toast } = useToast();
  const [kind, setKind] = useState<EventDocument["kind"]>("rule_book");
  const [label, setLabel] = useState("");
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const upload = async (file: File) => {
    setUploading(true);
    try {
      await eventAPI.addDocument(event._id, file, kind, label.trim());
      setLabel("");
      onChanged();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const remove = async (docId: string) => {
    setBusyId(docId);
    try {
      await eventAPI.removeDocument(event._id, docId);
      onChanged();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="border-2 border-black bg-white p-4">
      <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
        <FileText className="w-4 h-4" /> Documents ({event.documents.length})
      </h3>
      <div className="space-y-2 mb-4">
        {event.documents.map((d) => (
          <div
            key={d._id}
            className="flex items-center justify-between border-2 border-black/10 px-3 py-2"
          >
            <a
              href={d.url}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-bold hover:underline"
            >
              {d.label || KIND_LABELS[d.kind]}
              <span className="ml-2 text-[11px] text-muted-foreground font-normal">
                {KIND_LABELS[d.kind]}
              </span>
            </a>
            <button
              onClick={() => remove(d._id)}
              disabled={busyId === d._id}
              className="text-red-500 hover:text-red-700"
            >
              {busyId === d._id ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        ))}
        {event.documents.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No documents uploaded yet
          </p>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
        <div>
          <label className="block text-xs font-bold uppercase mb-1">Type</label>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as EventDocument["kind"])}
            className="w-full border-2 border-black px-2 py-1.5 text-sm font-medium bg-white"
          >
            {Object.entries(KIND_LABELS).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold uppercase mb-1">
            Label (optional)
          </label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full border-2 border-black px-2 py-1.5 text-sm font-medium bg-white"
            placeholder="e.g. 2026 Rule Book"
          />
        </div>
        <FileUpload onFileSelected={upload} uploading={uploading} />
      </div>
    </div>
  );
}
