import React from "react";
import { ImageIcon, Trash2 } from "lucide-react";
import { TEMPLATE_VARS, type ChequeField } from "@/lib/chequeTemplate";
import { fileToDataUrl } from "./imageUtil";
import type { Selection } from "./DesignerCanvas";

const label = "block text-[10px] font-black uppercase tracking-widest text-black/60 mb-1";
const input = "w-full border-2 border-black px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#024BAB]";

function Num({ text, value, min, max, step, onChange }: { text: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  const set = (v: string) => onChange(Math.min(max, Math.max(min, Number(v) || min)));
  return (
    <div>
      <span className={label}>{text}</span>
      <div className="flex items-center gap-2">
        <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => set(e.target.value)} className="flex-1 accent-[#024BAB]" />
        <input type="number" min={min} max={max} step={step} value={Math.round(value * 100) / 100} onChange={(e) => set(e.target.value)} className={`${input} !w-16`} />
      </div>
    </div>
  );
}

function Chk({ text, value, onChange }: { text: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-xs font-bold cursor-pointer py-0.5">
      <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} className="w-3.5 h-3.5 accent-[#024BAB]" />
      {text}
    </label>
  );
}

function Select({ text, value, options, onChange }: { text: string; value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <div>
      <span className={label}>{text}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={input}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}

function Color({ text, value, onChange }: { text: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <span className={label}>{text}</span>
      <div className="flex items-center gap-2">
        <input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#000000"} onChange={(e) => onChange(e.target.value)} className="w-9 h-8 border-2 border-black p-0 bg-white cursor-pointer" />
        <input value={value} onChange={(e) => onChange(e.target.value)} className={input} maxLength={7} />
      </div>
    </div>
  );
}

function ImageField({ value, onChange, canUseLogo, usesLogo, onToggleLogo }: { value: string; onChange: (v: string) => void; canUseLogo?: boolean; usesLogo?: boolean; onToggleLogo?: (v: boolean) => void }) {
  const [err, setErr] = React.useState("");
  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      setErr("");
      onChange(await fileToDataUrl(f));
    } catch (x: any) {
      setErr(x.message || "Could not use that image.");
    }
  };
  return (
    <div>
      <span className={label}>Image</span>
      {canUseLogo && <Chk text="Use the company logo (Settings → General Info)" value={!!usesLogo} onChange={(v) => onToggleLogo?.(v)} />}
      {!usesLogo && (
        <div className="flex items-center gap-2 mt-1">
          <div className="w-14 h-14 border-2 border-black bg-[repeating-conic-gradient(#eee_0%_25%,#fff_0%_50%)] bg-[length:10px_10px] flex items-center justify-center overflow-hidden shrink-0">
            {value ? <img src={value} className="max-w-full max-h-full object-contain" /> : <ImageIcon className="w-5 h-5 text-black/30" />}
          </div>
          <label className="nb-btn cursor-pointer px-3 py-1.5 text-xs font-bold border-2 border-black bg-white hover:bg-[#FFDE00]/40">
            {value ? "Replace" : "Upload"}
            <input type="file" accept="image/*" onChange={pick} className="hidden" />
          </label>
          {value ? <button type="button" onClick={() => onChange("")} className="text-[10px] font-bold underline">remove</button> : null}
        </div>
      )}
      {err ? <p className="text-[11px] text-red-600 font-bold mt-1">{err}</p> : null}
    </div>
  );
}

export function Inspector({
  field,
  onChange,
  onRemove,
}: {
  field: ChequeField | undefined;
  onChange: (patch: Partial<ChequeField>, group: string) => void;
  onRemove: () => void;
}) {
  if (!field) {
    return (
      <div className="space-y-3">
        <p className="text-xs font-black uppercase tracking-widest text-black/60">Field settings</p>
        <p className="text-[11px] text-black/50">Click any field on the cheque, or an item in the list, to edit it.</p>
        <p className="text-[10px] text-black/50">Variables you can type in any text field: {TEMPLATE_VARS.map((v) => `{{${v}}}`).join("  ")}</p>
      </div>
    );
  }

  const g = (k: string) => `field-${field.id}-${k}`;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1 pb-2 border-b-2 border-black">
        <div className="w-1 h-4 bg-[#024BAB]" />
        <p className="text-xs font-black uppercase tracking-widest">{field.kind === "image" ? "Image field" : "Text field"}</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Num text="X %" value={field.x} min={0} max={99} step={0.5} onChange={(v) => onChange({ x: v }, g("x"))} />
        <Num text="Y %" value={field.y} min={0} max={99} step={0.5} onChange={(v) => onChange({ y: v }, g("y"))} />
        <Num text="Width %" value={field.w} min={3} max={100} step={0.5} onChange={(v) => onChange({ w: v }, g("w"))} />
        <Num text="Height %" value={field.h} min={2} max={100} step={0.5} onChange={(v) => onChange({ h: v }, g("h"))} />
      </div>

      {field.kind === "text" ? (
        <>
          <div>
            <span className={label}>Text</span>
            <textarea value={field.text ?? ""} rows={2} maxLength={300} onChange={(e) => onChange({ text: e.target.value }, g("text"))} className={input} />
          </div>
          <Num text="Font size" value={field.size || 10} min={6} max={40} step={1} onChange={(v) => onChange({ size: v }, g("size"))} />
          <Color text="Colour" value={field.color || "#000000"} onChange={(v) => onChange({ color: v }, g("color"))} />
          <Chk text="Bold" value={!!field.bold} onChange={(v) => onChange({ bold: v }, g("bold"))} />
          <Select text="Align" value={field.align || "left"} options={[["left", "Left"], ["center", "Centre"], ["right", "Right"]]} onChange={(v) => onChange({ align: v as any }, g("align"))} />
        </>
      ) : (
        <ImageField
          value={field.src || ""}
          canUseLogo={field.usesCompanyLogo !== undefined}
          usesLogo={field.usesCompanyLogo}
          onToggleLogo={(v) => onChange({ usesCompanyLogo: v }, g("logo"))}
          onChange={(v) => onChange({ src: v, usesCompanyLogo: false }, g("src"))}
        />
      )}

      <button type="button" onClick={onRemove} className="flex items-center gap-1.5 text-xs font-bold text-red-600 hover:underline pt-2">
        <Trash2 className="w-3.5 h-3.5" /> Delete this field
      </button>
    </div>
  );
}
