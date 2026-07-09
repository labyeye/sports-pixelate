import { useState, useEffect, useRef, useCallback } from "react";
import nesthrlogo from "../../assets/nesthr.png";
import { AppLayout } from "@/components/layout/AppLayout";
import { DocumentsTabPane } from "@/components/ess/DocumentsTabPane";
import { AssetsTabPane } from "@/components/ess/AssetsTabPane";
import { ProfileDetailsTabPane } from "@/components/ess/ProfileDetailsTabPane";
import { AttendanceCorrectionPane } from "@/components/ess/AttendanceCorrectionPane";
import { useAuth } from "@/contexts/AuthContext";
import {
  employeeAPI,
  attendanceAPI,
  leaveAPI,
  payrollAPI,
  performanceAPI,
  authAPI,
  dashboardAPI,
  assetAPI,
  announcementAPI,
  attendanceCorrectionAPI,
  documentAPI,
  supportAPI,
} from "@/services/api";
import { cn, formatDate, formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  AlertCircle,
  Loader2,
  Star,
  Camera,
  Eye,
  EyeOff,
  Save,
  Lock,
  User,
  Phone,
  Mail,
  MapPin,
  Briefcase,
  Calendar,
  Clock,
  IndianRupee,
  Shield,
  CreditCard,
  TrendingUp,
  Edit2,
  X,
  ChevronRight,
  Upload,
  Plus,
  Send,
  FolderOpen,
  Cpu,
  Gift,
  Award,
  BookOpen,
  Heart,
  Megaphone,
  UserCheck,
  RefreshCw,
  FileText,
  Check,
} from "lucide-react";

interface AttendanceStats {
  presentDays: number;
  absentDays: number;
  totalDays: number;
  attendancePercentage: number;
}

function InfoRow({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value?: string | null;
  icon?: any;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-black/8 last:border-0">
      {Icon && <Icon className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">
          {label}
        </p>
        <p className="text-sm font-semibold text-black truncate">
          {value || "—"}
        </p>
      </div>
    </div>
  );
}

type Tab =
  | "overview"
  | "attendance"
  | "leaves"
  | "payroll"
  | "documents"
  | "assets"
  | "settings";

const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: "overview", label: "Overview", icon: User },
  { id: "attendance", label: "Attendance", icon: Clock },
  { id: "leaves", label: "Leaves", icon: Calendar },
  { id: "payroll", label: "Payroll", icon: IndianRupee },
  { id: "documents", label: "Documents", icon: FolderOpen },
  { id: "assets", label: "Assets", icon: Cpu },
  { id: "settings", label: "Settings", icon: Lock },
];

const leaveStatusColor: Record<string, string> = {
  approved: "bg-[#00C48C]/10 text-[#00C48C] border-[#00C48C]",
  pending: "bg-[#FA731C]/10 text-[#FA731C] border-[#FA731C]",
  rejected: "bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]",
  cancelled: "bg-gray-100 text-gray-500 border-gray-300",
};

const payrollStatusColor: Record<string, string> = {
  paid: "bg-[#00C48C]/10 text-[#00C48C] border-[#00C48C]",
  processed: "bg-[#024BAB]/10 text-[#024BAB] border-[#024BAB]",
  draft: "bg-gray-100 text-gray-500 border-gray-300",
};

const attendanceStatusColor: Record<string, string> = {
  present: "bg-[#00C48C]/10 text-[#00C48C] border-[#00C48C]",
  absent: "bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]",
  late: "bg-[#FA731C]/10 text-[#FA731C] border-[#FA731C]",
  on_leave: "bg-[#024BAB]/10 text-[#024BAB] border-[#024BAB]",
  holiday: "bg-[#A855F7]/10 text-[#A855F7] border-[#A855F7]",
  weekend: "bg-gray-100 text-gray-500 border-gray-300",
};

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export default function EmployeeDashboard() {
  const { user, updateUser } = useAuth();
  const { toast } = useToast();

  const [employee, setEmployee] = useState<any>(null);
  const [attendance, setAttendance] = useState<AttendanceStats | null>(null);
  const [recentAttendance, setRecentAttendance] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [payrolls, setPayrolls] = useState<any[]>([]);
  const [performance, setPerformance] = useState<any[]>([]);
  const [essStats, setEssStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");

  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" });
  const [showPw, setShowPw] = useState({
    current: false,
    next: false,
    confirm: false,
  });
  const [pwSaving, setPwSaving] = useState(false);

  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    leaveType: "casual",
    startDate: "",
    endDate: "",
    reason: "",
    isHalfDay: false,
    halfDayType: "first_half",
    startHour: "",
    endHour: "",
  });
  const [leaveSaving, setLeaveSaving] = useState(false);

  const photoInputRef = useRef<HTMLInputElement>(null);

  const loadEmployeeData = useCallback(async () => {
    if (!user?.email) return;
    setLoading(true);
    try {
      const empRes = await employeeAPI.getAll({ search: user.email });
      if (empRes.success && empRes.data.length > 0) {
        const emp = empRes.data[0];
        setEmployee(emp);
        setEditName(user.name || "");
        setEditPhone(user.phone || "");

        await Promise.allSettled([
          attendanceAPI
            .getAll({ employeeId: emp._id, limit: "60" })
            .then((r) => {
              if (r.success) {
                const records: any[] = r.data;
                setRecentAttendance(records.slice(0, 14));
                const present = records.filter((x) =>
                  ["present", "late"].includes(x.status),
                ).length;
                const absent = records.filter(
                  (x) => x.status === "absent",
                ).length;
                const total = records.length;
                setAttendance({
                  presentDays: present,
                  absentDays: absent,
                  totalDays: total,
                  attendancePercentage: total ? (present / total) * 100 : 0,
                });
              }
            })
            .catch(() => {}),
          leaveAPI
            .getAll({ employeeId: emp._id })
            .then((r) => r.success && setLeaves(r.data))
            .catch(() => {}),
          payrollAPI
            .getMy({ limit: "6" })
            .then((r) => r.success && setPayrolls(r.data))
            .catch(() => {}),
          performanceAPI
            .getAll({ employeeId: emp._id })
            .then((r) => r.success && setPerformance(r.data))
            .catch(() => {}),
          dashboardAPI
            .getEmployeeStats()
            .then((r) => r.success && setEssStats(r.data))
            .catch(() => {}),
        ]);
      }
    } catch (err) {
      console.error("Error loading employee data:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.email, user?.name, user?.phone]);

  useEffect(() => {
    loadEmployeeData();
  }, [loadEmployeeData]);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please choose an image under 3 MB",
        variant: "destructive",
      });
      return;
    }
    setPhotoUploading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      let finalBase64 = base64;
      if (base64.length > 500_000) {
        const img = new Image();
        img.src = base64;
        await new Promise<void>((r) => {
          img.onload = () => r();
        });
        const canvas = document.createElement("canvas");
        const MAX = 400;
        const scale = Math.min(MAX / img.width, MAX / img.height, 1);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        canvas
          .getContext("2d")!
          .drawImage(img, 0, 0, canvas.width, canvas.height);
        finalBase64 = canvas.toDataURL("image/jpeg", 0.8);
      }
      await authAPI.updateProfile({ avatar: finalBase64 });
      updateUser({ avatar: finalBase64 });
      toast({
        title: "Photo updated",
        description: "Your profile photo has been saved.",
      });
    } catch (err: any) {
      toast({
        title: "Upload failed",
        description: err.message || "Could not save photo",
        variant: "destructive",
      });
    } finally {
      setPhotoUploading(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  };

  const handleRemovePhoto = async () => {
    setSaving(true);
    try {
      await authAPI.updateProfile({ avatar: "" });
      updateUser({ avatar: "" });
      toast({ title: "Photo removed" });
    } catch (err: any) {
      toast({
        title: "Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const res = (await authAPI.updateProfile({
        name: editName.trim(),
        phone: editPhone.trim(),
      })) as any;
      updateUser({
        name: res.data?.name || editName.trim(),
        phone: res.data?.phone || editPhone.trim(),
      });
      toast({ title: "Profile saved", description: "Name and phone updated." });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to save profile",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!pwForm.current || !pwForm.next) return;
    if (pwForm.next !== pwForm.confirm) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    setPwSaving(true);
    try {
      await authAPI.updateProfile({
        currentPassword: pwForm.current,
        password: pwForm.next,
      });
      setPwForm({ current: "", next: "", confirm: "" });
      toast({
        title: "Password changed",
        description: "Your new password is active.",
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to change password",
        variant: "destructive",
      });
    } finally {
      setPwSaving(false);
    }
  };

  const calcDays = (start: string, end: string, isHalf: boolean) => {
    if (!start || !end) return 0;
    const s = new Date(start);
    const e = new Date(end);
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || s > e) return 0;
    const diff = Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
    return isHalf ? 0.5 : diff;
  };

  const handleRequestLeave = async () => {
    const {
      leaveType,
      startDate,
      endDate,
      reason,
      isHalfDay,
      halfDayType,
      startHour,
      endHour,
    } = leaveForm;
    if (!startDate || !endDate || !reason.trim()) {
      toast({ title: "Please fill all fields", variant: "destructive" });
      return;
    }
    let days = calcDays(startDate, endDate, isHalfDay);
    if (leaveType === "hourly") {
      days = 0.125;
    }
    if (days <= 0) {
      toast({ title: "Invalid date range", variant: "destructive" });
      return;
    }
    setLeaveSaving(true);
    try {
      const res = await leaveAPI.create({
        leaveType,
        startDate,
        endDate,
        days,
        reason: reason.trim(),
        isHalfDay,
        halfDayType,
        startHour: leaveType === "hourly" ? startHour : undefined,
        endHour: leaveType === "hourly" ? endHour : undefined,
      });
      if (res.success) {
        toast({
          title: "Leave requested",
          description: "Your request has been submitted for approval.",
        });
        setShowLeaveModal(false);
        setLeaveForm({
          leaveType: "casual",
          startDate: "",
          endDate: "",
          reason: "",
          isHalfDay: false,
          halfDayType: "first_half",
          startHour: "",
          endHour: "",
        });
        const emp = employee;
        leaveAPI
          .getAll({ employeeId: emp._id })
          .then((r: any) => r.success && setLeaves(r.data))
          .catch(() => {});
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to submit leave",
        variant: "destructive",
      });
    } finally {
      setLeaveSaving(false);
    }
  };

  if (loading) {
    return (
      <AppLayout title="My Profile">
        <div className="flex h-[80vh] items-center justify-center">
          <img src={nesthrlogo} alt="NestSports" className="h-16 w-auto" />
        </div>
      </AppLayout>
    );
  }

  if (!employee) {
    return (
      <AppLayout title="My Profile">
        <div className="border-2 border-black bg-white p-12 flex flex-col items-center justify-center">
          <AlertCircle className="w-12 h-12 text-muted-foreground/30 mb-3" />
          <p className="font-bold text-black">No employee record found</p>
          <p className="text-sm text-muted-foreground mt-1">
            Contact your HR manager to link your account
          </p>
        </div>
      </AppLayout>
    );
  }

  const avatarSrc = user?.avatar || employee.avatar || "";

  return (
    <AppLayout title="My Profile">
      {}
      <div className="border-2 border-black mb-6 overflow-hidden">
        {}
        <div className="bg-[#024BAB] h-28 relative">
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg,#fff 0,#fff 1px,transparent 0,transparent 50%)",
              backgroundSize: "12px 12px",
            }}
          />
        </div>

        {}
        <div className="bg-white px-6 pb-5">
          <div className="flex flex-col sm:flex-row gap-4 -mt-10">
            {}
            <div className="relative shrink-0 group">
              <div className="w-32 h-32 border-4 border-white bg-[#024BAB] flex items-center justify-center text-2xl font-bold text-white overflow-hidden shadow-lg">
                {avatarSrc ? (
                  <img
                    src={avatarSrc}
                    alt="avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{employee.firstName?.[0]?.toUpperCase()}</span>
                )}
              </div>
              {}
              <button
                onClick={() => photoInputRef.current?.click()}
                disabled={photoUploading}
                className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                title="Change photo"
              >
                {photoUploading ? (
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                ) : (
                  <Camera className="w-5 h-5 text-white" />
                )}
              </button>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoChange}
              />
            </div>

            {}
            <div className="flex-1 min-w-0 pb-2 mt-12">
              {}
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-display font-bold text-black">
                  {employee.firstName} {employee.lastName}
                </h1>
                <span
                  className={cn(
                    "text-[10px] font-bold uppercase border-2 px-2 py-0.5",
                    employee.status === "active"
                      ? "bg-[#00C48C]/10 text-[#00C48C] border-[#00C48C]"
                      : "bg-gray-100 text-gray-500 border-gray-300",
                  )}
                >
                  {employee.status}
                </span>
                <div className="ml-auto flex flex-wrap gap-2">
                  {[
                    {
                      label: "Monthly CTC",
                      value: formatCurrency(
                        Math.round((employee.salary || 0) / 12),
                      ),
                      color: "text-[#024BAB]",
                      icon: IndianRupee,
                    },
                    {
                      label: "Joined",
                      value: formatDate(employee.joinDate),
                      color: "text-black",
                      icon: Calendar,
                    },
                    {
                      label: "Attendance",
                      value: attendance
                        ? `${attendance.attendancePercentage.toFixed(0)}%`
                        : "—",
                      color: "text-[#00C48C]",
                      icon: Clock,
                    },
                  ].map(({ label, value, color, icon: Icon }) => (
                    <div
                      key={label}
                      className="border-2 border-black px-3 py-1.5 text-center bg-white min-w-[90px] flex flex-col items-center gap-0.5"
                    >
                      <Icon className={cn("w-3.5 h-3.5 mt-0.5", color)} />
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {label}
                      </p>
                      <p className={cn("text-sm font-bold", color)}>{value}</p>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-sm text-muted-foreground font-medium mt-1">
                {employee.designation} · {employee.department?.name || "—"}
              </p>
              <p className="text-xs font-mono text-gray-400 mt-0.5">
                {employee.employeeId}
              </p>
            </div>
          </div>
        </div>
      </div>

      {}
      <div className="flex border-2 border-black bg-white mb-6 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all border-r-2 border-black last:border-r-0 flex-1 justify-center",
              tab === t.id
                ? "bg-[#024BAB] text-white"
                : "bg-white text-black hover:bg-[#024BAB]/5",
            )}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {}
      {tab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {}
          <div className="space-y-5">
            <div className="border-2 border-black bg-white overflow-hidden">
              <div className="px-4 py-3 bg-[#024BAB] flex items-center gap-2">
                <User className="w-4 h-4 text-white" />
                <p className="text-xs font-bold uppercase tracking-wider text-white">
                  Personal Information
                </p>
              </div>
              <div className="p-4 space-y-0.5">
                <InfoRow
                  label="Full Name"
                  value={`${employee.firstName} ${employee.lastName}`}
                  icon={User}
                />
                <InfoRow label="Email" value={employee.email} icon={Mail} />
                <InfoRow label="Phone" value={employee.phone} icon={Phone} />
                <InfoRow
                  label="Gender"
                  value={
                    employee.gender
                      ? employee.gender.charAt(0).toUpperCase() +
                        employee.gender.slice(1)
                      : null
                  }
                />
                <InfoRow
                  label="Date of Birth"
                  value={
                    employee.dateOfBirth
                      ? formatDate(employee.dateOfBirth)
                      : null
                  }
                  icon={Calendar}
                />
                <InfoRow
                  label="Emergency Contact"
                  value={employee.emergencyContact}
                  icon={Phone}
                />
              </div>
            </div>

            <div className="border-2 border-black bg-white overflow-hidden">
              <div className="px-4 py-3 bg-[#024BAB] flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-white" />
                <p className="text-xs font-bold uppercase tracking-wider text-white">
                  Work Information
                </p>
              </div>
              <div className="p-4 space-y-0.5">
                <InfoRow label="Employee ID" value={employee.employeeId} />
                <InfoRow
                  label="Department"
                  value={employee.department?.name}
                  icon={MapPin}
                />
                <InfoRow
                  label="Designation"
                  value={employee.designation}
                  icon={Briefcase}
                />
                <InfoRow
                  label="Employment Type"
                  value={employee.employmentType?.replace(/_/g, " ")}
                />
                <InfoRow
                  label="Join Date"
                  value={formatDate(employee.joinDate)}
                  icon={Calendar}
                />
                {employee.reportingTo && (
                  <InfoRow
                    label="Reports To"
                    value={`${employee.reportingTo.firstName} ${employee.reportingTo.lastName}`}
                    icon={User}
                  />
                )}
              </div>
            </div>

            <div className="border-2 border-black bg-white overflow-hidden">
              <div className="px-4 py-3 bg-[#024BAB] flex items-center gap-2">
                <Shield className="w-4 h-4 text-white" />
                <p className="text-xs font-bold uppercase tracking-wider text-white">
                  Address & Documents
                </p>
              </div>
              <div className="p-4 space-y-0.5">
                <InfoRow
                  label="Address"
                  value={employee.address}
                  icon={MapPin}
                />
                <InfoRow label="PAN Number" value={employee.panNumber} />
                {employee.bankAccount && (
                  <InfoRow
                    label="Bank Account"
                    value={`****${employee.bankAccount.slice(-4)}`}
                    icon={CreditCard}
                  />
                )}
                {employee.ifscCode && (
                  <InfoRow label="IFSC Code" value={employee.ifscCode} />
                )}
              </div>
            </div>
          </div>

          {}
          <div className="lg:col-span-2 space-y-5">
            {/* ESS Overview Alerts & Cards */}
            {essStats && (
              <div className="space-y-4">
                {/* Birthday & Anniversary Banners */}
                {(essStats.birthdayWishes?.isTodayUserBirthday ||
                  (essStats.birthdayWishes?.todayBirthdays &&
                    essStats.birthdayWishes.todayBirthdays.length > 0) ||
                  essStats.workAnniversary?.isTodayUserAnniversary ||
                  (essStats.workAnniversary?.todayAnniversaries &&
                    essStats.workAnniversary.todayAnniversaries.length >
                      0)) && (
                  <div className="border-2 border-black bg-[#F8FAFF] p-4 space-y-2">
                    {essStats.birthdayWishes?.isTodayUserBirthday && (
                      <div className="flex items-center gap-3">
                        <Gift className="w-8 h-8 text-pink-500 animate-bounce" />
                        <div>
                          <p className="font-bold text-lg text-black">
                            Happy Birthday to You! 🎂
                          </p>
                          <p className="text-xs text-muted-foreground">
                            The NestSports family wishes you a fantastic day ahead
                            filled with joy and success!
                          </p>
                        </div>
                      </div>
                    )}
                    {essStats.birthdayWishes?.todayBirthdays?.map((b: any) => (
                      <div key={b._id} className="flex items-center gap-3 py-1">
                        <Gift className="w-5 h-5 text-purple-500" />
                        <p className="text-sm font-semibold text-black">
                          It is{" "}
                          <span className="underline">
                            {b.firstName} {b.lastName}
                          </span>
                          's birthday today! Send your wishes! 🎉
                        </p>
                      </div>
                    ))}
                    {essStats.workAnniversary?.isTodayUserAnniversary && (
                      <div className="flex items-center gap-3 border-t border-black/10 pt-2">
                        <Award className="w-8 h-8 text-yellow-500 animate-pulse" />
                        <div>
                          <p className="font-bold text-lg text-black">
                            Happy Work Anniversary! 🎖️
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Thank you for your dedication and contribution to
                            the company!
                          </p>
                        </div>
                      </div>
                    )}
                    {essStats.workAnniversary?.todayAnniversaries?.map(
                      (a: any) => (
                        <div
                          key={a._id}
                          className="flex items-center gap-3 py-1 border-t border-black/10 pt-2"
                        >
                          <Award className="w-5 h-5 text-yellow-600" />
                          <p className="text-sm font-semibold text-black">
                            Happy Work Anniversary to{" "}
                            <span className="font-bold">
                              {a.firstName} {a.lastName}
                            </span>
                            ! 👏
                          </p>
                        </div>
                      ),
                    )}
                  </div>
                )}

                {/* Shift, Pending Approvals, Pending Salary Info */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Shift Info */}
                  <div className="border-2 border-black bg-white p-4 flex items-center gap-3">
                    <Clock className="w-8 h-8 text-[#024BAB]" />
                    <div>
                      <p className="text-[10px] font-bold uppercase text-muted-foreground">
                        Today's Shift
                      </p>
                      <p className="text-sm font-bold text-black">
                        {essStats.todayShift?.name || "General"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {essStats.todayShift?.startTime} -{" "}
                        {essStats.todayShift?.endTime}
                      </p>
                    </div>
                  </div>

                  {/* Pending Approvals */}
                  <div className="border-2 border-black bg-white p-4 flex items-center gap-3">
                    <UserCheck className="w-8 h-8 text-[#FA731C]" />
                    <div>
                      <p className="text-[10px] font-bold uppercase text-muted-foreground">
                        Approvals
                      </p>
                      <p className="text-sm font-bold text-black">
                        {essStats.pendingApprovalsCount > 0
                          ? `${essStats.pendingApprovalsCount} Pending`
                          : "All Clean"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Requires review
                      </p>
                    </div>
                  </div>

                  {/* Pending Salary */}
                  <div className="border-2 border-black bg-white p-4 flex items-center gap-3">
                    <IndianRupee className="w-8 h-8 text-[#00C48C]" />
                    <div>
                      <p className="text-[10px] font-bold uppercase text-muted-foreground">
                        Pending Salary
                      </p>
                      <p className="text-sm font-bold text-black">
                        {essStats.pendingSalary?.length > 0
                          ? `${essStats.pendingSalary.length} Months`
                          : "Paid"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Unpaid payslips
                      </p>
                    </div>
                  </div>
                </div>

                {/* Announcements Card */}
                {essStats.announcements?.length > 0 && (
                  <div className="border-2 border-black bg-white overflow-hidden">
                    <div className="px-4 py-3 bg-[#024BAB] flex items-center gap-2">
                      <Megaphone className="w-4 h-4 text-white" />
                      <p className="text-xs font-bold uppercase tracking-wider text-white">
                        Company Announcements
                      </p>
                    </div>
                    <div className="p-4 space-y-3">
                      {essStats.announcements.map((a: any) => (
                        <div
                          key={a._id}
                          className="border-b border-black/5 last:border-b-0 pb-3 last:pb-0"
                        >
                          <div className="flex items-center justify-between">
                            <h4 className="font-bold text-sm text-black">
                              {a.title}
                            </h4>
                            <span className="text-[10px] font-mono text-muted-foreground">
                              {new Date(a.date).toLocaleDateString("en-IN")}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
                            {a.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {}
            {attendance && (
              <div className="grid grid-cols-3 gap-4">
                {[
                  {
                    label: "Present Days",
                    value: attendance.presentDays,
                    color: "bg-[#00C48C]",
                    text: "text-[#00C48C]",
                  },
                  {
                    label: "Absent Days",
                    value: attendance.absentDays,
                    color: "bg-[#EF4444]",
                    text: "text-[#EF4444]",
                  },
                  {
                    label: "Attendance %",
                    value: `${attendance.attendancePercentage.toFixed(1)}%`,
                    color: "bg-[#024BAB]",
                    text: "text-[#024BAB]",
                  },
                ].map(({ label, value, color, text }) => (
                  <div
                    key={label}
                    className="border-2 border-black bg-white p-4"
                  >
                    <div className={cn("w-2 h-8 mb-3", color)} />
                    <p className="text-xs font-bold uppercase text-muted-foreground">
                      {label}
                    </p>
                    <p className={cn("text-2xl font-bold mt-1", text)}>
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {}
            {recentAttendance.length > 0 && (
              <div className="border-2 border-black bg-white overflow-hidden">
                <div className="px-4 py-3 bg-[#024BAB]/5 border-b-2 border-black flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#024BAB]" />
                  <p className="text-xs font-bold uppercase tracking-wider text-black">
                    Recent Attendance
                  </p>
                </div>
                <div className="overflow-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-black bg-[#024BAB]/5">
                        {[
                          "Date",
                          "Status",
                          "Check In",
                          "Check Out",
                          "Hours",
                        ].map((h) => (
                          <th
                            key={h}
                            className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-black"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {recentAttendance.map((rec, i) => (
                        <tr
                          key={rec._id}
                          className={cn(
                            "border-b border-black/10",
                            i % 2 !== 0 && "bg-[#F8FAFF]",
                          )}
                        >
                          <td className="px-4 py-2.5 font-medium text-black text-xs">
                            {formatDate(rec.date)}
                          </td>
                          <td className="px-4 py-2.5">
                            <span
                              className={cn(
                                "px-2 py-0.5 text-[10px] font-bold uppercase border-2",
                                attendanceStatusColor[rec.status] ||
                                  "bg-gray-100 text-gray-500 border-gray-300",
                              )}
                            >
                              {rec.status?.replace("_", " ")}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-black">
                            {rec.checkIn
                              ? new Date(rec.checkIn).toLocaleTimeString(
                                  "en-IN",
                                  { hour: "2-digit", minute: "2-digit" },
                                )
                              : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-black">
                            {rec.checkOut
                              ? new Date(rec.checkOut).toLocaleTimeString(
                                  "en-IN",
                                  { hour: "2-digit", minute: "2-digit" },
                                )
                              : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-xs font-medium text-black">
                            {rec.workHours ? `${rec.workHours}h` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {}
            {leaves.length > 0 && (
              <div className="border-2 border-black bg-white overflow-hidden">
                <div className="px-4 py-3 bg-[#024BAB]/5 border-b-2 border-black flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-[#024BAB]" />
                    <p className="text-xs font-bold uppercase tracking-wider text-black">
                      Recent Leaves
                    </p>
                  </div>
                  <button
                    onClick={() => setTab("leaves")}
                    className="text-[10px] font-bold text-[#024BAB] flex items-center gap-1"
                  >
                    View All <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
                <div className="divide-y divide-black/10">
                  {leaves.slice(0, 3).map((lv) => (
                    <div
                      key={lv._id}
                      className="flex items-center justify-between px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-bold text-black capitalize">
                          {lv.leaveType?.replace("_", " ")} Leave
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(lv.startDate)} → {formatDate(lv.endDate)}{" "}
                          · {lv.days}d
                        </p>
                      </div>
                      <span
                        className={cn(
                          "px-2 py-0.5 text-[10px] font-bold uppercase border-2",
                          leaveStatusColor[lv.status] ||
                            "bg-gray-100 text-gray-500 border-gray-300",
                        )}
                      >
                        {lv.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {}
            {performance.length > 0 && (
              <div className="border-2 border-black bg-white overflow-hidden">
                <div className="px-4 py-3 bg-[#024BAB]/5 border-b-2 border-black flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#024BAB]" />
                  <p className="text-xs font-bold uppercase tracking-wider text-black">
                    Performance Reviews
                  </p>
                </div>
                <div className="divide-y divide-black/10">
                  {performance.slice(0, 2).map((rev) => (
                    <div key={rev._id} className="px-4 py-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-bold text-black text-sm">
                            {rev.reviewPeriod}
                          </p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {rev.reviewType?.replace("_", " ")} Review
                          </p>
                        </div>
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={cn(
                                "w-4 h-4",
                                i < Math.round(rev.overallRating)
                                  ? "text-[#FA731C] fill-[#FA731C]"
                                  : "text-gray-200",
                              )}
                            />
                          ))}
                          <span className="text-xs text-muted-foreground ml-1">
                            {rev.overallRating}/5
                          </span>
                        </div>
                      </div>
                      {rev.reviewerComments && (
                        <p className="text-xs text-muted-foreground italic">
                          "{rev.reviewerComments}"
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {}
      {tab === "attendance" && (
        <div className="space-y-5">
          {attendance && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                {
                  label: "Present Days",
                  value: attendance.presentDays,
                  color: "bg-[#00C48C]",
                  text: "text-[#00C48C]",
                },
                {
                  label: "Absent Days",
                  value: attendance.absentDays,
                  color: "bg-[#EF4444]",
                  text: "text-[#EF4444]",
                },
                {
                  label: "Total Days",
                  value: attendance.totalDays,
                  color: "bg-[#024BAB]",
                  text: "text-[#024BAB]",
                },
                {
                  label: "Attendance %",
                  value: `${attendance.attendancePercentage.toFixed(1)}%`,
                  color: "bg-[#FA731C]",
                  text: "text-[#FA731C]",
                },
              ].map(({ label, value, color, text }) => (
                <div key={label} className="border-2 border-black bg-white p-4">
                  <div className={cn("w-2 h-6 mb-3", color)} />
                  <p className="text-xs font-bold uppercase text-muted-foreground">
                    {label}
                  </p>
                  <p className={cn("text-2xl font-bold mt-1", text)}>{value}</p>
                </div>
              ))}
            </div>
          )}
          <div className="border-2 border-black bg-white overflow-hidden">
            <div className="px-4 py-3 bg-[#024BAB]/5 border-b-2 border-black">
              <p className="text-xs font-bold uppercase tracking-wider text-black">
                Attendance Records
              </p>
            </div>
            {recentAttendance.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground">
                No attendance records found
              </div>
            ) : (
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-black bg-[#024BAB]/5">
                      {[
                        "Date",
                        "Status",
                        "Check In",
                        "Check Out",
                        "Hours",
                        "Method",
                      ].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recentAttendance.map((rec, i) => (
                      <tr
                        key={rec._id}
                        className={cn(
                          "border-b border-black/10",
                          i % 2 !== 0 && "bg-[#F8FAFF]",
                        )}
                      >
                        <td className="px-4 py-3 font-medium text-black text-xs">
                          {formatDate(rec.date)}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "px-2 py-0.5 text-[10px] font-bold uppercase border-2",
                              attendanceStatusColor[rec.status] ||
                                "bg-gray-100 text-gray-500 border-gray-300",
                            )}
                          >
                            {rec.status?.replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-black">
                          {rec.checkIn
                            ? new Date(rec.checkIn).toLocaleTimeString(
                                "en-IN",
                                { hour: "2-digit", minute: "2-digit" },
                              )
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-black">
                          {rec.checkOut
                            ? new Date(rec.checkOut).toLocaleTimeString(
                                "en-IN",
                                { hour: "2-digit", minute: "2-digit" },
                              )
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-xs font-medium">
                          {rec.workHours ? `${rec.workHours}h` : "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground capitalize">
                          {rec.verifyMode || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <AttendanceCorrectionPane toast={toast} />
          </div>
        </div>
      )}

      {}
      {tab === "leaves" && (
        <div className="space-y-4">
          <div className="border-2 border-black bg-white overflow-hidden">
            <div className="px-4 py-3 bg-[#024BAB]/5 border-b-2 border-black flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-black">
                Leave Records ({leaves.length})
              </p>
              <button
                onClick={() => setShowLeaveModal(true)}
                className="flex items-center gap-1.5 bg-[#024BAB] text-white border-2 border-black px-3 py-1.5 text-xs font-bold uppercase hover:bg-[#024BAB]/90 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Request Leave
              </button>
            </div>
            {leaves.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground">
                No leave records found
              </div>
            ) : (
              <div className="divide-y divide-black/10">
                {leaves.map((lv) => (
                  <div
                    key={lv._id}
                    className="flex items-start justify-between px-4 py-4"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-bold text-black capitalize">
                          {lv.leaveType?.replace("_", " ")} Leave
                        </p>
                        <span
                          className={cn(
                            "px-2 py-0.5 text-[10px] font-bold uppercase border-2",
                            leaveStatusColor[lv.status] ||
                              "bg-gray-100 text-gray-500 border-gray-300",
                          )}
                        >
                          {lv.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(lv.startDate)} → {formatDate(lv.endDate)} ·{" "}
                        {lv.days} day{lv.days > 1 ? "s" : ""}
                      </p>
                      {lv.reason && (
                        <p className="text-xs text-muted-foreground mt-0.5 italic">
                          "{lv.reason}"
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Leave Request Modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white border-2 border-black w-full max-w-lg">
            <div className="flex items-center justify-between px-5 py-4 border-b-2 border-black bg-[#024BAB]">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-white" />
                <p className="text-sm font-bold uppercase tracking-wider text-white">
                  Request Leave
                </p>
              </div>
              <button
                onClick={() => setShowLeaveModal(false)}
                className="text-white hover:text-white/70"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase mb-1.5">
                    Leave Type
                  </label>
                  <select
                    value={leaveForm.leaveType}
                    onChange={(e) =>
                      setLeaveForm((f) => ({ ...f, leaveType: e.target.value }))
                    }
                    className="w-full border-2 border-black px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#024BAB] bg-white"
                  >
                    {[
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
                    ].map((t) => (
                      <option key={t} value={t} className="capitalize">
                        {t === "wfh" ? "WFH Request" : t.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                </div>
                {leaveForm.leaveType !== "hourly" && (
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={leaveForm.isHalfDay}
                        onChange={(e) =>
                          setLeaveForm((f) => ({
                            ...f,
                            isHalfDay: e.target.checked,
                          }))
                        }
                        className="w-4 h-4 border-2 border-black accent-[#024BAB]"
                      />
                      <span className="text-xs font-bold uppercase">
                        Half Day
                      </span>
                    </label>
                  </div>
                )}
              </div>

              {leaveForm.isHalfDay && leaveForm.leaveType !== "hourly" && (
                <div>
                  <label className="block text-xs font-bold uppercase mb-1.5">
                    Half Day Type
                  </label>
                  <select
                    value={leaveForm.halfDayType}
                    onChange={(e) =>
                      setLeaveForm((f) => ({
                        ...f,
                        halfDayType: e.target.value,
                      }))
                    }
                    className="w-full border-2 border-black px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#024BAB] bg-white"
                  >
                    <option value="first_half">First Half</option>
                    <option value="second_half">Second Half</option>
                  </select>
                </div>
              )}

              {leaveForm.leaveType === "hourly" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase mb-1.5">
                      Start Hour
                    </label>
                    <input
                      type="time"
                      value={leaveForm.startHour}
                      onChange={(e) =>
                        setLeaveForm((f) => ({
                          ...f,
                          startHour: e.target.value,
                        }))
                      }
                      className="w-full border-2 border-black px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#024BAB] bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase mb-1.5">
                      End Hour
                    </label>
                    <input
                      type="time"
                      value={leaveForm.endHour}
                      onChange={(e) =>
                        setLeaveForm((f) => ({ ...f, endHour: e.target.value }))
                      }
                      className="w-full border-2 border-black px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#024BAB] bg-white"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase mb-1.5">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={leaveForm.startDate}
                    onChange={(e) =>
                      setLeaveForm((f) => ({ ...f, startDate: e.target.value }))
                    }
                    className="w-full border-2 border-black px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#024BAB]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase mb-1.5">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={leaveForm.endDate}
                    min={leaveForm.startDate}
                    onChange={(e) =>
                      setLeaveForm((f) => ({ ...f, endDate: e.target.value }))
                    }
                    className="w-full border-2 border-black px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#024BAB]"
                  />
                </div>
              </div>

              {leaveForm.startDate && leaveForm.endDate && (
                <p className="text-xs text-[#024BAB] font-bold">
                  Duration:{" "}
                  {calcDays(
                    leaveForm.startDate,
                    leaveForm.endDate,
                    leaveForm.isHalfDay,
                  )}{" "}
                  day(s)
                </p>
              )}

              <div>
                <label className="block text-xs font-bold uppercase mb-1.5">
                  Reason
                </label>
                <textarea
                  value={leaveForm.reason}
                  onChange={(e) =>
                    setLeaveForm((f) => ({ ...f, reason: e.target.value }))
                  }
                  rows={3}
                  maxLength={500}
                  placeholder="Brief reason for leave..."
                  className="w-full border-2 border-black px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#024BAB] resize-none"
                />
                <p className="text-[10px] text-muted-foreground text-right">
                  {leaveForm.reason.length}/500
                </p>
              </div>
            </div>
            <div className="flex gap-3 px-5 pb-5">
              <button
                onClick={() => setShowLeaveModal(false)}
                className="flex-1 border-2 border-black py-2.5 text-sm font-bold uppercase hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRequestLeave}
                disabled={leaveSaving}
                className="flex-1 flex items-center justify-center gap-2 bg-[#024BAB] text-white border-2 border-black py-2.5 text-sm font-bold uppercase disabled:opacity-50"
              >
                {leaveSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {leaveSaving ? "Submitting..." : "Submit Request"}
              </button>
            </div>
          </div>
        </div>
      )}

      {}
      {tab === "payroll" && (
        <div className="border-2 border-black bg-white overflow-hidden">
          <div className="px-4 py-3 bg-[#024BAB]/5 border-b-2 border-black">
            <p className="text-xs font-bold uppercase tracking-wider text-black">
              Payroll History
            </p>
          </div>
          {payrolls.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              No payroll records found
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-black bg-[#024BAB]/5">
                    {[
                      "Month",
                      "Basic",
                      "Gross",
                      "Deductions",
                      "Net Pay",
                      "Days",
                      "Status",
                    ].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payrolls.map((p, i) => (
                    <tr
                      key={p._id}
                      className={cn(
                        "border-b border-black/10",
                        i % 2 !== 0 && "bg-[#F8FAFF]",
                      )}
                    >
                      <td className="px-4 py-3 font-bold text-black">
                        {MONTHS[(p.month || 1) - 1]} {p.year}
                      </td>
                      <td className="px-4 py-3 text-xs text-black">
                        {formatCurrency(p.basicSalary)}
                      </td>
                      <td className="px-4 py-3 text-xs text-black">
                        {formatCurrency(p.grossSalary)}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#EF4444]">
                        -{formatCurrency(p.totalDeductions)}
                      </td>
                      <td className="px-4 py-3 text-xs font-bold text-[#00C48C]">
                        {formatCurrency(p.netSalary)}
                      </td>
                      <td className="px-4 py-3 text-xs text-black">
                        {p.presentDays}/{p.workingDays}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "px-2 py-0.5 text-[10px] font-bold uppercase border-2",
                            payrollStatusColor[p.status] ||
                              "bg-gray-100 text-gray-500 border-gray-300",
                          )}
                        >
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "documents" && (
        <DocumentsTabPane employee={employee} toast={toast} />
      )}

      {tab === "assets" && <AssetsTabPane toast={toast} />}

      {}
      {tab === "settings" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {}
          <div className="border-2 border-black bg-white overflow-hidden">
            <div className="px-4 py-3 bg-[#024BAB] border-b-2 border-black flex items-center gap-2">
              <Camera className="w-4 h-4 text-white" />
              <p className="text-xs font-bold uppercase tracking-wider text-white">
                Profile Photo
              </p>
            </div>
            <div className="p-5 flex flex-col items-center gap-4">
              <div className="w-28 h-28 border-2 border-black bg-[#024BAB] flex items-center justify-center text-3xl font-bold text-white overflow-hidden">
                {avatarSrc ? (
                  <img
                    src={avatarSrc}
                    alt="avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{employee.firstName?.[0]?.toUpperCase()}</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground text-center">
                JPG, PNG or WEBP · Max 3 MB
                <br />
                Will appear in the header and your profile
              </p>
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => photoInputRef.current?.click()}
                  disabled={photoUploading}
                  className="flex-1 flex items-center justify-center gap-2 bg-[#024BAB] text-white border-2 border-black py-2.5 font-bold text-xs uppercase disabled:opacity-50"
                >
                  {photoUploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  {photoUploading ? "Uploading..." : "Upload Photo"}
                </button>
                {avatarSrc && (
                  <button
                    onClick={handleRemovePhoto}
                    disabled={saving}
                    className="flex items-center justify-center gap-2 bg-white text-[#EF4444] border-2 border-[#EF4444] px-4 py-2.5 font-bold text-xs uppercase disabled:opacity-50"
                  >
                    <X className="w-4 h-4" /> Remove
                  </button>
                )}
              </div>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoChange}
              />
            </div>
          </div>

          {}
          <div className="border-2 border-black bg-white overflow-hidden">
            <div className="px-4 py-3 bg-[#024BAB] border-b-2 border-black flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-white" />
              <p className="text-xs font-bold uppercase tracking-wider text-white">
                Edit Profile
              </p>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase mb-1.5">
                  Display Name
                </label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full border-2 border-black px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#024BAB]"
                  placeholder="Your full name"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase mb-1.5">
                  Phone Number
                </label>
                <input
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full border-2 border-black px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#024BAB]"
                  placeholder="+91 XXXXX XXXXX"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase mb-1.5">
                  Email
                </label>
                <input
                  value={user?.email || ""}
                  disabled
                  className="w-full border-2 border-black/30 px-3 py-2.5 text-sm font-medium bg-gray-50 text-gray-400 cursor-not-allowed"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Email cannot be changed. Contact HR.
                </p>
              </div>
              <button
                onClick={handleSaveProfile}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 bg-[#024BAB] text-white border-2 border-black py-2.5 font-bold text-xs uppercase disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>

          {}
          <div className="border-2 border-black bg-white overflow-hidden lg:col-span-2">
            <div className="px-4 py-3 bg-[#024BAB] border-b-2 border-black flex items-center gap-2">
              <Lock className="w-4 h-4 text-white" />
              <p className="text-xs font-bold uppercase tracking-wider text-white">
                Change Password
              </p>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { key: "current", label: "Current Password" },
                { key: "next", label: "New Password" },
                { key: "confirm", label: "Confirm New Password" },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-xs font-bold uppercase mb-1.5">
                    {label}
                  </label>
                  <div className="relative">
                    <input
                      type={
                        showPw[key as keyof typeof showPw] ? "text" : "password"
                      }
                      value={pwForm[key as keyof typeof pwForm]}
                      onChange={(e) =>
                        setPwForm((p) => ({ ...p, [key]: e.target.value }))
                      }
                      className="w-full border-2 border-black px-3 py-2.5 pr-9 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#024BAB]"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowPw((p) => ({
                          ...p,
                          [key]: !p[key as keyof typeof p],
                        }))
                      }
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black"
                    >
                      {showPw[key as keyof typeof showPw] ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
              <div className="sm:col-span-3">
                <p className="text-[10px] text-muted-foreground mb-3">
                  Must be at least 8 characters with uppercase, lowercase, and a
                  number.
                </p>
                <button
                  onClick={handleChangePassword}
                  disabled={
                    pwSaving ||
                    !pwForm.current ||
                    !pwForm.next ||
                    !pwForm.confirm
                  }
                  className="flex items-center gap-2 bg-[#FA731C] text-white border-2 border-black px-6 py-2.5 font-bold text-xs uppercase disabled:opacity-50"
                >
                  {pwSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Lock className="w-4 h-4" />
                  )}
                  {pwSaving ? "Changing..." : "Change Password"}
                </button>
              </div>
            </div>
          </div>
          <div className="mt-6 border-t-2 border-black/10 pt-6">
            <ProfileDetailsTabPane
              employee={employee}
              toast={toast}
              onRefresh={loadEmployeeData}
            />
          </div>
        </div>
      )}
    </AppLayout>
  );
}
