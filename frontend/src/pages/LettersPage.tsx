// Letters (web): reusable letter templates (offer, appointment, experience,
// relieving) with {{placeholders}}. "Generate" fills a template for a staff
// member and opens the print dialog. Backend: offerLetterAPI.

import { useState, useEffect, useCallback } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { offerLetterAPI, employeeAPI } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/utils";
import { confirmDialog } from "@/lib/confirmDialog";
import { FileText, Plus, Trash2, Edit2, Printer, Loader2, X } from "lucide-react";

interface Letter {
  _id: string;
  name: string;
  body: string;
  uses: number;
}

const HINT =
  "{{name}} {{designation}} {{company}} {{empId}} {{joiningDate}} {{ctc}} {{fromDate}} {{toDate}} {{exitDate}}";

export default function LettersPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [letters, setLetters] = useState<Letter[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<{ id?: string; name: string; body: string } | null>(null);
  const [gen, setGen] = useState<{ letter: Letter; empId: string; text: string } | null>(null);

  const fail = (e: unknown) =>
    toast({ title: "Error", description: getErrorMessage(e), variant: "destructive" });

  const load = useCallback(async () => {
    try {
      setLetters((await offerLetterAPI.getAll()).data || []);
    } catch (e) {
      fail(e);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
    employeeAPI
      .getAll({ limit: "200" })
      .then((r: any) => setStaff(r.data || []))
      .catch(() => {});
  }, [load]);

  const save = async () => {
    if (!edit || !edit.name.trim()) return;
    try {
      const body = { name: edit.name.trim(), body: edit.body };
      if (edit.id) await offerLetterAPI.update(edit.id, body);
      else await offerLetterAPI.create(body);
      setEdit(null);
      await load();
    } catch (e) {
      fail(e);
    }
  };

  const remove = async (l: Letter) => {
    if (!(await confirmDialog(`Delete "${l.name}"?`))) return;
    try {
      await offerLetterAPI.delete(l._id);
      setLetters((p) => p.filter((x) => x._id !== l._id));
    } catch (e) {
      fail(e);
    }
  };

  const fill = (body: string, empId: string) => {
    const e = staff.find((s) => s._id === empId);
    const vals: Record<string, string> = {
      name: e ? `${e.firstName || ""} ${e.lastName || ""}`.trim() : "",
      designation: e?.designation || "",
      company: (user as any)?.company?.name || "",
      empId: e?.employeeId || "",
      joiningDate: e?.joinDate ? new Date(e.joinDate).toLocaleDateString("en-IN") : "",
    };
    return body.replace(/{{(\w+)}}/g, (m, k) => vals[k] || m);
  };

  const print = (text: string) => {
    const w = window.open("", "_blank");
    if (!w) return;
    const esc = text.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    w.document.write(
      `<pre style="font:14px/1.6 Georgia,serif;white-space:pre-wrap;padding:40px">${esc}</pre>`,
    );
    w.document.close();
    w.print();
  };

  return (
    <AppLayout title="Letters">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-start justify-between mb-6 gap-3">
          <div>
            <h1 className="font-display font-bold text-3xl text-black">Letters</h1>
            <p className="text-gray-600 font-medium mt-1">
              Offer, appointment and experience letter templates
            </p>
          </div>
          <button
            onClick={() => setEdit({ name: "", body: "" })}
            className="flex items-center gap-2 bg-[#024BAB] text-white border-2 border-black px-4 py-2 font-bold text-sm uppercase shrink-0"
          >
            <Plus className="w-4 h-4" /> New Template
          </button>
        </div>

        {loading ? (
          <div className="py-16 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : (
          <div className="space-y-3">
            {letters.map((l) => (
              <div key={l._id} className="border-2 border-black bg-white p-4 flex items-center gap-3">
                <div className="w-10 h-10 bg-[#024BAB]/10 border-2 border-[#024BAB] flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 text-[#024BAB]" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold truncate">{l.name}</p>
                  <p className="text-xs text-gray-600 truncate">{l.body.slice(0, 90)}</p>
                </div>
                <button
                  onClick={() => setGen({ letter: l, empId: "", text: l.body })}
                  className="px-3 py-1.5 border-2 border-black text-xs font-bold uppercase"
                >
                  Generate
                </button>
                <button onClick={() => setEdit({ id: l._id, name: l.name, body: l.body })}>
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => remove(l)}>
                  <Trash2 className="w-4 h-4 text-red-600" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {edit && (
        <div className="nb-backdrop fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="nb-modal border-2 border-black bg-white w-full max-w-lg p-5 space-y-3">
            <div className="flex justify-between">
              <h2 className="font-bold text-lg">{edit.id ? "Edit" : "New"} template</h2>
              <button onClick={() => setEdit(null)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              className="w-full border-2 border-black px-3 py-2 text-sm"
              placeholder="Template name"
              value={edit.name}
              onChange={(e) => setEdit({ ...edit, name: e.target.value })}
            />
            <textarea
              className="w-full border-2 border-black px-3 py-2 text-sm"
              rows={10}
              value={edit.body}
              onChange={(e) => setEdit({ ...edit, body: e.target.value })}
            />
            <p className="text-[11px] text-gray-500 break-words">Placeholders: {HINT}</p>
            <button
              onClick={save}
              className="w-full bg-[#024BAB] text-white border-2 border-black py-2 font-bold uppercase text-sm"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {gen && (
        <div className="nb-backdrop fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <div className="nb-modal border-2 border-black bg-white w-full max-w-lg p-5 space-y-3">
            <div className="flex justify-between">
              <h2 className="font-bold text-lg">{gen.letter.name}</h2>
              <button onClick={() => setGen(null)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <select
              className="w-full border-2 border-black px-3 py-2 text-sm bg-white"
              value={gen.empId}
              onChange={(e) =>
                setGen({ ...gen, empId: e.target.value, text: fill(gen.letter.body, e.target.value) })
              }
            >
              <option value="">Select staff member…</option>
              {staff.map((s) => (
                <option key={s._id} value={s._id}>
                  {`${s.firstName || ""} ${s.lastName || ""}`.trim()}
                </option>
              ))}
            </select>
            <textarea
              className="w-full border-2 border-black px-3 py-2 text-sm"
              rows={12}
              value={gen.text}
              onChange={(e) => setGen({ ...gen, text: e.target.value })}
            />
            <button
              onClick={() => print(gen.text)}
              className="w-full flex items-center justify-center gap-2 bg-[#024BAB] text-white border-2 border-black py-2 font-bold uppercase text-sm"
            >
              <Printer className="w-4 h-4" /> Print / Save as PDF
            </button>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
