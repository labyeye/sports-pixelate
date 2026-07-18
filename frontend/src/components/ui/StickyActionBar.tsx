import { Loader2, Check, X } from "lucide-react";

interface StickyActionBarProps {
  onSave: () => void;
  onCancel: () => void;
  saving?: boolean;
  saveLabel?: string;
  cancelLabel?: string;
}

// Sticky bottom Save/Cancel bar for long forms (EventForm).
export function StickyActionBar({
  onSave,
  onCancel,
  saving,
  saveLabel = "Save",
  cancelLabel = "Cancel",
}: StickyActionBarProps) {
  return (
    <div className="sticky bottom-0 left-0 right-0 bg-white border-t-2 border-black mt-6 py-3 flex gap-3 justify-end z-10">
      <button
        type="button"
        onClick={onCancel}
        className="flex items-center gap-2 bg-white border-2 border-black px-4 py-2 font-bold text-sm uppercase hover:bg-gray-50"
      >
        <X className="w-4 h-4" /> {cancelLabel}
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="flex items-center gap-2 bg-[#024BAB] text-white border-2 border-black px-4 py-2 font-bold text-sm uppercase disabled:opacity-60"
      >
        {saving ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Check className="w-4 h-4" />
        )}
        {saveLabel}
      </button>
    </div>
  );
}
