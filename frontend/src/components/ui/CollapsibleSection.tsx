import { useState, type ReactNode } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface CollapsibleSectionProps {
  title: string;
  icon?: LucideIcon;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}

// Accordion card matching the border-2/black hard-shadow convention — used
// to compose the many form sections in EventForm without one giant scroll.
export function CollapsibleSection({
  title,
  icon: Icon,
  defaultOpen = false,
  children,
  className,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={cn("border-2 border-black bg-white", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="flex items-center gap-2 font-bold text-sm uppercase tracking-wide text-black">
          {Icon && <Icon className="w-4 h-4 text-[#024BAB]" />}
          {title}
        </span>
        <ChevronDown
          className={cn(
            "w-4 h-4 transition-transform",
            open ? "rotate-180" : "",
          )}
        />
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 border-t-2 border-black">{children}</div>
      )}
    </div>
  );
}
