import { useState, useEffect, useCallback } from "react";
import nesthrlogo from "../../assets/nesthr.png";
import { AppLayout } from "@/components/layout/AppLayout";
import { leaveAPI, employeeAPI } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { LeaveRequest, Employee } from "@/types/hrms";
import { cn, formatDate } from "@/lib/utils";
import {
  Plus,
  CalendarDays,
  CheckCircle,
  XCircle,
  Clock,
  X,
  Search,
  ArrowUp,
  ArrowDown,
  Pencil,
  Trash2,
} from "lucide-react";
import { ActionModal } from "@/components/ui/ActionModal";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-[#FA731C]/10 text-[#FA731C] border-[#FA731C] px-2 py-0.5",
  approved: "bg-[#00C48C]/10 text-[#00C48C] border-[#00C48C] px-2 py-0.5",
  rejected: "bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444] px-2 py-0.5",
  cancelled: "bg-gray-100 text-gray-500 border-gray-300 px-2 py-0.5",
};

const TYPE_BADGE_COLORS: Record<string, string> = {
  casual: "bg-[#024BAB]/10 text-[#024BAB] border-[#024BAB]",
  sick: "bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]",
  earned: "bg-[#00C48C]/10 text-[#00C48C] border-[#00C48C]",
  maternity: "bg-[#A855F7]/10 text-[#A855F7] border-[#A855F7]",
  paternity: "bg-[#024BAB]/10 text-[#024BAB] border-[#024BAB]",
  unpaid: "bg-gray-100 text-gray-500 border-gray-300",
  compensatory: "bg-[#FA731C]/10 text-[#FA731C] border-[#FA731C]",
};

const TYPE_LABELS: Record<string, string> = {
  casual: "Casual",
  sick: "Sick",
  earned: "Earned",
  maternity: "Maternity",
  paternity: "Paternity",
  unpaid: "Unpaid",
  compensatory: "Comp-off",
};

interface LeaveForm {
  employee: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: string;
  reason: string;
  isHalfDay: boolean;
}

const EMPTY_FORM: LeaveForm = {
  employee: "",
  leaveType: "casual",
  startDate: "",
  endDate: "",
  days: "1",
  reason: "",
  isHalfDay: false,
};

function LeaveFormFields({
  f,
  setF,
  showEmployee,
  employees,
}: {
  f: LeaveForm;
  setF: (v: LeaveForm) => void;
  showEmployee: boolean;
  employees: Employee[];
}) {
  return (
    <>
      {showEmployee && (
        <div>
          <label className="block text-xs font-bold text-black mb-1">
            Employee
          </label>
          <select
            value={f.employee}
            onChange={(e) => setF({ ...f, employee: e.target.value })}
            className="border-2 w-full px-3 py-2 text-sm"
            required
          >
            <option value="">Select employee</option>
            {employees.map((e) => (
              <option key={e._id} value={e._id}>
                {e.firstName} {e.lastName}
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className="block text-xs font-bold text-black mb-1">
          Leave Type
        </label>
        <select
          required
          value={f.leaveType}
          onChange={(e) => setF({ ...f, leaveType: e.target.value })}
          className="border-2 w-full px-3 py-2 text-sm"
        >
          {Object.entries(TYPE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-black mb-1">
            Start Date
          </label>
          <input
            type="date"
            value={f.startDate}
            onChange={(e) => setF({ ...f, startDate: e.target.value })}
            className="border-2 w-full px-3 py-2 text-sm"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-black mb-1">
            End Date
          </label>
          <input
            type="date"
            value={f.endDate}
            onChange={(e) => setF({ ...f, endDate: e.target.value })}
            className="border-2 w-full px-3 py-2 text-sm"
            required
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-bold text-black mb-1">
          Number of Days
        </label>
        <input
          type="number"
          min="0.5"
          max="30"
          step="0.5"
          value={f.days}
          onChange={(e) => setF({ ...f, days: e.target.value })}
          className="border-2 w-full px-3 py-2 text-sm"
          required
        />
      </div>
      <div>
        <label className="block text-xs font-bold text-black mb-1">
          Reason
        </label>
        <textarea
          value={f.reason}
          onChange={(e) => setF({ ...f, reason: e.target.value })}
          className="border-2 w-full px-3 py-2 text-sm resize-none"
          rows={3}
          required
          placeholder="Reason for leave..."
        />
      </div>
    </>
  );
}

function toDateInputValue(dateStr: string) {
  if (!dateStr) return "";
  return new Date(dateStr).toISOString().slice(0, 10);
}

export default function LeavePage() {
  const { user } = useAuth();
  const isEmployee = user?.role === "employee";
  const isAdmin = ["super_admin", "admin", "hr_manager"].includes(
    user?.role ?? "",
  );

  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [myEmployeeId, setMyEmployeeId] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  // Create modal
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<LeaveForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Edit modal
  const [editLeave, setEditLeave] = useState<LeaveRequest | null>(null);
  const [editForm, setEditForm] = useState<LeaveForm>(EMPTY_FORM);
  const [editSaving, setEditSaving] = useState(false);

  // Rejection reason modal
  const [rejectModal, setRejectModal] = useState<{
    show: boolean;
    leaveId: string;
    reason: string;
  }>({ show: false, leaveId: "", reason: "" });

  // Cancellation reason modal (for cancelling approved leave)
  const [cancelModal, setCancelModal] = useState<{
    show: boolean;
    leaveId: string;
    reason: string;
  }>({ show: false, leaveId: "", reason: "" });

  // Approve modal — with salary deduction option
  const [approveModal, setApproveModal] = useState<{
    show: boolean;
    leaveId: string;
    leaveType: string;
    days: number;
    empName: string;
    deductSalary: boolean;
  }>({
    show: false,
    leaveId: "",
    leaveType: "",
    days: 0,
    empName: "",
    deductSalary: false,
  });

  const [actionModal, setActionModal] = useState<{
    show: boolean;
    type: "success" | "error";
    title: string;
    message: string;
  }>({ show: false, type: "success", title: "", message: "" });

  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<"startDate" | "days" | "employee">(
    "startDate",
  );
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (isEmployee) {
        const [leavesRes, meRes] = await Promise.all([
          leaveAPI.getAll(filter ? { status: filter } : undefined),
          employeeAPI.getMe(),
        ]);
        if (leavesRes.success) setLeaves(leavesRes.data);
        if (meRes.success) setMyEmployeeId(meRes.data._id);
      } else {
        const [leavesRes, empRes] = await Promise.all([
          leaveAPI.getAll(filter ? { status: filter } : undefined),
          employeeAPI.getAll({ status: "active", limit: "200" }),
        ]);
        if (leavesRes.success) setLeaves(leavesRes.data);
        if (empRes.success) setEmployees(empRes.data);
      }
    } catch {}
    setLoading(false);
  }, [filter, isEmployee]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await leaveAPI.create({ ...form, days: Number(form.days) });
      setActionModal({
        show: true,
        type: "success",
        title: "Leave Applied",
        message: "Your leave request has been submitted.",
      });
      setShowModal(false);
      setForm(EMPTY_FORM);
      load();
    } catch (err: any) {
      setActionModal({
        show: true,
        type: "error",
        title: "Error",
        message: err.message || "Failed to submit leave request.",
      });
    }
    setSaving(false);
  };

  const openEdit = (leave: LeaveRequest) => {
    setEditLeave(leave);
    setEditForm({
      employee: (leave.employee as any)?._id ?? "",
      leaveType: leave.leaveType,
      startDate: toDateInputValue(leave.startDate),
      endDate: toDateInputValue(leave.endDate),
      days: String(leave.days),
      reason: leave.reason ?? "",
      isHalfDay: leave.isHalfDay ?? false,
    });
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editLeave) return;
    setEditSaving(true);
    try {
      await leaveAPI.update(editLeave._id, {
        ...editForm,
        days: Number(editForm.days),
      });
      setActionModal({
        show: true,
        type: "success",
        title: "Leave Updated",
        message: "Leave request has been updated.",
      });
      setEditLeave(null);
      load();
    } catch (err: any) {
      setActionModal({
        show: true,
        type: "error",
        title: "Error",
        message: err.message || "Failed to update leave request.",
      });
    }
    setEditSaving(false);
  };

  const handleStatus = async (
    id: string,
    status: string,
    extra?: Record<string, string>,
  ) => {
    try {
      await leaveAPI.updateStatus(id, { status, ...extra });
      load();
    } catch (err: any) {
      setActionModal({
        show: true,
        type: "error",
        title: "Error",
        message: err.message || "Action failed.",
      });
    }
  };

  const handleDelete = async (leave: LeaveRequest) => {
    if (leave.status === "approved") {
      // Must prompt for cancellation reason
      setCancelModal({ show: true, leaveId: leave._id, reason: "" });
      return;
    }
    try {
      await leaveAPI.delete(leave._id);
      load();
    } catch (err: any) {
      setActionModal({
        show: true,
        type: "error",
        title: "Error",
        message: err.message || "Failed to delete leave.",
      });
    }
  };

  const confirmApprove = async () => {
    await handleStatus(approveModal.leaveId, "approved", {
      deductSalary: String(approveModal.deductSalary),
    });
    setApproveModal({
      show: false,
      leaveId: "",
      leaveType: "",
      days: 0,
      empName: "",
      deductSalary: false,
    });
  };

  const confirmReject = async () => {
    if (!rejectModal.reason.trim()) return;
    await handleStatus(rejectModal.leaveId, "rejected", {
      rejectionReason: rejectModal.reason,
    });
    setRejectModal({ show: false, leaveId: "", reason: "" });
  };

  const confirmCancel = async () => {
    if (!cancelModal.reason.trim()) return;
    try {
      await leaveAPI.delete(cancelModal.leaveId, {
        cancellationReason: cancelModal.reason,
      });
      setCancelModal({ show: false, leaveId: "", reason: "" });
      load();
    } catch (err: any) {
      setActionModal({
        show: true,
        type: "error",
        title: "Error",
        message: err.message || "Failed to cancel leave.",
      });
    }
  };

  const summary = {
    pending: leaves.filter((l) => l.status === "pending").length,
    approved: leaves.filter((l) => l.status === "approved").length,
    rejected: leaves.filter((l) => l.status === "rejected").length,
  };

  const displayedLeaves = [...leaves]
    .filter((l) => {
      if (!search) return true;
      const name =
        `${(l.employee as any)?.firstName ?? ""} ${(l.employee as any)?.lastName ?? ""}`.toLowerCase();
      return name.includes(search.toLowerCase());
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortKey === "startDate")
        cmp = new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
      else if (sortKey === "days") cmp = (a.days ?? 0) - (b.days ?? 0);
      else if (sortKey === "employee") {
        const na = `${(a.employee as any)?.firstName ?? ""}${(a.employee as any)?.lastName ?? ""}`;
        const nb = `${(b.employee as any)?.firstName ?? ""}${(b.employee as any)?.lastName ?? ""}`;
        cmp = na.localeCompare(nb);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

  return (
    <AppLayout title="Leave Management">
      {}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          {["", "pending", "approved", "rejected"].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={cn(
                "px-3 py-1.5 text-xs font-bold border-2 transition-colors capitalize",
                filter === s
                  ? "bg-[#024BAB] text-white border-black border-2"
                  : "bg-white text-black border-black hover:bg-[#024BAB]/10",
              )}
            >
              {s === "" ? "All" : s}{" "}
              {s === "pending" && summary.pending > 0 && `(${summary.pending})`}
            </button>
          ))}
        </div>
        <button
          onClick={() => {
            setForm(
              isEmployee
                ? { ...EMPTY_FORM, employee: myEmployeeId }
                : EMPTY_FORM,
            );
            setShowModal(true);
          }}
          className="border-2 bg-[#024BAB] text-white px-4 py-2 text-sm flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> Apply Leave
        </button>
      </div>

      {}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: "Pending", value: summary.pending, bg: "bg-[#FA731C]" },
          { label: "Approved", value: summary.approved, bg: "bg-[#024BAB]" },
          { label: "Rejected", value: summary.rejected, bg: "bg-[#EF4444]" },
        ].map(({ label, value, bg }) => (
          <div
            key={label}
            className="border-2 bg-white p-4 flex items-center gap-3"
          >
            <div
              className={cn(
                "w-10 h-10 border-2 border-black flex items-center justify-center shrink-0",
                bg,
              )}
            >
              <CalendarDays className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-display font-bold text-2xl text-black">
                {value}
              </p>
              <p className="text-xs font-bold text-muted-foreground uppercase">
                {label}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Search & Sort */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex items-center gap-2 border-2 border-black bg-white px-3 py-2 flex-1 min-w-48">
          <Search className="w-4 h-4 shrink-0 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by employee name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-sm outline-none w-full font-medium"
          />
          {search && (
            <button onClick={() => setSearch("")}>
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          )}
        </div>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as any)}
          className="border-2 border-black bg-white px-3 py-2 text-sm font-semibold outline-none"
        >
          <option value="startDate">Sort: Date</option>
          <option value="days">Sort: Days</option>
          <option value="employee">Sort: Employee</option>
        </select>
        <button
          onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
          className="border-2 border-black bg-white px-3 py-2 flex items-center gap-1 font-semibold text-sm"
        >
          {sortDir === "asc" ? (
            <ArrowUp className="w-4 h-4" />
          ) : (
            <ArrowDown className="w-4 h-4" />
          )}
          {sortDir === "asc" ? "Asc" : "Desc"}
        </button>
      </div>

      {}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <img src={nesthrlogo} alt="NestSports" className="h-16 w-auto" />
        </div>
      ) : displayedLeaves.length === 0 ? (
        <div className="border-2 bg-white p-12 flex flex-col items-center justify-center">
          <CalendarDays className="w-12 h-12 text-muted-foreground/30 mb-3" />
          <p className="font-bold text-black">No leave requests</p>
        </div>
      ) : (
        <div className="border-2 bg-white overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-black bg-[#024BAB]/5">
                {[
                  "Employee",
                  "Leave Type",
                  "Duration",
                  "Days",
                  "Reason",
                  "Status",
                  "Actions",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-bold text-black uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayedLeaves.map((leave, i) => (
                <tr
                  key={leave._id}
                  className={cn(
                    "border-b border-black/10 hover:bg-[#024BAB]/5 transition-colors",
                    i % 2 === 0 ? "" : "bg-[#F8FAFF]",
                  )}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {(leave.employee as any)?.avatar ? (
                        <img
                          src={(leave.employee as any).avatar}
                          alt={(leave.employee as any)?.firstName}
                          className="w-7 h-7 border-2 border-black object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-7 h-7 bg-[#024BAB] border-2 border-black flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                          {(
                            leave.employee as any
                          )?.firstName?.[0]?.toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-black text-xs">
                          {(leave.employee as any)?.firstName}{" "}
                          {(leave.employee as any)?.lastName}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {(leave.employee as any)?.department?.name}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "border-2 text-[10px] px-2 py-0.5",
                        TYPE_BADGE_COLORS[leave.leaveType] ||
                          "bg-gray-100 text-gray-500 border-gray-300",
                      )}
                    >
                      {TYPE_LABELS[leave.leaveType]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-black">
                    {formatDate(leave.startDate)} → {formatDate(leave.endDate)}
                  </td>
                  <td className="px-4 py-3 text-xs font-bold text-black">
                    {leave.days}d
                  </td>
                  <td className="px-4 py-3 text-xs text-black max-w-32 truncate">
                    {leave.reason}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <span
                        className={cn(
                          "border-2 text-[10px] capitalize",
                          STATUS_COLORS[leave.status],
                        )}
                      >
                        {leave.status}
                      </span>
                      {leave.status === "approved" && (
                        <span
                          className={cn(
                            "border text-[9px] px-1.5 py-0.5 font-bold",
                            (leave as any).deductSalary
                              ? "bg-[#FA731C]/10 text-[#FA731C] border-[#FA731C]"
                              : "bg-[#00C48C]/10 text-[#00C48C] border-[#00C48C]",
                          )}
                        >
                          {(leave as any).deductSalary ? "Unpaid" : "Paid"}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {/* Approve / Reject — admin only, pending leaves */}
                      {isAdmin && leave.status === "pending" && (
                        <>
                          <button
                            onClick={() =>
                              setApproveModal({
                                show: true,
                                leaveId: leave._id,
                                leaveType: leave.leaveType,
                                days: leave.days,
                                empName: `${(leave.employee as any)?.firstName ?? ""} ${(leave.employee as any)?.lastName ?? ""}`,
                                deductSalary: leave.leaveType === "unpaid",
                              })
                            }
                            className="p-1.5 border-2 border-transparent hover:border-black hover:bg-[#024BAB]/10 transition-colors"
                            title="Approve"
                          >
                            <CheckCircle className="w-3.5 h-3.5 text-[#024BAB]" />
                          </button>
                          <button
                            onClick={() =>
                              setRejectModal({
                                show: true,
                                leaveId: leave._id,
                                reason: "",
                              })
                            }
                            className="p-1.5 border-2 border-transparent hover:border-black hover:bg-red-50 transition-colors"
                            title="Reject"
                          >
                            <XCircle className="w-3.5 h-3.5 text-red-600" />
                          </button>
                        </>
                      )}

                      {/* Edit — admin can edit any; employee can edit own pending */}
                      {(isAdmin ||
                        (isEmployee && leave.status === "pending")) && (
                        <button
                          onClick={() => openEdit(leave)}
                          className="p-1.5 border-2 border-transparent hover:border-black hover:bg-yellow-50 transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5 text-yellow-600" />
                        </button>
                      )}

                      {/* Delete / Cancel — admin any; employee own pending */}
                      {(isAdmin ||
                        (isEmployee && leave.status === "pending")) && (
                        <button
                          onClick={() => handleDelete(leave)}
                          className="p-1.5 border-2 border-transparent hover:border-black hover:bg-red-50 transition-colors"
                          title={
                            leave.status === "approved"
                              ? "Cancel (approved)"
                              : "Delete"
                          }
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-600" />
                        </button>
                      )}

                      {/* Employee cancel pending */}
                      {isEmployee && leave.status === "pending" && (
                        <button
                          onClick={() => handleStatus(leave._id, "cancelled")}
                          className="text-xs font-bold border-2 border-black px-2 py-1 hover:bg-red-50 transition-colors"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Leave Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="border-2 bg-white w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b-2 border-black">
              <h3 className="font-display font-bold text-lg">Apply Leave</h3>
              <button onClick={() => setShowModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={handleCreate}
              onInvalidCapture={(e) => {
                const el = e.target as HTMLInputElement;
                e.preventDefault();
                const label =
                  el
                    .closest("div")
                    ?.querySelector("label")
                    ?.textContent?.replace("*", "")
                    .trim() ||
                  el.placeholder ||
                  el.name ||
                  "a required field";
                setActionModal({
                  show: true,
                  type: "error",
                  title: "Required Field Missing",
                  message: `Please fill in: ${label}`,
                });
              }}
              className="p-5 space-y-4"
            >
              <LeaveFormFields
                f={form}
                setF={setForm}
                showEmployee={!isEmployee}
                employees={employees}
              />
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="border-2 bg-[#024BAB] text-white px-6 py-2.5 text-sm font-bold flex-1"
                >
                  {saving ? "Submitting..." : "Apply Leave"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="border-2 bg-white text-black px-4 py-2.5 text-sm font-bold"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Leave Modal */}
      {editLeave && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="border-2 bg-white w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b-2 border-black">
              <h3 className="font-display font-bold text-lg">Edit Leave</h3>
              <button onClick={() => setEditLeave(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleEdit} className="p-5 space-y-4">
              <LeaveFormFields
                f={editForm}
                setF={setEditForm}
                showEmployee={false}
                employees={employees}
              />
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={editSaving}
                  className="border-2 bg-[#024BAB] text-white px-6 py-2.5 text-sm font-bold flex-1"
                >
                  {editSaving ? "Saving..." : "Save Changes"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditLeave(null)}
                  className="border-2 bg-white text-black px-4 py-2.5 text-sm font-bold"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Approve Leave Modal — with salary deduction option */}
      {approveModal.show && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="border-2 bg-white w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b-2 border-black">
              <h3 className="font-display font-bold text-lg">Approve Leave</h3>
              <button
                onClick={() =>
                  setApproveModal({
                    show: false,
                    leaveId: "",
                    leaveType: "",
                    days: 0,
                    empName: "",
                    deductSalary: false,
                  })
                }
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-black font-medium">
                Approving{" "}
                <strong>
                  {approveModal.days}d {approveModal.leaveType}
                </strong>{" "}
                leave for <strong>{approveModal.empName}</strong>.
              </p>
              <div className="border-2 border-black p-4 space-y-3">
                <p className="text-xs font-bold text-black uppercase tracking-wider">
                  Salary Deduction
                </p>
                <p className="text-xs text-muted-foreground">
                  Should salary be deducted for these leave days?
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() =>
                      setApproveModal((m) => ({ ...m, deductSalary: false }))
                    }
                    className={cn(
                      "flex-1 py-2.5 text-sm font-bold border-2 transition-colors",
                      !approveModal.deductSalary
                        ? "bg-[#00C48C] text-white border-black"
                        : "bg-white text-black border-black hover:bg-[#00C48C]/10",
                    )}
                  >
                    ✓ Paid Leave
                  </button>
                  <button
                    onClick={() =>
                      setApproveModal((m) => ({ ...m, deductSalary: true }))
                    }
                    className={cn(
                      "flex-1 py-2.5 text-sm font-bold border-2 transition-colors",
                      approveModal.deductSalary
                        ? "bg-[#FA731C] text-white border-black"
                        : "bg-white text-black border-black hover:bg-[#FA731C]/10",
                    )}
                  >
                    ✗ Unpaid (Deduct)
                  </button>
                </div>
                <p
                  className={cn(
                    "text-xs font-semibold",
                    approveModal.deductSalary
                      ? "text-[#FA731C]"
                      : "text-[#00C48C]",
                  )}
                >
                  {approveModal.deductSalary
                    ? "Salary will be deducted for these leave days."
                    : "Salary will NOT be deducted — employee gets full pay."}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={confirmApprove}
                  className="border-2 bg-[#024BAB] text-white px-6 py-2.5 text-sm font-bold flex-1"
                >
                  Confirm Approve
                </button>
                <button
                  onClick={() =>
                    setApproveModal({
                      show: false,
                      leaveId: "",
                      leaveType: "",
                      days: 0,
                      empName: "",
                      deductSalary: false,
                    })
                  }
                  className="border-2 bg-white text-black px-4 py-2.5 text-sm font-bold"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Reason Modal */}
      {rejectModal.show && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="border-2 bg-white w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b-2 border-black">
              <h3 className="font-display font-bold text-lg">Reject Leave</h3>
              <button
                onClick={() =>
                  setRejectModal({ show: false, leaveId: "", reason: "" })
                }
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-muted-foreground">
                Please provide a reason for rejection. This will be sent to the
                employee via WhatsApp.
              </p>
              <textarea
                value={rejectModal.reason}
                onChange={(e) =>
                  setRejectModal({ ...rejectModal, reason: e.target.value })
                }
                className="border-2 w-full px-3 py-2 text-sm resize-none"
                rows={3}
                placeholder="Rejection reason..."
              />
              <div className="flex gap-3">
                <button
                  onClick={confirmReject}
                  disabled={!rejectModal.reason.trim()}
                  className="border-2 bg-red-600 text-white px-6 py-2.5 text-sm font-bold flex-1 disabled:opacity-40"
                >
                  Reject Leave
                </button>
                <button
                  onClick={() =>
                    setRejectModal({ show: false, leaveId: "", reason: "" })
                  }
                  className="border-2 bg-white text-black px-4 py-2.5 text-sm font-bold"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancellation Reason Modal (for approved leaves) */}
      {cancelModal.show && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="border-2 bg-white w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b-2 border-black">
              <h3 className="font-display font-bold text-lg">
                Cancel Approved Leave
              </h3>
              <button
                onClick={() =>
                  setCancelModal({ show: false, leaveId: "", reason: "" })
                }
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-muted-foreground">
                This leave is already approved. Provide a reason for
                cancellation — the employee will be notified via WhatsApp.
              </p>
              <textarea
                value={cancelModal.reason}
                onChange={(e) =>
                  setCancelModal({ ...cancelModal, reason: e.target.value })
                }
                className="border-2 w-full px-3 py-2 text-sm resize-none"
                rows={3}
                placeholder="Cancellation reason..."
              />
              <div className="flex gap-3">
                <button
                  onClick={confirmCancel}
                  disabled={!cancelModal.reason.trim()}
                  className="border-2 bg-red-600 text-white px-6 py-2.5 text-sm font-bold flex-1 disabled:opacity-40"
                >
                  Cancel Leave
                </button>
                <button
                  onClick={() =>
                    setCancelModal({ show: false, leaveId: "", reason: "" })
                  }
                  className="border-2 bg-white text-black px-4 py-2.5 text-sm font-bold"
                >
                  Go Back
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ActionModal
        show={actionModal.show}
        type={actionModal.type}
        title={actionModal.title}
        message={actionModal.message}
        onClose={() => setActionModal({ ...actionModal, show: false })}
      />
    </AppLayout>
  );
}
