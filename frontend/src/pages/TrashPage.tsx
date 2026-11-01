import { useCallback, useEffect, useState } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { trashAPI } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/utils";
import { confirmDialog } from "@/lib/confirmDialog";

const LABEL: Record<string, string> = {
  Leave: "Leave request",
  Announcement: "Announcement",
  EmployeeDocument: "Document",
  Expense: "Expense",
};

const summary = (t: any) => {
  const d = t.data || {};
  return (
    d.title || d.name || d.reason || d.leaveType || d.category || "Deleted item"
  );
};

export default function TrashPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await trashAPI.getAll();
      setItems(r.data || []);
    } catch (e) {
      toast({
        title: "Error",
        description: getErrorMessage(e),
        variant: "destructive",
      });
    }
    setLoading(false);
  }, [toast]);
  useEffect(() => {
    load();
  }, [load]);

  const restore = async (t: any) => {
    try {
      await trashAPI.restore(t._id);
      setItems((p) => p.filter((x) => x._id !== t._id));
      toast({ title: "Restored" });
    } catch (e) {
      toast({
        title: "Error",
        description: getErrorMessage(e),
        variant: "destructive",
      });
    }
  };

  const purge = async (t: any) => {
    if (!(await confirmDialog("Delete forever? This cannot be undone."))) return;
    try {
      await trashAPI.purge(t._id);
      setItems((p) => p.filter((x) => x._id !== t._id));
    } catch (e) {
      toast({
        title: "Error",
        description: getErrorMessage(e),
        variant: "destructive",
      });
    }
  };

  return (
    <AppLayout title="Trash">
      <div className="max-w-3xl mx-auto">
        <h1 className="font-display font-bold text-3xl text-black">Trash</h1>
        <p className="text-gray-600 font-medium mt-1 mb-6">
          Deleted items are kept for 30 days, then removed for good.
        </p>
        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : items.length === 0 ? (
          <div className="border-2 border-black bg-white p-10 text-center font-bold">
            Trash is empty
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((t) => (
              <div
                key={t._id}
                className="border-2 border-black bg-white p-4 flex items-center gap-4"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold uppercase text-gray-500">
                    {LABEL[t.modelName] || t.modelName}
                  </p>
                  <p className="font-bold truncate">{summary(t)}</p>
                  <p className="text-xs text-gray-500">
                    Deleted{t.deletedByName ? ` by ${t.deletedByName}` : ""} ·{" "}
                    {new Date(t.createdAt).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </p>
                </div>
                <button
                  onClick={() => restore(t)}
                  className="text-[#024BAB]"
                  aria-label="Restore"
                >
                  <RotateCcw className="w-5 h-5" />
                </button>
                <button
                  onClick={() => purge(t)}
                  className="text-red-600"
                  aria-label="Delete forever"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
