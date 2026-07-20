import { useState } from "react";
import {
  Trophy,
  Medal,
  IndianRupee,
  Star,
  FileText,
  Plus,
  X,
} from "lucide-react";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";
import type { EventAwards } from "@/types/hrms";

interface Props {
  value: EventAwards;
  onChange: (patch: Partial<EventAwards>) => void;
}

const inputClass =
  "w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none bg-white";
const labelClass = "flex items-center gap-1.5 text-xs font-bold uppercase mb-1";

export function AwardsSection({ value, onChange }: Props) {
  const [tagInput, setTagInput] = useState("");

  const addTag = () => {
    const v = tagInput.trim();
    if (!v) return;
    onChange({ specialAwards: [...(value.specialAwards || []), v] });
    setTagInput("");
  };

  return (
    <CollapsibleSection title="Awards" icon={Trophy}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>
            <Trophy className="w-3.5 h-3.5 text-[#024BAB]" />
            Winner Prize
          </label>
          <input
            className={inputClass}
            value={value.winnerPrize || ""}
            onChange={(e) => onChange({ winnerPrize: e.target.value })}
          />
        </div>
        <div>
          <label className={labelClass}>
            <Medal className="w-3.5 h-3.5 text-[#024BAB]" />
            Runner-up Prize
          </label>
          <input
            className={inputClass}
            value={value.runnerUpPrize || ""}
            onChange={(e) => onChange({ runnerUpPrize: e.target.value })}
          />
        </div>
        <div>
          <label className={labelClass}>
            <IndianRupee className="w-3.5 h-3.5 text-[#024BAB]" />
            Cash Prize (₹)
          </label>
          <input
            type="number"
            min={0}
            className={inputClass}
            value={value.cashPrize ?? ""}
            onChange={(e) =>
              onChange({
                cashPrize: e.target.value ? Number(e.target.value) : undefined,
              })
            }
          />
        </div>
        <label className="flex items-center gap-2 text-sm font-bold">
          <input
            type="checkbox"
            checked={!!value.participationCertificate}
            onChange={(e) =>
              onChange({ participationCertificate: e.target.checked })
            }
          />
          Participation Certificate
        </label>
        <label className="flex items-center gap-2 text-sm font-bold">
          <input
            type="checkbox"
            checked={!!value.medals}
            onChange={(e) => onChange({ medals: e.target.checked })}
          />
          Medals
        </label>
        <label className="flex items-center gap-2 text-sm font-bold">
          <input
            type="checkbox"
            checked={!!value.trophies}
            onChange={(e) => onChange({ trophies: e.target.checked })}
          />
          Trophies
        </label>
        <div className="md:col-span-2">
          <label className={labelClass}>
            <Star className="w-3.5 h-3.5 text-[#024BAB]" />
            Special Awards
          </label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {(value.specialAwards || []).map((a) => (
              <span
                key={a}
                className="flex items-center gap-1 border-2 border-black px-2 py-1 text-xs font-bold"
              >
                {a}
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      specialAwards: value.specialAwards.filter((x) => x !== a),
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
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && (e.preventDefault(), addTag())
              }
              placeholder="Add special award"
              className="flex-1 border-2 border-black px-3 py-1.5 text-sm font-medium outline-none max-w-xs"
            />
            <button
              type="button"
              onClick={addTag}
              className="border-2 border-black px-2 py-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <div className="md:col-span-2">
          <label className={labelClass}>
            <FileText className="w-3.5 h-3.5 text-[#024BAB]" />
            Description
          </label>
          <textarea
            className={inputClass}
            rows={3}
            value={value.description || ""}
            onChange={(e) => onChange({ description: e.target.value })}
          />
        </div>
      </div>
    </CollapsibleSection>
  );
}
