import { useState, useEffect, useCallback } from "react";
import nesthrlogo from "../../assets/nesthr.png";
import { AppLayout } from "@/components/layout/AppLayout";
import { loanAPI, employeeAPI } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ImportExportModal, type ImportHeader } from "@/components/ImportExportModal";
import { exportRowsToExcel } from "@/utils/excelImportExport";
import {
  Banknote,
  Plus,
  Pencil,
  Trash2,
  X,
  IndianRupee,
  TrendingDown,
  CheckCircle2,
  Check,
  Clock,
  Download,
  FileSpreadsheet,
} from "lucide-react";
import { Employee } from "@/types/hrms";

const LOAN_IMPORT_HEADERS: ImportHeader[] = [
  {
    key: "employeeId",
    label: "Employee ID",
    required: true,
    example: "EMP0001",
  },
  { key: "type", label: "Type", required: true, example: "loan" },
  { key: "amount", label: "Amount", required: true, example: "20000" },
  {
    key: "remainingBalance",
    label: "Remaining Balance",
    required: false,
    example: "15000",
  },
  {
    key: "monthlyEmi",
    label: "Monthly EMI",
    required: false,
    example: "2000",
  },
  {
    key: "tenureMonths",
    label: "Tenure (Months)",
    required: false,
    example: "10",
  },
  { key: "reason", label: "Reason", required: false, example: "Medical" },
  {
    key: "disbursedOn",
    label: "Disbursed On",
    required: false,
    example: "2024-01-15",
  },
  { key: "status", label: "Status", required: false, example: "active" },
  { key: "remarks", label: "Remarks", required: false, example: "" },
];

interface Loan {
  _id: string;
  employee: {
    _id: string;
    firstName: string;
    lastName: string;
    employeeId: string;
    department?: any;
  };
  type: "loan" | "advance";
  amount: number;
  remainingBalance: number;
  monthlyEmi: number;
  tenureMonths?: number;
  reason: string;
  disbursedOn: string;
  status: "pending" | "active" | "rejected" | "cleared" | "paused";
  rejectionReason?: string;
  clearedOn?: string;
  remarks: string;
}

const EMPTY_FORM = {
  employee: "",
  type: "loan" as "loan" | "advance",
  amount: "",
  monthlyEmi: "",
  reason: "",
  disbursedOn: new Date().toISOString().split("T")[0],
  status: "active" as "active" | "cleared" | "paused",
  remarks: "",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-orange-50 border-orange-500 text-orange-800",
  active: "bg-green-50 border-green-500 text-green-800",
  rejected: "bg-red-50 border-red-500 text-red-800",
  cleared: "bg-gray-100 border-gray-400 text-gray-600",
  paused: "bg-yellow-50 border-yellow-500 text-yellow-800",
};

export default function LoansPage() {
  const { toast } = useToast();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [importModal, setImportModal] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<"all" | "loan" | "advance">(
    "all",
  );
  const [filterStatus, setFilterStatus] = useState<
    "all" | "pending" | "active" | "rejected" | "cleared" | "paused"
  >("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<
    "employee" | "amount" | "remaining" | "date"
  >("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [loanRes, empRes] = await Promise.all([
        loanAPI.getAll(),
        employeeAPI.getAll({ status: "active", limit: "300" }),
      ]);
      setLoans(loanRes.data || []);
      setEmployees(empRes.data || []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openAdd = () => {
    setForm({ ...EMPTY_FORM });
    setEditId(null);
    setModal(true);
  };

  const openEdit = (loan: Loan) => {
    setForm({
      employee: loan.employee._id,
      type: loan.type,
      amount: String(loan.amount),
      monthlyEmi: String(loan.monthlyEmi),
      reason: loan.reason,
      disbursedOn: loan.disbursedOn ? loan.disbursedOn.split("T")[0] : "",
      status: loan.status,
      remarks: loan.remarks,
    });
    setEditId(loan._id);
    setModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        employee: form.employee,
        type: form.type,
        amount: parseFloat(form.amount),
        monthlyEmi: parseFloat(form.monthlyEmi) || 0,
        reason: form.reason,
        disbursedOn: form.disbursedOn,
        status: form.status,
        remarks: form.remarks,
        remainingBalance: parseFloat(form.amount),
      };
      if (editId) {
        await loanAPI.update(editId, payload);
        toast({
          title: "Updated",
          description: "Loan/advance record updated.",
        });
      } else {
        await loanAPI.create(payload);
        toast({ title: "Created", description: "Loan/advance entry added." });
      }
      setModal(false);
      load();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    }
    setSaving(false);
  };

  const handleApprove = async (id: string) => {
    try {
      await loanAPI.updateStatus(id, { status: "approved" });
      toast({ title: "Approved", description: "Loan/advance approved." });
      load();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const handleReject = async (id: string) => {
    const rejectionReason =
      window.prompt("Reason for rejection (optional):") || "";
    try {
      await loanAPI.updateStatus(id, { status: "rejected", rejectionReason });
      toast({
        title: "Rejected",
        description: "Loan/advance request rejected.",
      });
      load();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await loanAPI.delete(id);
      toast({ title: "Deleted" });
      setDeleteConfirm(null);
      load();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const displayedLoans = [...loans]
    .filter((l) => {
      if (filterType !== "all" && l.type !== filterType) return false;
      if (filterStatus !== "all" && l.status !== filterStatus) return false;
      if (search) {
        const name =
          `${(l.employee as any)?.firstName ?? ""} ${(l.employee as any)?.lastName ?? ""}`.toLowerCase();
        if (!name.includes(search.toLowerCase())) return false;
      }
      return true;
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortKey === "employee") {
        const na = `${(a.employee as any)?.firstName ?? ""}${(a.employee as any)?.lastName ?? ""}`;
        const nb = `${(b.employee as any)?.firstName ?? ""}${(b.employee as any)?.lastName ?? ""}`;
        cmp = na.localeCompare(nb);
      } else if (sortKey === "amount") cmp = a.amount - b.amount;
      else if (sortKey === "remaining")
        cmp = a.remainingBalance - b.remainingBalance;
      else if (sortKey === "date")
        cmp =
          new Date(a.disbursedOn ?? 0).getTime() -
          new Date(b.disbursedOn ?? 0).getTime();
      return sortDir === "asc" ? cmp : -cmp;
    });

  const totalDisbursed = displayedLoans.reduce((s, l) => s + l.amount, 0);
  const totalOutstanding = displayedLoans
    .filter((l) => l.status === "active")
    .reduce((s, l) => s + l.remainingBalance, 0);
  const activeCount = displayedLoans.filter(
    (l) => l.status === "active",
  ).length;
  const pendingCount = displayedLoans.filter(
    (l) => l.status === "pending",
  ).length;
  const clearedCount = displayedLoans.filter(
    (l) => l.status === "cleared",
  ).length;

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(n);

  return (
    <AppLayout title="Loans & Advances">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex flex-wrap gap-2">
          {(["all", "loan", "advance"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={cn(
                "px-3 py-1.5 text-xs font-bold border-2 capitalize",
                filterType === t
                  ? "bg-[#024BAB] text-white border-[#024BAB]"
                  : "bg-white border-black text-black",
              )}
            >
              {t === "all" ? "All" : t === "loan" ? "Loans" : "Advances"}
            </button>
          ))}
          <span className="border-l-2 border-black/20 mx-1" />
          {(
            [
              "all",
              "pending",
              "active",
              "rejected",
              "cleared",
              "paused",
            ] as const
          ).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={cn(
                "px-3 py-1.5 text-xs font-bold border-2 capitalize",
                filterStatus === s
                  ? "bg-black text-white border-black"
                  : "bg-white border-black text-black",
              )}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              exportRowsToExcel(
                LOAN_IMPORT_HEADERS.map((h) => ({ key: h.key, label: h.label })),
                displayedLoans.map((l) => ({
                  employeeId: l.employee?.employeeId || "",
                  type: l.type,
                  amount: l.amount,
                  remainingBalance: l.remainingBalance,
                  monthlyEmi: l.monthlyEmi,
                  tenureMonths: l.tenureMonths,
                  reason: l.reason,
                  disbursedOn: l.disbursedOn?.slice(0, 10),
                  status: l.status,
                  remarks: l.remarks,
                })),
                "loans_export.xlsx",
                "Loans",
              )
            }
            className="border-2 border-black bg-white text-black px-4 py-2 text-sm flex items-center gap-1.5 font-bold hover:bg-gray-50"
          >
            <Download className="w-4 h-4" /> Export
          </button>
          <button
            onClick={() => setImportModal(true)}
            className="border-2 border-black bg-white text-black px-4 py-2 text-sm flex items-center gap-1.5 font-bold hover:bg-gray-50"
          >
            <FileSpreadsheet className="w-4 h-4" /> Import Excel
          </button>
          <button
            onClick={openAdd}
            className="border-2 bg-[#024BAB] text-white px-4 py-2 text-sm flex items-center gap-1.5 font-bold"
          >
            <Plus className="w-4 h-4" /> Add Loan / Advance
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          {
            label: "Total Disbursed",
            value: fmt(totalDisbursed),
            icon: Banknote,
            color: "text-[#024BAB]",
          },
          {
            label: "Outstanding",
            value: fmt(totalOutstanding),
            icon: TrendingDown,
            color: "text-red-600",
          },
          {
            label: "Active",
            value: String(activeCount),
            icon: IndianRupee,
            color: "text-green-600",
          },
          {
            label: "Pending",
            value: String(pendingCount),
            icon: Clock,
            color: "text-orange-600",
          },
          {
            label: "Cleared",
            value: String(clearedCount),
            icon: CheckCircle2,
            color: "text-gray-600",
          },
        ].map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="border-2 border-black bg-white p-4 flex flex-col gap-1"
          >
            <div className="flex items-center gap-2">
              <Icon className={cn("w-4 h-4", color)} />
              <p className="text-xs font-bold text-gray-500 uppercase">
                {label}
              </p>
            </div>
            <p className={cn("text-xl font-bold", color)}>{value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <img src={nesthrlogo} alt="NestSports" className="h-16 w-auto" />
        </div>
      ) : displayedLoans.length === 0 ? (
        <div className="border-2 bg-white p-12 flex flex-col items-center justify-center">
          <Banknote className="w-12 h-12 text-muted-foreground/30 mb-3" />
          <p className="font-bold text-black">No records found</p>
        </div>
      ) : (
        <div className="border-2 bg-white overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-black bg-[#024BAB]/5">
                {[
                  "Employee",
                  "Type",
                  "Amount",
                  "Remaining",
                  "EMI/Month",
                  "Disbursed On",
                  "Reason",
                  "Status",
                  "",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-bold text-black uppercase tracking-wider whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayedLoans.map((loan, i) => (
                <tr
                  key={loan._id}
                  className={cn(
                    "border-b border-black/10 hover:bg-[#024BAB]/5",
                    i % 2 === 0 ? "" : "bg-[#F8FAFF]",
                  )}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {loan.employee.avatar ? (
                        <img
                          src={loan.employee.avatar}
                          alt={loan.employee.firstName}
                          className="w-7 h-7 border-2 border-black object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-7 h-7 bg-[#024BAB] border-2 border-black flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                          {loan.employee.firstName[0]}
                        </div>
                      )}
                      <div>
                        <p className="font-bold text-xs text-black">
                          {loan.employee.firstName} {loan.employee.lastName}
                        </p>
                        <p className="text-[10px] text-gray-500">
                          {loan.employee.employeeId}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "px-2 py-0.5 text-[10px] font-bold border-2",
                        loan.type === "loan"
                          ? "bg-blue-50 border-blue-500 text-blue-800"
                          : "bg-orange-50 border-orange-500 text-orange-800",
                      )}
                    >
                      {loan.type === "loan" ? "Loan" : "Advance"}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-bold text-xs">
                    {fmt(loan.amount)}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span
                      className={cn(
                        "font-bold",
                        loan.remainingBalance > 0
                          ? "text-red-600"
                          : "text-green-600",
                      )}
                    >
                      {fmt(loan.remainingBalance)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-700">
                    {loan.monthlyEmi > 0 ? fmt(loan.monthlyEmi) : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-700">
                    {loan.disbursedOn
                      ? new Date(loan.disbursedOn).toLocaleDateString("en-IN")
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-700 max-w-[140px] truncate">
                    {loan.reason || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "px-2 py-0.5 text-[10px] font-bold border-2 capitalize",
                        STATUS_COLORS[loan.status],
                      )}
                    >
                      {loan.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {loan.status === "pending" && (
                        <>
                          <button
                            onClick={() => handleApprove(loan._id)}
                            className="p-1.5 border-2 border-green-600 text-green-600 hover:bg-green-600 hover:text-white transition-colors"
                            title="Approve"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleReject(loan._id)}
                            className="p-1.5 border-2 border-red-500 text-red-500 hover:bg-red-500 hover:text-white transition-colors"
                            title="Reject"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => openEdit(loan)}
                        className="p-1.5 border-2 border-black hover:bg-[#024BAB] hover:text-white transition-colors"
                        title="Edit"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(loan._id)}
                        className="p-1.5 border-2 border-red-500 text-red-500 hover:bg-red-500 hover:text-white transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="border-2 bg-white w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b-2 border-black sticky top-0 bg-white z-10">
              <h3 className="font-display font-bold text-lg">
                {editId ? "Edit Loan / Advance" : "Add Loan / Advance"}
              </h3>
              <button onClick={() => setModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1">Employee</label>
                <select
                  value={form.employee}
                  onChange={(e) =>
                    setForm({ ...form, employee: e.target.value })
                  }
                  className="border-2 w-full px-3 py-2 text-sm disabled:opacity-60 disabled:bg-gray-50"
                  required
                  disabled={!!editId}
                >
                  <option value="">Select employee</option>
                  {employees.map((e) => (
                    <option key={e._id} value={e._id}>
                      {e.firstName} {e.lastName} ({e.employeeId})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1">Type</label>
                  <select
                    value={form.type}
                    onChange={(e) =>
                      setForm({ ...form, type: e.target.value as any })
                    }
                    className="border-2 w-full px-3 py-2 text-sm"
                  >
                    <option value="loan">Loan</option>
                    <option value="advance">Salary Advance</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm({ ...form, status: e.target.value as any })
                    }
                    className="border-2 w-full px-3 py-2 text-sm"
                  >
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="cleared">Cleared</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1">
                    Amount (₹)
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={form.amount}
                    onChange={(e) =>
                      setForm({ ...form, amount: e.target.value })
                    }
                    className="border-2 w-full px-3 py-2 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">
                    Monthly EMI (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0 = no EMI"
                    value={form.monthlyEmi}
                    onChange={(e) =>
                      setForm({ ...form, monthlyEmi: e.target.value })
                    }
                    className="border-2 w-full px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">
                  Disbursed On
                </label>
                <input
                  type="date"
                  value={form.disbursedOn}
                  onChange={(e) =>
                    setForm({ ...form, disbursedOn: e.target.value })
                  }
                  className="border-2 w-full px-3 py-2 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">Reason</label>
                <input
                  type="text"
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder="e.g. Medical emergency"
                  className="border-2 w-full px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">Remarks</label>
                <textarea
                  value={form.remarks}
                  onChange={(e) =>
                    setForm({ ...form, remarks: e.target.value })
                  }
                  rows={2}
                  className="border-2 w-full px-3 py-2 text-sm resize-none"
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={saving}
                  className="border-2 bg-[#024BAB] text-white px-6 py-2.5 text-sm font-bold flex-1 disabled:opacity-60"
                >
                  {saving ? "Saving..." : editId ? "Update" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => setModal(false)}
                  className="border-2 bg-white text-black px-4 py-2.5 text-sm font-bold"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="border-2 bg-white w-full max-w-sm p-6 space-y-4">
            <p className="font-bold text-base">Delete this record?</p>
            <p className="text-sm text-gray-600">
              This will remove the loan/advance and recalculate the employee
              balance.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 border-2 bg-red-600 text-white py-2.5 text-sm font-bold"
              >
                Delete
              </button>
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 border-2 bg-white text-black py-2.5 text-sm font-bold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      <ImportExportModal
        open={importModal}
        onClose={() => setImportModal(false)}
        entityLabel="Loan"
        headers={LOAN_IMPORT_HEADERS}
        templateFilename="loans_import_template.xlsx"
        notes={
          <>
            <p>
              • <strong>Employee ID</strong> must exactly match an employee's
              ID (e.g. <code>EMP0001</code>).
            </p>
            <p>
              • <strong>Type</strong> must be <code>loan</code> or{" "}
              <code>advance</code>. Imported records are created as{" "}
              <strong>active</strong> immediately, bypassing the
              pending-approval flow — for backfilling historical records.
            </p>
            <p>
              • Maximum <strong>200 loans</strong> per import.
            </p>
          </>
        }
        previewColumns={[
          { key: "employeeId", label: "Employee ID" },
          { key: "type", label: "Type" },
          { key: "amount", label: "Amount" },
          { key: "monthlyEmi", label: "Monthly EMI" },
        ]}
        onImport={(rows) => loanAPI.bulkImport(rows) as any}
        onImported={load}
      />
    </AppLayout>
  );
}
