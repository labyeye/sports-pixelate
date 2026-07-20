import { useEffect, useState } from "react";
import { Image as ImageIcon, Trash2, Loader2 } from "lucide-react";
import { eventAPI } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { FileUpload } from "@/components/ui/FileUpload";

interface GalleryItem {
  _id: string;
  url: string;
  caption?: string;
  createdAt: string;
}

interface Props {
  eventId: string;
}

// Shell tab: basic list + upload wired to a real endpoint, no albums/reorder/etc.
export function GalleryTab({ eventId }: Props) {
  const { toast } = useToast();
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await eventAPI.getGallery(eventId);
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

  const upload = async (file: File) => {
    setUploading(true);
    try {
      await eventAPI.addGalleryItem(eventId, file, "");
      await load();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const remove = async (itemId: string) => {
    setBusyId(itemId);
    try {
      await eventAPI.deleteGalleryItem(eventId, itemId);
      setItems((prev) => prev.filter((i) => i._id !== itemId));
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="border-2 border-black bg-white p-4">
      <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
        <ImageIcon className="w-4 h-4" /> Gallery ({items.length})
      </h3>
      <div className="mb-4">
        <FileUpload
          isImage
          onFileSelected={upload}
          uploading={uploading}
          label="Add photo"
        />
      </div>
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">
          No photos yet — upload one above.
        </p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {items.map((item) => (
            <div
              key={item._id}
              className="relative border-2 border-black h-28 overflow-hidden group"
            >
              <img
                src={item.url}
                alt={item.caption || ""}
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => remove(item._id)}
                disabled={busyId === item._id}
                className="absolute top-1 right-1 bg-white border-2 border-black p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                {busyId === item._id ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Trash2 className="w-3 h-3" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
