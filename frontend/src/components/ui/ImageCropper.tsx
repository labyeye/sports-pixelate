import { useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Check, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface CropRequest {
  file: File;
  aspect: number;
  resolve: (file: File | null) => void;
}

let pushRequest: ((r: CropRequest) => void) | null = null;

/**
 * Opens the crop dialog for an image and resolves with the cropped File,
 * or null if the user cancelled. Non-image files are returned untouched.
 * Requires <ImageCropHost /> to be mounted once near the app root.
 */
export function cropImage(
  file: File | null | undefined,
  opts: { aspect?: number } = {},
): Promise<File | null> {
  if (!file) return Promise.resolve(null);
  if (!file.type.startsWith("image/") || !pushRequest)
    return Promise.resolve(file);
  return new Promise((resolve) =>
    pushRequest!({ file, aspect: opts.aspect ?? 1, resolve }),
  );
}

const ASPECTS: { label: string; value: number }[] = [
  { label: "1:1", value: 1 },
  { label: "4:3", value: 4 / 3 },
  { label: "3:4", value: 3 / 4 },
  { label: "16:9", value: 16 / 9 },
];

const MAX_SIDE = 2048;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function getCroppedFile(
  src: string,
  area: Area,
  original: File,
): Promise<File> {
  const img = await loadImage(src);
  const scale = Math.min(1, MAX_SIDE / Math.max(area.width, area.height));
  const w = Math.round(area.width * scale);
  const h = Math.round(area.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, w, h);
  // Keep PNG for transparency (logos); everything else becomes JPEG.
  const isPng = original.type === "image/png";
  const type = isPng ? "image/png" : "image/jpeg";
  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Crop failed"))),
      type,
      0.92,
    ),
  );
  const base = original.name.replace(/\.[^.]+$/, "") || "photo";
  return new File([blob], `${base}.${isPng ? "png" : "jpg"}`, { type });
}

export function ImageCropHost() {
  const [req, setReq] = useState<CropRequest | null>(null);
  const [src, setSrc] = useState("");
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspect, setAspect] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    pushRequest = (r) => {
      setReq(r);
      setAspect(r.aspect);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setArea(null);
      setSrc(URL.createObjectURL(r.file));
    };
    return () => {
      pushRequest = null;
    };
  }, []);

  const close = (result: File | null) => {
    req?.resolve(result);
    if (src) URL.revokeObjectURL(src);
    setReq(null);
    setSrc("");
    setBusy(false);
  };

  const confirm = async () => {
    if (!req || !area) return;
    setBusy(true);
    try {
      close(await getCroppedFile(src, area, req.file));
    } catch {
      // Fall back to the uncropped original rather than losing the upload.
      close(req.file);
    }
  };

  if (!req) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 flex items-start sm:items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-lg border-2 border-black bg-white flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b-2 border-black bg-[#024BAB]">
          <h3 className="font-bold text-white">Crop Photo</h3>
          <button
            onClick={() => close(null)}
            className="text-white hover:opacity-80"
            aria-label="Cancel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative w-full h-72 sm:h-96 bg-black">
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_, px) => setArea(px)}
          />
        </div>

        <div className="p-4 space-y-3 border-t-2 border-black">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase">Zoom</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 accent-[#024BAB]"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold uppercase">Shape</span>
            {ASPECTS.map((a) => (
              <button
                key={a.label}
                type="button"
                onClick={() => setAspect(a.value)}
                className={cn(
                  "border-2 border-black px-2.5 py-1 text-xs font-bold",
                  Math.abs(aspect - a.value) < 0.001
                    ? "bg-[#024BAB] text-white"
                    : "bg-white hover:bg-[#024BAB]/5",
                )}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 px-4 py-3 border-t-2 border-black">
          <button
            onClick={() => close(null)}
            className="border-2 border-black bg-white px-4 py-2 text-sm font-bold uppercase"
          >
            Cancel
          </button>
          <button
            onClick={confirm}
            disabled={busy || !area}
            className="flex items-center gap-2 border-2 border-black bg-[#024BAB] text-white px-4 py-2 text-sm font-bold uppercase disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            Crop &amp; Use
          </button>
        </div>
      </div>
    </div>
  );
}
