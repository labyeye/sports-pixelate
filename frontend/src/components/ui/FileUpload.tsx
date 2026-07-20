import { useRef, useState } from "react";
import { UploadCloud, X, FileText, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileUploadProps {
  label?: string;
  accept?: string;
  isImage?: boolean;
  /** Existing/staged preview URL (server URL in edit mode, object URL when staged pre-create) */
  previewUrl?: string | null;
  fileName?: string | null;
  onFileSelected: (file: File) => void;
  onClear?: () => void;
  uploading?: boolean;
  className?: string;
}

// Single generalized upload control: used for cover/banner/gallery images
// (isImage=true, shows a preview thumbnail) AND generic documents
// (isImage=false, shows a filename chip) — avoids two near-duplicate
// components for what is the same "pick a file, show what's picked" flow.
export function FileUpload({
  label,
  accept,
  isImage = false,
  previewUrl,
  fileName,
  onFileSelected,
  onClear,
  uploading,
  className,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  const handlePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (isImage) setLocalPreview(URL.createObjectURL(file));
    onFileSelected(file);
    e.target.value = "";
  };

  const shownPreview = localPreview || previewUrl;

  return (
    <div className={className}>
      {label && (
        <label className="block text-xs font-bold uppercase mb-1">
          {label}
        </label>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept || (isImage ? "image/*" : undefined)}
        onChange={handlePick}
        className="hidden"
      />
      {isImage && shownPreview ? (
        <div className="relative border-2 border-black w-full h-32 overflow-hidden group">
          <img
            src={shownPreview}
            alt={label || "preview"}
            className="w-full h-full object-cover"
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center text-white text-xs font-bold opacity-0 group-hover:opacity-100 transition-all"
          >
            Change
          </button>
          {onClear && (
            <button
              type="button"
              onClick={() => {
                setLocalPreview(null);
                onClear();
              }}
              className="absolute top-1 right-1 bg-white border-2 border-black p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      ) : !isImage && fileName ? (
        <div className="flex items-center justify-between border-2 border-black px-3 py-2">
          <span className="flex items-center gap-2 text-xs font-bold truncate">
            <FileText className="w-3.5 h-3.5 shrink-0" /> {fileName}
          </span>
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              className="text-red-500 hover:text-red-700 shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={cn(
            "w-full flex items-center justify-center gap-2 border-2 border-dashed border-black/40 px-3 py-4 text-xs font-bold text-muted-foreground hover:border-black hover:text-black transition-colors disabled:opacity-50",
          )}
        >
          {uploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <UploadCloud className="w-4 h-4" />
          )}
          {uploading
            ? "Uploading..."
            : isImage
              ? "Upload image"
              : "Upload file"}
        </button>
      )}
    </div>
  );
}
