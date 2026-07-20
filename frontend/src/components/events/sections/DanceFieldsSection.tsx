import { useState } from "react";
import {
  Music,
  Users,
  Clock,
  Link,
  Palette,
  Ruler,
  UserPlus,
  UserMinus,
  Shirt,
  ListOrdered,
  ClipboardCheck,
  Plus,
  X,
} from "lucide-react";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import type { DanceFields } from "@/types/hrms";

interface Props {
  value: DanceFields;
  onChange: (patch: Partial<DanceFields>) => void;
}

const inputClass =
  "w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none bg-white";
const labelClass = "flex items-center gap-1.5 text-xs font-bold uppercase mb-1";

export function DanceFieldsSection({ value, onChange }: Props) {
  const [criterion, setCriterion] = useState("");

  const addCriterion = () => {
    const v = criterion.trim();
    if (!v) return;
    onChange({ judgingCriteria: [...(value.judgingCriteria || []), v] });
    setCriterion("");
  };

  return (
    <CollapsibleSection title="Dance Details" icon={Music}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>
            <Music className="w-3.5 h-3.5 text-[#024BAB]" />
            Dance Style
          </label>
          <input
            className={inputClass}
            value={value.danceStyle || ""}
            onChange={(e) => onChange({ danceStyle: e.target.value })}
          />
        </div>
        <div>
          <label className={labelClass}>
            <Users className="w-3.5 h-3.5 text-[#024BAB]" />
            Performance Mode
          </label>
          <select
            className={inputClass}
            value={value.performanceMode || ""}
            onChange={(e) =>
              onChange({
                performanceMode: (e.target.value ||
                  null) as DanceFields["performanceMode"],
              })
            }
          >
            <option value="">Select...</option>
            <option value="solo">Solo</option>
            <option value="duo">Duo</option>
            <option value="group">Group</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>
            <Clock className="w-3.5 h-3.5 text-[#024BAB]" />
            Performance Duration (min)
          </label>
          <input
            type="number"
            min={0}
            className={inputClass}
            value={value.performanceDurationMinutes ?? ""}
            onChange={(e) =>
              onChange({
                performanceDurationMinutes: e.target.value
                  ? Number(e.target.value)
                  : undefined,
              })
            }
          />
        </div>
        <div>
          <label className={labelClass}>
            <Link className="w-3.5 h-3.5 text-[#024BAB]" />
            Music Upload URL
          </label>
          <input
            className={inputClass}
            value={value.musicUploadUrl || ""}
            onChange={(e) => onChange({ musicUploadUrl: e.target.value })}
          />
        </div>
        <div>
          <label className={labelClass}>
            <Palette className="w-3.5 h-3.5 text-[#024BAB]" />
            Theme
          </label>
          <input
            className={inputClass}
            value={value.theme || ""}
            onChange={(e) => onChange({ theme: e.target.value })}
          />
        </div>
        <div>
          <label className={labelClass}>
            <Ruler className="w-3.5 h-3.5 text-[#024BAB]" />
            Stage Dimensions
          </label>
          <input
            className={inputClass}
            value={value.stageDimensions || ""}
            onChange={(e) => onChange({ stageDimensions: e.target.value })}
          />
        </div>
        <div>
          <label className={labelClass}>
            <UserPlus className="w-3.5 h-3.5 text-[#024BAB]" />
            Max Performers
          </label>
          <input
            type="number"
            min={0}
            className={inputClass}
            value={value.maxPerformers ?? ""}
            onChange={(e) =>
              onChange({
                maxPerformers: e.target.value
                  ? Number(e.target.value)
                  : undefined,
              })
            }
          />
        </div>
        <div>
          <label className={labelClass}>
            <UserMinus className="w-3.5 h-3.5 text-[#024BAB]" />
            Min Performers
          </label>
          <input
            type="number"
            min={0}
            className={inputClass}
            value={value.minPerformers ?? ""}
            onChange={(e) =>
              onChange({
                minPerformers: e.target.value
                  ? Number(e.target.value)
                  : undefined,
              })
            }
          />
        </div>
        <label className="flex items-center gap-2 text-sm font-bold">
          <input
            type="checkbox"
            checked={!!value.propsAllowed}
            onChange={(e) => onChange({ propsAllowed: e.target.checked })}
          />
          Props Allowed
        </label>
        <div className="md:col-span-2">
          <label className={labelClass}>
            <Shirt className="w-3.5 h-3.5 text-[#024BAB]" />
            Costume Guidelines
          </label>
          <textarea
            className={inputClass}
            rows={2}
            value={value.costumeGuidelines || ""}
            onChange={(e) => onChange({ costumeGuidelines: e.target.value })}
          />
        </div>
        <div className="md:col-span-2">
          <label className={labelClass}>
            <ListOrdered className="w-3.5 h-3.5 text-[#024BAB]" />
            Performance Order
          </label>
          <input
            className={inputClass}
            value={value.performanceOrder || ""}
            onChange={(e) => onChange({ performanceOrder: e.target.value })}
          />
        </div>
        <div className="md:col-span-2">
          <label className={labelClass}>
            <ClipboardCheck className="w-3.5 h-3.5 text-[#024BAB]" />
            Judging Criteria
          </label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {(value.judgingCriteria || []).map((c) => (
              <span
                key={c}
                className="flex items-center gap-1 border-2 border-black px-2 py-1 text-xs font-bold"
              >
                {c}
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      judgingCriteria: value.judgingCriteria.filter(
                        (x) => x !== c,
                      ),
                    })
                  }
                  className="text-red-500 hover:text-red-700"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={criterion}
              onChange={(e) => setCriterion(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && (e.preventDefault(), addCriterion())
              }
              placeholder="Add judging criterion"
              className="flex-1 border-2 border-black px-3 py-1.5 text-sm font-medium outline-none max-w-xs"
            />
            <button
              type="button"
              onClick={addCriterion}
              className="border-2 border-black px-2 py-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </CollapsibleSection>
  );
}
