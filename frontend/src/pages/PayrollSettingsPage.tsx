import { useState, useEffect, useCallback } from "react";
import nesthrlogo from "../../assets/nesthr.png";
import { payrollConfigAPI } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { AppLayout } from "@/components/layout/AppLayout";
import { ShieldAlert, Clock, Loader2, Save, LogOut } from "lucide-react";

interface DeductionRule {
  shiftStartHour: number;
  shiftStartMinute: number;
  shiftEndHour: number;
  shiftEndMinute: number;
  lateThresholdMinutes: number;
  lateDeductionType: "fixed" | "percent";
  lateDeductionAmount: number;
  halfDayThresholdMinutes: number;
  earlyCheckoutThresholdMinutes: number;
  earlyCheckoutDeductionEnabled: boolean;
}

const DEFAULT_DEDUCTIONS: DeductionRule = {
  shiftStartHour: 9,
  shiftStartMinute: 0,
  shiftEndHour: 18,
  shiftEndMinute: 0,
  lateThresholdMinutes: 15,
  lateDeductionType: "fixed",
  lateDeductionAmount: 0,
  halfDayThresholdMinutes: 120,
  earlyCheckoutThresholdMinutes: 15,
  earlyCheckoutDeductionEnabled: false,
};

function NumField({
  label,
  value,
  onChange,
  min,
  max,
  hint,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  hint?: string;
  suffix?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-bold uppercase mb-1 text-gray-600">
        {label}
      </label>
      <div className="relative">
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-bold">
            {suffix}
          </span>
        )}
        <input
          type="number"
          min={min ?? 0}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full border-2 border-black px-3 py-2 text-sm font-medium focus:outline-none pr-10"
        />
      </div>
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  description,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  description?: string;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="text-sm font-bold">{label}</p>
        {description && <p className="text-xs text-gray-500">{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full border-2 border-black transition-colors ${
          checked ? "bg-[#024BAB]" : "bg-gray-200"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white border border-black transition-transform ${
            checked ? "translate-x-5" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}

function fmt(h: number, m: number) {
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export default function PayrollSettingsPage() {
  const { toast } = useToast();
  const [rules, setRules] = useState<DeductionRule>(DEFAULT_DEDUCTIONS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const set = (patch: Partial<DeductionRule>) =>
    setRules((p) => ({ ...p, ...patch }));

  const fetchRules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await payrollConfigAPI.getDeductionRules();
      if (res.data) setRules({ ...DEFAULT_DEDUCTIONS, ...res.data });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await payrollConfigAPI.upsertDeductionRules(rules);
      toast({
        title: "Settings saved",
        description: "Attendance rules updated",
        variant: "success",
      });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout title="Payroll Settings">
      <div className="w-full mx-auto">
        <div className="mb-6">
          <h1 className="font-display font-bold text-3xl text-black">
            Payroll Settings
          </h1>
          <p className="text-gray-600 font-medium mt-1">
            Configure shift timing, grace period, and attendance deduction
            rules. Each employee's work schedule (Mon–Fri / Mon–Sat / Mon–Sun)
            is set individually in the Employees page.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <img src={nesthrlogo} alt="NestSports" className="h-16 w-auto" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-white border-2 border-black">
              <div className="p-4 border-b-2 border-black bg-[#F0F6FF]">
                <div className="flex items-center gap-3">
                  <ShieldAlert className="w-5 h-5 text-[#024BAB]" />
                  <div>
                    <h2 className="font-bold text-base">
                      Attendance Deduction Rules
                    </h2>
                    <p className="text-xs text-gray-500">
                      Shift timing, grace period, and late / early-checkout
                      deductions. Per-employee shift assignments override these
                      fallback timings.
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-5 space-y-6">
                {/* Late deduction */}
                <div>
                  <p className="text-xs font-bold uppercase mb-3">
                    Late Arrival
                  </p>
                  <div className="grid grid-cols-3 gap-4">
                    <NumField
                      label="Grace Period (min)"
                      value={rules.lateThresholdMinutes}
                      onChange={(v) => set({ lateThresholdMinutes: v })}
                      hint={`On time if in by ${fmt(rules.shiftStartHour, rules.shiftStartMinute + rules.lateThresholdMinutes)}`}
                    />
                    <div>
                      <label className="block text-xs font-bold uppercase mb-1 text-gray-600">
                        Deduction Type
                      </label>
                      <select
                        value={rules.lateDeductionType}
                        onChange={(e) =>
                          set({
                            lateDeductionType: e.target.value as
                              "fixed" | "percent",
                          })
                        }
                        className="w-full border-2 border-black px-3 py-2 text-sm bg-white focus:outline-none"
                      >
                        <option value="fixed">Fixed Amount (₹)</option>
                        <option value="percent">% of Daily Salary</option>
                      </select>
                    </div>
                    <NumField
                      label={
                        rules.lateDeductionType === "fixed"
                          ? "Amount per Late Day (₹)"
                          : "% of Daily Salary"
                      }
                      value={rules.lateDeductionAmount}
                      onChange={(v) => set({ lateDeductionAmount: v })}
                      suffix={
                        rules.lateDeductionType === "percent" ? "%" : undefined
                      }
                    />
                  </div>
                </div>

                {/* Half-day threshold */}
                <div className="border-t pt-5">
                  <p className="text-xs font-bold uppercase mb-3">
                    Half-Day Rule
                  </p>
                  <NumField
                    label="Late by more than (min) = Half Day (50% pay)"
                    value={rules.halfDayThresholdMinutes}
                    onChange={(v) => set({ halfDayThresholdMinutes: v })}
                    hint={`Half day if arriving after ${fmt(rules.shiftStartHour, rules.shiftStartMinute + rules.halfDayThresholdMinutes)}`}
                  />
                </div>

                {/* Early checkout */}
                <div className="border-t pt-5">
                  <div className="flex items-center gap-2 mb-3">
                    <LogOut className="w-4 h-4 text-[#024BAB]" />
                    <p className="text-xs font-bold uppercase">
                      Early Checkout
                    </p>
                  </div>
                  <Toggle
                    label="Enable Early Checkout Deduction"
                    description="Proportionally deducts pay when employee leaves before shift end"
                    checked={rules.earlyCheckoutDeductionEnabled}
                    onChange={(v) => set({ earlyCheckoutDeductionEnabled: v })}
                  />
                  {rules.earlyCheckoutDeductionEnabled && (
                    <div className="mt-3">
                      <NumField
                        label="Grace Period Before Shift End (min)"
                        value={rules.earlyCheckoutThresholdMinutes}
                        onChange={(v) =>
                          set({ earlyCheckoutThresholdMinutes: v })
                        }
                        hint="No deduction if leaving within this many minutes of shift end"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-[#024BAB] text-white border-2 border-black px-6 py-3 font-bold text-sm uppercase disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
