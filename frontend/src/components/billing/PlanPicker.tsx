import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { PLANS, inr, GST_RATE, type PlanId } from "@/lib/plans";

// The three yearly plans as selectable cards. Plans smaller than the academy's current student count are disabled.
export default function PlanPicker({
  value,
  onChange,
  students = 0,
  current,
}: {
  value: PlanId | "";
  onChange: (id: PlanId) => void;
  students?: number;
  current?: string;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {PLANS.map((p) => {
        const tooSmall = p.maxStudents !== null && students > p.maxStudents;
        const selected = value === p.id;
        return (
          <button
            key={p.id}
            type="button"
            disabled={tooSmall}
            onClick={() => onChange(p.id)}
            className={cn(
              "text-left border-2 border-black p-5 bg-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed",
              selected && "bg-[#024BAB] text-white",
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="font-display font-bold text-lg">{p.name}</p>
              {current === p.id && (
                <span className="text-[10px] font-bold uppercase border border-current px-1.5 py-0.5">
                  Current
                </span>
              )}
            </div>
            <p className="font-display font-bold text-3xl">{inr(p.price)}</p>
            <p
              className={cn(
                "text-xs mb-3",
                selected ? "text-white/70" : "text-muted-foreground",
              )}
            >
              per year + {GST_RATE}% GST
            </p>
            <ul className="space-y-1.5 text-sm">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" />
                {p.maxStudents === null
                  ? "Unlimited students"
                  : `Up to ${p.maxStudents} students`}
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" />
                Unlimited staff &amp; coaches
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" />
                Web + mobile apps, all features
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" />
                WhatsApp alerts on prepaid credits
              </li>
            </ul>
            {tooSmall && (
              <p className="text-xs font-bold mt-3">
                You have {students} students
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}
