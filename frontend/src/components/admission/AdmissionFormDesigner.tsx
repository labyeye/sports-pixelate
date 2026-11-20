import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Copy,
  FileText,
  ImagePlus,
  Minus,
  PenLine,
  Plus,
  Printer,
  Redo2,
  RotateCcw,
  Save,
  Square,
  Trash2,
  Type,
  Undo2,
  User,
  Database,
  Building2,
} from "lucide-react";
import { settingsAPI } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { openPrintWindow } from "@/lib/printWindow";
import {
  A4_H,
  A4_W,
  FIELD_OPTIONS,
  FONT_STACKS,
  KIND_LABELS,
  MAX_PAGES,
  PX_PER_MM,
  SAMPLE_STUDENT,
  blankPage,
  buildAdmissionFormHTML,
  defaultTemplate,
  makeEl,
  pageHTML,
  toMmX,
  toMmY,
  pctX,
  pctY,
  type AdmissionFormTemplate,
  type AfEl,
  type AfFont,
  type AfKind,
} from "@/lib/admissionForm";
import { loadAdmissionFormSetup } from "@/lib/admissionFormData";
import type { AfCompany } from "@/lib/admissionForm";

const PAGE_W_PX = A4_W * PX_PER_MM;
const PAGE_H_PX = A4_H * PX_PER_MM;
const MAX_UPLOAD = 5 * 1024 * 1024;
const r1 = (n: number) => Math.round(n * 10) / 10;

type Drag =
  | { mode: "move"; id: string; sx: number; sy: number; ox: number; oy: number }
  | { mode: "resize"; id: string; sx: number; sy: number; ow: number; oh: number };

const inputCls =
  "w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#044bab]/30";
const btnCls =
  "inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40";

const SIGNATURE_PRESETS = [
  "Parent / Guardian",
  "Student",
  "Coach",
  "Authorised signatory",
  "Date & place",
];

export function AdmissionFormDesigner() {
  const { toast } = useToast();
  const [template, setTemplate] = useState<AdmissionFormTemplate | null>(null);
  const [company, setCompany] = useState<AfCompany | null>(null);
  const [savedJson, setSavedJson] = useState("");
  const [pageIdx, setPageIdx] = useState(0);
  const [selId, setSelId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState(0.8);
  const drag = useRef<Drag | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const onFile = useRef<((f: File) => void) | null>(null);

  // ── undo / redo (whole-design snapshots; a quick run of edits counts as one step) ──
  const tplRef = useRef<AdmissionFormTemplate | null>(null);
  const past = useRef<AdmissionFormTemplate[]>([]);
  const future = useRef<AdmissionFormTemplate[]>([]);
  const lastPush = useRef(0);
  const [, setHist] = useState(0);
  const setTpl = useCallback(
    (fn: (t: AdmissionFormTemplate) => AdmissionFormTemplate) => {
      const prev = tplRef.current;
      if (!prev) return;
      const next = fn(prev);
      if (next === prev) return;
      const now = Date.now();
      if (now - lastPush.current > 700) {
        past.current.push(prev);
        if (past.current.length > 80) past.current.shift();
      }
      lastPush.current = now;
      future.current = [];
      tplRef.current = next;
      setTemplate(next);
      setHist((h) => h + 1);
    },
    [],
  );
  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev || !tplRef.current) return;
    future.current.push(tplRef.current);
    tplRef.current = prev;
    lastPush.current = 0;
    setTemplate(prev);
    setHist((h) => h + 1);
  }, []);
  const redo = useCallback(() => {
    const nxt = future.current.pop();
    if (!nxt || !tplRef.current) return;
    past.current.push(tplRef.current);
    tplRef.current = nxt;
    lastPush.current = 0;
    setTemplate(nxt);
    setHist((h) => h + 1);
  }, []);

  useEffect(() => {
    loadAdmissionFormSetup()
      .then((s) => {
        tplRef.current = s.template;
        setTemplate(s.template);
        setCompany(s.company);
        setSavedJson(s.saved ? JSON.stringify(s.template) : "");
      })
      .catch((e) => setError(e.message || "Could not load the designer"));
  }, []);

  const page = template?.pages[Math.min(pageIdx, (template?.pages.length || 1) - 1)];
  const sel = page?.elements.find((e) => e.id === selId) || null;
  const dirty = !!template && JSON.stringify(template) !== savedJson;

  const patchPage = useCallback(
    (fn: (els: AfEl[]) => AfEl[]) =>
      setTpl((t) => ({
        ...t,
        pages: t.pages.map((p, i) =>
          i === pageIdx ? { ...p, elements: fn(p.elements) } : p,
        ),
      })),
    [setTpl, pageIdx],
  );
  const patchEl = useCallback(
    (id: string, patch: Partial<AfEl>) =>
      patchPage((els) => els.map((e) => (e.id === id ? { ...e, ...patch } : e))),
    [patchPage],
  );
  const removeEl = useCallback(
    (id: string) => {
      patchPage((els) => els.filter((e) => e.id !== id));
      setSelId(null);
    },
    [patchPage],
  );
  const addEl = (el: AfEl) => {
    patchPage((els) => [...els, el]);
    setSelId(el.id);
  };

  // keyboard: undo/redo, delete, arrow nudge
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.metaKey || e.ctrlKey) {
        const k = e.key.toLowerCase();
        if (k === "z" && !e.shiftKey) {
          e.preventDefault();
          undo();
        } else if ((k === "z" && e.shiftKey) || k === "y") {
          e.preventDefault();
          redo();
        }
        return;
      }
      if (!selId) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        removeEl(selId);
      }
      const step = e.shiftKey ? 2 : 0.5;
      const d: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      };
      if (d[e.key]) {
        e.preventDefault();
        const el = page?.elements.find((x) => x.id === selId);
        if (el)
          patchEl(selId, {
            x: el.x + pctX(d[e.key][0]),
            y: el.y + pctY(d[e.key][1]),
          });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, selId, removeEl, patchEl, page]);

  // ── drag / resize ──
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const box = stage.current?.getBoundingClientRect();
    if (!d || !box) return;
    const dx = ((e.clientX - d.sx) / box.width) * 100;
    const dy = ((e.clientY - d.sy) / box.height) * 100;
    if (d.mode === "move") patchEl(d.id, { x: d.ox + dx, y: d.oy + dy });
    else patchEl(d.id, { w: Math.max(0.5, d.ow + dx), h: Math.max(0.3, d.oh + dy) });
  };
  const endDrag = () => {
    drag.current = null;
  };

  // ── images ──
  const askFile = (cb: (f: File) => void) => {
    onFile.current = cb;
    fileInput.current?.click();
  };
  const uploadImage = async (file: File): Promise<string | null> => {
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) {
      toast({ title: "Unsupported image", description: "Use a PNG, JPG or WebP image.", variant: "destructive" });
      return null;
    }
    if (file.size > MAX_UPLOAD) {
      toast({ title: "Image too large", description: "Please use an image under 5 MB.", variant: "destructive" });
      return null;
    }
    try {
      return (await settingsAPI.uploadIdCardImage(file)).url;
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
      return null;
    }
  };

  // ── pages ──
  const addPage = () => {
    if (!template || template.pages.length >= MAX_PAGES) return;
    setTpl((t) => ({ ...t, pages: [...t.pages, blankPage()] }));
    setPageIdx(template.pages.length);
    setSelId(null);
  };
  const dupPage = () => {
    if (!template || template.pages.length >= MAX_PAGES || !page) return;
    const copy = {
      ...page,
      elements: page.elements.map((e) => ({ ...e, id: makeEl("text", { x: 0, y: 0, w: 1, h: 1 }).id + e.id.slice(-2) })),
    };
    setTpl((t) => ({ ...t, pages: [...t.pages.slice(0, pageIdx + 1), copy, ...t.pages.slice(pageIdx + 1)] }));
    setPageIdx(pageIdx + 1);
  };
  const delPage = () => {
    if (!template || template.pages.length <= 1) return;
    setTpl((t) => ({ ...t, pages: t.pages.filter((_, i) => i !== pageIdx) }));
    setPageIdx(Math.max(0, pageIdx - 1));
    setSelId(null);
  };

  const save = async () => {
    if (!template) return;
    setSaving(true);
    try {
      await settingsAPI.update({ admissionFormTemplate: template });
      setSavedJson(JSON.stringify(template));
      toast({ title: "Admission form saved", description: "It's now used when you download a student's admission form." });
    } catch (e: any) {
      toast({ title: "Could not save", description: e.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const preview = () => {
    if (!template || !company) return;
    const win = openPrintWindow(buildAdmissionFormHTML(template, [SAMPLE_STUDENT], company));
    if (!win) toast({ title: "Pop-up blocked", description: "Allow pop-ups to preview.", variant: "destructive" });
  };

  const html = useMemo(
    () => (page && company ? pageHTML(page, SAMPLE_STUDENT, company) : ""),
    [page, company],
  );

  if (error) return <div className="p-6 text-sm text-red-600">{error}</div>;
  if (!template || !company || !page) return <div className="p-6 text-sm text-slate-500">Loading designer…</div>;

  const W = PAGE_W_PX * zoom;
  const H = PAGE_H_PX * zoom;
  const addBtn = (kind: AfKind, icon: React.ReactNode, mm: { x: number; y: number; w: number; h: number }, over: Partial<AfEl> = {}) => (
    <button key={kind + (over.text || "")} className={btnCls} onClick={() => addEl(makeEl(kind, mm, over))}>
      {icon} {KIND_LABELS[kind]}
    </button>
  );

  return (
    <div className="space-y-3">
      <input
        ref={fileInput}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onFile.current?.(f);
        }}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900">Admission form designer</h2>
          <p className="text-xs text-slate-500">
            A4 pages. Drag to move, drag the corner to resize, arrow keys nudge. Fields fill with each student's details when downloaded.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className={btnCls} onClick={undo} disabled={!past.current.length}><Undo2 className="h-3.5 w-3.5" /> Undo</button>
          <button className={btnCls} onClick={redo} disabled={!future.current.length}><Redo2 className="h-3.5 w-3.5" /> Redo</button>
          <button
            className={btnCls}
            onClick={() => {
              if (window.confirm("Replace the whole design with the default form?")) {
                setTpl(() => defaultTemplate());
                setPageIdx(0);
                setSelId(null);
              }
            }}
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </button>
          <button className={btnCls} onClick={preview}><Printer className="h-3.5 w-3.5" /> Preview / print</button>
          <button
            className="inline-flex items-center gap-1.5 rounded-md bg-[#044bab] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
            onClick={save}
            disabled={saving || !dirty}
          >
            <Save className="h-3.5 w-3.5" /> {saving ? "Saving…" : dirty ? "Save design" : "Saved"}
          </button>
        </div>
      </div>

      {/* page tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {template.pages.map((_, i) => (
          <button
            key={i}
            onClick={() => { setPageIdx(i); setSelId(null); }}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold ${i === pageIdx ? "bg-[#044bab] text-white" : "border border-slate-300 bg-white text-slate-700"}`}
          >
            Page {i + 1}
          </button>
        ))}
        <button className={btnCls} onClick={addPage} disabled={template.pages.length >= MAX_PAGES}><Plus className="h-3.5 w-3.5" /> Add page</button>
        <button className={btnCls} onClick={dupPage} disabled={template.pages.length >= MAX_PAGES}><Copy className="h-3.5 w-3.5" /> Duplicate</button>
        <button className={btnCls} onClick={delPage} disabled={template.pages.length <= 1}><Trash2 className="h-3.5 w-3.5" /> Delete page</button>
        <div className="ml-auto flex items-center gap-2 text-xs text-slate-600">
          Zoom
          <input type="range" min={0.4} max={1.4} step={0.05} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
          {Math.round(zoom * 100)}%
        </div>
      </div>

      {/* add toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
        <span className="px-1 text-xs font-semibold text-slate-500">Add</span>
        {addBtn("text", <Type className="h-3.5 w-3.5" />, { x: 15, y: 20, w: 60, h: 7 })}
        {addBtn("field", <Database className="h-3.5 w-3.5" />, { x: 15, y: 30, w: 70, h: 6 }, { underline: true, borderColor: "#94a3b8" })}
        {addBtn("photo", <User className="h-3.5 w-3.5" />, { x: 160, y: 15, w: 33, h: 40 })}
        {addBtn("logo", <Building2 className="h-3.5 w-3.5" />, { x: 15, y: 12, w: 24, h: 24 })}
        {addBtn("line", <Minus className="h-3.5 w-3.5" />, { x: 15, y: 60, w: 180, h: 1 })}
        {addBtn("box", <Square className="h-3.5 w-3.5" />, { x: 15, y: 70, w: 80, h: 30 })}
        <button
          className={btnCls}
          onClick={() =>
            askFile(async (f) => {
              const src = await uploadImage(f);
              if (src) addEl(makeEl("image", { x: 15, y: 20, w: 40, h: 30 }, { src }));
            })
          }
        >
          <ImagePlus className="h-3.5 w-3.5" /> Image
        </button>
        <span className="mx-1 h-5 w-px bg-slate-300" />
        <span className="px-1 text-xs font-semibold text-slate-500">Signature</span>
        {SIGNATURE_PRESETS.map((label) => (
          <button
            key={label}
            className={btnCls}
            onClick={() => addEl(makeEl("signature", { x: 15, y: 245, w: 52, h: 14 }, { text: label }))}
          >
            <PenLine className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
        <button
          className={btnCls}
          onClick={() => {
            const labels = ["Parent / Guardian", "Student", "Authorised signatory"];
            patchPage((els) => [
              ...els,
              ...labels.map((text, i) => makeEl("signature", { x: 15 + i * 64, y: 245, w: 52, h: 14 }, { text })),
            ]);
          }}
        >
          <FileText className="h-3.5 w-3.5" /> 3-signature row
        </button>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_300px]">
        {/* canvas */}
        <div className="overflow-auto rounded-lg border border-slate-200 bg-slate-200 p-4" style={{ maxHeight: "78vh" }}>
          <div
            ref={stage}
            className="relative mx-auto bg-white shadow-lg"
            style={{ width: W, height: H }}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerLeave={endDrag}
            onPointerDown={() => setSelId(null)}
          >
            <div
              style={{ width: PAGE_W_PX, height: PAGE_H_PX, transform: `scale(${zoom})`, transformOrigin: "top left", pointerEvents: "none" }}
              dangerouslySetInnerHTML={{ __html: html }}
            />
            {page.elements.map((el) => (
              <div
                key={el.id}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setSelId(el.id);
                  (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
                  drag.current = { mode: "move", id: el.id, sx: e.clientX, sy: e.clientY, ox: el.x, oy: el.y };
                }}
                style={{
                  position: "absolute",
                  left: `${el.x}%`,
                  top: `${el.y}%`,
                  width: `${el.w}%`,
                  height: `${el.h}%`,
                  cursor: "move",
                  outline: el.id === selId ? "2px solid #044bab" : "1px dashed rgba(4,75,171,0.25)",
                  outlineOffset: 0,
                }}
              >
                {el.id === selId && (
                  <div
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
                      drag.current = { mode: "resize", id: el.id, sx: e.clientX, sy: e.clientY, ow: el.w, oh: el.h };
                    }}
                    style={{ position: "absolute", right: -5, bottom: -5, width: 10, height: 10, background: "#044bab", cursor: "nwse-resize", borderRadius: 2 }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* properties */}
        <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3 text-sm">
          {!sel ? (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">Select an element to edit it, or set this page's background.</p>
              <label className="block text-xs font-medium text-slate-600">
                Page background
                <input
                  type="color"
                  className="mt-1 block h-8 w-full cursor-pointer rounded border border-slate-300"
                  value={page.bg}
                  onChange={(e) =>
                    setTpl((t) => ({ ...t, pages: t.pages.map((p, i) => (i === pageIdx ? { ...p, bg: e.target.value } : p)) }))
                  }
                />
              </label>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-900">{KIND_LABELS[sel.kind]}</span>
                <div className="flex gap-1">
                  <button className={btnCls} onClick={() => addEl({ ...sel, id: makeEl("text", { x: 0, y: 0, w: 1, h: 1 }).id, x: sel.x + 1.5, y: sel.y + 1.5 })}><Copy className="h-3.5 w-3.5" /></button>
                  <button className={btnCls} onClick={() => removeEl(sel.id)}><Trash2 className="h-3.5 w-3.5 text-red-600" /></button>
                </div>
              </div>

              {(sel.kind === "text" || sel.kind === "signature") && (
                <label className="block text-xs font-medium text-slate-600">
                  {sel.kind === "signature" ? "Caption" : "Text"}
                  <textarea rows={sel.kind === "text" ? 4 : 2} className={inputCls} value={sel.text} onChange={(e) => patchEl(sel.id, { text: e.target.value })} />
                </label>
              )}

              {sel.kind === "field" && (
                <>
                  <label className="block text-xs font-medium text-slate-600">
                    Student detail
                    <select className={inputCls} value={sel.field} onChange={(e) => patchEl(sel.id, { field: e.target.value as AfEl["field"] })}>
                      {Array.from(new Set(FIELD_OPTIONS.map((f) => f.group))).map((g) => (
                        <optgroup key={g} label={g}>
                          {FIELD_OPTIONS.filter((f) => f.group === g).map((f) => (
                            <option key={f.key} value={f.key}>{f.label}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs font-medium text-slate-600">
                    Text before value
                    <input className={inputCls} value={sel.prefix} onChange={(e) => patchEl(sel.id, { prefix: e.target.value })} />
                  </label>
                </>
              )}

              {sel.kind === "image" && (
                <button
                  className={btnCls}
                  onClick={() =>
                    askFile(async (f) => {
                      const src = await uploadImage(f);
                      if (src) patchEl(sel.id, { src });
                    })
                  }
                >
                  <ImagePlus className="h-3.5 w-3.5" /> Replace image
                </button>
              )}

              {/* geometry in mm */}
              <div className="grid grid-cols-2 gap-2">
                {([
                  ["X (mm)", toMmX(sel.x), (v: number) => ({ x: pctX(v) })],
                  ["Y (mm)", toMmY(sel.y), (v: number) => ({ y: pctY(v) })],
                  ["Width (mm)", toMmX(sel.w), (v: number) => ({ w: pctX(Math.max(0.5, v)) })],
                  ["Height (mm)", toMmY(sel.h), (v: number) => ({ h: pctY(Math.max(0.5, v)) })],
                ] as const).map(([label, val, f]) => (
                  <label key={label} className="block text-xs font-medium text-slate-600">
                    {label}
                    <input type="number" step={0.5} className={inputCls} value={r1(val)} onChange={(e) => patchEl(sel.id, f(Number(e.target.value) || 0))} />
                  </label>
                ))}
              </div>
              <div className="flex gap-1">
                <button className={btnCls} onClick={() => patchEl(sel.id, { x: pctX((A4_W - toMmX(sel.w)) / 2) })}>Center ↔</button>
                <button className={btnCls} onClick={() => patchEl(sel.id, { y: pctY((A4_H - toMmY(sel.h)) / 2) })}>Center ↕</button>
              </div>

              {(sel.kind === "text" || sel.kind === "field" || sel.kind === "signature") && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block text-xs font-medium text-slate-600">
                      Size (pt)
                      <input type="number" min={5} max={60} className={inputCls} value={sel.size} onChange={(e) => patchEl(sel.id, { size: Number(e.target.value) || 10 })} />
                    </label>
                    <label className="block text-xs font-medium text-slate-600">
                      Colour
                      <input type="color" className="block h-[30px] w-full rounded border border-slate-300" value={sel.color} onChange={(e) => patchEl(sel.id, { color: e.target.value })} />
                    </label>
                  </div>
                  <label className="block text-xs font-medium text-slate-600">
                    Font
                    <select className={inputCls} value={sel.font} onChange={(e) => patchEl(sel.id, { font: e.target.value as AfFont })}>
                      {(Object.keys(FONT_STACKS) as AfFont[]).map((f) => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {(["bold", "italic", "upper"] as const).map((k) => (
                      <button key={k} className={`${btnCls} ${sel[k] ? "!bg-[#044bab] !text-white" : ""}`} onClick={() => patchEl(sel.id, { [k]: !sel[k] })}>
                        {k === "upper" ? "ABC" : k === "bold" ? "B" : "I"}
                      </button>
                    ))}
                    {sel.kind !== "signature" && (
                      <button className={`${btnCls} ${sel.underline ? "!bg-[#044bab] !text-white" : ""}`} onClick={() => patchEl(sel.id, { underline: !sel.underline })}>
                        Line under
                      </button>
                    )}
                    {(["left", "center", "right"] as const).map((a) => (
                      <button key={a} className={`${btnCls} ${sel.align === a ? "!bg-[#044bab] !text-white" : ""}`} onClick={() => patchEl(sel.id, { align: a })}>
                        {a[0].toUpperCase()}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {(sel.kind === "text" || sel.kind === "field" || sel.kind === "box") && (
                <div className="grid grid-cols-2 items-end gap-2">
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
                    <input type="checkbox" checked={sel.filled} onChange={(e) => patchEl(sel.id, { filled: e.target.checked })} /> Fill
                  </label>
                  <input type="color" className="h-[30px] w-full rounded border border-slate-300" value={sel.fill} onChange={(e) => patchEl(sel.id, { fill: e.target.value, filled: true })} />
                </div>
              )}

              {["line", "box", "photo", "signature", "text", "field"].includes(sel.kind) && (
                <div className="grid grid-cols-2 gap-2">
                  <label className="block text-xs font-medium text-slate-600">
                    {sel.kind === "text" || sel.kind === "field" ? "Line thickness" : "Border (mm)"}
                    <input type="number" step={0.1} min={0} max={3} className={inputCls} value={sel.borderWidth} onChange={(e) => patchEl(sel.id, { borderWidth: Number(e.target.value) || 0 })} />
                  </label>
                  <label className="block text-xs font-medium text-slate-600">
                    Line colour
                    <input type="color" className="block h-[30px] w-full rounded border border-slate-300" value={sel.borderColor} onChange={(e) => patchEl(sel.id, { borderColor: e.target.value })} />
                  </label>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
