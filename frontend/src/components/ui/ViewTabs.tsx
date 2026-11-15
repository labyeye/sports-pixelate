import { useCallback, useState } from "react";
import { BarChart3, List } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

export type ViewMode = "graphs" | "details";

const storageKey = (page: string) => `nestacademy:view:${page}`;

/**
 * Which tab a list page opens on. Admin/HR default to Graphs, everyone else to Details.
 * The last tab a person picked is remembered per page (per browser).
 */
export function useViewTab(
  page: string,
  managerDefault: ViewMode = "graphs",
): [ViewMode, (v: ViewMode) => void] {
  const { user } = useAuth();
  const isManager = user?.role === "super_admin" || user?.role === "hr_manager";
  const [mode, setMode] = useState<ViewMode>(() => {
    try {
      const saved = localStorage.getItem(storageKey(page));
      if (saved === "graphs" || saved === "details") return saved;
    } catch {
      /* storage blocked: fall back to the role default */
    }
    return isManager ? managerDefault : "details";
  });
  const set = useCallback(
    (v: ViewMode) => {
      setMode(v);
      try {
        localStorage.setItem(storageKey(page), v);
      } catch {
        /* ignore */
      }
    },
    [page],
  );
  return [mode, set];
}

export function ViewTabs({
  value,
  onChange,
  className,
}: {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
  className?: string;
}) {
  const tabs: { id: ViewMode; label: string; icon: typeof List }[] = [
    { id: "graphs", label: "Insights", icon: BarChart3 },
    { id: "details", label: "Details", icon: List },
  ];
  return (
    <div
      role="tablist"
      className={cn("inline-flex border-2 border-black bg-white", className)}
    >
      {tabs.map(({ id, label, icon: Icon }) => {
        const active = value === id;
        return (
          <button
            key={id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(id)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 text-sm font-bold transition-colors border-r-2 border-black last:border-r-0",
              active
                ? "bg-[#024BAB] text-white"
                : "bg-white text-black hover:bg-[#024BAB]/5",
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
