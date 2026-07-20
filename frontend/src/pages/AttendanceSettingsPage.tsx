import { useState, useEffect, useCallback } from "react";
import nesthrlogo from "../../assets/nesthr.png";
import { attendanceSettingsAPI, employeeAPI } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { AppLayout } from "@/components/layout/AppLayout";
import { Employee } from "@/types/hrms";
import {
  ShieldAlert,
  Clock,
  Loader2,
  Save,
  LogOut,
  X,
  Users,
  CalendarDays,
  Percent,
} from "lucide-react";

interface AttendanceSettings {
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

const DEFAULT_SETTINGS: AttendanceSettings = {
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

const LEAVE_TYPES = [
  "casual",
  "sick",
  "earned",
  "maternity",
  "paternity",
  "unpaid",
  "compensatory",
  "hourly",
  "wfh",
  "outdoor_duty",
];

const LEAVE_LABELS: Record<string, string> = {
  casual: "Casual",
  sick: "Sick",
  earned: "Earned",
  maternity: "Maternity",
  paternity: "Paternity",
  unpaid: "Unpaid",
  compensatory: "Comp-off",
  hourly: "Hourly",
  wfh: "WFH",
  outdoor_duty: "Outdoor Duty",
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
      <label className="flex items-center gap-1.5 text-xs font-bold uppercase mb-1 text-gray-600">
        <Clock className="w-3.5 h-3.5 text-[#024BAB]" />
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

function Avatar({
  avatar,
  firstName,
}: {
  avatar?: string;
  firstName?: string;
}) {
  return avatar ? (
    <img
      src={avatar}
      alt={firstName}
      className="w-7 h-7 border-2 border-black object-cover shrink-0 rounded-full"
    />
  ) : (
    <div className="w-7 h-7 bg-[#024BAB] border-2 border-black flex items-center justify-center text-[10px] font-bold text-white shrink-0 rounded-full">
      {firstName?.[0]?.toUpperCase()}
    </div>
  );
}

// Modal for configuring per-employee overrides — reused for late allowance
// and per-leave-type allowance (single numeric field per employee).
function CustomAllowanceModal({
  title,
  employees,
  initial,
  fieldLabel,
  onClose,
  onSave,
}: {
  title: string;
  employees: Employee[];
  initial: Record<string, number>;
  fieldLabel: string;
  onClose: () => void;
  onSave: (perEmployee: { employee: string; value: number }[]) => void;
}) {
  const [values, setValues] = useState<Record<string, number>>(initial);
  const [search, setSearch] = useState("");
  const filtered = employees.filter((e) =>
    `${e.firstName} ${e.lastName} ${e.employeeId}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="border-2 border-black bg-white w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b-2 border-black">
          <h3 className="font-display font-bold text-lg">{title}</h3>
          <button onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 border-b-2 border-black">
          <input
            type="text"
            placeholder="Search employees..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-2 border-black w-full px-3 py-2 text-sm"
          />
        </div>
        <div className="overflow-auto flex-1 divide-y divide-black/10">
          {filtered.map((e) => (
            <div
              key={e._id}
              className="flex items-center justify-between px-4 py-2"
            >
              <div className="flex items-center gap-2">
                <Avatar avatar={e.avatar} firstName={e.firstName} />
                <div>
                  <p className="text-sm font-bold">
                    {e.firstName} {e.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {e.employeeId}
                  </p>
                </div>
              </div>
              <input
                type="number"
                min={0}
                value={values[e._id] ?? 0}
                onChange={(ev) =>
                  setValues((v) => ({ ...v, [e._id]: Number(ev.target.value) }))
                }
                className="border-2 border-black w-20 px-2 py-1 text-sm text-right"
                title={fieldLabel}
              />
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">
              No employees found
            </p>
          )}
        </div>
        <div className="p-4 border-t-2 border-black flex gap-2">
          <button
            onClick={() =>
              onSave(
                Object.entries(values).map(([employee, value]) => ({
                  employee,
                  value,
                })),
              )
            }
            className="flex-1 border-2 bg-[#024BAB] text-white px-4 py-2 text-sm font-bold"
          >
            Save
          </button>
          <button
            onClick={onClose}
            className="border-2 border-black px-4 py-2 text-sm font-bold"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

interface BalanceRow {
  employee: {
    _id: string;
    firstName: string;
    lastName: string;
    employeeId: string;
    avatar?: string;
  };
  lateUsed: number;
  lateAllowed: number;
  leaveUsed: { leaveType: string; daysUsed: number; daysAllowed: number }[];
}

export default function AttendanceSettingsPage() {
  const { toast } = useToast();
  const [settings, setSettings] =
    useState<AttendanceSettings>(DEFAULT_SETTINGS);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Late allowance
  const [lateMode, setLateMode] = useState<"bulk" | "custom">("bulk");
  const [lateBulkCount, setLateBulkCount] = useState(0);
  const [showLateModal, setShowLateModal] = useState(false);
  const [savingLate, setSavingLate] = useState(false);

  // Leave allowance
  const [leaveType, setLeaveType] = useState("casual");
  const [leaveMode, setLeaveMode] = useState<"bulk" | "custom">("bulk");
  const [leaveBulkDays, setLeaveBulkDays] = useState(0);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [savingLeave, setSavingLeave] = useState(false);

  // Balance summary
  const [balances, setBalances] = useState<BalanceRow[]>([]);
  const [loadingBalances, setLoadingBalances] = useState(false);

  const set = (patch: Partial<AttendanceSettings>) =>
    setSettings((p) => ({ ...p, ...patch }));

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsRes, empRes] = await Promise.all([
        attendanceSettingsAPI.get(),
        employeeAPI.getAll({ status: "active", limit: "500" }),
      ]);
      if (settingsRes.data)
        setSettings({ ...DEFAULT_SETTINGS, ...settingsRes.data });
      if (empRes.success) setEmployees(empRes.data);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchBalances = useCallback(async () => {
    setLoadingBalances(true);
    try {
      const res = await attendanceSettingsAPI.getBalanceSummary();
      if (res.success) setBalances(res.data);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoadingBalances(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchAll();
    fetchBalances();
  }, [fetchAll, fetchBalances]);

  const handleSave = async () => {
    if (saving) return;
    if (
      !window.confirm(
        "Save attendance settings? This updates attendance deduction rules for all employees.",
      )
    )
      return;
    setSaving(true);
    try {
      await attendanceSettingsAPI.update(settings);
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

  const saveLateBulk = async () => {
    setSavingLate(true);
    try {
      await attendanceSettingsAPI.upsertLateAllowance({
        mode: "bulk",
        bulkCount: lateBulkCount,
      });
      toast({
        title: "Saved",
        description: "Late allowance updated",
        variant: "success",
      });
      fetchBalances();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSavingLate(false);
    }
  };

  const saveLateCustom = async (
    perEmployee: { employee: string; value: number }[],
  ) => {
    setSavingLate(true);
    try {
      await attendanceSettingsAPI.upsertLateAllowance({
        mode: "custom",
        perEmployee: perEmployee.map((p) => ({
          employee: p.employee,
          count: p.value,
        })),
      });
      toast({
        title: "Saved",
        description: "Late allowance updated",
        variant: "success",
      });
      setShowLateModal(false);
      fetchBalances();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSavingLate(false);
    }
  };

  const saveLeaveBulk = async () => {
    setSavingLeave(true);
    try {
      await attendanceSettingsAPI.upsertLeaveAllowance({
        leaveType,
        mode: "bulk",
        bulkDays: leaveBulkDays,
      });
      toast({
        title: "Saved",
        description: `${LEAVE_LABELS[leaveType]} leave allowance updated`,
        variant: "success",
      });
      fetchBalances();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSavingLeave(false);
    }
  };

  const saveLeaveCustom = async (
    perEmployee: { employee: string; value: number }[],
  ) => {
    setSavingLeave(true);
    try {
      await attendanceSettingsAPI.upsertLeaveAllowance({
        leaveType,
        mode: "custom",
        perEmployee: perEmployee.map((p) => ({
          employee: p.employee,
          days: p.value,
        })),
      });
      toast({
        title: "Saved",
        description: `${LEAVE_LABELS[leaveType]} leave allowance updated`,
        variant: "success",
      });
      setShowLeaveModal(false);
      fetchBalances();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSavingLeave(false);
    }
  };

  return (
    <AppLayout title="Attendance Settings">
      <div className="w-full mx-auto">
        <div className="mb-6">
          <h1 className="font-display font-bold text-3xl text-black">
            Attendance Settings
          </h1>
          <p className="text-gray-600 font-medium mt-1">
            Configure shift timing, grace period, attendance deduction rules,
            and monthly late/leave allowances. Each employee's work schedule is
            set individually in the Employees page.
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
                <div>
                  <p className="text-xs font-bold uppercase mb-3">
                    Late Arrival
                  </p>
                  <div className="grid grid-cols-3 gap-4">
                    <NumField
                      label="Grace Period (min)"
                      value={settings.lateThresholdMinutes}
                      onChange={(v) => set({ lateThresholdMinutes: v })}
                      hint={`On time if in by ${fmt(settings.shiftStartHour, settings.shiftStartMinute + settings.lateThresholdMinutes)}`}
                    />
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-bold uppercase mb-1 text-gray-600">
                        <Percent className="w-3.5 h-3.5 text-[#024BAB]" />
                        Deduction Type
                      </label>
                      <select
                        value={settings.lateDeductionType}
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
                        settings.lateDeductionType === "fixed"
                          ? "Amount per Late Day (₹)"
                          : "% of Daily Salary"
                      }
                      value={settings.lateDeductionAmount}
                      onChange={(v) => set({ lateDeductionAmount: v })}
                      suffix={
                        settings.lateDeductionType === "percent"
                          ? "%"
                          : undefined
                      }
                    />
                  </div>
                </div>

                <div className="border-t pt-5">
                  <p className="text-xs font-bold uppercase mb-3">
                    Half-Day Rule
                  </p>
                  <NumField
                    label="Late by more than (min) = Half Day (50% pay)"
                    value={settings.halfDayThresholdMinutes}
                    onChange={(v) => set({ halfDayThresholdMinutes: v })}
                    hint={`Half day if arriving after ${fmt(settings.shiftStartHour, settings.shiftStartMinute + settings.halfDayThresholdMinutes)}`}
                  />
                </div>

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
                    checked={settings.earlyCheckoutDeductionEnabled}
                    onChange={(v) => set({ earlyCheckoutDeductionEnabled: v })}
                  />
                  {settings.earlyCheckoutDeductionEnabled && (
                    <div className="mt-3">
                      <NumField
                        label="Grace Period Before Shift End (min)"
                        value={settings.earlyCheckoutThresholdMinutes}
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

            {/* Late Allowance */}
            <div className="bg-white border-2 border-black">
              <div className="p-4 border-b-2 border-black bg-[#F0F6FF]">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-[#024BAB]" />
                  <div>
                    <h2 className="font-bold text-base">Late Allowance</h2>
                    <p className="text-xs text-gray-500">
                      Max late arrivals per month with no deduction/approval
                      needed.
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-5 space-y-4">
                <div className="flex gap-3">
                  <button
                    onClick={() => setLateMode("bulk")}
                    className={`flex-1 py-2 text-sm font-bold border-2 border-black ${lateMode === "bulk" ? "bg-[#024BAB] text-white" : "bg-white text-black"}`}
                  >
                    Bulk (All Employees)
                  </button>
                  <button
                    onClick={() => setLateMode("custom")}
                    className={`flex-1 py-2 text-sm font-bold border-2 border-black ${lateMode === "custom" ? "bg-[#024BAB] text-white" : "bg-white text-black"}`}
                  >
                    Custom (Per Employee)
                  </button>
                </div>
                {lateMode === "bulk" ? (
                  <div className="flex items-end gap-3">
                    <div className="w-48">
                      <NumField
                        label="Max Lates / Month"
                        value={lateBulkCount}
                        onChange={setLateBulkCount}
                      />
                    </div>
                    <button
                      onClick={saveLateBulk}
                      disabled={savingLate}
                      className="border-2 bg-[#024BAB] text-white px-6 py-2.5 text-sm font-bold disabled:opacity-60"
                    >
                      {savingLate ? "Saving..." : "Save"}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowLateModal(true)}
                    className="border-2 border-black px-4 py-2.5 text-sm font-bold flex items-center gap-2"
                  >
                    <Users className="w-4 h-4" /> Configure per Employee
                  </button>
                )}
              </div>
            </div>

            {/* Leave Allowance */}
            <div className="bg-white border-2 border-black">
              <div className="p-4 border-b-2 border-black bg-[#F0F6FF]">
                <div className="flex items-center gap-3">
                  <CalendarDays className="w-5 h-5 text-[#024BAB]" />
                  <div>
                    <h2 className="font-bold text-base">Leave Allowance</h2>
                    <p className="text-xs text-gray-500">
                      Max no-deduction leave days per month, configured per
                      leave type.
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-bold uppercase mb-1 text-gray-600">
                    <CalendarDays className="w-3.5 h-3.5 text-[#024BAB]" />
                    Leave Type
                  </label>
                  <select
                    value={leaveType}
                    onChange={(e) => setLeaveType(e.target.value)}
                    className="w-full border-2 border-black px-3 py-2 text-sm bg-white focus:outline-none"
                  >
                    {LEAVE_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {LEAVE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setLeaveMode("bulk")}
                    className={`flex-1 py-2 text-sm font-bold border-2 border-black ${leaveMode === "bulk" ? "bg-[#024BAB] text-white" : "bg-white text-black"}`}
                  >
                    Bulk (All Employees)
                  </button>
                  <button
                    onClick={() => setLeaveMode("custom")}
                    className={`flex-1 py-2 text-sm font-bold border-2 border-black ${leaveMode === "custom" ? "bg-[#024BAB] text-white" : "bg-white text-black"}`}
                  >
                    Custom (Per Employee)
                  </button>
                </div>
                {leaveMode === "bulk" ? (
                  <div className="flex items-end gap-3">
                    <div className="w-48">
                      <NumField
                        label={`${LEAVE_LABELS[leaveType]} Days / Month`}
                        value={leaveBulkDays}
                        onChange={setLeaveBulkDays}
                      />
                    </div>
                    <button
                      onClick={saveLeaveBulk}
                      disabled={savingLeave}
                      className="border-2 bg-[#024BAB] text-white px-6 py-2.5 text-sm font-bold disabled:opacity-60"
                    >
                      {savingLeave ? "Saving..." : "Save"}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowLeaveModal(true)}
                    className="border-2 border-black px-4 py-2.5 text-sm font-bold flex items-center gap-2"
                  >
                    <Users className="w-4 h-4" /> Configure per Employee (
                    {LEAVE_LABELS[leaveType]})
                  </button>
                )}
              </div>
            </div>

            {/* Balance Summary */}
            <div className="bg-white border-2 border-black">
              <div className="p-4 border-b-2 border-black bg-[#F0F6FF]">
                <h2 className="font-bold text-base">
                  Balance Summary (This Month)
                </h2>
              </div>
              {loadingBalances ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-6 h-6 animate-spin text-[#024BAB]" />
                </div>
              ) : balances.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-10">
                  No usage recorded yet this month.
                </p>
              ) : (
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-black bg-[#024BAB]/5">
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase">
                          Employee
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase">
                          Late Used/Allowed
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-bold uppercase">
                          Leave Usage
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {balances.map((b, i) => (
                        <tr
                          key={b.employee._id}
                          className={i % 2 ? "bg-[#F8FAFF]" : ""}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Avatar
                                avatar={b.employee.avatar}
                                firstName={b.employee.firstName}
                              />
                              <div>
                                <p className="font-bold text-xs">
                                  {b.employee.firstName} {b.employee.lastName}
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                  {b.employee.employeeId}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs font-bold">
                            {b.lateUsed}/{b.lateAllowed}
                          </td>
                          <td className="px-4 py-3 text-xs">
                            {b.leaveUsed.length === 0
                              ? "—"
                              : b.leaveUsed
                                  .map(
                                    (l) =>
                                      `${LEAVE_LABELS[l.leaveType] ?? l.leaveType}: ${l.daysUsed}/${l.daysAllowed}`,
                                  )
                                  .join(", ")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {showLateModal && (
        <CustomAllowanceModal
          title="Late Allowance — Per Employee"
          employees={employees}
          initial={{}}
          fieldLabel="Max lates/month"
          onClose={() => setShowLateModal(false)}
          onSave={saveLateCustom}
        />
      )}
      {showLeaveModal && (
        <CustomAllowanceModal
          title={`${LEAVE_LABELS[leaveType]} Leave Allowance — Per Employee`}
          employees={employees}
          initial={{}}
          fieldLabel="Days/month"
          onClose={() => setShowLeaveModal(false)}
          onSave={saveLeaveCustom}
        />
      )}
    </AppLayout>
  );
}
