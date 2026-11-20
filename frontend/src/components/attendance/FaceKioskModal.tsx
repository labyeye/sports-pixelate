// Full-screen face attendance kiosk for a spare wall-mounted phone / tablet / laptop signed in as admin.
// Watches the camera, and once a face is steady sends a frame to the server, which recognises the
// employee and toggles their day (first scan = check-in, next = check-out). Manual marking elsewhere is unchanged.
import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, LogOut, ScanFace, X, XCircle } from "lucide-react";
import { useFaceRecognition } from "@/hooks/useFaceRecognition";
import { attendanceAPI } from "@/services/api";

type Result = { ok: boolean; title: string; sub: string };
const RESULT_MS = 3500;

export default function FaceKioskModal({
  onClose,
  onMarked,
}: {
  onClose: () => void;
  onMarked?: () => void;
}) {
  const {
    videoRef,
    canvasRef,
    loadState,
    cameraActive,
    liveDetection,
    startCamera,
    stopCamera,
    startLiveDetection,
  } = useFaceRecognition();
  const [result, setResult] = useState<Result | null>(null);
  const [hint, setHint] = useState("Look at the camera");
  const [fatal, setFatal] = useState("");
  const [action, setAction] = useState<"checkin" | "checkout">("checkin");
  const actionRef = useRef(action);
  actionRef.current = action;
  const busy = useRef(false);
  const cooldownUntil = useRef(0);
  const faceSince = useRef<number | null>(null);

  useEffect(() => {
    startCamera().catch((e: any) =>
      setFatal(e.message || "Camera unavailable"),
    );
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (cameraActive && loadState === "ready") startLiveDetection();
  }, [cameraActive, loadState, startLiveDetection]);

  const scan = useCallback(async () => {
    busy.current = true;
    setHint("Scanning…");
    try {
      // No blink step: like a wall-mounted device, a steady face is enough. The server re-derives the embedding from the photo.
      const video = videoRef.current!;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d")!.drawImage(video, 0, 0);
      const blob: Blob = await new Promise((res, rej) =>
        canvas.toBlob(
          (b) => (b ? res(b) : rej(new Error("Capture failed"))),
          "image/jpeg",
          0.85,
        ),
      );
      setHint("Verifying…");
      const { data, locked } = await attendanceAPI.kioskFace(
        blob,
        actionRef.current,
      );
      const time = new Date(data.timestamp).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const personName =
        data.person?.name ||
        data.employee?.name ||
        data.student?.name ||
        "Recognized";
      if (locked) setResult({ ok: true, title: personName, sub: data.message });
      else if (data.type === "check_in")
        setResult({
          ok: true,
          title: personName,
          sub: `Checked in at ${time}`,
        });
      else
        setResult({
          ok: true,
          title: personName,
          sub: `Checked out at ${time}${data.workHours ? ` · ${data.workHours.toFixed(1)} hrs` : ""}`,
        });
      if (!locked) onMarked?.();
    } catch (e: any) {
      setResult({
        ok: false,
        title: "Not marked",
        sub: e.message || "Please try again",
      });
    } finally {
      cooldownUntil.current = Date.now() + RESULT_MS;
      faceSince.current = null;
      setTimeout(() => {
        setResult(null);
        setHint("Look at the camera");
        busy.current = false;
      }, RESULT_MS);
    }
  }, [onMarked, videoRef]);

  // Start a scan once a face has stayed in frame for ~1s and we're not mid-scan or showing a result.
  useEffect(() => {
    if (busy.current || Date.now() < cooldownUntil.current) return;
    if (!liveDetection) {
      faceSince.current = null;
      return;
    }
    faceSince.current ??= Date.now();
    if (Date.now() - faceSince.current >= 1000) scan();
  }, [liveDetection, scan]);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black text-white">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-2 font-bold">
          <ScanFace className="h-5 w-5" /> Face Attendance
        </div>
        <button
          onClick={onClose}
          className="rounded border border-white/40 p-2"
          aria-label="Close kiosk"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          className="h-full w-full -scale-x-100 object-cover"
        />
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-0 h-full w-full -scale-x-100 object-cover opacity-0"
        />
        {loadState === "loading" && (
          <p className="absolute">Loading face models…</p>
        )}
        {(fatal || loadState === "error") && (
          <p className="absolute max-w-xs text-center text-red-300">
            {fatal || "Could not load face models"}
          </p>
        )}

        <div className="absolute top-4 flex gap-2">
          {(["checkin", "checkout"] as const).map((a) => (
            <button
              key={a}
              onClick={() => setAction(a)}
              className={`border-2 px-5 py-2 text-sm font-bold ${
                action === a
                  ? "border-white bg-white text-black"
                  : "border-white/40 text-white"
              }`}
            >
              {a === "checkin" ? "Check In" : "Check Out"}
            </button>
          ))}
        </div>
        {!result && !fatal && (
          <div className="absolute bottom-10 rounded-full bg-black/60 px-5 py-2 text-sm font-medium">
            {hint}
          </div>
        )}
        {result && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/75 p-6 text-center">
            {result.ok ? (
              <CheckCircle2 className="h-20 w-20 text-green-400" />
            ) : (
              <XCircle className="h-20 w-20 text-red-400" />
            )}
            <p className="text-3xl font-bold">{result.title}</p>
            <p className="flex items-center gap-2 text-lg text-white/80">
              {result.ok && result.sub.startsWith("Checked out") && (
                <LogOut className="h-5 w-5" />
              )}
              {result.sub}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
