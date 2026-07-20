import { useState } from "react";
import { Tags, Tag, Plus, X } from "lucide-react";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import type { EventCategories } from "@/types/hrms";

interface Props {
  value: EventCategories;
  onChange: (patch: Partial<EventCategories>) => void;
}

function TagList({
  label,
  items,
  onAdd,
  onRemove,
}: {
  label: string;
  items: string[];
  onAdd: (v: string) => void;
  onRemove: (v: string) => void;
}) {
  const [input, setInput] = useState("");
  const add = () => {
    const v = input.trim();
    if (!v) return;
    onAdd(v);
    setInput("");
  };
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-bold uppercase mb-1">
        <Tag className="w-3.5 h-3.5 text-[#024BAB]" />
        {label}
      </label>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {items.map((it) => (
          <span
            key={it}
            className="flex items-center gap-1 border-2 border-black px-2 py-1 text-xs font-bold"
          >
            {it}
            <button
              type="button"
              onClick={() => onRemove(it)}
              className="text-red-500 hover:text-red-700"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
          placeholder={`Add ${label.toLowerCase()}`}
          className="flex-1 border-2 border-black px-3 py-1.5 text-sm font-medium outline-none max-w-xs"
        />
        <button
          type="button"
          onClick={add}
          className="border-2 border-black px-2 py-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export function CategoriesSection({ value, onChange }: Props) {
  const make = (key: keyof EventCategories) => ({
    items: value[key] || [],
    onAdd: (v: string) =>
      onChange({
        [key]: [...(value[key] || []), v],
      } as Partial<EventCategories>),
    onRemove: (v: string) =>
      onChange({
        [key]: (value[key] || []).filter((x) => x !== v),
      } as Partial<EventCategories>),
  });

  return (
    <CollapsibleSection title="Categories" icon={Tags}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TagList label="Age Category" {...make("ageCategory")} />
        <TagList label="Gender" {...make("gender")} />
        <TagList label="Skill Level" {...make("skillLevel")} />
        <TagList label="Division" {...make("division")} />
      </div>
    </CollapsibleSection>
  );
}
