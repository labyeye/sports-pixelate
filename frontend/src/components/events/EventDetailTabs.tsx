import { cn } from "@/lib/utils";

export interface EventTabDef {
  key: string;
  label: string;
}

interface EventDetailTabsProps {
  tabs: EventTabDef[];
  active: string;
  onChange: (key: string) => void;
}

// Hand-rolled button-row tab bar (NOT shadcn tabs.tsx) — bold uppercase
// labels, active tab underlined in #024BAB, matching the flat neo-brutalist
// convention used elsewhere in the app.
export function EventDetailTabs({
  tabs,
  active,
  onChange,
}: EventDetailTabsProps) {
  return (
    <div className="border-2 border-black bg-white overflow-x-auto mb-4">
      <div className="flex min-w-max">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={cn(
              "px-4 py-3 text-xs font-bold uppercase tracking-wide whitespace-nowrap border-b-4 transition-colors",
              active === tab.key
                ? "border-[#024BAB] text-[#024BAB]"
                : "border-transparent text-black/60 hover:text-black hover:bg-gray-50",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
