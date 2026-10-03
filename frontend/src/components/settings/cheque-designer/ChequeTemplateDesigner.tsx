import { useEffect, useMemo, useRef, useState } from "react";
import { Eye, EyeOff, FileText, ImagePlus, Loader2, Redo2, RotateCcw, Save, Trash2, Type, Undo2 } from "lucide-react";
import { defaultTemplate, FIELD_LABEL, newImageField, newTextField, normalizeTemplate, type ChequeField, type ChequeTemplate, type VarCtx } from "@/lib/chequeTemplate";
import { useHistoryState } from "@/hooks/useHistoryState";
import { settingsAPI } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { cn, getErrorMessage } from "@/lib/utils";
import { DesignerCanvas, type Selection } from "./DesignerCanvas";
import { Inspector } from "./Inspector";
import { fileToDataUrl } from "./imageUtil";

// Sample payslip used only to preview text on the canvas — the real print substitutes the actual
// employee/payroll record for the same {{variables}}.
const SAMPLE_CTX: VarCtx = {
  "company.name": "Your Sports Academy",
  "company.address": "221B Baker Street, Andheri East, Mumbai",
  "issue.date": "30/09/2026",
  "emp.name": "Rohan Sharma",
  "emp.id": "EMP-0042",
  "emp.designation": "Head Coach",
  "amount.net": "45,000",
  "amount.words": "Rupees Forty Five Thousand Only",
  "period.from": "01/09/2026",
  "period.to": "30/09/2026",
};

export default function ChequeTemplateDesigner({ settings, active, onSaved }: { settings: any; active: boolean; onSaved: (t: ChequeTemplate, background: string) => void }) {
  const { toast } = useToast();
  const initial = useMemo(() => normalizeTemplate(settings?.chequeTemplateDesign), []); // eslint-disable-line react-hooks/exhaustive-deps
  const { state: tpl, set, undo, redo, canUndo, canRedo } = useHistoryState<ChequeTemplate>(initial);
  const [background, setBackground] = useState(settings?.payrollChequeTemplate || "");
  const savedRef = useRef<{ tpl: ChequeTemplate; background: string }>({ tpl: initial, background });
  const [sel, setSel] = useState<Selection>(null);
  const [saving, setSaving] = useState(false);
  const [bgUploading, setBgUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bgFileRef = useRef<HTMLInputElement>(null);

  const logo = settings?.logoUrl || "";
  const dirty = tpl !== savedRef.current.tpl || background !== savedRef.current.background;

  const setField = (id: string, patch: Partial<ChequeField>, group: string) => set((t) => ({ ...t, fields: t.fields.map((f) => (f.id === id ? { ...f, ...patch } : f)) }), group);
  const toggleField = (id: string) => set((t) => ({ ...t, fields: t.fields.map((f) => (f.id === id ? { ...f, visible: !f.visible } : f)) }));
  const remove = (id: string) => {
    set((t) => ({ ...t, fields: t.fields.filter((f) => f.id !== id) }));
    setSel(null);
  };
  const addText = () => {
    const f = newTextField();
    set((t) => ({ ...t, fields: [...t.fields, f] }));
    setSel(f.id);
  };
  const addImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const src = await fileToDataUrl(file, 600);
      const f = newImageField({ src, x: 40, y: 40, w: 20, h: 12 });
      set((t) => ({ ...t, fields: [...t.fields, f] }));
      setSel(f.id);
    } catch (x: any) {
      toast({ title: "Could not add image", description: x.message, variant: "destructive" });
    }
  };
  const changeBackground = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBgUploading(true);
    try {
      setBackground(await fileToDataUrl(file, 1800));
    } catch (x: any) {
      toast({ title: "Could not use that image", description: x.message, variant: "destructive" });
    } finally {
      setBgUploading(false);
    }
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const res = await settingsAPI.update({ chequeTemplateDesign: tpl, payrollChequeTemplate: background });
      savedRef.current = { tpl, background };
      onSaved(tpl, background);
      toast({ title: "Payslip design saved", description: "New payslips will print using this layout." });
    } catch (e: unknown) {
      toast({ title: "Could not save", description: getErrorMessage(e) || "Try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!active) return;
    const editing = (el: HTMLElement) => el.tagName === "TEXTAREA" || el.tagName === "SELECT" || (el.tagName === "INPUT" && !["range", "checkbox", "color", "file"].includes((el as HTMLInputElement).type));
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (mod && key === "s") {
        e.preventDefault();
        void save();
        return;
      }
      if (editing(e.target as HTMLElement)) return;
      if (mod && key === "z") {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      } else if (mod && key === "y") {
        e.preventDefault();
        redo();
      } else if (sel && (e.key === "Delete" || e.key === "Backspace")) {
        e.preventDefault();
        remove(sel);
      } else if (sel && e.key.startsWith("Arrow")) {
        e.preventDefault();
        const f = tpl.fields.find((x) => x.id === sel);
        if (!f) return;
        const step = e.shiftKey ? 2 : 0.4;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        setField(f.id, { x: Math.min(100 - f.w, Math.max(0, f.x + dx)), y: Math.min(100 - f.h, Math.max(0, f.y + dy)) }, `nudge-${f.id}`);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const btn = "nb-btn px-3 py-1.5 text-xs font-bold border-2 border-black bg-white hover:bg-[#FFDE00]/40 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed";
  const rowCls = (on: boolean) => cn("flex items-center gap-1 border-2 px-1.5 py-1.5 text-xs font-bold bg-white cursor-pointer", on ? "border-[#024BAB] bg-[#024BAB]/10" : "border-black/20 hover:border-black");
  const selectedField = tpl.fields.find((f) => f.id === sel);

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] min-h-[600px]">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-4 sm:px-6 py-2 border-b-2 border-black bg-white">
        <button className={btn} onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)"><Undo2 className="w-3.5 h-3.5" /> Undo</button>
        <button className={btn} onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)"><Redo2 className="w-3.5 h-3.5" /> Redo</button>
        <button className={btn} onClick={() => { set(defaultTemplate()); setSel(null); }} title="Back to the starting layout (you can undo this)"><RotateCcw className="w-3.5 h-3.5" /> Reset layout</button>
        <div className="flex-1" />
        {dirty && <span className="text-[11px] font-bold text-amber-700">Unsaved changes</span>}
        <button onClick={save} disabled={saving || !dirty} className="nb-btn px-4 py-1.5 text-xs font-bold text-white border-2 border-black bg-[#024BAB] hover:bg-[#01368A] flex items-center gap-1.5 disabled:bg-gray-400 disabled:cursor-not-allowed" title="Ctrl+S">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save design
        </button>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[250px_minmax(0,1fr)_290px]">
        {/* layers */}
        <div className="border-b-2 lg:border-b-0 lg:border-r-2 border-black bg-white overflow-y-auto p-3 space-y-4 max-h-72 lg:max-h-none">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-black/50 mb-2">Background</p>
            <button className={cn(btn, "w-full justify-center")} onClick={() => bgFileRef.current?.click()} disabled={bgUploading}>
              {bgUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />} {background ? "Replace cheque image" : "Upload cheque image"}
            </button>
            <input ref={bgFileRef} type="file" accept="image/*" className="hidden" onChange={changeBackground} />
            <p className="text-[10px] text-black/40 mt-1">Scan or photo of your cheque leaf / payslip letterhead. PNG or JPG.</p>
          </div>

          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-black/50 mb-2">Fields</p>
            <div className="flex gap-2 mb-2">
              <button className={cn(btn, "flex-1 justify-center")} onClick={() => fileRef.current?.click()}><ImagePlus className="w-3.5 h-3.5" /> Image</button>
              <button className={cn(btn, "flex-1 justify-center")} onClick={addText}><Type className="w-3.5 h-3.5" /> Text</button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={addImage} />
            </div>
            <div className="space-y-1">
              {tpl.fields.map((f) => (
                <div key={f.id} onClick={() => setSel(f.id)} className={rowCls(sel === f.id)}>
                  {f.kind === "image" ? <ImagePlus className="w-3.5 h-3.5 shrink-0" /> : <Type className="w-3.5 h-3.5 shrink-0" />}
                  <span className={cn("flex-1 truncate", !f.visible && "opacity-40 line-through")}>{FIELD_LABEL(f)}</span>
                  <button aria-label={f.visible ? "Hide" : "Show"} onClick={(e) => { e.stopPropagation(); toggleField(f.id); }} className="p-0.5">{f.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}</button>
                  <button aria-label="Delete" onClick={(e) => { e.stopPropagation(); remove(f.id); }} className="p-0.5 text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
              {tpl.fields.length === 0 && <p className="text-[11px] text-black/40">Add a text or image field and drag it anywhere on the cheque.</p>}
            </div>
          </div>
        </div>

        {/* canvas */}
        <div className="overflow-auto bg-[#e5e7eb] p-4 sm:p-6">
          <DesignerCanvas fields={tpl.fields} background={background} logo={logo} ctx={SAMPLE_CTX} selection={sel} onSelect={setSel} onChange={setField} />
        </div>

        {/* inspector */}
        <div className="border-t-2 lg:border-t-0 lg:border-l-2 border-black bg-white overflow-y-auto p-4">
          <Inspector field={selectedField} onChange={(patch, group) => sel && setField(sel, patch, group)} onRemove={() => sel && remove(sel)} />
        </div>
      </div>
    </div>
  );
}
