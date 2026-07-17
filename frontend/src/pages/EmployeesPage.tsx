import { useState, useEffect, useCallback, useRef } from "react";
import nesthrlogo from "../../assets/nesthr.png";
import * as XLSX from "xlsx";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { SportPicker } from "@/components/SportPicker";
import {
  employeeAPI,
  departmentAPI,
  loanAPI,
  transactionAPI,
  shiftAPI,
  payrollAPI,
} from "@/services/api";
import { Employee, Department } from "@/types/hrms";
import { cn, formatDate } from "@/lib/utils";
import {
  Plus,
  Search,
  X,
  Users,
  Edit,
  Trash2,
  Eye,
  Upload,
  CheckCircle,
  AlertCircle,
  Clock,
  Banknote,
  ArrowLeft,
  ArrowRight,
  Calendar,
  FileText,
  IndianRupee,
  TrendingUp,
  UserCheck,
  Printer,
  Building2,
  Phone,
  Mail,
  CreditCard,
  Shield,
  FileSpreadsheet,
  Download,
  Loader2,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { ActionModal } from "@/components/ui/ActionModal";

const STATUS_COLORS: Record<string, string> = {
  active:
    "border-2 bg-[#00C48C]/10 text-[#00C48C] border-[#00C48C] px-2 py-0.5",
  on_leave:
    "border-2 bg-[#FA731C]/10 text-[#FA731C] border-[#FA731C] px-2 py-0.5",
  inactive: "border-2 bg-gray-100 text-gray-500 border-gray-300 px-2 py-0.5",
  terminated:
    "border-2 bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444] px-2 py-0.5",
};

const TYPE_COLORS: Record<string, string> = {
  full_time:
    "border-2 bg-[#024BAB]/10 text-[#024BAB] border-[#024BAB] px-2 py-0.5",
  part_time:
    "border-2 bg-[#A855F7]/10 text-[#A855F7] border-[#A855F7] px-2 py-0.5",
  contract:
    "border-2 bg-[#FA731C]/10 text-[#FA731C] border-[#FA731C] px-2 py-0.5",
  intern:
    "border-2 bg-[#00C48C]/10 text-[#00C48C] border-[#00C48C] px-2 py-0.5",
};

const FORM_TABS = ["Basic Info", "Attendance", "Salary", "Other Info"];

interface EmployeeFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  designation: string;
  department: string;
  role: string;
  sport: string;
  employmentType: string;
  joinDate: string;
  salary: string;
  gender: string;
  status: string;
  password: string;
  avatar?: string;
  panNumber: string;
  aadharNumber: string;
  address: string;
  permanentAddress: string;
  city: string;
  state: string;
  pincode: string;
  dateOfBirth: string;
  emergencyContact: string;
  bankAccount: string;
  accountHolderName: string;
  ifscCode: string;
  bankName: string;
  uanNumber: string;
  esicNumber: string;
  pfNumber: string;
  workDaysPerWeek: string;
  workScheduleType: string;
  customWorkDays: number[];
  otRate: string;
  otEnabled: boolean;
  geofenceAttendanceEnabled: boolean;
  geofenceMode: "specific" | "any";
  geofenceLat: string;
  geofenceLng: string;
  geofenceRadiusMeters: string;
  shift: string;
  shiftName: string;
  isCustomShift: boolean;
  customShift: {
    startTime: string;
    endTime: string;
    breakMinutes: string;
    workingHours: string;
    otAfterHours: string;
  };
  // Personal details
  fatherName: string;
  motherName: string;
  spouseName: string;
  maritalStatus: string;
  bloodGroup: string;
  nationality: string;
  religion: string;
  personalEmail: string;
  alternatePhone: string;
  // Professional background
  qualification: string;
  totalExperience: string;
  previousCompany: string;
}

const EMPTY_FORM: EmployeeFormData = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  designation: "",
  department: "",
  role: "staff",
  sport: "",
  employmentType: "full_time",
  joinDate: "",
  salary: "",
  gender: "male",
  status: "active",
  password: "hrms@123",
  avatar: "",
  panNumber: "",
  aadharNumber: "",
  address: "",
  permanentAddress: "",
  city: "",
  state: "",
  pincode: "",
  dateOfBirth: "",
  emergencyContact: "",
  bankAccount: "",
  accountHolderName: "",
  ifscCode: "",
  bankName: "",
  uanNumber: "",
  esicNumber: "",
  pfNumber: "",
  workDaysPerWeek: "6",
  workScheduleType: "standard",
  customWorkDays: [],
  otRate: "",
  otEnabled: false,
  geofenceAttendanceEnabled: false,
  geofenceMode: "specific",
  geofenceLat: "",
  geofenceLng: "",
  geofenceRadiusMeters: "200",
  shift: "",
  shiftName: "",
  isCustomShift: false,
  customShift: {
    startTime: "",
    endTime: "",
    breakMinutes: "30",
    workingHours: "8",
    otAfterHours: "9",
  },
  fatherName: "",
  motherName: "",
  spouseName: "",
  maritalStatus: "",
  bloodGroup: "",
  nationality: "Indian",
  religion: "",
  personalEmail: "",
  alternatePhone: "",
  qualification: "",
  totalExperience: "",
  previousCompany: "",
};

export default function EmployeesPage() {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [payrollNetMap, setPayrollNetMap] = useState<Record<string, number>>(
    {},
  );
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [sortKey, setSortKey] = useState<
    "firstName" | "department" | "joinDate"
  >("firstName");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [formTab, setFormTab] = useState(0);
  const [editEmp, setEditEmp] = useState<Employee | null>(null);
  const [form, setForm] = useState<EmployeeFormData>(EMPTY_FORM);
  const [docFiles, setDocFiles] = useState<{
    aadhaarDoc?: File;
    panDoc?: File;
  }>({});
  const [faceEnrolling, setFaceEnrolling] = useState(false);
  const faceEnrollInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [viewEmp, setViewEmp] = useState<Employee | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [loanModal, setLoanModal] = useState(false);
  const [loanForm, setLoanForm] = useState({
    employee: "",
    type: "loan",
    amount: "",
    monthlyEmi: "",
    reason: "",
  });
  const [savingLoan, setSavingLoan] = useState(false);
  const [txModal, setTxModal] = useState<
    "allowance" | "penalty" | "overtime" | null
  >(null);
  const [txForm, setTxForm] = useState({
    employee: "",
    amount: "",
    hours: "",
    date: new Date().toISOString().split("T")[0],
    remark: "",
  });
  const [savingTx, setSavingTx] = useState(false);
  const [actionModal, setActionModal] = useState<{
    show: boolean;
    type: "success" | "error";
    title: string;
    message: string;
  }>({ show: false, type: "success", title: "", message: "" });

  const [importModal, setImportModal] = useState(false);
  const [importStep, setImportStep] = useState<"guide" | "preview" | "result">(
    "guide",
  );
  const [importRows, setImportRows] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    imported: number;
    failed: number;
    results: any[];
  } | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  const empParams = useCallback(
    (pageNum: number): Record<string, string> => {
      const params: Record<string, string> = { page: String(pageNum), limit: "20" };
      if (search) params.search = search;
      if (filterDept) params.department = filterDept;
      if (filterStatus) params.status = filterStatus;
      // "department" sort isn't backend-sortable (it's a ref, not a scalar) —
      // only firstName/joinDate get pushed to the server; department sort is
      // applied client-side over whatever page is currently loaded.
      if (sortKey !== "department") {
        params.sortBy = sortKey;
        params.sortDir = sortDir;
      }
      return params;
    },
    [search, filterDept, filterStatus, sortKey, sortDir],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      const [empRes, deptRes, shiftRes, payrollRes] = await Promise.all([
        employeeAPI.getAll(empParams(1)),
        departmentAPI.getAll(),
        shiftAPI.getAll(),
        payrollAPI.getAll({
          month: String(now.getMonth() + 1),
          year: String(now.getFullYear()),
          limit: "200",
        }),
      ]);
      if (empRes.success) {
        setEmployees(empRes.data);
        setPage(1);
        setPages(empRes.pages || 1);
        setTotal(empRes.total ?? empRes.data.length);
      }
      if (deptRes.success) setDepartments(deptRes.data);
      if ((shiftRes as any).success) setShifts((shiftRes as any).data);
      if ((payrollRes as any).success) {
        const map: Record<string, number> = {};
        for (const p of (payrollRes as any).data) {
          const empId =
            typeof p.employee === "object" ? p.employee._id : p.employee;
          if (empId && p.netSalary != null) map[empId] = p.netSalary;
        }
        setPayrollNetMap(map);
      }
    } catch {}
    setLoading(false);
  }, [empParams]);

  const loadMoreEmployees = async () => {
    if (loadingMore || page >= pages) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const res = await employeeAPI.getAll(empParams(next));
      if (res.success) {
        setEmployees((p) => [...p, ...res.data]);
        setPage(next);
        setPages(res.pages || 1);
      }
    } catch {
      // ignore, user can retry by clicking Load More again
    }
    setLoadingMore(false);
  };

  useEffect(() => {
    load();
  }, [load]);

  const openAdd = () => {
    setEditEmp(null);
    setForm(EMPTY_FORM);
    setDocFiles({});
    setAvatarPreview(null);
    setFormTab(0);
    setShowModal(true);
  };

  const openEdit = (emp: Employee) => {
    setEditEmp(emp);
    setAvatarPreview(emp.avatar || null);
    setForm({
      firstName: emp.firstName,
      lastName: emp.lastName,
      email: emp.email,
      phone: emp.phone || "",
      designation: emp.designation,
      department: (emp.department as any)?._id || "",
      role: (emp as any).role || "staff",
      sport: (emp as any).sport || "",
      employmentType: emp.employmentType,
      joinDate: emp.joinDate?.split("T")[0] || "",
      salary: String(emp.salary || ""),
      gender: emp.gender || "male",
      status: emp.status,
      password: "",
      avatar: emp.avatar || "",
      panNumber: (emp as any).panNumber || "",
      aadharNumber: (emp as any).aadharNumber || "",
      address: (emp as any).address || "",
      dateOfBirth: (emp as any).dateOfBirth?.split("T")[0] || "",
      emergencyContact: (emp as any).emergencyContact || "",
      bankAccount: (emp as any).bankAccount || "",
      accountHolderName: (emp as any).accountHolderName || "",
      ifscCode: (emp as any).ifscCode || "",
      bankName: (emp as any).bankName || "",
      uanNumber: (emp as any).uanNumber || "",
      esicNumber: (emp as any).esicNumber || "",
      pfNumber: (emp as any).pfNumber || "",
      workDaysPerWeek: String((emp as any).workDaysPerWeek || 6),
      workScheduleType: (emp as any).workScheduleType || "standard",
      customWorkDays: (emp as any).customWorkDays || [],
      otRate: String((emp as any).otRate || ""),
      otEnabled: (emp as any).otEnabled === true,
      geofenceAttendanceEnabled:
        (emp as any).geofenceAttendanceEnabled === true,
      geofenceMode: (emp as any).geofenceMode === "any" ? "any" : "specific",
      geofenceLat:
        (emp as any).geofenceLat != null
          ? String((emp as any).geofenceLat)
          : "",
      geofenceLng:
        (emp as any).geofenceLng != null
          ? String((emp as any).geofenceLng)
          : "",
      geofenceRadiusMeters: String((emp as any).geofenceRadiusMeters || 200),
      shift: (emp as any).shift?._id || (emp as any).shift || "",
      shiftName: (emp as any).shiftName || "",
      isCustomShift: (emp as any).isCustomShift === true,
      customShift: {
        startTime: (emp as any).customShift?.startTime || "",
        endTime: (emp as any).customShift?.endTime || "",
        breakMinutes: String((emp as any).customShift?.breakMinutes ?? 30),
        workingHours: String((emp as any).customShift?.workingHours ?? 8),
        otAfterHours: String((emp as any).customShift?.otAfterHours ?? 9),
      },
      permanentAddress: (emp as any).permanentAddress || "",
      city: (emp as any).city || "",
      state: (emp as any).state || "",
      pincode: (emp as any).pincode || "",
      fatherName: (emp as any).fatherName || "",
      motherName: (emp as any).motherName || "",
      spouseName: (emp as any).spouseName || "",
      maritalStatus: (emp as any).maritalStatus || "",
      bloodGroup: (emp as any).bloodGroup || "",
      nationality: (emp as any).nationality || "Indian",
      religion: (emp as any).religion || "",
      personalEmail: (emp as any).personalEmail || "",
      alternatePhone: (emp as any).alternatePhone || "",
      qualification: (emp as any).qualification || "",
      totalExperience: (emp as any).totalExperience || "",
      previousCompany: (emp as any).previousCompany || "",
    });
    setDocFiles({});
    setFormTab(0);
    setShowModal(true);
  };

  const handleEnrollFace = async (file: File) => {
    if (!editEmp) return;
    setFaceEnrolling(true);
    try {
      await employeeAPI.enrollFace(editEmp._id, file);
      setActionModal({
        show: true,
        type: "success",
        title: "Face Enrolled",
        message:
          "Face captured — this employee can now check in via the mobile app.",
      });
    } catch (err: any) {
      setActionModal({
        show: true,
        type: "error",
        title: "Enrollment Failed",
        message:
          err.message ||
          "Could not enroll face. Use a clear, single-face photo.",
      });
    } finally {
      setFaceEnrolling(false);
      if (faceEnrollInputRef.current) faceEnrollInputRef.current.value = "";
    }
  };

  const handleSave = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        salary: Number(form.salary) || 0,
        workDaysPerWeek:
          form.workScheduleType === "custom"
            ? form.customWorkDays.length
            : Number(form.workDaysPerWeek) || 6,
        workScheduleType: form.workScheduleType,
        customWorkDays:
          form.workScheduleType === "custom" ? form.customWorkDays : [],
        otRate: Number(form.otRate) || 0,
        geofenceLat:
          form.geofenceLat.trim() === "" ? undefined : Number(form.geofenceLat),
        geofenceLng:
          form.geofenceLng.trim() === "" ? undefined : Number(form.geofenceLng),
        geofenceRadiusMeters: Number(form.geofenceRadiusMeters) || 200,
        customShift: form.isCustomShift
          ? {
              startTime: form.customShift.startTime,
              endTime: form.customShift.endTime,
              breakMinutes: Number(form.customShift.breakMinutes) || 30,
              workingHours: Number(form.customShift.workingHours) || 8,
              otAfterHours: Number(form.customShift.otAfterHours) || 9,
            }
          : undefined,
      };
      let savedId = editEmp?._id;
      if (editEmp) {
        await employeeAPI.update(editEmp._id, payload);
      } else {
        const res = await employeeAPI.create(payload);
        savedId = res.data?._id;
      }

      // Upload documents if any were selected
      if (savedId && (docFiles.aadhaarDoc || docFiles.panDoc)) {
        await employeeAPI.uploadDocuments(savedId, docFiles).catch(() => {});
        setDocFiles({});
      }

      setActionModal({
        show: true,
        type: "success",
        title: editEmp ? "Employee Updated" : "Employee Created",
        message: editEmp
          ? "Employee information updated successfully."
          : "New employee added successfully.",
      });
      setTimeout(() => {
        setShowModal(false);
        load();
      }, 500);
    } catch (err: any) {
      setActionModal({
        show: true,
        type: "error",
        title: "Error",
        message: err.message || "Failed to save employee",
      });
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Terminate this employee?")) return;
    try {
      await employeeAPI.delete(id);
      setActionModal({
        show: true,
        type: "success",
        title: "Employee Terminated",
        message: "Employee has been terminated successfully.",
      });
      load();
    } catch (err: any) {
      setActionModal({
        show: true,
        type: "error",
        title: "Error",
        message: err.message || "Failed to delete employee",
      });
    }
  };

  const IMPORT_HEADERS = [
    { key: "firstName", label: "First Name", required: true, example: "Rahul" },
    { key: "lastName", label: "Last Name", required: true, example: "Sharma" },
    {
      key: "email",
      label: "Email",
      required: true,
      example: "rahul@sportsclub.com",
    },
    {
      key: "designation",
      label: "Designation",
      required: true,
      example: "Software Engineer",
    },
    {
      key: "joinDate",
      label: "Join Date",
      required: true,
      example: "2024-01-15",
    },
    { key: "phone", label: "Phone", required: false, example: "9876543210" },
    {
      key: "department",
      label: "Department",
      required: false,
      example: "Engineering",
    },
    {
      key: "employmentType",
      label: "Employment Type",
      required: false,
      example: "full_time",
    },
    { key: "gender", label: "Gender", required: false, example: "male" },
    { key: "salary", label: "Salary", required: false, example: "35000" },
    {
      key: "password",
      label: "Password",
      required: false,
      example: "hrms@123",
    },
    {
      key: "shiftName",
      label: "Shift Name",
      required: false,
      example: "Morning Shift",
    },
    {
      key: "dateOfBirth",
      label: "Date of Birth",
      required: false,
      example: "1995-06-20",
    },
    {
      key: "address",
      label: "Address",
      required: false,
      example: "123 Main St, Mumbai",
    },
    {
      key: "emergencyContact",
      label: "Emergency Contact",
      required: false,
      example: "9876500000",
    },
    {
      key: "bankAccount",
      label: "Bank Account",
      required: false,
      example: "1234567890",
    },
    {
      key: "accountHolderName",
      label: "Account Holder Name",
      required: false,
      example: "Rahul Sharma",
    },
    {
      key: "ifscCode",
      label: "IFSC Code",
      required: false,
      example: "HDFC0001234",
    },
    {
      key: "bankName",
      label: "Bank Name",
      required: false,
      example: "HDFC Bank",
    },
    {
      key: "panNumber",
      label: "PAN Number",
      required: false,
      example: "ABCDE1234F",
    },
    {
      key: "aadharNumber",
      label: "Aadhar Number",
      required: false,
      example: "1234 5678 9012",
    },
    {
      key: "uanNumber",
      label: "UAN Number",
      required: false,
      example: "100123456789",
    },
    {
      key: "esicNumber",
      label: "ESIC Number",
      required: false,
      example: "12345678901234",
    },
    {
      key: "pfNumber",
      label: "PF Number",
      required: false,
      example: "MH/12345/67890",
    },
  ];

  const downloadTemplate = () => {
    const headerRow = IMPORT_HEADERS.map((h) => h.label);
    const exampleRow = IMPORT_HEADERS.map((h) => h.example);
    const ws = XLSX.utils.aoa_to_sheet([headerRow, exampleRow]);
    ws["!cols"] = IMPORT_HEADERS.map(() => ({ wch: 22 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Employees");
    XLSX.writeFile(wb, "nesthr_employees_template.xlsx");
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const wb = XLSX.read(evt.target?.result, {
        type: "array",
        cellDates: true,
      });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw: any[][] = XLSX.utils.sheet_to_json(ws, {
        header: 1,
        defval: "",
      });
      if (raw.length < 2) {
        alert("Sheet is empty or has no data rows.");
        return;
      }

      const headerRow = (raw[0] as string[]).map((h) => String(h).trim());
      const labelToKey: Record<string, string> = {};
      IMPORT_HEADERS.forEach((h) => {
        labelToKey[h.label.toLowerCase()] = h.key;
      });

      const parsed = raw
        .slice(1)
        .filter((r) => r.some((c) => c !== ""))
        .map((row) => {
          const obj: Record<string, string> = {};
          headerRow.forEach((hdr, i) => {
            const key = labelToKey[hdr.toLowerCase()];
            if (key) {
              const val = row[i];
              if (val instanceof Date) {
                obj[key] = val.toISOString().split("T")[0];
              } else {
                obj[key] = String(val ?? "").trim();
              }
            }
          });
          return obj;
        });

      setImportRows(parsed);
      setImportStep("preview");
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const handleImport = async () => {
    setImporting(true);
    try {
      const res: any = await employeeAPI.bulkImport(importRows);
      setImportResult({
        imported: res.imported,
        failed: res.failed,
        results: res.results,
      });
      setImportStep("result");
      if (res.imported > 0) load();
    } catch (err: any) {
      alert(err.message || "Import failed");
    }
    setImporting(false);
  };

  const closeImportModal = () => {
    setImportModal(false);
    setImportStep("guide");
    setImportRows([]);
    setImportResult(null);
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Please upload a valid image file");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert("File size must be less than 10MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 300;
        const ratio = Math.min(MAX / img.width, MAX / img.height, 1);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas
          .getContext("2d")!
          .drawImage(img, 0, 0, canvas.width, canvas.height);
        const compressed = canvas.toDataURL("image/jpeg", 0.82);
        setAvatarPreview(compressed);
        setForm((f) => ({ ...f, avatar: compressed }));
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const displayedEmployees = [...employees].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "firstName")
      cmp = (a.firstName ?? "").localeCompare(b.firstName ?? "");
    else if (sortKey === "department")
      cmp = ((a.department as any)?.name ?? "").localeCompare(
        (b.department as any)?.name ?? "",
      );
    else if (sortKey === "joinDate")
      cmp =
        new Date(a.joinDate ?? 0).getTime() -
        new Date(b.joinDate ?? 0).getTime();
    return sortDir === "asc" ? cmp : -cmp;
  });

  const totalSalary = employees.reduce(
    (s, e) => s + ((e as any).salary ?? 0),
    0,
  );
  const totalLoan = employees.reduce(
    (s, e) => s + ((e as any).loanBalance ?? 0),
    0,
  );
  const totalEstBalance = employees.reduce((s, e) => {
    const id = (e as any)._id;
    const net = payrollNetMap[id];
    return (
      s +
      (net != null
        ? net
        : ((e as any).salary ?? 0) - ((e as any).loanBalance ?? 0))
    );
  }, 0);

  return (
    <AppLayout title="Employees">
      {}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="font-display font-bold text-2xl text-black">
          Employees
        </h1>
        <div className="grid-cols-2 grid gap-2">
          <button
            onClick={() => {
              setImportModal(true);
              setImportStep("guide");
            }}
            className="border-2 border-black bg-white text-black px-4 py-2 text-sm flex items-center gap-1.5 font-bold hover:bg-gray-50 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" /> Import Excel
          </button>
          <button
            onClick={openAdd}
            className="border-2 border-black bg-[#024BAB] text-white px-4 py-2 text-sm flex items-center gap-1.5 font-bold hover:bg-[#01368A] transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Employee
          </button>
        </div>
      </div>

      {}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-5">
        {" "}
        <div className="border-2 border-black bg-white p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#024BAB]/10 border-2 border-[#024BAB] flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 text-[#024BAB]" />
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Total Employees
            </p>
            <p className="text-2xl font-bold text-black">{employees.length}</p>
          </div>
        </div>
        <div className="border-2 border-black bg-white p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#00C48C]/10 border-2 border-[#00C48C] flex items-center justify-center shrink-0">
            <IndianRupee className="w-5 h-5 text-[#00C48C]" />
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Total Est. Balance
            </p>
            <p
              className={`text-2xl font-bold ${totalEstBalance < 0 ? "text-red-500" : "text-[#00C48C]"}`}
            >
              {formatCurrency(totalEstBalance)}
            </p>
          </div>
        </div>
        <div className="border-2 border-black bg-white p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#EF4444]/10 border-2 border-[#EF4444] flex items-center justify-center shrink-0">
            <Banknote className="w-5 h-5 text-[#EF4444]" />
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Total Loan Balance
            </p>
            <p className="text-2xl font-bold text-[#EF4444]">
              {formatCurrency(totalLoan)}
            </p>
          </div>
        </div>
      </div>

      {}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex items-center gap-2 border-2 border-black bg-white px-3 py-2 flex-1 min-w-48">
          <Search className="w-4 h-4 shrink-0" />
          <input
            type="text"
            placeholder="Search by name, ID, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-sm outline-none w-full font-medium"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            className="w-full border-2 border-black bg-white px-3 py-2 text-sm font-semibold outline-none"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d._id} value={d._id}>
                {d.name}
              </option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full border-2 border-black bg-white px-3 py-2 text-sm font-semibold outline-none"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="on_leave">On Leave</option>
            <option value="inactive">Inactive</option>
            <option value="terminated">Terminated</option>
          </select>
        </div>
        {(filterDept || filterStatus) && (
          <button
            onClick={() => {
              setFilterDept("");
              setFilterStatus("");
            }}
            className="flex items-center gap-1 text-xs font-bold border-2 border-black px-2 py-2 hover:bg-red-50 transition-colors"
          >
            <X className="w-3.5 h-3.5" /> Clear
          </button>
        )}
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as any)}
          className="border-2 border-black bg-white px-3 py-2 text-sm font-semibold outline-none"
        >
          <option value="firstName">Sort: Name</option>
          <option value="department">Sort: Department</option>
          <option value="joinDate">Sort: Join Date</option>
        </select>
        <button
          onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
          className="border-2 border-black bg-white px-3 py-2 text-sm font-semibold flex items-center gap-1"
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
        <div className="flex items-center justify-center h-64">
          <img src={nesthrlogo} alt="NestSports" className="h-16 w-auto" />
        </div>
      ) : employees.length === 0 ? (
        <div className="border-2 border-black bg-white p-12 flex flex-col items-center justify-center">
          <Users className="w-12 h-12 text-muted-foreground/30 mb-3" />
          <p className="font-bold text-black">No employees found</p>
          <p className="text-sm text-muted-foreground mt-1">
            Add your first employee to get started
          </p>
          <button
            onClick={openAdd}
            className="border-2 border-black bg-[#024BAB] text-white px-4 py-2 text-sm mt-4"
          >
            <Plus className="w-4 h-4 inline mr-1" /> Add Employee
          </button>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="grid grid-cols-1 gap-3 sm:hidden">
            {displayedEmployees.map((emp) => {
              const sal = (emp as any).salary ?? 0;
              const loan = (emp as any).loanBalance ?? 0;
              const processedNet = payrollNetMap[(emp as any)._id];
              const bal = processedNet != null ? processedNet : sal - loan;
              return (
                <div
                  key={emp._id}
                  className="border-2 border-black bg-white p-4 active:bg-[#024BAB]/5"
                  onClick={() => setViewEmp(emp)}
                >
                  {/* Header row */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-11 h-11 border-2 border-black shrink-0 overflow-hidden bg-[#024BAB] flex items-center justify-center text-sm font-bold text-white rounded-full">
                      {emp.avatar ? (
                        <img
                          src={emp.avatar}
                          alt={emp.firstName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        emp.firstName?.[0]?.toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-black truncate">
                        {emp.firstName} {emp.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {emp.employeeId}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "border-2 text-[10px] capitalize shrink-0",
                        STATUS_COLORS[emp.status],
                      )}
                    >
                      {emp.status.replace("_", " ")}
                    </span>
                  </div>

                  {/* Info grid */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mb-3">
                    <div>
                      <span className="text-muted-foreground">Dept: </span>
                      <span className="font-bold text-black">
                        {(emp.department as any)?.name || "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Joined: </span>
                      <span className="font-bold text-black">
                        {formatDate(emp.joinDate)}
                      </span>
                    </div>
                    <div className="col-span-2 truncate">
                      <span className="text-muted-foreground">Role: </span>
                      <span className="font-bold text-black">
                        {emp.designation}
                      </span>
                    </div>
                  </div>

                  {/* Balance chips */}
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="bg-[#F8FAFF] border border-black/10 px-3 py-2">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground">
                        Est. Balance
                      </p>
                      {sal ? (
                        <p
                          className={cn(
                            "text-sm font-bold",
                            bal < 0
                              ? "text-[#EF4444]"
                              : bal < sal * 0.3
                                ? "text-amber-600"
                                : "text-[#00C48C]",
                          )}
                        >
                          ₹
                          {bal.toLocaleString("en-IN", {
                            maximumFractionDigits: 0,
                          })}
                        </p>
                      ) : (
                        <p className="text-sm font-bold text-muted-foreground">
                          —
                        </p>
                      )}
                    </div>
                    <div className="bg-[#F8FAFF] border border-black/10 px-3 py-2">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground">
                        Loan Balance
                      </p>
                      {loan > 0 ? (
                        <p className="text-sm font-bold text-[#EF4444]">
                          ₹{loan.toLocaleString()}
                        </p>
                      ) : (
                        <p className="text-sm font-bold text-muted-foreground">
                          —
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div
                    className="flex items-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => setViewEmp(emp)}
                      className="flex-1 flex items-center justify-center gap-1.5 border-2 border-black py-2 text-xs font-bold bg-white hover:bg-[#024BAB]/5"
                    >
                      <Eye className="w-3.5 h-3.5" /> View
                    </button>
                    <button
                      onClick={() => openEdit(emp)}
                      className="flex-1 flex items-center justify-center gap-1.5 border-2 border-black py-2 text-xs font-bold bg-[#024BAB] text-white hover:bg-[#01368A]"
                    >
                      <Edit className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button
                      onClick={() => handleDelete(emp._id)}
                      className="p-2 border-2 border-black bg-white hover:bg-red-50"
                      title="Terminate"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-600" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block border-2 border-black bg-white overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-black bg-[#024BAB]/5">
                  {[
                    "Employee",
                    "Department",
                    "Designation",
                    "Est. Balance",
                    "Join Date",
                    "Loan Balance",
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
                {displayedEmployees.map((emp, i) => (
                  <tr
                    key={emp._id}
                    className={cn(
                      "border-b border-black/10 hover:bg-[#024BAB]/5 transition-colors cursor-pointer",
                      i % 2 === 0 ? "" : "bg-[#F8FAFF]",
                    )}
                    onClick={() => setViewEmp(emp)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 border-[1px] border-black shrink-0 overflow-hidden bg-[#024BAB] flex items-center justify-center text-xs font-bold text-white rounded-full">
                          {emp.avatar ? (
                            <img
                              src={emp.avatar}
                              alt={emp.firstName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            emp.firstName?.[0]?.toUpperCase()
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-black">
                            {emp.firstName} {emp.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {emp.employeeId}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-black font-medium">
                      {(emp.department as any)?.name || "—"}
                    </td>
                    <td className="px-4 py-3 text-black">{emp.designation}</td>
                    <td className="px-4 py-3 text-xs font-bold">
                      {(() => {
                        const sal = (emp as any).salary ?? 0;
                        const loan = (emp as any).loanBalance ?? 0;
                        const processedNet = payrollNetMap[(emp as any)._id];
                        const bal =
                          processedNet != null ? processedNet : sal - loan;
                        if (!sal)
                          return (
                            <span className="text-muted-foreground">—</span>
                          );
                        return (
                          <span
                            className={
                              bal < 0
                                ? "text-[#EF4444]"
                                : bal < sal * 0.3
                                  ? "text-amber-600"
                                  : "text-[#00C48C]"
                            }
                          >
                            ₹
                            {bal.toLocaleString("en-IN", {
                              maximumFractionDigits: 0,
                            })}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3 text-black text-xs">
                      {formatDate(emp.joinDate)}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {(emp as any).loanBalance > 0 ? (
                        <span className="font-bold text-[#EF4444]">
                          ₹{(emp as any).loanBalance.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "border-2 text-[10px] capitalize",
                          STATUS_COLORS[emp.status],
                        )}
                      >
                        {emp.status.replace("_", " ")}
                      </span>
                    </td>
                    <td
                      className="px-4 py-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setViewEmp(emp)}
                          className="p-1.5 border-2 border-transparent hover:border-black hover:bg-[#024BAB]/10 transition-colors"
                          title="View Profile"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openEdit(emp)}
                          className="p-1.5 border-2 border-transparent hover:border-black hover:bg-[#024BAB]/10 transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(emp._id)}
                          className="p-1.5 border-2 border-transparent hover:border-black hover:bg-red-50 transition-colors"
                          title="Terminate"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-600" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {page < pages && (
            <div className="flex flex-col items-center gap-2 mt-4">
              <p className="text-xs text-muted-foreground">
                Showing {employees.length} of {total}
              </p>
              <button
                onClick={loadMoreEmployees}
                disabled={loadingMore}
                className="flex items-center gap-2 border-2 border-black bg-white px-4 py-2 text-sm font-bold uppercase hover:bg-[#024BAB]/5 disabled:opacity-60"
              >
                {loadingMore && <Loader2 className="w-4 h-4 animate-spin" />}
                {loadingMore ? "Loading..." : "Load More"}
              </button>
            </div>
          )}
        </>
      )}

      {}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="border-2 border-black bg-white w-full max-w-3xl max-h-[95vh] flex flex-col">
            {}
            <div className="flex items-center justify-between px-6 py-4 border-b-2 border-black bg-[#024BAB]">
              <div className="flex items-center gap-3">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="avatar"
                    className="w-10 h-10 rounded-full object-cover border-2 border-white"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-white/20 border-2 border-white flex items-center justify-center text-white font-bold">
                    {form.firstName?.[0]?.toUpperCase() || "?"}
                  </div>
                )}
                <div>
                  <h3 className="font-bold text-lg text-white">
                    {editEmp ? "Edit Employee" : "Add Employee"}
                  </h3>
                  {(form.firstName || form.lastName) && (
                    <p className="text-white/70 text-xs">
                      {form.firstName} {form.lastName}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-white hover:text-white/70 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {}
            <div className="flex border-b-2 border-black">
              {FORM_TABS.map((tab, idx) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setFormTab(idx)}
                  className={cn(
                    "flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors border-r-2 border-black last:border-r-0",
                    formTab === idx
                      ? "bg-[#024BAB] text-white"
                      : "bg-white text-black hover:bg-[#024BAB]/5",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold mr-1.5",
                      formTab === idx
                        ? "bg-white text-[#024BAB]"
                        : "bg-black/10 text-black",
                    )}
                  >
                    {idx + 1}
                  </span>
                  {tab}
                </button>
              ))}
            </div>

            {}
            <form
              onSubmit={handleSave}
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
              className="flex-1 overflow-y-auto flex flex-col"
            >
              <div className="p-6 flex-1">
                {}
                {formTab === 0 && (
                  <div className="space-y-5">
                    {}
                    <div className="flex items-start gap-4 p-4 bg-[#F8FAFF] border-2 border-black">
                      <div className="relative shrink-0">
                        <div className="w-20 h-20 border-2 border-black overflow-hidden bg-[#024BAB] flex items-center justify-center">
                          {avatarPreview ? (
                            <img
                              src={avatarPreview}
                              alt="Preview"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-2xl font-bold text-white">
                              {form.firstName?.[0]?.toUpperCase() || "?"}
                            </span>
                          )}
                        </div>
                        <label
                          htmlFor="avatar-upload"
                          className="absolute -bottom-2 -right-2 w-7 h-7 bg-[#024BAB] border-2 border-black flex items-center justify-center cursor-pointer hover:bg-[#01368A]"
                        >
                          <Upload className="w-3.5 h-3.5 text-white" />
                        </label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleAvatarUpload}
                          className="hidden"
                          id="avatar-upload"
                        />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-bold uppercase tracking-wider text-black mb-1">
                          Profile Photo
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Click the camera icon to upload. PNG, JPG up to 10MB.
                        </p>
                        {avatarPreview && (
                          <button
                            type="button"
                            onClick={() => {
                              setAvatarPreview(null);
                              setForm({ ...form, avatar: "" });
                            }}
                            className="mt-2 text-xs font-bold text-red-600 flex items-center gap-1 hover:underline"
                          >
                            <X className="w-3 h-3" /> Remove photo
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-black mb-1">
                          First Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={form.firstName}
                          onChange={(e) =>
                            setForm({ ...form, firstName: e.target.value })
                          }
                          className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30"
                          placeholder="e.g. Ravi"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-black mb-1">
                          Last Name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={form.lastName}
                          onChange={(e) =>
                            setForm({ ...form, lastName: e.target.value })
                          }
                          className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30"
                          placeholder="e.g. Kumar"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-black mb-1">
                          Email Address <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="email"
                          required
                          value={form.email}
                          onChange={(e) =>
                            setForm({ ...form, email: e.target.value })
                          }
                          className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30"
                          placeholder="employee@sportsclub.com"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-black mb-1">
                          Mobile Number
                        </label>
                        <input
                          type="tel"
                          value={form.phone}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              phone: e.target.value
                                .replace(/\D/g, "")
                                .slice(0, 10),
                            })
                          }
                          maxLength={10}
                          minLength={10}
                          pattern="\d{10}"
                          title="Enter a valid 10-digit mobile number"
                          className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30"
                          placeholder="10-digit mobile number"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-black mb-1">
                          Designation <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={form.designation}
                          onChange={(e) =>
                            setForm({ ...form, designation: e.target.value })
                          }
                          className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30"
                          placeholder="e.g. Senior Engineer"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-black mb-1">
                          Joining Date <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          required
                          value={form.joinDate}
                          onChange={(e) =>
                            setForm({ ...form, joinDate: e.target.value })
                          }
                          className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30"
                        />
                      </div>
                    </div>

                    {}
                    <div>
                      <label className="block text-xs font-bold text-black mb-2">
                        Gender
                      </label>
                      <div className="flex gap-3">
                        {["male", "female", "other"].map((g) => (
                          <button
                            key={g}
                            type="button"
                            onClick={() => setForm({ ...form, gender: g })}
                            className={cn(
                              "flex-1 py-2.5 border-2 border-black text-sm font-bold capitalize transition-colors",
                              form.gender === g
                                ? "bg-[#024BAB] text-white"
                                : "bg-white text-black hover:bg-[#024BAB]/5",
                            )}
                          >
                            {g}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-black mb-1">
                          Department
                        </label>
                        <select
                          required
                          value={form.department}
                          onChange={(e) =>
                            setForm({ ...form, department: e.target.value })
                          }
                          className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30 bg-white"
                        >
                          <option value="">Select department</option>
                          {departments.map((d) => (
                            <option key={d._id} value={d._id}>
                              {d.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-black mb-1">
                          Employment Type
                        </label>
                        <select
                          value={form.employmentType}
                          onChange={(e) =>
                            setForm({ ...form, employmentType: e.target.value })
                          }
                          className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30 bg-white"
                        >
                          <option value="full_time">Full Time</option>
                          <option value="part_time">Part Time</option>
                          <option value="contract">Contract</option>
                          <option value="intern">Intern</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-black mb-1">
                          Role
                        </label>
                        <select
                          value={form.role}
                          onChange={(e) =>
                            setForm({ ...form, role: e.target.value })
                          }
                          className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30 bg-white"
                        >
                          <option value="staff">Staff</option>
                          <option value="coach">Coach</option>
                        </select>
                      </div>
                      {form.role === "coach" && (
                        <div>
                          <label className="block text-xs font-bold text-black mb-1">
                            Sport
                          </label>
                          <SportPicker
                            value={form.sport}
                            onChange={(sport) => setForm({ ...form, sport })}
                          />
                        </div>
                      )}
                      {editEmp && (
                        <div>
                          <label className="block text-xs font-bold text-black mb-1">
                            Status
                          </label>
                          <select
                            value={form.status}
                            onChange={(e) =>
                              setForm({ ...form, status: e.target.value })
                            }
                            className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30 bg-white"
                          >
                            <option value="active">Active</option>
                            <option value="on_leave">On Leave</option>
                            <option value="inactive">Inactive</option>
                          </select>
                        </div>
                      )}
                      {!editEmp && (
                        <div>
                          <label className="block text-xs font-bold text-black mb-1">
                            Default Password
                          </label>
                          <input
                            type="text"
                            value={form.password}
                            onChange={(e) =>
                              setForm({ ...form, password: e.target.value })
                            }
                            minLength={6}
                            title="Password must be at least 6 characters"
                            className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30"
                            placeholder="Min 6 characters (e.g. hrms@123)"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {}
                {formTab === 1 && (
                  <div className="space-y-6">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-[#024BAB] mb-1">
                        Work Schedule
                      </p>
                      <p className="text-xs text-gray-500 mb-4">
                        How many days per week does this employee work? Used to
                        calculate monthly working days for payroll.
                      </p>
                      <div className="flex gap-3 flex-wrap">
                        {[
                          { val: "5", label: "5 Days", sub: "Mon – Fri" },
                          { val: "6", label: "6 Days", sub: "Mon – Sat" },
                          { val: "7", label: "7 Days", sub: "Mon – Sun" },
                        ].map(({ val, label, sub }) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() =>
                              setForm({
                                ...form,
                                workDaysPerWeek: val,
                                workScheduleType: "standard",
                                customWorkDays: [],
                              })
                            }
                            className={cn(
                              "flex-1 py-5 border-2 border-black text-sm font-bold transition-colors",
                              form.workScheduleType === "standard" &&
                                form.workDaysPerWeek === val
                                ? "bg-[#024BAB] text-white"
                                : "bg-white text-black hover:bg-[#024BAB]/5",
                            )}
                          >
                            <div className="text-xl font-bold mb-1">
                              {label}
                            </div>
                            <div className="text-xs font-normal opacity-70">
                              {sub}
                            </div>
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() =>
                            setForm({
                              ...form,
                              workScheduleType: "custom",
                              customWorkDays: form.customWorkDays.length
                                ? form.customWorkDays
                                : [],
                            })
                          }
                          className={cn(
                            "flex-1 py-5 border-2 border-black text-sm font-bold transition-colors",
                            form.workScheduleType === "custom"
                              ? "bg-[#024BAB] text-white"
                              : "bg-white text-black hover:bg-[#024BAB]/5",
                          )}
                        >
                          <div className="text-xl font-bold mb-1">Custom</div>
                          <div className="text-xs font-normal opacity-70">
                            Pick days
                          </div>
                        </button>
                      </div>
                      {form.workScheduleType === "custom" && (
                        <div className="mt-4">
                          <p className="text-xs text-gray-500 mb-3">
                            Select the days this employee works:
                          </p>
                          <div className="flex gap-2 flex-wrap">
                            {[
                              { day: 1, label: "Mon" },
                              { day: 2, label: "Tue" },
                              { day: 3, label: "Wed" },
                              { day: 4, label: "Thu" },
                              { day: 5, label: "Fri" },
                              { day: 6, label: "Sat" },
                              { day: 0, label: "Sun" },
                            ].map(({ day, label }) => {
                              const selected =
                                form.customWorkDays.includes(day);
                              return (
                                <button
                                  key={day}
                                  type="button"
                                  onClick={() => {
                                    const days = selected
                                      ? form.customWorkDays.filter(
                                          (d) => d !== day,
                                        )
                                      : [...form.customWorkDays, day];
                                    setForm({ ...form, customWorkDays: days });
                                  }}
                                  className={cn(
                                    "w-12 h-12 border-2 border-black text-xs font-bold transition-colors",
                                    selected
                                      ? "bg-[#024BAB] text-white"
                                      : "bg-white text-black hover:bg-[#024BAB]/5",
                                  )}
                                >
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                          {form.customWorkDays.length > 0 && (
                            <p className="text-xs text-[#024BAB] font-bold mt-2">
                              {form.customWorkDays.length} day
                              {form.customWorkDays.length > 1 ? "s" : ""}{" "}
                              selected — attendance will only be tracked on
                              these days
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="border-t-2 border-black pt-5">
                      <p className="text-xs font-bold uppercase tracking-wider text-[#024BAB] mb-4">
                        Overtime & Biometric
                      </p>
                      <div className="flex items-center justify-between p-3 border-2 border-black/10 hover:border-black transition-colors mb-4">
                        <div>
                          <p className="text-sm font-bold text-black">
                            Enable Overtime
                          </p>
                          <p className="text-xs text-muted-foreground">
                            When on, extra hours beyond shift end are counted as
                            OT
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setForm({ ...form, otEnabled: !form.otEnabled })
                          }
                          className={cn(
                            "w-12 h-6 border-2 border-black transition-colors relative flex-shrink-0",
                            form.otEnabled ? "bg-[#024BAB]" : "bg-gray-200",
                          )}
                        >
                          <span
                            className={cn(
                              "absolute top-0.5 w-4 h-4 bg-white border border-black transition-all",
                              form.otEnabled ? "left-6" : "left-0.5",
                            )}
                          />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-black mb-1">
                            OT Rate (₹ / Hour)
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={form.otRate}
                            onChange={(e) =>
                              setForm({ ...form, otRate: e.target.value })
                            }
                            className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30"
                            placeholder="e.g. 50"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-black mb-1">
                            Biometric User ID
                          </label>
                          <input
                            type="text"
                            value={(form as any).biometricUserId || ""}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                ["biometricUserId" as any]: e.target.value,
                              })
                            }
                            className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30"
                            placeholder="Device user ID (e.g. 1, 2, 3)"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="border-t-2 border-black pt-5">
                      <p className="text-xs font-bold uppercase tracking-wider text-[#024BAB] mb-4">
                        Mobile Geofenced Attendance
                      </p>
                      <div className="flex items-center justify-between p-3 border-2 border-black/10 hover:border-black transition-colors mb-4">
                        <div>
                          <p className="text-sm font-bold text-black">
                            Allow Mobile Camera Check-in/out
                          </p>
                          <p className="text-xs text-muted-foreground">
                            When on, this employee can mark attendance from the
                            mobile app using a selfie, either from anywhere or
                            restricted to a specific location
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setForm({
                              ...form,
                              geofenceAttendanceEnabled:
                                !form.geofenceAttendanceEnabled,
                            })
                          }
                          className={cn(
                            "w-12 h-6 border-2 border-black transition-colors relative flex-shrink-0",
                            form.geofenceAttendanceEnabled
                              ? "bg-[#024BAB]"
                              : "bg-gray-200",
                          )}
                        >
                          <span
                            className={cn(
                              "absolute top-0.5 w-4 h-4 bg-white border border-black transition-all",
                              form.geofenceAttendanceEnabled
                                ? "left-6"
                                : "left-0.5",
                            )}
                          />
                        </button>
                      </div>
                      {form.geofenceAttendanceEnabled && (
                        <>
                          <div className="flex gap-2 mb-4">
                            <button
                              type="button"
                              onClick={() =>
                                setForm({ ...form, geofenceMode: "any" })
                              }
                              className={cn(
                                "flex-1 text-xs font-bold px-3 py-2.5 border-2 border-black",
                                form.geofenceMode === "any"
                                  ? "bg-[#024BAB] text-white"
                                  : "bg-white text-black hover:bg-[#024BAB]/5",
                              )}
                            >
                              Any Location
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setForm({ ...form, geofenceMode: "specific" })
                              }
                              className={cn(
                                "flex-1 text-xs font-bold px-3 py-2.5 border-2 border-black",
                                form.geofenceMode === "specific"
                                  ? "bg-[#024BAB] text-white"
                                  : "bg-white text-black hover:bg-[#024BAB]/5",
                              )}
                            >
                              Specific Location
                            </button>
                          </div>

                          {form.geofenceMode === "any" ? (
                            <p className="text-xs text-muted-foreground mb-4">
                              This employee can check in/out from anywhere —
                              only face verification is required, no location
                              restriction.
                            </p>
                          ) : (
                            <>
                              <div className="grid grid-cols-3 gap-4 mb-3">
                                <div>
                                  <label className="block text-xs font-bold text-black mb-1">
                                    Latitude
                                  </label>
                                  <input
                                    type="number"
                                    step="any"
                                    value={form.geofenceLat}
                                    onChange={(e) =>
                                      setForm({
                                        ...form,
                                        geofenceLat: e.target.value,
                                      })
                                    }
                                    className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30"
                                    placeholder="e.g. 28.6139"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-bold text-black mb-1">
                                    Longitude
                                  </label>
                                  <input
                                    type="number"
                                    step="any"
                                    value={form.geofenceLng}
                                    onChange={(e) =>
                                      setForm({
                                        ...form,
                                        geofenceLng: e.target.value,
                                      })
                                    }
                                    className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30"
                                    placeholder="e.g. 77.2090"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-bold text-black mb-1">
                                    Radius (meters)
                                  </label>
                                  <input
                                    type="number"
                                    min="10"
                                    value={form.geofenceRadiusMeters}
                                    onChange={(e) =>
                                      setForm({
                                        ...form,
                                        geofenceRadiusMeters: e.target.value,
                                      })
                                    }
                                    className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30"
                                    placeholder="200"
                                  />
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  if (!navigator.geolocation) return;
                                  navigator.geolocation.getCurrentPosition(
                                    (pos) => {
                                      setForm({
                                        ...form,
                                        geofenceLat: String(
                                          pos.coords.latitude,
                                        ),
                                        geofenceLng: String(
                                          pos.coords.longitude,
                                        ),
                                      });
                                    },
                                    () => {
                                      setActionModal({
                                        show: true,
                                        type: "error",
                                        title: "Location Unavailable",
                                        message:
                                          "Could not get your current location. Enter coordinates manually.",
                                      });
                                    },
                                  );
                                }}
                                className="text-xs font-bold text-[#024BAB] border-2 border-[#024BAB] px-3 py-2 hover:bg-[#024BAB]/5"
                              >
                                Use My Current Location
                              </button>
                            </>
                          )}

                          {editEmp ? (
                            <div className="mt-4 pt-4 border-t border-black/10">
                              <p className="text-sm font-bold text-black mb-1">
                                Face Enrollment
                              </p>
                              <p className="text-xs text-muted-foreground mb-3">
                                Recommended: have the employee enroll their own
                                face from the mobile app (uses the front camera,
                                matching how they'll check in). Use this upload
                                only as a fallback — a photo taken under
                                different conditions than their phone selfie may
                                reduce match accuracy.
                              </p>
                              <input
                                ref={faceEnrollInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleEnrollFace(file);
                                }}
                              />
                              <button
                                type="button"
                                disabled={faceEnrolling}
                                onClick={() =>
                                  faceEnrollInputRef.current?.click()
                                }
                                className="text-xs font-bold text-white bg-[#024BAB] border-2 border-black px-3 py-2 disabled:opacity-50"
                              >
                                {faceEnrolling
                                  ? "Enrolling…"
                                  : "Upload Face Photo"}
                              </button>
                            </div>
                          ) : (
                            <p className="mt-4 pt-4 border-t border-black/10 text-xs text-muted-foreground">
                              Save this employee first, then reopen edit to
                              enroll their face for mobile attendance.
                            </p>
                          )}
                        </>
                      )}
                    </div>

                    <div className="border-t-2 border-black pt-5">
                      <p className="text-xs font-bold uppercase tracking-wider text-[#024BAB] mb-4">
                        Shift Assignment
                      </p>
                      <div>
                        <label className="block text-xs font-bold text-black mb-1">
                          Shift
                        </label>
                        <select
                          value={form.isCustomShift ? "custom" : form.shift}
                          onChange={(e) => {
                            if (e.target.value === "custom") {
                              setForm({
                                ...form,
                                shift: "",
                                shiftName: "Custom",
                                isCustomShift: true,
                              });
                              return;
                            }
                            const selected = shifts.find(
                              (s) => s._id === e.target.value,
                            );
                            setForm({
                              ...form,
                              shift: e.target.value,
                              shiftName: selected ? selected.name : "",
                              isCustomShift: false,
                            });
                          }}
                          className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30 bg-white"
                        >
                          <option value="">— No shift assigned —</option>
                          {shifts.map((s) => (
                            <option key={s._id} value={s._id}>
                              {s.name} ({s.startTime} – {s.endTime})
                            </option>
                          ))}
                          <option value="custom">— Custom shift —</option>
                        </select>
                        {shifts.length === 0 && !form.isCustomShift && (
                          <p className="text-xs text-muted-foreground mt-1">
                            No shifts yet. Create one under{" "}
                            <strong>Manage → Shifts</strong>, or pick{" "}
                            <strong>Custom shift</strong> above.
                          </p>
                        )}
                        {form.isCustomShift && (
                          <div className="grid grid-cols-2 gap-3 mt-3 border-2 border-black p-3 bg-[#F5F5F0]">
                            <div>
                              <label className="block text-xs font-bold text-black mb-1">
                                Start Time
                              </label>
                              <input
                                type="time"
                                value={form.customShift.startTime}
                                onChange={(e) =>
                                  setForm({
                                    ...form,
                                    customShift: {
                                      ...form.customShift,
                                      startTime: e.target.value,
                                    },
                                  })
                                }
                                className="border-2 border-black w-full px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30 bg-white"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-black mb-1">
                                End Time
                              </label>
                              <input
                                type="time"
                                value={form.customShift.endTime}
                                onChange={(e) =>
                                  setForm({
                                    ...form,
                                    customShift: {
                                      ...form.customShift,
                                      endTime: e.target.value,
                                    },
                                  })
                                }
                                className="border-2 border-black w-full px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30 bg-white"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-black mb-1">
                                Break (minutes)
                              </label>
                              <input
                                type="number"
                                min={0}
                                value={form.customShift.breakMinutes}
                                onChange={(e) =>
                                  setForm({
                                    ...form,
                                    customShift: {
                                      ...form.customShift,
                                      breakMinutes: e.target.value,
                                    },
                                  })
                                }
                                className="border-2 border-black w-full px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30 bg-white"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-black mb-1">
                                OT After (hours)
                              </label>
                              <input
                                type="number"
                                min={0}
                                value={form.customShift.otAfterHours}
                                onChange={(e) =>
                                  setForm({
                                    ...form,
                                    customShift: {
                                      ...form.customShift,
                                      otAfterHours: e.target.value,
                                    },
                                  })
                                }
                                className="border-2 border-black w-full px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30 bg-white"
                              />
                            </div>
                            <p className="text-xs text-muted-foreground col-span-2">
                              This custom shift applies only to this employee
                              and is used directly for their attendance and
                              payroll calculations.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {}
                {formTab === 2 && (
                  <div className="space-y-6">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-[#024BAB] mb-4">
                        Salary Information
                      </p>
                      <div>
                        <label className="block text-xs font-bold text-black mb-1">
                          Monthly Salary (₹ / Month)
                        </label>
                        <input
                          type="number"
                          required
                          min="1"
                          value={form.salary}
                          onChange={(e) =>
                            setForm({ ...form, salary: e.target.value })
                          }
                          className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30"
                          placeholder="e.g. 15000"
                        />
                        {form.salary && (
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            {[
                              {
                                label: "Monthly",
                                value: `₹${Number(form.salary).toLocaleString("en-IN")}`,
                              },
                              {
                                label: "Annual",
                                value: `₹${(Number(form.salary) * 12).toLocaleString("en-IN")}`,
                              },
                            ].map(({ label, value }) => (
                              <div
                                key={label}
                                className="bg-[#F8FAFF] border-2 border-black p-3 text-center"
                              >
                                <p className="text-[10px] font-bold uppercase text-muted-foreground">
                                  {label}
                                </p>
                                <p className="text-sm font-bold text-black mt-0.5">
                                  {value}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="border-t-2 border-black pt-5">
                      <p className="text-xs font-bold uppercase tracking-wider text-[#024BAB] mb-4">
                        Compliance Numbers
                      </p>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-black mb-1">
                            PF Number
                          </label>
                          <input
                            type="text"
                            value={form.pfNumber}
                            onChange={(e) =>
                              setForm({ ...form, pfNumber: e.target.value })
                            }
                            className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30"
                            placeholder="PF account number"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-black mb-1">
                            UAN Number
                          </label>
                          <input
                            type="text"
                            value={form.uanNumber}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                uanNumber: e.target.value
                                  .replace(/\D/g, "")
                                  .slice(0, 12),
                              })
                            }
                            maxLength={12}
                            minLength={12}
                            pattern="\d{12}"
                            title="UAN must be exactly 12 digits"
                            className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30"
                            placeholder="12-digit UAN"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-black mb-1">
                            ESIC Number
                          </label>
                          <input
                            type="text"
                            value={form.esicNumber}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                esicNumber: e.target.value
                                  .replace(/\D/g, "")
                                  .slice(0, 17),
                              })
                            }
                            maxLength={17}
                            minLength={17}
                            pattern="\d{17}"
                            title="ESIC number must be exactly 17 digits"
                            className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30"
                            placeholder="17-digit ESIC number"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {}
                {formTab === 3 && (
                  <div className="space-y-6">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-[#024BAB] mb-4">
                        Personal Details
                      </p>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-black mb-1">
                            Date of Birth
                          </label>
                          <input
                            type="date"
                            value={form.dateOfBirth}
                            onChange={(e) =>
                              setForm({ ...form, dateOfBirth: e.target.value })
                            }
                            className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-black mb-1">
                            Emergency Contact
                          </label>
                          <input
                            type="tel"
                            value={form.emergencyContact}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                emergencyContact: e.target.value
                                  .replace(/\D/g, "")
                                  .slice(0, 10),
                              })
                            }
                            maxLength={10}
                            minLength={10}
                            pattern="\d{10}"
                            title="Enter a valid 10-digit phone number"
                            className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30"
                            placeholder="10-digit phone number"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs font-bold text-black mb-1">
                            Current Address
                          </label>
                          <textarea
                            value={form.address}
                            onChange={(e) =>
                              setForm({ ...form, address: e.target.value })
                            }
                            className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30 resize-none"
                            rows={2}
                            placeholder="Current residential address"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs font-bold text-black mb-1">
                            Permanent Address{" "}
                            <span className="text-gray-400 font-normal">
                              (if different)
                            </span>
                          </label>
                          <textarea
                            value={form.permanentAddress}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                permanentAddress: e.target.value,
                              })
                            }
                            className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30 resize-none"
                            rows={2}
                            placeholder="Permanent address"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-black mb-1">
                            City
                          </label>
                          <input
                            type="text"
                            value={form.city}
                            onChange={(e) =>
                              setForm({ ...form, city: e.target.value })
                            }
                            className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30"
                            placeholder="City"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-black mb-1">
                            State
                          </label>
                          <input
                            type="text"
                            value={form.state}
                            onChange={(e) =>
                              setForm({ ...form, state: e.target.value })
                            }
                            className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30"
                            placeholder="State"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-black mb-1">
                            Pincode
                          </label>
                          <input
                            type="text"
                            value={form.pincode}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                pincode: e.target.value
                                  .replace(/\D/g, "")
                                  .slice(0, 6),
                              })
                            }
                            maxLength={6}
                            className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30"
                            placeholder="6-digit pincode"
                          />
                        </div>
                      </div>
                    </div>

                    {/* ── Personal Details ─────────────────────────── */}
                    <div className="border-t-2 border-black pt-5">
                      <p className="text-xs font-bold uppercase tracking-wider text-[#024BAB] mb-4">
                        Personal Details
                      </p>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-black mb-1">
                            Father's Name
                          </label>
                          <input
                            type="text"
                            value={form.fatherName}
                            onChange={(e) =>
                              setForm({ ...form, fatherName: e.target.value })
                            }
                            className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30"
                            placeholder="Father's full name"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-black mb-1">
                            Mother's Name
                          </label>
                          <input
                            type="text"
                            value={form.motherName}
                            onChange={(e) =>
                              setForm({ ...form, motherName: e.target.value })
                            }
                            className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30"
                            placeholder="Mother's full name"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-black mb-1">
                            Marital Status
                          </label>
                          <select
                            value={form.maritalStatus}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                maritalStatus: e.target.value,
                              })
                            }
                            className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30 bg-white"
                          >
                            <option value="">Select</option>
                            <option value="single">Single</option>
                            <option value="married">Married</option>
                            <option value="divorced">Divorced</option>
                            <option value="widowed">Widowed</option>
                          </select>
                        </div>
                        {form.maritalStatus === "married" && (
                          <div>
                            <label className="block text-xs font-bold text-black mb-1">
                              Spouse Name
                            </label>
                            <input
                              type="text"
                              value={form.spouseName}
                              onChange={(e) =>
                                setForm({ ...form, spouseName: e.target.value })
                              }
                              className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30"
                              placeholder="Spouse's full name"
                            />
                          </div>
                        )}
                        <div>
                          <label className="block text-xs font-bold text-black mb-1">
                            Blood Group
                          </label>
                          <select
                            value={form.bloodGroup}
                            onChange={(e) =>
                              setForm({ ...form, bloodGroup: e.target.value })
                            }
                            className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30 bg-white"
                          >
                            <option value="">Select</option>
                            {[
                              "A+",
                              "A-",
                              "B+",
                              "B-",
                              "AB+",
                              "AB-",
                              "O+",
                              "O-",
                            ].map((g) => (
                              <option key={g} value={g}>
                                {g}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-black mb-1">
                            Nationality
                          </label>
                          <input
                            type="text"
                            value={form.nationality}
                            onChange={(e) =>
                              setForm({ ...form, nationality: e.target.value })
                            }
                            className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30"
                            placeholder="Indian"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-black mb-1">
                            Religion
                          </label>
                          <input
                            type="text"
                            value={form.religion}
                            onChange={(e) =>
                              setForm({ ...form, religion: e.target.value })
                            }
                            className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30"
                            placeholder="Optional"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-black mb-1">
                            Personal Email
                          </label>
                          <input
                            type="email"
                            value={form.personalEmail}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                personalEmail: e.target.value,
                              })
                            }
                            className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30"
                            placeholder="personal@gmail.com"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-black mb-1">
                            Alternate Phone
                          </label>
                          <input
                            type="tel"
                            value={form.alternatePhone}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                alternatePhone: e.target.value
                                  .replace(/\D/g, "")
                                  .slice(0, 10),
                              })
                            }
                            maxLength={10}
                            className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30"
                            placeholder="Alternate 10-digit number"
                          />
                        </div>
                      </div>
                    </div>

                    {/* ── Professional Background ───────────────────── */}
                    <div className="border-t-2 border-black pt-5">
                      <p className="text-xs font-bold uppercase tracking-wider text-[#024BAB] mb-4">
                        Professional Background
                      </p>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-black mb-1">
                            Highest Qualification
                          </label>
                          <input
                            type="text"
                            value={form.qualification}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                qualification: e.target.value,
                              })
                            }
                            className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30"
                            placeholder="e.g. B.Com, MBA, 12th Pass"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-black mb-1">
                            Total Experience
                          </label>
                          <input
                            type="text"
                            value={form.totalExperience}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                totalExperience: e.target.value,
                              })
                            }
                            className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30"
                            placeholder="e.g. 3 years 2 months"
                          />
                        </div>
                        <div className="col-span-2">
                          <label className="block text-xs font-bold text-black mb-1">
                            Previous SportsClub
                          </label>
                          <input
                            type="text"
                            value={form.previousCompany}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                previousCompany: e.target.value,
                              })
                            }
                            className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30"
                            placeholder="Previous employer name"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="border-t-2 border-black pt-5">
                      <p className="text-xs font-bold uppercase tracking-wider text-[#024BAB] mb-4">
                        Identity Documents
                      </p>
                      <div className="grid grid-cols-2 gap-4">
                        {/* PAN Number */}
                        <div>
                          <label className="block text-xs font-bold text-black mb-1">
                            PAN Number
                          </label>
                          <input
                            type="text"
                            value={form.panNumber}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                panNumber: e.target.value
                                  .toUpperCase()
                                  .slice(0, 10),
                              })
                            }
                            maxLength={10}
                            pattern="[A-Z]{5}[0-9]{4}[A-Z]{1}"
                            title="PAN format: 5 letters + 4 digits + 1 letter (e.g. ABCDE1234F)"
                            className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30 uppercase"
                            placeholder="ABCDE1234F"
                          />
                        </div>

                        {/* PAN Document upload */}
                        <div>
                          <label className="block text-xs font-bold text-black mb-1">
                            PAN Document{" "}
                            <span className="text-gray-400 font-normal">
                              (optional, PDF/JPG/PNG, max 5MB)
                            </span>
                          </label>
                          <div className="flex items-center gap-2">
                            <label className="cursor-pointer flex-1">
                              <input
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png,.webp"
                                className="hidden"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f)
                                    setDocFiles((prev) => ({
                                      ...prev,
                                      panDoc: f,
                                    }));
                                }}
                              />
                              <div className="border-2 border-dashed border-gray-300 hover:border-[#024BAB] px-3 py-2 text-xs text-gray-500 hover:text-[#024BAB] transition-colors text-center">
                                {docFiles.panDoc
                                  ? docFiles.panDoc.name
                                  : editEmp && (editEmp as any).panDoc
                                    ? "✅ Uploaded — click to replace"
                                    : "Click to upload PAN document"}
                              </div>
                            </label>
                            {(docFiles.panDoc ||
                              (editEmp && (editEmp as any).panDoc)) && (
                              <div className="flex gap-1">
                                {docFiles.panDoc && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setDocFiles((prev) => {
                                        const n = { ...prev };
                                        delete n.panDoc;
                                        return n;
                                      })
                                    }
                                    className="text-red-500 text-xs border border-red-300 px-1.5 py-1 hover:bg-red-50"
                                  >
                                    ✕
                                  </button>
                                )}
                                {editEmp &&
                                  (editEmp as any).panDoc &&
                                  !docFiles.panDoc && (
                                    <a
                                      href={employeeAPI.getDocumentUrl(
                                        editEmp._id,
                                        "pan",
                                      )}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-[#024BAB] text-xs border border-[#024BAB] px-1.5 py-1 hover:bg-[#024BAB]/10"
                                    >
                                      View
                                    </a>
                                  )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Aadhaar Number */}
                        <div>
                          <label className="block text-xs font-bold text-black mb-1">
                            Aadhar Number
                          </label>
                          <input
                            type="text"
                            value={form.aadharNumber}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                aadharNumber: e.target.value
                                  .replace(/\D/g, "")
                                  .slice(0, 12),
                              })
                            }
                            maxLength={12}
                            pattern="\d{12}"
                            title="Aadhar must be exactly 12 digits"
                            className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30"
                            placeholder="12-digit Aadhar number"
                          />
                        </div>

                        {/* Aadhaar Document upload */}
                        <div>
                          <label className="block text-xs font-bold text-black mb-1">
                            Aadhaar Document{" "}
                            <span className="text-gray-400 font-normal">
                              (optional, PDF/JPG/PNG, max 5MB)
                            </span>
                          </label>
                          <div className="flex items-center gap-2">
                            <label className="cursor-pointer flex-1">
                              <input
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png,.webp"
                                className="hidden"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f)
                                    setDocFiles((prev) => ({
                                      ...prev,
                                      aadhaarDoc: f,
                                    }));
                                }}
                              />
                              <div className="border-2 border-dashed border-gray-300 hover:border-[#024BAB] px-3 py-2 text-xs text-gray-500 hover:text-[#024BAB] transition-colors text-center">
                                {docFiles.aadhaarDoc
                                  ? docFiles.aadhaarDoc.name
                                  : editEmp && (editEmp as any).aadhaarDoc
                                    ? "✅ Uploaded — click to replace"
                                    : "Click to upload Aadhaar document"}
                              </div>
                            </label>
                            {(docFiles.aadhaarDoc ||
                              (editEmp && (editEmp as any).aadhaarDoc)) && (
                              <div className="flex gap-1">
                                {docFiles.aadhaarDoc && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setDocFiles((prev) => {
                                        const n = { ...prev };
                                        delete n.aadhaarDoc;
                                        return n;
                                      })
                                    }
                                    className="text-red-500 text-xs border border-red-300 px-1.5 py-1 hover:bg-red-50"
                                  >
                                    ✕
                                  </button>
                                )}
                                {editEmp &&
                                  (editEmp as any).aadhaarDoc &&
                                  !docFiles.aadhaarDoc && (
                                    <a
                                      href={employeeAPI.getDocumentUrl(
                                        editEmp._id,
                                        "aadhaar",
                                      )}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-[#024BAB] text-xs border border-[#024BAB] px-1.5 py-1 hover:bg-[#024BAB]/10"
                                    >
                                      View
                                    </a>
                                  )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Resume upload — full width */}
                        <div className="col-span-2">
                          <label className="block text-xs font-bold text-black mb-1">
                            Resume / CV{" "}
                            <span className="text-gray-400 font-normal">
                              (optional, PDF/DOC, max 5MB)
                            </span>
                          </label>
                          <div className="flex items-center gap-2">
                            <label className="cursor-pointer flex-1">
                              <input
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png"
                                className="hidden"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f)
                                    setDocFiles((prev) => ({
                                      ...prev,
                                      resumeDoc: f,
                                    }));
                                }}
                              />
                              <div className="border-2 border-dashed border-gray-300 hover:border-[#024BAB] px-3 py-2 text-xs text-gray-500 hover:text-[#024BAB] transition-colors text-center">
                                {docFiles.resumeDoc
                                  ? docFiles.resumeDoc.name
                                  : editEmp && (editEmp as any).resumeDoc
                                    ? "✅ Uploaded — click to replace"
                                    : "Click to upload Resume / CV"}
                              </div>
                            </label>
                            {(docFiles.resumeDoc ||
                              (editEmp && (editEmp as any).resumeDoc)) && (
                              <div className="flex gap-1">
                                {docFiles.resumeDoc && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setDocFiles((prev) => {
                                        const n = { ...prev };
                                        delete n.resumeDoc;
                                        return n;
                                      })
                                    }
                                    className="text-red-500 text-xs border border-red-300 px-1.5 py-1 hover:bg-red-50"
                                  >
                                    ✕
                                  </button>
                                )}
                                {editEmp &&
                                  (editEmp as any).resumeDoc &&
                                  !docFiles.resumeDoc && (
                                    <a
                                      href={employeeAPI.getDocumentUrl(
                                        editEmp._id,
                                        "resume",
                                      )}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-[#024BAB] text-xs border border-[#024BAB] px-1.5 py-1 hover:bg-[#024BAB]/10"
                                    >
                                      View
                                    </a>
                                  )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="border-t-2 border-black pt-5">
                      <p className="text-xs font-bold uppercase tracking-wider text-[#024BAB] mb-4">
                        Bank Details
                      </p>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-black mb-1">
                            Account Holder Name
                          </label>
                          <input
                            type="text"
                            value={form.accountHolderName}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                accountHolderName: e.target.value,
                              })
                            }
                            className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30"
                            placeholder="As per bank records"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-black mb-1">
                            Bank Account Number
                          </label>
                          <input
                            type="text"
                            value={form.bankAccount}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                bankAccount: e.target.value
                                  .replace(/\D/g, "")
                                  .slice(0, 18),
                              })
                            }
                            maxLength={18}
                            className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30"
                            placeholder="9–18 digit account number"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-black mb-1">
                            IFSC Code
                          </label>
                          <input
                            type="text"
                            value={form.ifscCode}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                ifscCode: e.target.value
                                  .toUpperCase()
                                  .slice(0, 11),
                              })
                            }
                            maxLength={11}
                            minLength={11}
                            pattern="[A-Z]{4}0[A-Z0-9]{6}"
                            title="IFSC format: 4 letters + 0 + 6 alphanumeric (e.g. SBIN0001234)"
                            className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30 uppercase"
                            placeholder="SBIN0001234"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-black mb-1">
                            Bank Name
                          </label>
                          <input
                            type="text"
                            value={form.bankName}
                            onChange={(e) =>
                              setForm({ ...form, bankName: e.target.value })
                            }
                            className="border-2 border-black w-full px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[#024BAB]/30"
                            placeholder="e.g. SBI, HDFC, ICICI"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {}
              <div className="flex items-center justify-between px-6 py-4 border-t-2 border-black bg-[#F8FAFF]">
                <button
                  type="button"
                  onClick={() => setFormTab((t) => Math.max(0, t - 1))}
                  disabled={formTab === 0}
                  className="flex items-center gap-2 border-2 border-black px-4 py-2 text-sm font-bold bg-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50"
                >
                  <ArrowLeft className="w-4 h-4" /> Previous
                </button>

                <div className="flex gap-1.5">
                  {FORM_TABS.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setFormTab(idx)}
                      className={cn(
                        "h-2 rounded-full border border-black transition-all",
                        formTab === idx ? "bg-[#024BAB] w-6" : "bg-white w-2",
                      )}
                    />
                  ))}
                </div>

                {formTab < FORM_TABS.length - 1 ? (
                  <button
                    key="next"
                    type="button"
                    onClick={() =>
                      setFormTab((t) => Math.min(FORM_TABS.length - 1, t + 1))
                    }
                    className="flex items-center gap-2 border-2 border-black bg-[#024BAB] text-white px-4 py-2 text-sm font-bold hover:bg-[#01368A]"
                  >
                    Next <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    key="submit"
                    type="button"
                    disabled={saving}
                    onClick={handleSave}
                    className="flex items-center gap-2 border-2 border-black bg-[#024BAB] text-white px-6 py-2 text-sm font-bold hover:bg-[#01368A] disabled:opacity-50"
                  >
                    <CheckCircle className="w-4 h-4" />
                    {saving
                      ? "Saving..."
                      : editEmp
                        ? "Save Changes"
                        : "Add Employee"}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {}
      {viewEmp && (
        <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
          {}
          <div className="sticky top-0 bg-white border-b-2 border-black flex items-center justify-between px-6 py-3 z-10">
            <button
              onClick={() => setViewEmp(null)}
              className="flex items-center gap-2 text-sm font-bold text-black hover:text-[#024BAB] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setViewEmp(null);
                  openEdit(viewEmp);
                }}
                className="flex items-center gap-1.5 border-2 border-black px-3 py-1.5 text-xs font-bold bg-[#024BAB] text-white hover:bg-[#01368A]"
              >
                <Edit className="w-3.5 h-3.5" /> Edit
              </button>
              <button
                onClick={() => {
                  handleDelete(viewEmp._id);
                  setViewEmp(null);
                }}
                className="flex items-center gap-1.5 border-2 border-black px-3 py-1.5 text-xs font-bold bg-white text-red-600 hover:bg-red-50"
              >
                <Trash2 className="w-3.5 h-3.5" /> Terminate
              </button>
            </div>
          </div>

          <div className="max-w-4xl mx-auto p-6 space-y-4">
            {}
            <div className="border-2 border-black bg-white p-5">
              <div className="flex items-start gap-5">
                <div className="shrink-0">
                  {viewEmp.avatar ? (
                    <img
                      src={viewEmp.avatar}
                      alt="Profile"
                      className="w-20 h-20 object-cover border-2 border-black"
                    />
                  ) : (
                    <div className="w-20 h-20 bg-[#024BAB] border-2 border-black flex items-center justify-center text-3xl font-bold text-white rounded-full">
                      {viewEmp.firstName?.[0]?.toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground font-bold">
                        {viewEmp.employeeId}
                      </p>
                      <h1 className="text-2xl font-bold text-black mt-0.5">
                        {viewEmp.firstName} {viewEmp.lastName}
                      </h1>
                      <p className="text-sm font-medium text-muted-foreground mt-0.5">
                        {viewEmp.designation}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "border-2 text-[11px] capitalize shrink-0 mt-1",
                        STATUS_COLORS[viewEmp.status],
                      )}
                    >
                      {viewEmp.status.replace("_", " ")}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 mt-3">
                    {viewEmp.phone && (
                      <div className="flex items-center gap-1.5 text-xs text-black">
                        <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="font-medium">{viewEmp.phone}</span>
                      </div>
                    )}
                    {viewEmp.email && (
                      <div className="flex items-center gap-1.5 text-xs text-black col-span-2">
                        <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="font-medium truncate">
                          {viewEmp.email}
                        </span>
                      </div>
                    )}
                    {(viewEmp.department as any)?.name && (
                      <div className="flex items-center gap-1.5 text-xs text-black">
                        <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="font-medium">
                          {(viewEmp.department as any)?.name}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-xs text-black">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium">
                        Joined {formatDate(viewEmp.joinDate)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-black">
                      <IndianRupee className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium">
                        {formatCurrency(viewEmp.salary || 0)} / month
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs">
                      <span
                        className={cn(
                          "border-2 text-[10px] capitalize",
                          TYPE_COLORS[viewEmp.employmentType],
                        )}
                      >
                        {viewEmp.employmentType.replace("_", " ")}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="border-2 border-black bg-white p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Monthly Salary
                </p>
                <p className="text-2xl font-bold text-[#024BAB]">
                  ₹{(viewEmp.salary || 0).toLocaleString("en-IN")}
                </p>
                <span className="inline-block mt-1.5 text-[10px] font-bold bg-[#FA731C]/15 text-[#FA731C] px-2 py-0.5 border border-[#FA731C]">
                  Pending
                </span>
              </div>
              <div className="border-2 border-black bg-white p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Loan Balance
                </p>
                <p
                  className={cn(
                    "text-2xl font-bold",
                    (viewEmp as any).loanBalance > 0
                      ? "text-[#EF4444]"
                      : "text-black",
                  )}
                >
                  ₹{((viewEmp as any).loanBalance || 0).toLocaleString("en-IN")}
                </p>
                <span className="inline-block mt-1.5 text-[10px] font-bold bg-[#FA731C]/15 text-[#FA731C] px-2 py-0.5 border border-[#FA731C]">
                  Pending
                </span>
              </div>
              <div className="border-2 border-black bg-white p-4 flex flex-col gap-2 items-stretch justify-center">
                <button
                  onClick={() => navigate("/reports")}
                  className="flex items-center justify-center gap-2 bg-[#024BAB] text-white border-2 border-black px-4 py-2.5 text-sm font-bold hover:bg-[#01368A] transition-colors"
                >
                  <FileText className="w-4 h-4" /> Report
                </button>
                <button
                  onClick={() => navigate("/payroll")}
                  className="flex items-center justify-center gap-2 bg-white text-black border-2 border-black px-4 py-2 text-xs font-bold hover:bg-gray-50 transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" /> Pay Slip
                </button>
              </div>
            </div>

            {}
            <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
              {[
                {
                  icon: Calendar,
                  label: "Edit Attendance",
                  color: "text-[#024BAB]",
                  action: () => navigate("/attendance"),
                },
                {
                  icon: FileText,
                  label: "Payment History",
                  color: "text-[#A855F7]",
                  action: () => navigate("/reports"),
                },
                {
                  icon: Banknote,
                  label: "Loan Entry",
                  color: "text-[#FA731C]",
                  action: () => {
                    setLoanForm({
                      employee: viewEmp._id,
                      type: "loan",
                      amount: "",
                      monthlyEmi: "",
                      reason: "",
                    });
                    setLoanModal(true);
                    setViewEmp(null);
                  },
                },
                {
                  icon: Plus,
                  label: "Add Advance",
                  color: "text-[#00C48C]",
                  action: () => {
                    setLoanForm({
                      employee: viewEmp._id,
                      type: "advance",
                      amount: "",
                      monthlyEmi: "",
                      reason: "",
                    });
                    setLoanModal(true);
                    setViewEmp(null);
                  },
                },
                {
                  icon: TrendingUp,
                  label: "Allowance / Bonus",
                  color: "text-[#024BAB]",
                  action: () => {
                    setTxForm({
                      employee: viewEmp._id,
                      amount: "",
                      hours: "",
                      date: new Date().toISOString().split("T")[0],
                      remark: "",
                    });
                    setTxModal("allowance");
                  },
                },
                {
                  icon: AlertCircle,
                  label: "Penalty",
                  color: "text-[#EF4444]",
                  action: () => {
                    setTxForm({
                      employee: viewEmp._id,
                      amount: "",
                      hours: "",
                      date: new Date().toISOString().split("T")[0],
                      remark: "",
                    });
                    setTxModal("penalty");
                  },
                },
                {
                  icon: Clock,
                  label: "Overtime",
                  color: "text-[#F59E0B]",
                  action: () => {
                    setTxForm({
                      employee: viewEmp._id,
                      amount: "",
                      hours: "",
                      date: new Date().toISOString().split("T")[0],
                      remark: "",
                    });
                    setTxModal("overtime");
                  },
                },
                {
                  icon: IndianRupee,
                  label: "Pay Salary",
                  color: "text-[#00C48C]",
                  action: () => navigate("/payroll"),
                },
                {
                  icon: UserCheck,
                  label: "Leave Balance",
                  color: "text-[#FA731C]",
                  action: () => navigate("/leave"),
                },
                {
                  icon: Shield,
                  label: "Credentials",
                  color: "text-[#A855F7]",
                  action: () => navigate("/employee-credentials"),
                },
                {
                  icon: CreditCard,
                  label: "Payroll Config",
                  color: "text-[#024BAB]",
                  action: () => navigate("/payroll-settings"),
                },
                {
                  icon: Clock,
                  label: "Attendance Log",
                  color: "text-[#024BAB]",
                  action: () => navigate("/attendance"),
                },
                {
                  icon: Edit,
                  label: "Edit Profile",
                  color: "text-black",
                  action: () => {
                    setViewEmp(null);
                    openEdit(viewEmp);
                  },
                },
              ].map(({ icon: Icon, label, color, action }) => (
                <button
                  key={label}
                  onClick={action}
                  className="border-2 border-black bg-white p-4 flex flex-col items-center gap-2.5 hover:bg-[#024BAB]/5 transition-colors group"
                >
                  <Icon
                    className={cn(
                      "w-6 h-6 transition-transform group-hover:scale-110",
                      color,
                    )}
                  />
                  <span className="text-[11px] font-bold text-black text-center leading-tight">
                    {label}
                  </span>
                </button>
              ))}
            </div>

            {}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border-2 border-black bg-white">
                <div className="flex items-center gap-2 px-4 py-3 border-b-2 border-black bg-[#024BAB]/5">
                  <Phone className="w-4 h-4 text-[#024BAB]" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-black">
                    Contact Information
                  </h3>
                </div>
                <div className="p-4 space-y-2">
                  {[
                    ["Email", viewEmp.email],
                    ["Phone", viewEmp.phone || "—"],
                    ["Alt Phone", (viewEmp as any).alternatePhone || "—"],
                    ["Personal Email", (viewEmp as any).personalEmail || "—"],
                    ["Gender", viewEmp.gender || "—"],
                    [
                      "Date of Birth",
                      (viewEmp as any).dateOfBirth
                        ? formatDate((viewEmp as any).dateOfBirth)
                        : "—",
                    ],
                    ["Blood Group", (viewEmp as any).bloodGroup || "—"],
                    ["Marital Status", (viewEmp as any).maritalStatus || "—"],
                    ["Father", (viewEmp as any).fatherName || "—"],
                    ["Mother", (viewEmp as any).motherName || "—"],
                    ...((viewEmp as any).maritalStatus === "married"
                      ? [["Spouse", (viewEmp as any).spouseName || "—"]]
                      : []),
                    ["Nationality", (viewEmp as any).nationality || "—"],
                    ["Religion", (viewEmp as any).religion || "—"],
                    [
                      "Emergency Contact",
                      (viewEmp as any).emergencyContact || "—",
                    ],
                    ["Current Address", (viewEmp as any).address || "—"],
                    [
                      "Permanent Address",
                      (viewEmp as any).permanentAddress || "—",
                    ],
                    [
                      "City / State",
                      [(viewEmp as any).city, (viewEmp as any).state]
                        .filter(Boolean)
                        .join(", ") || "—",
                    ],
                    ["Pincode", (viewEmp as any).pincode || "—"],
                  ].map(([label, value]) => (
                    <div
                      key={label as string}
                      className="flex items-start justify-between gap-2 border-b border-black/10 pb-2 last:border-0 last:pb-0"
                    >
                      <span className="text-[10px] font-bold text-muted-foreground uppercase shrink-0">
                        {label}
                      </span>
                      <span className="text-xs font-bold text-black text-right capitalize">
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-2 border-black bg-white">
                <div className="flex items-center gap-2 px-4 py-3 border-b-2 border-black bg-[#024BAB]/5">
                  <CreditCard className="w-4 h-4 text-[#024BAB]" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-black">
                    Banking & Compliance
                  </h3>
                </div>
                <div className="p-4 space-y-2">
                  {[
                    ["Bank", (viewEmp as any).bankName || "—"],
                    ["Account No.", (viewEmp as any).bankAccount || "—"],
                    [
                      "Account Holder",
                      (viewEmp as any).accountHolderName || "—",
                    ],
                    ["IFSC", (viewEmp as any).ifscCode || "—"],
                    ["PAN", (viewEmp as any).panNumber || "—"],
                    ["Aadhar", (viewEmp as any).aadharNumber || "—"],
                    ["PF No.", (viewEmp as any).pfNumber || "—"],
                    ["UAN", (viewEmp as any).uanNumber || "—"],
                    ["ESIC", (viewEmp as any).esicNumber || "—"],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="flex items-start justify-between gap-2 border-b border-black/10 pb-2 last:border-0 last:pb-0"
                    >
                      <span className="text-[10px] font-bold text-muted-foreground uppercase shrink-0">
                        {label}
                      </span>
                      <span className="text-xs font-bold text-black text-right">
                        {value}
                      </span>
                    </div>
                  ))}

                  {/* Document links */}
                  {((viewEmp as any).panDoc ||
                    (viewEmp as any).aadhaarDoc ||
                    (viewEmp as any).resumeDoc) && (
                    <div className="pt-2 flex flex-wrap gap-2">
                      {(viewEmp as any).panDoc && (
                        <a
                          href={employeeAPI.getDocumentUrl(viewEmp._id, "pan")}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] font-bold border-2 border-[#024BAB] text-[#024BAB] px-2 py-1 hover:bg-[#024BAB]/10"
                        >
                          📄 PAN Doc
                        </a>
                      )}
                      {(viewEmp as any).aadhaarDoc && (
                        <a
                          href={employeeAPI.getDocumentUrl(
                            viewEmp._id,
                            "aadhaar",
                          )}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] font-bold border-2 border-[#024BAB] text-[#024BAB] px-2 py-1 hover:bg-[#024BAB]/10"
                        >
                          📄 Aadhaar Doc
                        </a>
                      )}
                      {(viewEmp as any).resumeDoc && (
                        <a
                          href={employeeAPI.getDocumentUrl(
                            viewEmp._id,
                            "resume",
                          )}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] font-bold border-2 border-[#00C48C] text-[#00C48C] px-2 py-1 hover:bg-[#00C48C]/10"
                        >
                          📄 Resume
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Professional Background */}
              {((viewEmp as any).qualification ||
                (viewEmp as any).totalExperience ||
                (viewEmp as any).previousCompany) && (
                <div className="border-2 border-black bg-white">
                  <div className="flex items-center gap-2 px-4 py-3 border-b-2 border-black bg-[#024BAB]/5">
                    <span className="text-xs font-bold uppercase tracking-wider text-black">
                      Professional Background
                    </span>
                  </div>
                  <div className="p-4 space-y-2">
                    {[
                      ["Qualification", (viewEmp as any).qualification],
                      ["Experience", (viewEmp as any).totalExperience],
                      ["Previous SportsClub", (viewEmp as any).previousCompany],
                    ]
                      .filter(([, v]) => v)
                      .map(([label, value]) => (
                        <div
                          key={label as string}
                          className="flex items-start justify-between gap-2 border-b border-black/10 pb-2 last:border-0 last:pb-0"
                        >
                          <span className="text-[10px] font-bold text-muted-foreground uppercase shrink-0">
                            {label}
                          </span>
                          <span className="text-xs font-bold text-black text-right">
                            {value}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {}
      {loanModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="border-2 border-black bg-white w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b-2 border-black">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Banknote className="w-5 h-5" /> Loan / Advance Entry
              </h3>
              <button onClick={() => setLoanModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
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
              onSubmit={async (e) => {
                e.preventDefault();
                setSavingLoan(true);
                try {
                  await loanAPI.create({
                    ...loanForm,
                    amount: parseFloat(loanForm.amount),
                    monthlyEmi: parseFloat(loanForm.monthlyEmi || "0"),
                  });
                  setActionModal({
                    show: true,
                    type: "success",
                    title: "Loan Created",
                    message: "Loan / advance entry saved successfully.",
                  });
                  setLoanModal(false);
                  load();
                } catch (err: any) {
                  setActionModal({
                    show: true,
                    type: "error",
                    title: "Error",
                    message: err.message || "Failed to create loan entry.",
                  });
                }
                setSavingLoan(false);
              }}
              className="p-5 space-y-4"
            >
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-black mb-1">
                  Type
                </label>
                <select
                  value={loanForm.type}
                  onChange={(e) =>
                    setLoanForm({ ...loanForm, type: e.target.value })
                  }
                  className="w-full border-2 border-black px-3 py-2 text-sm font-medium bg-white outline-none"
                >
                  <option value="loan">Loan</option>
                  <option value="advance">Salary Advance</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-black mb-1">
                  Amount (₹)
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={loanForm.amount}
                  onChange={(e) =>
                    setLoanForm({ ...loanForm, amount: e.target.value })
                  }
                  className="w-full border-2 border-black px-3 py-2 text-sm font-medium bg-white outline-none"
                  placeholder="e.g. 10000"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-black mb-1">
                  Monthly EMI (₹)
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={loanForm.monthlyEmi}
                  onChange={(e) =>
                    setLoanForm({ ...loanForm, monthlyEmi: e.target.value })
                  }
                  className="w-full border-2 border-black px-3 py-2 text-sm font-medium bg-white outline-none"
                  placeholder="e.g. 1000"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-black mb-1">
                  Reason
                </label>
                <input
                  type="text"
                  value={loanForm.reason}
                  onChange={(e) =>
                    setLoanForm({ ...loanForm, reason: e.target.value })
                  }
                  className="w-full border-2 border-black px-3 py-2 text-sm font-medium bg-white outline-none"
                  placeholder="Medical, home, personal..."
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={savingLoan}
                  className="flex-1 bg-[#FA731C] text-white border-2 border-black py-2.5 text-sm font-bold disabled:opacity-50"
                >
                  {savingLoan ? "Saving..." : "Create Loan Entry"}
                </button>
                <button
                  type="button"
                  onClick={() => setLoanModal(false)}
                  className="flex-1 border-2 border-black py-2.5 text-sm font-bold bg-white"
                >
                  Cancel
                </button>
              </div>
            </form>
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
      {}
      {txModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="border-2 border-black bg-white w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b-2 border-black">
              <h3 className="font-bold text-lg flex items-center gap-2">
                {txModal === "allowance" ? (
                  <>
                    <TrendingUp className="w-5 h-5 text-[#024BAB]" /> Allowance
                    / Bonus
                  </>
                ) : txModal === "overtime" ? (
                  <>
                    <Clock className="w-5 h-5 text-[#F59E0B]" /> Overtime
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-5 h-5 text-[#EF4444]" /> Penalty
                  </>
                )}
              </h3>
              <button onClick={() => setTxModal(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
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
              onSubmit={async (e) => {
                e.preventDefault();
                setSavingTx(true);
                try {
                  const payload: Record<string, unknown> = {
                    employee: txForm.employee,
                    type: txModal,
                    date: txForm.date,
                    remark: txForm.remark,
                  };
                  if (txModal === "overtime") {
                    payload.hours = parseFloat(txForm.hours);
                  } else {
                    payload.amount = parseFloat(txForm.amount);
                  }
                  await transactionAPI.create(payload);
                  setTxModal(null);
                  const label =
                    txModal === "allowance"
                      ? "Allowance/Bonus"
                      : txModal === "overtime"
                        ? "Overtime"
                        : "Penalty";
                  const detail =
                    txModal === "overtime"
                      ? `${txForm.hours} hrs`
                      : `₹${txForm.amount}`;
                  setActionModal({
                    show: true,
                    type: "success",
                    title: `${label} Added`,
                    message: `${label} of ${detail} saved successfully.`,
                  });
                } catch (err: any) {
                  setActionModal({
                    show: true,
                    type: "error",
                    title: "Error",
                    message: err.message || "Failed to save",
                  });
                }
                setSavingTx(false);
              }}
              className="p-5 space-y-4"
            >
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-black mb-1">
                  Date
                </label>
                <input
                  type="date"
                  required
                  value={txForm.date}
                  onChange={(e) =>
                    setTxForm({ ...txForm, date: e.target.value })
                  }
                  className="w-full border-2 border-black px-3 py-2 text-sm font-medium bg-white outline-none"
                />
              </div>
              {txModal === "overtime" ? (
                <>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-black mb-1">
                      Overtime Hours
                    </label>
                    <input
                      type="number"
                      required
                      min="0.5"
                      step="0.5"
                      value={txForm.hours}
                      onChange={(e) =>
                        setTxForm({ ...txForm, hours: e.target.value })
                      }
                      className="w-full border-2 border-black px-3 py-2 text-sm font-medium bg-white outline-none"
                      placeholder="e.g. 2.5"
                    />
                  </div>
                  {txForm.hours && parseFloat(txForm.hours) > 0 ? (
                    <div className="bg-amber-50 border-2 border-amber-400 px-3 py-2 text-sm font-bold text-amber-800">
                      OT amount auto-calculated on payroll run: dailyRate ÷
                      shiftHours × {parseFloat(txForm.hours)}h
                    </div>
                  ) : null}
                </>
              ) : (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-black mb-1">
                    Amount (₹)
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={txForm.amount}
                    onChange={(e) =>
                      setTxForm({ ...txForm, amount: e.target.value })
                    }
                    className="w-full border-2 border-black px-3 py-2 text-sm font-medium bg-white outline-none"
                    placeholder="e.g. 500"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-black mb-1">
                  {txModal === "allowance"
                    ? "Remark (TA, DA, Incentive, etc.)"
                    : txModal === "overtime"
                      ? "Remark"
                      : "Reason"}
                </label>
                <input
                  type="text"
                  required
                  value={txForm.remark}
                  onChange={(e) =>
                    setTxForm({ ...txForm, remark: e.target.value })
                  }
                  className="w-full border-2 border-black px-3 py-2 text-sm font-medium bg-white outline-none"
                  placeholder={
                    txModal === "allowance"
                      ? "e.g. Travel allowance, Diwali bonus"
                      : txModal === "overtime"
                        ? "e.g. Project deadline"
                        : "e.g. Late coming, misconduct"
                  }
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={savingTx}
                  className={`flex-1 text-white border-2 border-black py-2.5 text-sm font-bold disabled:opacity-50 ${
                    txModal === "allowance"
                      ? "bg-[#024BAB]"
                      : txModal === "overtime"
                        ? "bg-[#F59E0B]"
                        : "bg-[#EF4444]"
                  }`}
                >
                  {savingTx
                    ? "Saving..."
                    : txModal === "allowance"
                      ? "Add Allowance"
                      : txModal === "overtime"
                        ? "Add Overtime"
                        : "Add Penalty"}
                </button>
                <button
                  type="button"
                  onClick={() => setTxModal(null)}
                  className="flex-1 border-2 border-black py-2.5 text-sm font-bold bg-white"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ── EXCEL IMPORT MODAL ─────────────────────────────────────── */}
      {importModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white border-2 border-black w-full max-w-2xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b-2 border-black shrink-0">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-[#024BAB]" />
                <h2 className="font-bold text-lg text-black">
                  {importStep === "guide" && "Import Employees via Excel"}
                  {importStep === "preview" &&
                    `Preview — ${importRows.length} row${importRows.length !== 1 ? "s" : ""} found`}
                  {importStep === "result" && "Import Complete"}
                </h2>
              </div>
              <button onClick={closeImportModal}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-5 space-y-5">
              {/* ── STEP 1: Guide ── */}
              {importStep === "guide" && (
                <>
                  <div className="bg-[#F0F6FF] border-2 border-[#024BAB] p-4 text-sm text-[#024BAB] font-medium">
                    Prepare your Excel file with the columns listed below.
                    Download the template to get started instantly.
                  </div>

                  <div className="border-2 border-black overflow-hidden">
                    <div className="grid grid-cols-[1fr_80px_1fr] bg-[#024BAB] text-white text-xs font-bold uppercase px-3 py-2">
                      <span>Column Header (exact)</span>
                      <span>Required</span>
                      <span>Example Value</span>
                    </div>
                    {IMPORT_HEADERS.map((h) => (
                      <div
                        key={h.key}
                        className="grid grid-cols-[1fr_80px_1fr] px-3 py-2 border-t border-black/10 text-sm hover:bg-gray-50"
                      >
                        <span className="font-bold text-black">{h.label}</span>
                        <span
                          className={cn(
                            "text-xs font-bold",
                            h.required ? "text-[#EF4444]" : "text-gray-400",
                          )}
                        >
                          {h.required ? "Yes" : "No"}
                        </span>
                        <span className="text-muted-foreground font-mono text-xs">
                          {h.example}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="bg-amber-50 border-2 border-amber-400 p-3 text-xs font-medium text-amber-800 space-y-1">
                    <p className="font-bold">Notes:</p>
                    <p>
                      • <strong>Join Date</strong> and{" "}
                      <strong>Date of Birth</strong> must be in{" "}
                      <strong>YYYY-MM-DD</strong> format.
                    </p>
                    <p>
                      • <strong>Employment Type</strong> must be one of:{" "}
                      <code>full_time</code>, <code>part_time</code>,{" "}
                      <code>contract</code>, <code>intern</code>.
                    </p>
                    <p>
                      • <strong>Department</strong> and{" "}
                      <strong>Shift Name</strong> must exactly match names
                      already created in NestSports.
                    </p>
                    <p>
                      • <strong>Gender</strong> must be one of:{" "}
                      <code>male</code>, <code>female</code>, <code>other</code>
                      .
                    </p>
                    <p>
                      • If <strong>Password</strong> is blank, a random password
                      is auto-generated.
                    </p>
                    <p>
                      • Maximum <strong>200 employees</strong> per import.
                    </p>
                  </div>
                </>
              )}

              {/* ── STEP 2: Preview ── */}
              {importStep === "preview" && (
                <>
                  {importRows.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No data rows found in the file.
                    </p>
                  ) : (
                    <div className="border-2 border-black overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-[#024BAB]/5 border-b-2 border-black">
                            <th className="px-3 py-2 text-left font-bold">#</th>
                            <th className="px-3 py-2 text-left font-bold">
                              Name
                            </th>
                            <th className="px-3 py-2 text-left font-bold">
                              Email
                            </th>
                            <th className="px-3 py-2 text-left font-bold">
                              Designation
                            </th>
                            <th className="px-3 py-2 text-left font-bold">
                              Department
                            </th>
                            <th className="px-3 py-2 text-left font-bold">
                              Join Date
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {importRows.map((r, i) => (
                            <tr
                              key={i}
                              className="border-t border-black/10 hover:bg-gray-50"
                            >
                              <td className="px-3 py-2 text-muted-foreground">
                                {i + 1}
                              </td>
                              <td className="px-3 py-2 font-medium">
                                {r.firstName} {r.lastName}
                              </td>
                              <td className="px-3 py-2 text-muted-foreground">
                                {r.email}
                              </td>
                              <td className="px-3 py-2">{r.designation}</td>
                              <td className="px-3 py-2">
                                {r.department || "—"}
                              </td>
                              <td className="px-3 py-2">{r.joinDate}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}

              {/* ── STEP 3: Result ── */}
              {importStep === "result" && importResult && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="border-2 border-[#00C48C] bg-[#00C48C]/10 p-4 text-center">
                      <p className="text-3xl font-bold text-[#00C48C]">
                        {importResult.imported}
                      </p>
                      <p className="text-xs font-bold text-[#00C48C] mt-1">
                        Successfully Imported
                      </p>
                    </div>
                    <div className="border-2 border-[#EF4444] bg-[#EF4444]/10 p-4 text-center">
                      <p className="text-3xl font-bold text-[#EF4444]">
                        {importResult.failed}
                      </p>
                      <p className="text-xs font-bold text-[#EF4444] mt-1">
                        Failed
                      </p>
                    </div>
                  </div>

                  {importResult.failed > 0 && (
                    <div className="border-2 border-black overflow-hidden">
                      <div className="bg-[#EF4444] text-white text-xs font-bold px-3 py-2">
                        Failed Rows
                      </div>
                      {importResult.results
                        .filter((r) => r.status === "error")
                        .map((r) => (
                          <div
                            key={r.row}
                            className="flex items-start gap-3 px-3 py-2 border-t border-black/10 text-sm"
                          >
                            <span className="font-bold text-[#EF4444] shrink-0">
                              Row {r.row}
                            </span>
                            <span className="text-muted-foreground">
                              {r.message}
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer actions */}
            <div className="px-5 py-4 border-t-2 border-black flex items-center gap-3 shrink-0">
              {importStep === "guide" && (
                <>
                  <button
                    onClick={downloadTemplate}
                    className="border-2 border-black px-4 py-2 text-sm font-bold flex items-center gap-1.5 hover:bg-gray-50"
                  >
                    <Download className="w-4 h-4" /> Download Template
                  </button>
                  <label className="border-2 border-black bg-[#024BAB] text-white px-4 py-2 text-sm font-bold flex items-center gap-1.5 cursor-pointer hover:bg-[#01368A]">
                    <Upload className="w-4 h-4" /> Choose Excel File
                    <input
                      ref={importFileRef}
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={handleImportFile}
                    />
                  </label>
                  <button
                    onClick={closeImportModal}
                    className="ml-auto text-sm font-bold text-muted-foreground hover:text-black"
                  >
                    Cancel
                  </button>
                </>
              )}

              {importStep === "preview" && (
                <>
                  <button
                    onClick={() => setImportStep("guide")}
                    className="border-2 border-black px-4 py-2 text-sm font-bold hover:bg-gray-50"
                  >
                    ← Back
                  </button>
                  <button
                    onClick={handleImport}
                    disabled={importing || importRows.length === 0}
                    className="border-2 border-black bg-[#024BAB] text-white px-4 py-2 text-sm font-bold flex items-center gap-2 hover:bg-[#01368A] disabled:opacity-50"
                  >
                    {importing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Importing…
                      </>
                    ) : (
                      `Import ${importRows.length} Employee${importRows.length !== 1 ? "s" : ""}`
                    )}
                  </button>
                  <button
                    onClick={closeImportModal}
                    className="ml-auto text-sm font-bold text-muted-foreground hover:text-black"
                  >
                    Cancel
                  </button>
                </>
              )}

              {importStep === "result" && (
                <button
                  onClick={closeImportModal}
                  className="border-2 border-black bg-[#024BAB] text-white px-4 py-2 text-sm font-bold hover:bg-[#01368A]"
                >
                  Done
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
