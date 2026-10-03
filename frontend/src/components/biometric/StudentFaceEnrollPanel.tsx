import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { studentAPI } from "@/services/api";
import { useToast } from "@/hooks/use-toast";

interface FaceStatus {
  total: number;
  enrolled: number;
  missingCount: number;
  missing: { _id: string; studentId: string; firstName: string; lastName: string }[];
}

interface RowResult {
  file: string;
  studentId?: string;
  status: "enrolled" | "failed";
  error?: string;
}

const BATCH = 25;

// Owner tool for rolling face attendance out to every student: shows who still
// has no face on file and enrolls many photos at once (file name = student ID).
export function StudentFaceEnrollPanel() {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<FaceStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [results, setResults] = useState<RowResult[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await studentAPI.getFaceStatus();
      setStatus(res.data);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length || busy) return;
    const all = Array.from(files);
    setBusy(true);
    setResults([]);
    const collected: RowResult[] = [];
    try {
      for (let i = 0; i < all.length; i += BATCH) {
        setProgress(`Enrolling ${Math.min(i + BATCH, all.length)} / ${all.length}…`);
        const res = await studentAPI.bulkEnrollFaces(all.slice(i, i + BATCH));
        collected.push(...res.data.results);
      }
      setResults(collected);
      const ok = collected.filter((r) => r.status === "enrolled").length;
      toast({
        title: "Bulk enrollment done",
        description: `${ok} enrolled, ${collected.length - ok} failed`,
        variant: ok ? "success" : "destructive",
      });
    } catch (e: any) {
      setResults(collected);
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
      setProgress("");
      if (inputRef.current) inputRef.current.value = "";
      load();
    }
  };

  const failed = results.filter((r) => r.status === "failed");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm">
          <span className="font-bold">
            {status ? `${status.enrolled} / ${status.total}` : "—"}
          </span>{" "}
          students have a face enrolled
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-2 bg-[#024BAB] text-white border-2 border-black px-4 py-2 font-bold text-xs uppercase disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Upload className="w-4 h-4" />
          )}
          {busy ? progress : "Upload photos"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>
      <p className="text-xs text-gray-500">
        Name each photo after the student&apos;s ID (for example STU-0012.jpg).
        One clear, front-facing face per photo. Photos are not stored — only the
        face data is.
      </p>

      {failed.length > 0 && (
        <div className="border-2 border-black bg-red-50 p-3 text-xs space-y-1 max-h-40 overflow-y-auto">
          {failed.map((r, i) => (
            <p key={i}>
              <span className="font-bold">{r.file}</span>: {r.error}
            </p>
          ))}
        </div>
      )}

      {status && status.missingCount > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer font-bold">
            {status.missingCount} without a face
          </summary>
          <p className="mt-2 text-gray-600 max-h-40 overflow-y-auto">
            {status.missing
              .map((s) => `${s.studentId} (${s.firstName} ${s.lastName})`)
              .join(", ")}
          </p>
        </details>
      )}
    </div>
  );
}
