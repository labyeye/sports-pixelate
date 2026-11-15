import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const DAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const COUNT = 7;

interface Props {
  year: number;
  month: number; // 1-12
  selected: string | null; // YYYY-MM-DD
  onSelect: (iso: string | null) => void;
  /** Small coloured lines under each day, e.g. [{ text: "2P", color: "#00C48C" }] */
  badges?: (iso: string) => { text: string; color: string }[];
}

/** Week-at-a-time date picker strip (same look as the Attendance screen). Click the selected day again to clear. */
export function DateStrip({ year, month, selected, onSelect, badges }: Props) {
  const dim = new Date(year, month, 0).getDate();
  const todayIso = new Date().toISOString().split("T")[0];
  const [start, setStart] = useState(1);

  useEffect(() => {
    const t = new Date();
    setStart(
      t.getFullYear() === year && t.getMonth() + 1 === month
        ? Math.max(1, t.getDate() - 3)
        : 1,
    );
  }, [year, month]);

  const days = Array.from({ length: COUNT }, (_, i) => start + i).filter(
    (d) => d <= dim,
  );

  return (
    <div className="border-2 border-black bg-white mb-5 flex items-stretch">
      <button
        onClick={() => setStart((s) => Math.max(1, s - COUNT))}
        disabled={start <= 1}
        className="px-3 border-r-2 border-black hover:bg-[#024BAB]/5 disabled:opacity-30 shrink-0"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <div className="flex flex-1 overflow-hidden">
        {days.map((day) => {
          const date = new Date(year, month - 1, day);
          const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const isSel = iso === selected;
          const isToday = iso === todayIso;
          const b = badges?.(iso) ?? [];
          return (
            <button
              key={iso}
              onClick={() => onSelect(isSel ? null : iso)}
              className={cn(
                "flex-1 flex flex-col items-center justify-center py-3 px-1 border-r last:border-r-0 border-black/10 relative min-w-0",
                isSel
                  ? "bg-[#024BAB] text-white"
                  : isToday
                    ? "bg-[#024BAB]/5"
                    : "hover:bg-[#024BAB]/5",
              )}
            >
              {isToday && !isSel && (
                <span className="absolute top-1.5 w-1.5 h-1.5 rounded-full bg-[#024BAB]" />
              )}
              <span
                className={cn(
                  "text-xs font-bold whitespace-nowrap mb-2",
                  !isSel && (isToday ? "text-[#024BAB]" : "text-black"),
                )}
              >
                {DAY_ABBR[date.getDay()]},{" "}
                {date.toLocaleDateString("en-IN", { month: "short" })} {day}
              </span>
              {b.length ? (
                <div className="flex flex-col items-center gap-0.5">
                  {b.map((x) => (
                    <span
                      key={x.text}
                      className="text-[11px] font-bold leading-none"
                      style={{ color: isSel ? "#fff" : x.color }}
                    >
                      {x.text}
                    </span>
                  ))}
                </div>
              ) : (
                <span
                  className={cn(
                    "text-[10px]",
                    isSel ? "text-white/40" : "text-muted-foreground/40",
                  )}
                >
                  —
                </span>
              )}
              {isSel && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-white" />
              )}
            </button>
          );
        })}
      </div>
      <button
        onClick={() =>
          setStart((s) => Math.min(Math.max(1, dim - COUNT + 1), s + COUNT))
        }
        disabled={start + COUNT > dim}
        className="px-3 border-l-2 border-black hover:bg-[#024BAB]/5 disabled:opacity-30 shrink-0"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}
