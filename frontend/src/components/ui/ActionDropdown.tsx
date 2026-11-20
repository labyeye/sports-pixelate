import { useState, useRef, useEffect, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ActionDropdownItem {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "danger";
}

interface ActionDropdownProps {
  label?: string;
  icon?: ReactNode;
  items: ActionDropdownItem[];
  className?: string;
  align?: "left" | "right";
}

export function ActionDropdown({
  label = "Actions",
  icon,
  items,
  className,
  align = "right",
}: ActionDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block text-left" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "border-2 border-black bg-white text-black px-3.5 py-2 text-sm flex items-center gap-1.5 font-bold hover:bg-gray-50 transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]",
          className,
        )}
      >
        {icon}
        <span>{label}</span>
        <ChevronDown
          className={cn(
            "w-4 h-4 transition-transform duration-150",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div
          className={cn(
            "absolute mt-1 min-w-[170px] bg-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] z-40 py-1",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {items.map((item, idx) => (
            <button
              key={idx}
              type="button"
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
              className={cn(
                "w-full flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-left transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
                item.variant === "danger"
                  ? "text-red-600 hover:bg-red-50"
                  : "text-black hover:bg-[#024BAB]/10",
              )}
            >
              {item.icon && <span className="shrink-0">{item.icon}</span>}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
