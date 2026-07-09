import { useState, useEffect } from "react";
import nesthrlogo from "../../assets/nesthr.png";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  shiftAPI,
  salaryHeadAPI,
  designationAPI,
  offerLetterAPI,
  departmentAPI,
} from "@/services/api";
import { cn } from "@/lib/utils";
import {
  Clock,
  IndianRupee,
  Briefcase,
  FileText,
  ShieldCheck,
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  X,
  Loader2,
  CheckCircle,
  Search,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

function NbSelect({
  value,
  onChange,
  children,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "w-full border-2 border-black px-3 py-2 text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-[#024BAB]",
        className,
      )}
    >
      {children}
    </select>
  );
}

function NbInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder = "",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-bold text-black uppercase tracking-wider">
        {label}
      </label>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border-2 border-black px-3 py-2 text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-[#024BAB]"
      />
    </div>
  );
}

function SubHeader({
  title,
  icon,
  onBack,
  onAdd,
  addLabel = "Add",
}: {
  title: string;
  icon: React.ElementType;
  onBack: () => void;
  onAdd?: () => void;
  addLabel?: string;
}) {
  const Icon = icon;
  return (
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-2 border-2 border-black px-3 py-2 text-sm font-bold bg-white hover:bg-gray-50"
        >
          <ArrowLeft className="w-4 h-4" /> Manage
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#024BAB] border-2 border-black flex items-center justify-center">
            <Icon className="w-4 h-4 text-white" />
          </div>
          <h2 className="text-xl font-bold text-black">{title}</h2>
        </div>
      </div>
      {onAdd && (
        <button
          onClick={onAdd}
          className="flex items-center gap-2 border-2 border-black px-4 py-2 text-sm font-bold bg-[#024BAB] text-white"
        >
          <Plus className="w-4 h-4" /> {addLabel}
        </button>
      )}
    </div>
  );
}

function NbTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: React.ReactNode[][];
}) {
  return (
    <div className="border-2 bg-white overflow-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-black bg-[#024BAB]/5">
            {headers.map((h) => (
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
          {rows.map((row, i) => (
            <tr
              key={i}
              className={cn(
                "border-b border-black/10",
                i % 2 !== 0 && "bg-[#F8FAFF]",
              )}
            >
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-3 text-sm text-black">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ShiftsSection({ onBack }: { onBack: () => void }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [shiftSearch, setShiftSearch] = useState("");
  const [shiftFilterStatus, setShiftFilterStatus] = useState("");
  const [shiftSortKey, setShiftSortKey] = useState<"name" | "workingHours">(
    "name",
  );
  const [shiftSortDir, setShiftSortDir] = useState<"asc" | "desc">("asc");
  const [form, setForm] = useState({
    name: "",
    startTime: "09:00",
    endTime: "18:00",
    breakMinutes: "30",
    workingHours: "8",
    otAfterHours: "9",
    color: "#024BAB",
    status: "active",
  });

  const load = () => {
    setLoading(true);
    shiftAPI
      .getAll()
      .then((r: any) => {
        if (r.success) setData(r.data);
      })
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
  }, []);

  const openAdd = () => {
    setEditing(null);
    setForm({
      name: "",
      startTime: "09:00",
      endTime: "18:00",
      breakMinutes: "30",
      workingHours: "8",
      otAfterHours: "9",
      color: "#024BAB",
      status: "active",
    });
    setModal(true);
  };
  const openEdit = (s: any) => {
    setEditing(s);
    setForm({
      name: s.name,
      startTime: s.startTime,
      endTime: s.endTime,
      breakMinutes: String(s.breakMinutes),
      workingHours: String(s.workingHours),
      otAfterHours: String(s.otAfterHours),
      color: s.color,
      status: s.status,
    });
    setModal(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        breakMinutes: +form.breakMinutes,
        workingHours: +form.workingHours,
        otAfterHours: +form.otAfterHours,
      };
      if (editing) await shiftAPI.update(editing._id, payload);
      else await shiftAPI.create(payload);
      setModal(false);
      load();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const displayedShifts = [...data]
    .filter((s) => {
      if (
        shiftSearch &&
        !s.name.toLowerCase().includes(shiftSearch.toLowerCase())
      )
        return false;
      if (shiftFilterStatus && s.status !== shiftFilterStatus) return false;
      return true;
    })
    .sort((a, b) => {
      let cmp = 0;
      if (shiftSortKey === "name") cmp = a.name.localeCompare(b.name);
      else if (shiftSortKey === "workingHours")
        cmp = (a.workingHours ?? 0) - (b.workingHours ?? 0);
      return shiftSortDir === "asc" ? cmp : -cmp;
    });

  return (
    <div>
      <SubHeader
        title="Shift Timings"
        icon={Clock}
        onBack={onBack}
        onAdd={openAdd}
        addLabel="Add Shift"
      />
      {/* Search, Filter & Sort */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex items-center gap-2 border-2 border-black bg-white px-3 py-2 flex-1 min-w-48">
          <Search className="w-4 h-4 shrink-0 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search shifts..."
            value={shiftSearch}
            onChange={(e) => setShiftSearch(e.target.value)}
            className="bg-transparent text-sm outline-none w-full font-medium"
          />
          {shiftSearch && (
            <button onClick={() => setShiftSearch("")}>
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          )}
        </div>
        <select
          value={shiftFilterStatus}
          onChange={(e) => setShiftFilterStatus(e.target.value)}
          className="border-2 border-black bg-white px-3 py-2 text-sm font-semibold outline-none"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <select
          value={shiftSortKey}
          onChange={(e) => setShiftSortKey(e.target.value as any)}
          className="border-2 border-black bg-white px-3 py-2 text-sm font-semibold outline-none"
        >
          <option value="name">Sort: Name</option>
          <option value="workingHours">Sort: Working Hrs</option>
        </select>
        <button
          onClick={() => setShiftSortDir((d) => (d === "asc" ? "desc" : "asc"))}
          className="border-2 border-black bg-white px-3 py-2 flex items-center gap-1 font-semibold text-sm"
        >
          {shiftSortDir === "asc" ? (
            <ArrowUp className="w-4 h-4" />
          ) : (
            <ArrowDown className="w-4 h-4" />
          )}
          {shiftSortDir === "asc" ? "Asc" : "Desc"}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <img src={nesthrlogo} alt="NestSports" className="h-16 w-auto" />
        </div>
      ) : (
        <NbTable
          headers={[
            "#",
            "Shift Name",
            "Start",
            "End",
            "Break (min)",
            "Working Hrs",
            "OT After",
            "Status",
            "Action",
          ]}
          rows={displayedShifts.map((s, i) => [
            i + 1,
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 border border-black rounded-full"
                style={{ background: s.color }}
              />
              <span className="font-bold">{s.name}</span>
            </div>,
            s.startTime,
            s.endTime,
            s.breakMinutes,
            `${s.workingHours}h`,
            `${s.otAfterHours}h`,
            <span
              className={cn(
                "px-2 py-0.5 text-xs font-bold border-2",
                s.status === "active"
                  ? "bg-[#00C48C]/10 text-[#00C48C] border-[#00C48C]"
                  : "bg-gray-100 text-gray-500 border-gray-300",
              )}
            >
              {s.status}
            </span>,
            <div className="flex gap-1">
              <button
                onClick={() => openEdit(s)}
                className="p-1.5 border-2 border-transparent hover:border-black hover:bg-blue-50"
              >
                <Edit className="w-3.5 h-3.5 text-[#024BAB]" />
              </button>
              <button
                onClick={async () => {
                  if (!confirm("Delete shift?")) return;
                  await shiftAPI.delete(s._id);
                  load();
                }}
                className="p-1.5 border-2 border-transparent hover:border-black hover:bg-red-50"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-500" />
              </button>
            </div>,
          ])}
        />
      )}
      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="border-2 bg-white w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b-2 border-black">
              <h3 className="font-bold text-lg">
                {editing ? "Edit Shift" : "Add Shift"}
              </h3>
              <button onClick={() => setModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={save} className="p-5 space-y-3">
              <NbInput
                label="Shift Name"
                value={form.name}
                onChange={(v) => setForm({ ...form, name: v })}
                required
                placeholder="e.g. Morning Shift"
              />
              <div className="grid grid-cols-2 gap-3">
                <NbInput
                  label="Start Time"
                  type="time"
                  value={form.startTime}
                  onChange={(v) => setForm({ ...form, startTime: v })}
                />
                <NbInput
                  label="End Time"
                  type="time"
                  value={form.endTime}
                  onChange={(v) => setForm({ ...form, endTime: v })}
                />
                <NbInput
                  label="Break (minutes)"
                  type="number"
                  value={form.breakMinutes}
                  onChange={(v) => setForm({ ...form, breakMinutes: v })}
                />
                <NbInput
                  label="Working Hours"
                  type="number"
                  value={form.workingHours}
                  onChange={(v) => setForm({ ...form, workingHours: v })}
                />
                <NbInput
                  label="OT After (hours)"
                  type="number"
                  value={form.otAfterHours}
                  onChange={(v) => setForm({ ...form, otAfterHours: v })}
                />
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-black uppercase tracking-wider">
                    Color
                  </label>
                  <input
                    type="color"
                    value={form.color}
                    onChange={(e) =>
                      setForm({ ...form, color: e.target.value })
                    }
                    className="w-full h-10 border-2 border-black cursor-pointer"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-[#024BAB] text-white border-2 border-black py-2.5 text-sm font-bold"
                >
                  {editing ? "Save" : "Create Shift"}
                </button>
                <button
                  type="button"
                  onClick={() => setModal(false)}
                  className="flex-1 border-2 border-black py-2.5 text-sm font-bold bg-white"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function SalaryHeadsSection({ onBack }: { onBack: () => void }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    name: "",
    type: "Earning",
    calcMethod: "fixed",
    value: "",
    taxable: false,
    status: "active",
  });

  const load = () => {
    setLoading(true);
    salaryHeadAPI
      .getAll()
      .then((r: any) => {
        if (r.success) setData(r.data);
      })
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
  }, []);

  const openAdd = () => {
    setEditing(null);
    setForm({
      name: "",
      type: "Earning",
      calcMethod: "fixed",
      value: "",
      taxable: false,
      status: "active",
    });
    setModal(true);
  };
  const openEdit = (h: any) => {
    setEditing(h);
    setForm({
      name: h.name,
      type: h.type,
      calcMethod: h.calcMethod,
      value: String(h.value),
      taxable: h.taxable,
      status: h.status,
    });
    setModal(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { ...form, value: +form.value };
      if (editing) await salaryHeadAPI.update(editing._id, payload);
      else await salaryHeadAPI.create(payload);
      setModal(false);
      load();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const TYPE_COLORS: Record<string, string> = {
    Earning: "bg-[#00C48C]/10 text-[#00C48C] border-[#00C48C]",
    Deduction: "bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]",
    Variable: "bg-[#FA731C]/10 text-[#FA731C] border-[#FA731C]",
  };
  const CALC_LABELS: Record<string, string> = {
    fixed: "Fixed Amount",
    percent_of_basic: "% of Basic",
    percent_of_gross: "% of Gross",
    formula: "Formula",
    as_per_loan: "As per Loan",
  };

  return (
    <div>
      <SubHeader
        title="Salary Head / Components"
        icon={IndianRupee}
        onBack={onBack}
        onAdd={openAdd}
        addLabel="Add Component"
      />
      {loading ? (
        <div className="flex justify-center py-12">
          <img src={nesthrlogo} alt="NestSports" className="h-16 w-auto" />
        </div>
      ) : (
        <NbTable
          headers={[
            "#",
            "Component",
            "Type",
            "Calculation",
            "Value",
            "Taxable",
            "Status",
            "Action",
          ]}
          rows={data.map((h, i) => [
            i + 1,
            <span className="font-bold">{h.name}</span>,
            <span
              className={cn(
                "px-2 py-0.5 text-xs font-bold border-2",
                TYPE_COLORS[h.type] ||
                  "bg-gray-100 text-gray-500 border-gray-300",
              )}
            >
              {h.type}
            </span>,
            CALC_LABELS[h.calcMethod] || h.calcMethod,
            h.calcMethod === "fixed" ? `₹${h.value}` : `${h.value}%`,
            h.taxable ? (
              <CheckCircle className="w-4 h-4 text-[#00C48C]" />
            ) : (
              <span className="text-muted-foreground text-xs">No</span>
            ),
            <span
              className={cn(
                "px-2 py-0.5 text-xs font-bold border-2",
                h.status === "active"
                  ? "bg-[#024BAB]/10 text-[#024BAB] border-[#024BAB]"
                  : "bg-gray-100 text-gray-500 border-gray-300",
              )}
            >
              {h.status}
            </span>,
            <div className="flex gap-1">
              <button
                onClick={() => openEdit(h)}
                className="p-1.5 border-2 border-transparent hover:border-black hover:bg-blue-50"
              >
                <Edit className="w-3.5 h-3.5 text-[#024BAB]" />
              </button>
              <button
                onClick={async () => {
                  if (!confirm("Delete component?")) return;
                  await salaryHeadAPI.delete(h._id);
                  load();
                }}
                className="p-1.5 border-2 border-transparent hover:border-black hover:bg-red-50"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-500" />
              </button>
            </div>,
          ])}
        />
      )}
      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="border-2 bg-white w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b-2 border-black">
              <h3 className="font-bold text-lg">
                {editing ? "Edit Component" : "Add Component"}
              </h3>
              <button onClick={() => setModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={save} className="p-5 space-y-3">
              <NbInput
                label="Component Name"
                value={form.name}
                onChange={(v) => setForm({ ...form, name: v })}
                required
                placeholder="e.g. HRA, Medical Allowance"
              />
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-black uppercase tracking-wider">
                    Type
                  </label>
                  <NbSelect
                    value={form.type}
                    onChange={(v) => setForm({ ...form, type: v })}
                  >
                    <option value="Earning">Earning</option>
                    <option value="Deduction">Deduction</option>
                    <option value="Variable">Variable</option>
                  </NbSelect>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-black uppercase tracking-wider">
                    Calculation
                  </label>
                  <NbSelect
                    value={form.calcMethod}
                    onChange={(v) => setForm({ ...form, calcMethod: v })}
                  >
                    <option value="fixed">Fixed Amount</option>
                    <option value="percent_of_basic">% of Basic</option>
                    <option value="percent_of_gross">% of Gross</option>
                    <option value="formula">Formula</option>
                    <option value="as_per_loan">As per Loan</option>
                  </NbSelect>
                </div>
              </div>
              <NbInput
                label={
                  form.calcMethod === "fixed" ? "Amount (₹)" : "Percentage (%)"
                }
                type="number"
                value={form.value}
                onChange={(v) => setForm({ ...form, value: v })}
                placeholder="e.g. 1600 or 12"
              />
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="taxable"
                  checked={form.taxable}
                  onChange={(e) =>
                    setForm({ ...form, taxable: e.target.checked })
                  }
                  className="w-4 h-4 border-2 border-black"
                />
                <label
                  htmlFor="taxable"
                  className="text-sm font-bold text-black"
                >
                  Taxable component
                </label>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-[#024BAB] text-white border-2 border-black py-2.5 text-sm font-bold"
                >
                  {editing ? "Save" : "Add Component"}
                </button>
                <button
                  type="button"
                  onClick={() => setModal(false)}
                  className="flex-1 border-2 border-black py-2.5 text-sm font-bold bg-white"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function DesignationsSection({ onBack }: { onBack: () => void }) {
  const [data, setData] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    name: "",
    department: "",
    grade: "L1",
    minSalary: "",
    maxSalary: "",
    status: "active",
  });

  const load = () => {
    setLoading(true);
    Promise.all([designationAPI.getAll(), departmentAPI.getAll()])
      .then(([d, dept]: [any, any]) => {
        if (d.success) setData(d.data);
        if (dept.success) setDepartments(dept.data);
      })
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
  }, []);

  const openAdd = () => {
    setEditing(null);
    setForm({
      name: "",
      department: departments[0]?._id || "",
      grade: "L1",
      minSalary: "",
      maxSalary: "",
      status: "active",
    });
    setModal(true);
  };
  const openEdit = (d: any) => {
    setEditing(d);
    setForm({
      name: d.name,
      department: d.department?._id || "",
      grade: d.grade,
      minSalary: String(d.minSalary || ""),
      maxSalary: String(d.maxSalary || ""),
      status: d.status,
    });
    setModal(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        minSalary: +form.minSalary || 0,
        maxSalary: +form.maxSalary || 0,
      };
      if (editing) await designationAPI.update(editing._id, payload);
      else await designationAPI.create(payload);
      setModal(false);
      load();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const GRADE_COLORS: Record<string, string> = {
    L1: "bg-gray-100 text-gray-500 border-gray-300",
    L2: "bg-[#024BAB]/10 text-[#024BAB] border-[#024BAB]",
    L3: "bg-[#00C48C]/10 text-[#00C48C] border-[#00C48C]",
    L4: "bg-[#FA731C]/10 text-[#FA731C] border-[#FA731C]",
  };

  return (
    <div>
      <SubHeader
        title="Designations"
        icon={Briefcase}
        onBack={onBack}
        onAdd={openAdd}
        addLabel="Add Designation"
      />
      {loading ? (
        <div className="flex justify-center py-12">
          <img src={nesthrlogo} alt="NestSports" className="h-16 w-auto" />
        </div>
      ) : (
        <NbTable
          headers={[
            "#",
            "Designation",
            "Department",
            "Grade",
            "Min Salary",
            "Max Salary",
            "Employees",
            "Action",
          ]}
          rows={data.map((d, i) => [
            i + 1,
            <span className="font-bold">{d.name}</span>,
            d.department?.name || "—",
            <span
              className={cn(
                "px-2 py-0.5 text-xs font-bold border-2",
                GRADE_COLORS[d.grade] ||
                  "bg-gray-100 text-gray-500 border-gray-300",
              )}
            >
              {d.grade}
            </span>,
            d.minSalary ? `₹${d.minSalary.toLocaleString()}` : "—",
            d.maxSalary ? `₹${d.maxSalary.toLocaleString()}` : "—",
            d.employeeCount || 0,
            <div className="flex gap-1">
              <button
                onClick={() => openEdit(d)}
                className="p-1.5 border-2 border-transparent hover:border-black hover:bg-blue-50"
              >
                <Edit className="w-3.5 h-3.5 text-[#024BAB]" />
              </button>
              <button
                onClick={async () => {
                  if (!confirm("Delete designation?")) return;
                  await designationAPI.delete(d._id);
                  load();
                }}
                className="p-1.5 border-2 border-transparent hover:border-black hover:bg-red-50"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-500" />
              </button>
            </div>,
          ])}
        />
      )}
      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="border-2 bg-white w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b-2 border-black">
              <h3 className="font-bold text-lg">
                {editing ? "Edit Designation" : "Add Designation"}
              </h3>
              <button onClick={() => setModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={save} className="p-5 space-y-3">
              <NbInput
                label="Designation Name"
                value={form.name}
                onChange={(v) => setForm({ ...form, name: v })}
                required
                placeholder="e.g. Senior Developer"
              />
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-black uppercase tracking-wider">
                    Department
                  </label>
                  <NbSelect
                    value={form.department}
                    onChange={(v) => setForm({ ...form, department: v })}
                  >
                    <option value="">Select Dept</option>
                    {departments.map((d: any) => (
                      <option key={d._id} value={d._id}>
                        {d.name}
                      </option>
                    ))}
                  </NbSelect>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-black uppercase tracking-wider">
                    Grade
                  </label>
                  <NbSelect
                    value={form.grade}
                    onChange={(v) => setForm({ ...form, grade: v })}
                  >
                    {["L1", "L2", "L3", "L4", "L5"].map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </NbSelect>
                </div>
                <NbInput
                  label="Min Salary (₹)"
                  type="number"
                  value={form.minSalary}
                  onChange={(v) => setForm({ ...form, minSalary: v })}
                  placeholder="12000"
                />
                <NbInput
                  label="Max Salary (₹)"
                  type="number"
                  value={form.maxSalary}
                  onChange={(v) => setForm({ ...form, maxSalary: v })}
                  placeholder="30000"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-[#024BAB] text-white border-2 border-black py-2.5 text-sm font-bold"
                >
                  {editing ? "Save" : "Create"}
                </button>
                <button
                  type="button"
                  onClick={() => setModal(false)}
                  className="flex-1 border-2 border-black py-2.5 text-sm font-bold bg-white"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function OfferLettersSection({ onBack }: { onBack: () => void }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: "", forRole: "All", body: "" });
  const [preview, setPreview] = useState<any>(null);

  const load = () => {
    setLoading(true);
    offerLetterAPI
      .getAll()
      .then((r: any) => {
        if (r.success) setData(r.data);
      })
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
  }, []);

  const openAdd = () => {
    setEditing(null);
    setForm({ name: "", forRole: "All", body: "" });
    setModal(true);
  };
  const openEdit = (l: any) => {
    setEditing(l);
    setForm({ name: l.name, forRole: l.forRole, body: l.body });
    setModal(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) await offerLetterAPI.update(editing._id, form);
      else await offerLetterAPI.create(form);
      setModal(false);
      load();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div>
      <SubHeader
        title="Offer Letter Templates"
        icon={FileText}
        onBack={onBack}
        onAdd={openAdd}
        addLabel="Add Template"
      />
      {loading ? (
        <div className="flex justify-center py-12">
          <img src={nesthrlogo} alt="NestSports" className="h-16 w-auto" />
        </div>
      ) : (
        <NbTable
          headers={["#", "Template Name", "For Role", "Uses", "Action"]}
          rows={data.map((l, i) => [
            i + 1,
            <span className="font-bold">{l.name}</span>,
            l.forRole || "All",
            l.uses || 0,
            <div className="flex gap-1">
              <button
                onClick={() => setPreview(l)}
                className="p-1.5 border-2 border-transparent hover:border-black hover:bg-gray-50"
              >
                <FileText className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
              <button
                onClick={() => openEdit(l)}
                className="p-1.5 border-2 border-transparent hover:border-black hover:bg-blue-50"
              >
                <Edit className="w-3.5 h-3.5 text-[#024BAB]" />
              </button>
              <button
                onClick={async () => {
                  if (!confirm("Delete template?")) return;
                  await offerLetterAPI.delete(l._id);
                  load();
                }}
                className="p-1.5 border-2 border-transparent hover:border-black hover:bg-red-50"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-500" />
              </button>
            </div>,
          ])}
        />
      )}
      {}
      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="border-2 bg-white w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b-2 border-black">
              <h3 className="font-bold text-lg">
                {editing ? "Edit Template" : "Add Template"}
              </h3>
              <button onClick={() => setModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={save}
              className="p-5 space-y-3 flex-1 overflow-y-auto"
            >
              <div className="grid grid-cols-2 gap-3">
                <NbInput
                  label="Template Name"
                  value={form.name}
                  onChange={(v) => setForm({ ...form, name: v })}
                  required
                />
                <NbInput
                  label="For Role"
                  value={form.forRole}
                  onChange={(v) => setForm({ ...form, forRole: v })}
                  placeholder="All, Manager, etc."
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-black uppercase tracking-wider">
                  Template Body
                </label>
                <p className="text-[10px] text-muted-foreground">
                  Use &#123;&#123;name&#125;&#125;,
                  &#123;&#123;designation&#125;&#125;,
                  &#123;&#123;joiningDate&#125;&#125;,
                  &#123;&#123;ctc&#125;&#125;, &#123;&#123;company&#125;&#125;
                  as placeholders.
                </p>
                <textarea
                  rows={12}
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  className="w-full border-2 border-black px-3 py-2 text-sm font-mono bg-white focus:outline-none focus:ring-2 focus:ring-[#024BAB] resize-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-[#024BAB] text-white border-2 border-black py-2.5 text-sm font-bold"
                >
                  {editing ? "Save" : "Create Template"}
                </button>
                <button
                  type="button"
                  onClick={() => setModal(false)}
                  className="flex-1 border-2 border-black py-2.5 text-sm font-bold bg-white"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {}
      {preview && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="border-2 bg-white w-full max-w-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b-2 border-black">
              <h3 className="font-bold text-lg">{preview.name}</h3>
              <button onClick={() => setPreview(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 flex-1 overflow-y-auto">
              <pre className="text-sm font-mono whitespace-pre-wrap text-black">
                {preview.body}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RolesSection({ onBack }: { onBack: () => void }) {
  const ROLES = [
    {
      role: "Super Admin",
      users: "1",
      dashboard: "Full",
      employee: "Full",
      salary: "Full",
      reports: "Full",
      manage: "Full",
      settings: "Full",
    },
    {
      role: "HR Manager",
      users: "—",
      dashboard: "Full",
      employee: "Full",
      salary: "Full",
      reports: "Read",
      manage: "Partial",
      settings: "Partial",
    },
    {
      role: "HR Executive",
      users: "—",
      dashboard: "Read",
      employee: "Full",
      salary: "Read",
      reports: "Read",
      manage: "None",
      settings: "None",
    },
    {
      role: "Dept Head",
      users: "—",
      dashboard: "Read",
      employee: "Read",
      salary: "None",
      reports: "None",
      manage: "None",
      settings: "None",
    },
    {
      role: "Employee",
      users: "—",
      dashboard: "Self",
      employee: "Self",
      salary: "Self",
      reports: "None",
      manage: "None",
      settings: "None",
    },
  ];
  const LEVEL_COLOR: Record<string, string> = {
    Full: "bg-[#00C48C]/10 text-[#00C48C] border-[#00C48C]",
    Partial: "bg-[#FA731C]/10 text-[#FA731C] border-[#FA731C]",
    Read: "bg-[#024BAB]/10 text-[#024BAB] border-[#024BAB]",
    Self: "bg-[#A855F7]/10 text-[#A855F7] border-[#A855F7]",
    None: "bg-gray-100 text-gray-500 border-gray-300",
  };

  return (
    <div>
      <SubHeader
        title="User Roles & Permissions"
        icon={ShieldCheck}
        onBack={onBack}
      />
      <NbTable
        headers={[
          "Role",
          "Dashboard",
          "Employee",
          "Salary",
          "Reports",
          "Manage",
          "Settings",
        ]}
        rows={ROLES.map((r) => [
          <span className="font-bold text-black">
            {r.role}
            <br />
            <span className="text-[10px] text-muted-foreground font-normal">
              {r.users !== "—" ? `${r.users} user` : ""}
            </span>
          </span>,
          ...[
            r.dashboard,
            r.employee,
            r.salary,
            r.reports,
            r.manage,
            r.settings,
          ].map((v) => (
            <span
              className={cn(
                "px-2 py-0.5 text-[10px] font-bold border-2",
                LEVEL_COLOR[v] || "bg-gray-100 text-gray-500 border-gray-300",
              )}
            >
              {v}
            </span>
          )),
        ])}
      />
    </div>
  );
}

const MANAGE_ITEMS = [
  {
    id: "shifts",
    label: "Shift Timings",
    sub: "Work schedule config",
    icon: Clock,
    bg: "bg-[#FA731C]",
  },
  {
    id: "salaryhead",
    label: "Salary Head",
    sub: "Pay components",
    icon: IndianRupee,
    bg: "bg-[#00C48C]",
  },
  {
    id: "designations",
    label: "Designations",
    sub: "Roles & grades",
    icon: Briefcase,
    bg: "bg-purple-500",
  },
  {
    id: "letters",
    label: "Offer Letters",
    sub: "Letter templates",
    icon: FileText,
    bg: "bg-[#024BAB]",
  },
  {
    id: "roles",
    label: "User Roles",
    sub: "Access control",
    icon: ShieldCheck,
    bg: "bg-[#FA731C]",
  },
];

export default function ManagePage() {
  const [sub, setSub] = useState<string | null>(null);

  if (sub === "shifts")
    return (
      <AppLayout title="Manage — Shifts">
        <ShiftsSection onBack={() => setSub(null)} />
      </AppLayout>
    );
  if (sub === "salaryhead")
    return (
      <AppLayout title="Manage — Salary Head">
        <SalaryHeadsSection onBack={() => setSub(null)} />
      </AppLayout>
    );
  if (sub === "designations")
    return (
      <AppLayout title="Manage — Designations">
        <DesignationsSection onBack={() => setSub(null)} />
      </AppLayout>
    );
  if (sub === "letters")
    return (
      <AppLayout title="Manage — Offer Letters">
        <OfferLettersSection onBack={() => setSub(null)} />
      </AppLayout>
    );
  if (sub === "roles")
    return (
      <AppLayout title="Manage — Roles">
        <RolesSection onBack={() => setSub(null)} />
      </AppLayout>
    );

  return (
    <AppLayout title="Manage">
      <div className="mb-6">
        <h1 className="text-3xl font-display font-bold text-black">Manage</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Click any module to view and manage records
        </p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {MANAGE_ITEMS.map(({ id, label, sub: subtitle, icon: Icon, bg }) => (
          <button
            key={id}
            onClick={() => setSub(id)}
            className="border-2 bg-white p-5 text-left flex flex-col gap-3 hover:border-[#024BAB] transition-colors"
          >
            <div
              className={cn(
                "w-12 h-12 border-2 border-black flex items-center justify-center",
                bg,
              )}
            >
              <Icon className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="font-bold text-black text-sm">{label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
            </div>
          </button>
        ))}
      </div>
    </AppLayout>
  );
}
