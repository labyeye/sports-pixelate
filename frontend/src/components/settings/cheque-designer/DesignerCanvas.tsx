import { useLayoutEffect, useRef, useState } from "react";
import { fillVars, type ChequeField, type VarCtx } from "@/lib/chequeTemplate";

export type Selection = string | null; // field id

export function DesignerCanvas({
  fields,
  background,
  logo,
  ctx,
  selection,
  onSelect,
  onChange,
}: {
  fields: ChequeField[];
  background: string;
  logo?: string;
  ctx: VarCtx;
  selection: Selection;
  onSelect: (id: Selection) => void;
  onChange: (id: string, patch: Partial<ChequeField>, group: string) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [ratio, setRatio] = useState(0.55); // height / width, replaced once the background loads

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(Math.max(280, Math.min(900, el.clientWidth - 8))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (!background) return;
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth && img.naturalHeight) setRatio(img.naturalHeight / img.naturalWidth);
    };
    img.src = background;
  }, [background]);

  const height = width * ratio;
  const drag = useRef<{ id: string; mode: "move" | "resize"; sx: number; sy: number; f: ChequeField } | null>(null);

  const onDown = (e: React.PointerEvent, f: ChequeField, mode: "move" | "resize") => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: f.id, mode, sx: e.clientX, sy: e.clientY, f };
    onSelect(f.id);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = ((e.clientX - d.sx) / width) * 100;
    const dy = ((e.clientY - d.sy) / height) * 100;
    const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
    const patch: Partial<ChequeField> =
      d.mode === "move"
        ? { x: clamp(d.f.x + dx, 0, 100 - d.f.w), y: clamp(d.f.y + dy, 0, 100 - d.f.h) }
        : { w: clamp(d.f.w + dx, 3, 100 - d.f.x), h: clamp(d.f.h + dy, 2, 100 - d.f.y) };
    onChange(d.id, patch, `drag-${d.id}`);
  };
  const onUp = () => {
    drag.current = null;
  };

  const JUSTIFY = { left: "flex-start", center: "center", right: "flex-end" } as const;

  return (
    <div ref={wrapRef} className="w-full flex flex-col items-center">
      <div
        onPointerDown={() => onSelect(null)}
        style={{
          position: "relative",
          width,
          height,
          background: background ? `url(${background}) center/contain no-repeat, #fff` : "#f3f4f6",
          boxShadow: "0 2px 16px rgba(0,0,0,.25)",
          overflow: "hidden",
        }}
      >
        {!background && (
          <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-black/40 text-center px-6">
            Upload a cheque / payslip background image to start designing
          </div>
        )}
        {fields.filter((f) => f.visible).map((f) => {
          const sel = selection === f.id;
          const src = f.kind === "image" ? (f.usesCompanyLogo ? f.src || logo : f.src) : undefined;
          return (
            <div
              key={f.id}
              onPointerDown={(e) => onDown(e, f, "move")}
              onPointerMove={onMove}
              onPointerUp={onUp}
              style={{
                position: "absolute",
                left: `${f.x}%`,
                top: `${f.y}%`,
                width: `${f.w}%`,
                height: `${f.h}%`,
                cursor: "move",
                touchAction: "none",
                outline: sel ? "2px solid #2563eb" : "1px dashed rgba(37,99,235,.4)",
                zIndex: sel ? 30 : 20,
                userSelect: "none",
                display: "flex",
                alignItems: f.kind === "text" ? "center" : "stretch",
              }}
            >
              {f.kind === "image" ? (
                src ? (
                  <img src={src} draggable={false} style={{ width: "100%", height: "100%", objectFit: "contain", pointerEvents: "none" }} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[10px] text-black/40 bg-black/5">No image</div>
                )
              ) : (
                <div
                  style={{
                    width: "100%",
                    fontSize: (f.size || 10) * (width / 600),
                    color: f.color || "#000",
                    fontWeight: f.bold ? 700 : 400,
                    textAlign: f.align || "left",
                    display: "flex",
                    justifyContent: JUSTIFY[f.align || "left"],
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    fontFamily: "'Segoe UI', Arial, sans-serif",
                  }}
                >
                  {fillVars(f.text, ctx) || <span className="text-black/30">Empty text</span>}
                </div>
              )}
              {sel && (
                <div
                  onPointerDown={(e) => onDown(e, f, "resize")}
                  onPointerMove={onMove}
                  onPointerUp={onUp}
                  style={{ position: "absolute", right: -6, bottom: -6, width: 12, height: 12, background: "#2563eb", border: "2px solid #fff", cursor: "nwse-resize", borderRadius: 2, touchAction: "none" }}
                />
              )}
            </div>
          );
        })}
      </div>
      <p className="text-center text-[11px] text-black/50 mt-3">Preview with sample payslip data. Drag fields to move; drag the blue corner to resize.</p>
    </div>
  );
}
