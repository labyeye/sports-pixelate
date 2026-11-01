import { useCallback, useEffect, useState } from "react";
import { Megaphone, Pin, Plus, Trash2, CheckCircle2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { announcementAPI } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/utils";
import { confirmDialog } from "@/lib/confirmDialog";

const CATEGORIES = ["general", "urgent", "event", "holiday", "policy", "hr"];
const PRIORITIES = ["low", "medium", "high", "critical"];
const AUDIENCES = [
  { v: "all", l: "Everyone" },
  { v: "parents", l: "Parents" },
  { v: "staff", l: "Staff" },
];
const PRIORITY_COLOR: Record<string, string> = {
  low: "bg-gray-100 text-gray-700 border-gray-300",
  medium: "bg-blue-100 text-blue-800 border-blue-300",
  high: "bg-orange-100 text-orange-800 border-orange-300",
  critical: "bg-red-100 text-red-800 border-red-300",
};

const EMPTY = {
  title: "",
  content: "",
  category: "general",
  priority: "medium",
  audience: "all",
  pinned: false,
  acknowledgementRequired: false,
};

export default function AnnouncementsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === "super_admin" || user?.role === "hr_manager";
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [poster, setPoster] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await announcementAPI.getAll();
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

  const open = (a: any) => {
    if (!isAdmin && !a.read) {
      announcementAPI.markRead(a._id).catch(() => {});
      setItems((p) => p.map((x) => (x._id === a._id ? { ...x, read: true } : x)));
    }
  };

  const acknowledge = async (a: any) => {
    try {
      await announcementAPI.acknowledge(a._id);
      setItems((p) =>
        p.map((x) =>
          x._id === a._id ? { ...x, read: true, acknowledged: true } : x,
        ),
      );
    } catch (e) {
      toast({
        title: "Error",
        description: getErrorMessage(e),
        variant: "destructive",
      });
    }
  };

  const remove = async (a: any) => {
    if (!(await confirmDialog(`Delete "${a.title}"?`))) return;
    try {
      await announcementAPI.delete(a._id);
      setItems((p) => p.filter((x) => x._id !== a._id));
      toast({ title: "Moved to Trash" });
    } catch (e) {
      toast({
        title: "Error",
        description: getErrorMessage(e),
        variant: "destructive",
      });
    }
  };

  const save = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      toast({
        title: "Title and message are required",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      let posterUrl: string | undefined;
      if (poster) posterUrl = (await announcementAPI.uploadPoster(poster)).url;
      await announcementAPI.create({
        title: form.title.trim(),
        content: form.content.trim(),
        category: form.category,
        priority: form.priority,
        pinned: form.pinned,
        acknowledgementRequired: form.acknowledgementRequired,
        posterUrl,
        ...(form.audience === "all"
          ? { targetAudience: "all" }
          : {
              targetAudience: "role",
              roles:
                form.audience === "parents"
                  ? ["parent"]
                  : ["employee", "department_head", "hr_executive"],
            }),
      });
      setShowForm(false);
      setForm({ ...EMPTY });
      setPoster(null);
      await load();
      toast({ title: "Announcement published" });
    } catch (e) {
      toast({
        title: "Error",
        description: getErrorMessage(e),
        variant: "destructive",
      });
    }
    setSaving(false);
  };

  const field =
    "w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none";

  return (
    <AppLayout title="Announcements">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="font-display font-bold text-3xl text-black">
              Announcements
            </h1>
            <p className="text-gray-600 font-medium mt-1">
              Notices for parents and staff
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowForm((v) => !v)}
              className="flex items-center gap-2 bg-[#024BAB] text-white border-2 border-black px-4 py-2 font-bold text-sm uppercase"
            >
              <Plus className="w-4 h-4" /> New
            </button>
          )}
        </div>

        {showForm && (
          <div className="border-2 border-black bg-white p-5 mb-6 space-y-3">
            <input
              className={field}
              placeholder="Title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <textarea
              className={field}
              rows={4}
              placeholder="Message"
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
            />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <select
                className={field}
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                className={field}
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
              >
                {PRIORITIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                className={field}
                value={form.audience}
                onChange={(e) => setForm({ ...form, audience: e.target.value })}
              >
                {AUDIENCES.map((a) => (
                  <option key={a.v} value={a.v}>
                    {a.l}
                  </option>
                ))}
              </select>
            </div>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => setPoster(e.target.files?.[0] || null)}
              className="text-sm"
            />
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={form.pinned}
                onChange={(e) => setForm({ ...form, pinned: e.target.checked })}
              />
              Pin to top
            </label>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={form.acknowledgementRequired}
                onChange={(e) =>
                  setForm({
                    ...form,
                    acknowledgementRequired: e.target.checked,
                  })
                }
              />
              Ask readers to acknowledge
            </label>
            <button
              onClick={save}
              disabled={saving}
              className="bg-[#024BAB] text-white border-2 border-black px-5 py-2 font-bold text-sm uppercase disabled:opacity-50"
            >
              {saving ? "Publishing…" : "Publish"}
            </button>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : items.length === 0 ? (
          <div className="border-2 border-black bg-white p-10 text-center">
            <Megaphone className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p className="font-bold">No announcements yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((a) => (
              <div
                key={a._id}
                onClick={() => open(a)}
                className={`border-2 border-black bg-white p-5 ${
                  !isAdmin && !a.read ? "border-l-8 border-l-[#024BAB]" : ""
                }`}
              >
                {a.posterUrl && (
                  <img
                    src={announcementAPI.assetUrl(a.posterUrl)}
                    alt=""
                    className="w-full max-h-64 object-cover mb-3 border-2 border-black"
                  />
                )}
                <div className="flex items-center gap-2">
                  {a.pinned && <Pin className="w-4 h-4 text-orange-500" />}
                  <h2 className="font-bold text-lg flex-1">{a.title}</h2>
                  {isAdmin && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        remove(a);
                      }}
                      className="text-red-600"
                      aria-label="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className="text-xs font-bold uppercase border px-2 py-0.5 bg-blue-50 border-blue-200 text-blue-800">
                    {a.category}
                  </span>
                  <span
                    className={`text-xs font-bold uppercase border px-2 py-0.5 ${
                      PRIORITY_COLOR[a.priority] || PRIORITY_COLOR.medium
                    }`}
                  >
                    {a.priority}
                  </span>
                  {a.targetAudience === "role" && (
                    <span className="text-xs font-bold uppercase border px-2 py-0.5 bg-purple-50 border-purple-200 text-purple-800">
                      {(a.roles || []).includes("parent") ? "Parents" : "Staff"}
                    </span>
                  )}
                </div>
                <p className="mt-3 text-sm whitespace-pre-wrap">{a.content}</p>
                <p className="mt-3 text-xs text-gray-500">
                  {a.postedBy?.name ? `${a.postedBy.name} · ` : ""}
                  {new Date(a.date || a.createdAt).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                  {isAdmin &&
                    ` · ${(a.readBy || []).length} read${
                      a.acknowledgementRequired
                        ? ` · ${(a.acknowledgedBy || []).length} acknowledged`
                        : ""
                    }`}
                </p>
                {!isAdmin &&
                  a.acknowledgementRequired &&
                  (a.acknowledged ? (
                    <p className="mt-3 flex items-center gap-1 text-xs font-bold text-green-700">
                      <CheckCircle2 className="w-4 h-4" /> Acknowledged
                    </p>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        acknowledge(a);
                      }}
                      className="mt-3 bg-[#024BAB] text-white border-2 border-black px-4 py-2 text-xs font-bold uppercase"
                    >
                      I have read this
                    </button>
                  ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
