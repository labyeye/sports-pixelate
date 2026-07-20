import { useState, useEffect, useCallback } from "react";
import nesthrlogo from "../../assets/nesthr.png";
import { AppLayout } from "@/components/layout/AppLayout";
import { SportPicker } from "@/components/SportPicker";
import {
  studentAPI,
  employeeAPI,
  sportsPlanAPI,
  subscriptionAPI,
} from "@/services/api";
import {
  INDIA_STATES,
  INDIA_STATES_AND_CITIES,
} from "@/data/indiaStatesAndCities";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  ImportExportModal,
  type ImportHeader,
} from "@/components/ImportExportModal";
import { exportRowsToExcel } from "@/utils/excelImportExport";
import {
  GraduationCap,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Loader2,
  Search,
  Camera,
  User,
  ArrowUp,
  ArrowDown,
  Users,
  PauseCircle,
  Download,
  FileSpreadsheet,
  Droplet,
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Upload,
  Wallet,
  Trophy,
  Layers,
  UserCog,
  Calendar,
  Phone,
  Heart,
  MapPin,
  Award,
  Clock,
  Mail,
  FileText,
  Repeat,
  Lock,
} from "lucide-react";

const STUDENT_FORM_TABS = [
  "Basic Info",
  "Contact & Address",
  "Sports Profile",
  "Guardians",
  "Subscription Plan",
];

const STUDENT_IMPORT_HEADERS: ImportHeader[] = [
  { key: "firstName", label: "First Name", required: true, example: "Aarav" },
  { key: "lastName", label: "Last Name", required: true, example: "Mehta" },
  { key: "sport", label: "Sport", required: true, example: "Tennis" },
  { key: "batch", label: "Batch", required: false, example: "Morning U-12" },
  {
    key: "dateOfBirth",
    label: "Date of Birth",
    required: false,
    example: "2014-05-10",
  },
  { key: "gender", label: "Gender", required: false, example: "male" },
  {
    key: "enrollmentDate",
    label: "Enrollment Date",
    required: false,
    example: "2024-01-15",
  },
  {
    key: "coach",
    label: "Coach Name",
    required: false,
    example: "Rahul Sharma",
  },
  {
    key: "emergencyContact",
    label: "Emergency Contact",
    required: false,
    example: "9876500000",
  },
  {
    key: "medicalNotes",
    label: "Medical Notes",
    required: false,
    example: "",
  },
  {
    key: "guardianName",
    label: "Guardian Name",
    required: false,
    example: "Priya Mehta",
  },
  {
    key: "guardianRelation",
    label: "Guardian Relation",
    required: false,
    example: "mother",
  },
  {
    key: "guardianPhone",
    label: "Guardian Phone",
    required: false,
    example: "9876543210",
  },
  {
    key: "guardianEmail",
    label: "Guardian Email",
    required: false,
    example: "priya@example.com",
  },
];

interface Guardian {
  _id?: string;
  relation: "father" | "mother" | "guardian" | "other";
  name: string;
  phone?: string;
  email?: string;
  photo?: string;
  receivesWhatsapp?: boolean;
}

interface EmergencyContactPerson {
  name?: string;
  relation?: string;
  phone?: string;
}

interface Address {
  line1?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
}

interface SportsProfile {
  experienceLevel?: "Beginner" | "Intermediate" | "Advanced";
  previousAcademy?: string;
  yearsOfExperience?: number | string;
  playingLevel?: "School" | "District" | "State" | "National";
}

interface Student {
  _id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  sport: string;
  batch: string;
  status: "active" | "inactive" | "on_hold";
  coach?: { _id: string; firstName: string; lastName: string };
  enrollmentDate: string;
  avatar?: string;
  guardians?: Guardian[];
  bloodGroup?: string;
  emergencyContactPerson?: EmergencyContactPerson;
  address?: Address;
  sportsProfile?: SportsProfile;
}

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const EXPERIENCE_LEVELS = ["Beginner", "Intermediate", "Advanced"] as const;
const PLAYING_LEVELS = ["School", "District", "State", "National"] as const;

const EMPTY_EMERGENCY_CONTACT_PERSON: EmergencyContactPerson = {
  name: "",
  relation: "",
  phone: "",
};
const EMPTY_ADDRESS: Address = {
  line1: "",
  city: "",
  state: "",
  pincode: "",
  country: "",
};
const OTHER_CITY = "__other__";
const EMPTY_SPORTS_PROFILE: SportsProfile = {
  experienceLevel: undefined,
  previousAcademy: "",
  yearsOfExperience: "",
  playingLevel: undefined,
};

interface GuardianForm extends Guardian {
  photoFile?: File | null;
  password?: string;
}

const EMPTY_GUARDIAN: GuardianForm = {
  relation: "father",
  name: "",
  phone: "",
  email: "",
  photo: "",
  photoFile: null,
  receivesWhatsapp: false,
  password: "",
};

const RELATION_LABEL: Record<string, string> = {
  father: "Father",
  mother: "Mother",
  guardian: "Guardian",
  other: "Other",
};

const STATUS_META: Record<string, { bg: string; text: string }> = {
  active: { bg: "bg-green-50", text: "text-green-700" },
  inactive: { bg: "bg-gray-50", text: "text-gray-500" },
  on_hold: { bg: "bg-yellow-50", text: "text-yellow-700" },
};

type SortKey = "name" | "sport" | "enrollmentDate";

// The specific guardian entry (if any) matching this student + relation, so
// callers can show whose name was actually entered, not just yes/no.
function getGuardianName(s: Student, relation: "father" | "mother") {
  return s.guardians?.find((g) => g.relation === relation && g.name?.trim())
    ?.name;
}

// Male/female glyph (lucide-react 0.462 has no Mars/Venus icons) with a
// tick/cross corner badge — tooltip shows the actual father/mother name
// entered for this student, or that it's missing.
function ParentIndicator({
  symbol,
  name,
  color,
  label,
}: {
  symbol: "♂" | "♀";
  name?: string;
  color: string;
  label: "Father" | "Mother";
}) {
  const present = !!name;
  return (
    <span
      title={present ? `${label}: ${name}` : `${label} name not entered`}
      className="relative inline-flex items-center justify-center w-6 h-6 shrink-0"
    >
      <span
        className="text-base font-bold leading-none"
        style={{ color: present ? color : "#D1D5DB" }}
      >
        {symbol}
      </span>
      <span
        className={cn(
          "absolute -bottom-1 -right-1 w-3 h-3 rounded-full border border-white flex items-center justify-center",
          present ? "bg-green-500" : "bg-red-400",
        )}
      >
        {present ? (
          <Check className="w-2 h-2 text-white" strokeWidth={3} />
        ) : (
          <X className="w-2 h-2 text-white" strokeWidth={3} />
        )}
      </span>
    </span>
  );
}

export default function StudentsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const canManage = user?.role === "super_admin" || user?.role === "hr_manager";

  const [students, setStudents] = useState<Student[]>([]);
  const [sportOptions, setSportOptions] = useState<string[]>([]);
  const [coaches, setCoaches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [importModal, setImportModal] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filterSport, setFilterSport] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  const SORT_FIELD: Record<SortKey, string> = {
    name: "firstName",
    sport: "sport",
    enrollmentDate: "enrollmentDate",
  };

  const [showForm, setShowForm] = useState(false);
  const [formTab, setFormTab] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    sport: "",
    batch: "",
    coach: "",
    dateOfBirth: "",
    emergencyContact: "",
    bloodGroup: "",
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>("");
  const [guardians, setGuardians] = useState<GuardianForm[]>([]);
  const [emergencyContactPerson, setEmergencyContactPerson] =
    useState<EmergencyContactPerson>({ ...EMPTY_EMERGENCY_CONTACT_PERSON });
  const [address, setAddress] = useState<Address>({ ...EMPTY_ADDRESS });
  const [cityIsOther, setCityIsOther] = useState(false);
  const cityOptions = address.state
    ? INDIA_STATES_AND_CITIES[address.state] || []
    : [];
  const [sportsProfile, setSportsProfile] = useState<SportsProfile>({
    ...EMPTY_SPORTS_PROFILE,
  });
  const [plans, setPlans] = useState<any[]>([]);
  const [subscriptionPlan, setSubscriptionPlan] = useState({
    planId: "",
    billingCycle: "monthly",
  });

  const buildParams = useCallback(
    (pageNum: number) => ({
      page: String(pageNum),
      limit: "20",
      ...(search ? { search } : {}),
      ...(filterSport ? { sport: filterSport } : {}),
      ...(filterStatus ? { status: filterStatus } : {}),
      sortBy: SORT_FIELD[sortKey],
      sortDir,
    }),
    [search, filterSport, filterStatus, sortKey, sortDir],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await studentAPI.getAll(buildParams(1));
      setStudents(r.data);
      setPage(1);
      setPages(r.pages || 1);
      setTotal(r.total ?? r.data.length);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  const loadMore = async () => {
    if (loadingMore || page >= pages) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const r = await studentAPI.getAll(buildParams(next));
      setStudents((p) => [...p, ...r.data]);
      setPage(next);
      setPages(r.pages || 1);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    load();
  }, [load]);

  // One-time wide fetch just to populate the sport filter dropdown, independent
  // of the paginated `students` list so options don't shrink as pages load.
  useEffect(() => {
    studentAPI
      .getAll({ limit: "200" })
      .then((r) =>
        setSportOptions(
          Array.from(
            new Set((r.data as Student[]).map((s) => s.sport).filter(Boolean)),
          ).sort(),
        ),
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (canManage) {
      employeeAPI
        .getAll({ role: "coach" })
        .then((r) => setCoaches(r.data))
        .catch(() => {});
      sportsPlanAPI
        .getAll()
        .then((r) => setPlans(r.data))
        .catch(() => {});
    }
  }, [canManage]);

  const resetForm = () => {
    setForm({
      firstName: "",
      lastName: "",
      sport: "",
      batch: "",
      coach: "",
      dateOfBirth: "",
      emergencyContact: "",
      bloodGroup: "",
    });
    setAvatarFile(null);
    setAvatarPreview("");
    setGuardians([]);
    setEmergencyContactPerson({ ...EMPTY_EMERGENCY_CONTACT_PERSON });
    setAddress({ ...EMPTY_ADDRESS });
    setCityIsOther(false);
    setSportsProfile({ ...EMPTY_SPORTS_PROFILE });
    setSubscriptionPlan({ planId: "", billingCycle: "monthly" });
    setEditingId(null);
    setShowForm(false);
    setFormTab(0);
  };

  const addGuardian = () => setGuardians((p) => [...p, { ...EMPTY_GUARDIAN }]);
  const removeGuardian = (i: number) =>
    setGuardians((p) => p.filter((_, idx) => idx !== i));
  const updateGuardian = (i: number, patch: Partial<GuardianForm>) =>
    setGuardians((p) =>
      p.map((g, idx) => (idx === i ? { ...g, ...patch } : g)),
    );
  // Only one guardian may receive WhatsApp notifications — selecting one
  // clears the flag on every other guardian, so it behaves like a radio.
  const setWhatsappGuardian = (i: number) =>
    setGuardians((p) =>
      p.map((g, idx) => ({ ...g, receivesWhatsapp: idx === i })),
    );

  const handleSave = async () => {
    if (saving) return;
    if (!form.firstName.trim() || !form.lastName.trim() || !form.sport.trim()) {
      toast({
        title: "Missing fields",
        description: "First name, last name and sport are required",
        variant: "destructive",
      });
      return;
    }
    if (guardians.some((g) => !g.name.trim())) {
      toast({
        title: "Missing fields",
        description: "Every guardian needs a name",
        variant: "destructive",
      });
      return;
    }
    if (guardians.some((g) => g.password && g.password.length < 6)) {
      toast({
        title: "Weak password",
        description: "Guardian login password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        coach: form.coach || undefined,
        bloodGroup: form.bloodGroup || undefined,
        guardians: guardians.map((g) => ({
          relation: g.relation,
          name: g.name.trim(),
          phone: g.phone || undefined,
          email: g.email || undefined,
          photo: g.photo || undefined,
          receivesWhatsapp: !!g.receivesWhatsapp,
          password: g.password || undefined,
        })),
        emergencyContactPerson:
          emergencyContactPerson.name ||
          emergencyContactPerson.relation ||
          emergencyContactPerson.phone
            ? emergencyContactPerson
            : undefined,
        address: Object.values(address).some((v) => v) ? address : undefined,
        sportsProfile:
          sportsProfile.experienceLevel ||
          sportsProfile.previousAcademy ||
          sportsProfile.yearsOfExperience ||
          sportsProfile.playingLevel
            ? {
                ...sportsProfile,
                yearsOfExperience: sportsProfile.yearsOfExperience
                  ? Number(sportsProfile.yearsOfExperience)
                  : undefined,
              }
            : undefined,
      };

      let saved: Student;
      if (editingId) {
        const r = await studentAPI.update(editingId, payload);
        saved = r.data;
        toast({ title: "Student updated" });
      } else {
        const r = await studentAPI.create(payload);
        saved = r.data;
        toast({ title: "Student enrolled" });
      }

      if (avatarFile) {
        const r = await studentAPI.uploadAvatar(saved._id, avatarFile);
        saved = { ...saved, avatar: r.avatar };
      }

      const guardiansWithPhotos = saved.guardians ? [...saved.guardians] : [];
      for (let i = 0; i < guardians.length; i++) {
        const file = guardians[i].photoFile;
        const guardianId = guardiansWithPhotos[i]?._id;
        if (file && guardianId) {
          const r = await studentAPI.uploadGuardianPhoto(
            saved._id,
            guardianId,
            file,
          );
          guardiansWithPhotos[i] = {
            ...guardiansWithPhotos[i],
            photo: r.photo,
          };
        }
      }
      saved = { ...saved, guardians: guardiansWithPhotos };

      if (subscriptionPlan.planId) {
        try {
          await subscriptionAPI.assign({
            studentId: saved._id,
            planId: subscriptionPlan.planId,
            billingCycle: subscriptionPlan.billingCycle,
          });
        } catch (e: any) {
          toast({
            title: "Student saved, but subscription failed",
            description: e.message,
            variant: "destructive",
          });
        }
      }

      setStudents((p) =>
        editingId
          ? p.map((s) => (s._id === editingId ? saved : s))
          : [saved, ...p],
      );
      resetForm();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deactivate this student?")) return;
    try {
      await studentAPI.delete(id);
      setStudents((p) =>
        p.map((s) => (s._id === id ? { ...s, status: "inactive" } : s)),
      );
      toast({ title: "Student deactivated" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const startEdit = (s: any) => {
    setEditingId(s._id);
    setForm({
      firstName: s.firstName,
      lastName: s.lastName,
      sport: s.sport,
      batch: s.batch || "",
      coach: s.coach?._id || "",
      dateOfBirth: s.dateOfBirth ? s.dateOfBirth.slice(0, 10) : "",
      emergencyContact: s.emergencyContact || "",
      bloodGroup: s.bloodGroup || "",
    });
    setAvatarFile(null);
    setAvatarPreview(s.avatar || "");
    setGuardians(
      (s.guardians || []).map((g: Guardian) => ({ ...g, photoFile: null })),
    );
    setEmergencyContactPerson({
      ...EMPTY_EMERGENCY_CONTACT_PERSON,
      ...(s.emergencyContactPerson || {}),
    });
    const mergedAddress = { ...EMPTY_ADDRESS, ...(s.address || {}) };
    setAddress(mergedAddress);
    setCityIsOther(
      !!mergedAddress.city &&
        !(INDIA_STATES_AND_CITIES[mergedAddress.state] || []).includes(
          mergedAddress.city,
        ),
    );
    setSportsProfile({ ...EMPTY_SPORTS_PROFILE, ...(s.sportsProfile || {}) });
    setSubscriptionPlan({ planId: "", billingCycle: "monthly" });
    if (canManage) {
      subscriptionAPI
        .getAll({ studentId: s._id })
        .then((r) => {
          const active = (r.data || []).find(
            (sub: any) =>
              sub.status === "active" || sub.status === "pending_renewal",
          );
          if (active) {
            setSubscriptionPlan({
              planId: active.plan?._id || active.plan,
              billingCycle: active.billingCycle || "monthly",
            });
          }
        })
        .catch(() => {});
    }
    setShowForm(true);
    setFormTab(0);
  };

  const displayed = students;

  const activeCount = students.filter((s) => s.status === "active").length;
  const onHoldCount = students.filter((s) => s.status === "on_hold").length;

  return (
    <AppLayout title="Students">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="font-display font-bold text-2xl text-black">
          Student Roster
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              exportRowsToExcel(
                STUDENT_IMPORT_HEADERS.map((h) => ({
                  key: h.key,
                  label: h.label,
                })),
                displayed.map((s) => ({
                  firstName: s.firstName,
                  lastName: s.lastName,
                  sport: s.sport,
                  batch: s.batch,
                  coach: s.coach
                    ? `${s.coach.firstName} ${s.coach.lastName}`
                    : "",
                  enrollmentDate: s.enrollmentDate?.slice(0, 10),
                })),
                "students_export.xlsx",
                "Students",
              )
            }
            className="border-2 border-black bg-white text-black px-4 py-2 text-sm flex items-center gap-1.5 font-bold hover:bg-gray-50 transition-colors"
          >
            <Download className="w-4 h-4" /> Export
          </button>
          {canManage && (
            <>
              <button
                onClick={() => setImportModal(true)}
                className="border-2 border-black bg-white text-black px-4 py-2 text-sm flex items-center gap-1.5 font-bold hover:bg-gray-50 transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4" /> Import Excel
              </button>
              <button
                onClick={() => {
                  resetForm();
                  setShowForm(true);
                }}
                className="border-2 border-black bg-[#024BAB] text-white px-4 py-2 text-sm flex items-center gap-1.5 font-bold hover:bg-[#01368A] transition-colors"
              >
                <Plus className="w-4 h-4" /> Enroll Student
              </button>
            </>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-5">
        <div className="border-2 border-black bg-white p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#024BAB]/10 border-2 border-[#024BAB] flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 text-[#024BAB]" />
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Total Students
            </p>
            <p className="text-2xl font-bold text-black">{total}</p>
          </div>
        </div>
        <div className="border-2 border-black bg-white p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#00C48C]/10 border-2 border-[#00C48C] flex items-center justify-center shrink-0">
            <GraduationCap className="w-5 h-5 text-[#00C48C]" />
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Active
            </p>
            <p className="text-2xl font-bold text-black">{activeCount}</p>
          </div>
        </div>
        <div className="border-2 border-black bg-white p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-500/10 border-2 border-amber-500 flex items-center justify-center shrink-0">
            <PauseCircle className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              On Hold
            </p>
            <p className="text-2xl font-bold text-black">{onHoldCount}</p>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex items-center gap-2 border-2 border-black bg-white px-3 py-2 flex-1 min-w-48">
          <Search className="w-4 h-4 shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or student ID"
            className="bg-transparent text-sm outline-none w-full font-medium"
          />
        </div>
        <select
          value={filterSport}
          onChange={(e) => setFilterSport(e.target.value)}
          className="border-2 border-black bg-white px-3 py-2 text-sm font-semibold outline-none"
        >
          <option value="">All Sports</option>
          {sportOptions.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="border-2 border-black bg-white px-3 py-2 text-sm font-semibold outline-none"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="on_hold">On Hold</option>
          <option value="inactive">Inactive</option>
        </select>
        {(search || filterSport || filterStatus) && (
          <button
            onClick={() => {
              setSearch("");
              setFilterSport("");
              setFilterStatus("");
            }}
            className="flex items-center gap-1 text-xs font-bold border-2 border-black px-2 py-2 hover:bg-red-50 transition-colors"
          >
            <X className="w-3.5 h-3.5" /> Clear
          </button>
        )}
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="border-2 border-black bg-white px-3 py-2 text-sm font-semibold outline-none"
        >
          <option value="name">Sort: Name</option>
          <option value="sport">Sort: Sport</option>
          <option value="enrollmentDate">Sort: Enrollment Date</option>
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

      {showForm && canManage && (
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
                    {editingId ? "Edit Student" : "Enroll Student"}
                  </h3>
                  {(form.firstName || form.lastName) && (
                    <p className="text-white/70 text-xs">
                      {form.firstName} {form.lastName}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={resetForm}
                className="text-white hover:text-white/70 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {}
            <div className="flex border-b-2 border-black">
              {STUDENT_FORM_TABS.map((tab, idx) => (
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
            <div className="flex-1 overflow-y-auto flex flex-col">
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
                          htmlFor="student-avatar-upload"
                          className="absolute -bottom-2 -right-2 w-7 h-7 bg-[#024BAB] border-2 border-black flex items-center justify-center cursor-pointer hover:bg-[#01368A]"
                        >
                          <Upload className="w-3.5 h-3.5 text-white" />
                        </label>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          id="student-avatar-upload"
                          onChange={(e) => {
                            const file = e.target.files?.[0] || null;
                            setAvatarFile(file);
                            if (file)
                              setAvatarPreview(URL.createObjectURL(file));
                          }}
                        />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-bold uppercase tracking-wider text-black mb-1">
                          Student Photo
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Click the upload icon to add a photo. PNG, JPG up to
                          10MB.
                        </p>
                      </div>
                    </div>

                    <div>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="flex items-center gap-1.5 text-xs font-bold uppercase mb-1">
                            <User className="w-3.5 h-3.5 text-[#024BAB]" />
                            First Name *
                          </label>
                          <input
                            value={form.firstName}
                            onChange={(e) =>
                              setForm((p) => ({
                                ...p,
                                firstName: e.target.value,
                              }))
                            }
                            placeholder="Enter First Name"
                            className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none"
                          />
                        </div>
                        <div>
                          <label className="flex items-center gap-1.5 text-xs font-bold uppercase mb-1">
                            <User className="w-3.5 h-3.5 text-[#024BAB]" />
                            Last Name *
                          </label>
                          <input
                            value={form.lastName}
                            onChange={(e) =>
                              setForm((p) => ({
                                ...p,
                                lastName: e.target.value,
                              }))
                            }
                            placeholder="Enter Last Name"
                            className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="flex items-center gap-1.5 text-xs font-bold uppercase mb-1">
                            <Trophy className="w-3.5 h-3.5 text-[#024BAB]" />
                            Sport *
                          </label>
                          <SportPicker
                            value={form.sport}
                            onChange={(sport) =>
                              setForm((p) => ({ ...p, sport }))
                            }
                            required
                          />
                        </div>
                        <div>
                          <label className="flex items-center gap-1.5 text-xs font-bold uppercase mb-1">
                            <Layers className="w-3.5 h-3.5 text-[#024BAB]" />
                            Batch
                          </label>
                          <input
                            value={form.batch}
                            onChange={(e) =>
                              setForm((p) => ({ ...p, batch: e.target.value }))
                            }
                            placeholder="e.g. Morning U-12"
                            className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none"
                          />
                        </div>
                        <div>
                          <label className="flex items-center gap-1.5 text-xs font-bold uppercase mb-1">
                            <UserCog className="w-3.5 h-3.5 text-[#024BAB]" />
                            Coach
                          </label>
                          <select
                            value={form.coach}
                            onChange={(e) =>
                              setForm((p) => ({ ...p, coach: e.target.value }))
                            }
                            className="w-full border-2 border-black px-3 py-2 text-sm font-medium bg-white outline-none"
                          >
                            <option value="">Unassigned</option>
                            {coaches.map((c) => (
                              <option key={c._id} value={c._id}>
                                {c.firstName} {c.lastName}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="flex items-center gap-1.5 text-xs font-bold uppercase mb-1">
                            <Calendar className="w-3.5 h-3.5 text-[#024BAB]" />
                            Date of Birth
                          </label>
                          <input
                            type="date"
                            value={form.dateOfBirth}
                            onChange={(e) =>
                              setForm((p) => ({
                                ...p,
                                dateOfBirth: e.target.value,
                              }))
                            }
                            className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none"
                          />
                        </div>
                        <div>
                          <label className="flex items-center gap-1.5 text-xs font-bold uppercase mb-1">
                            <Phone className="w-3.5 h-3.5 text-[#024BAB]" />
                            Emergency Contact
                          </label>
                          <input
                            value={form.emergencyContact}
                            onChange={(e) =>
                              setForm((p) => ({
                                ...p,
                                emergencyContact: e.target.value,
                              }))
                            }
                            placeholder="Enter Emergency Contact"
                            maxLength={10}
                            className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none"
                          />
                        </div>
                        <div>
                          <label className="flex items-center gap-1.5 text-xs font-bold uppercase mb-1">
                            <Droplet className="w-3.5 h-3.5 text-[#024BAB]" />
                            Blood Group
                          </label>
                          <select
                            value={form.bloodGroup}
                            onChange={(e) =>
                              setForm((p) => ({
                                ...p,
                                bloodGroup: e.target.value,
                              }))
                            }
                            className="w-full border-2 border-black px-3 py-2 text-sm font-medium bg-white outline-none"
                          >
                            <option value="">Unspecified</option>
                            {BLOOD_GROUPS.map((bg) => (
                              <option key={bg} value={bg}>
                                {bg}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {}
                {formTab === 1 && (
                  <div className="space-y-5">
                    <div>
                      <h4 className="font-bold text-sm uppercase mb-3">
                        Emergency Contact Person
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="flex items-center gap-1.5 text-xs font-bold uppercase mb-1">
                            <User className="w-3.5 h-3.5 text-[#024BAB]" />
                            Name
                          </label>
                          <input
                            value={emergencyContactPerson.name || ""}
                            onChange={(e) =>
                              setEmergencyContactPerson((p) => ({
                                ...p,
                                name: e.target.value,
                              }))
                            }
                            placeholder="Enter Name"
                            className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none"
                          />
                        </div>
                        <div>
                          <label className="flex items-center gap-1.5 text-xs font-bold uppercase mb-1">
                            <Heart className="w-3.5 h-3.5 text-[#024BAB]" />
                            Relation
                          </label>
                          <input
                            value={emergencyContactPerson.relation || ""}
                            onChange={(e) =>
                              setEmergencyContactPerson((p) => ({
                                ...p,
                                relation: e.target.value,
                              }))
                            }
                            placeholder="e.g. Father, Mother"
                            className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none"
                          />
                        </div>
                        <div>
                          <label className="flex items-center gap-1.5 text-xs font-bold uppercase mb-1">
                            <Phone className="w-3.5 h-3.5 text-[#024BAB]" />
                            Phone Number
                          </label>
                          <input
                            value={emergencyContactPerson.phone || ""}
                            onChange={(e) =>
                              setEmergencyContactPerson((p) => ({
                                ...p,
                                phone: e.target.value,
                              }))
                            }
                            placeholder="Enter Phone Number"
                            maxLength={10}
                            className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t-2 border-black/10">
                      <h4 className="font-bold text-sm uppercase mb-3">
                        Address
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                          <label className="flex items-center gap-1.5 text-xs font-bold uppercase mb-1">
                            <MapPin className="w-3.5 h-3.5 text-[#024BAB]" />
                            Line 1
                          </label>
                          <input
                            value={address.line1 || ""}
                            onChange={(e) =>
                              setAddress((p) => ({
                                ...p,
                                line1: e.target.value,
                              }))
                            }
                            placeholder="Enter Address Line 1"
                            className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none"
                          />
                        </div>
                        <div>
                          <label className="flex items-center gap-1.5 text-xs font-bold uppercase mb-1">
                            <MapPin className="w-3.5 h-3.5 text-[#024BAB]" />
                            State
                          </label>
                          <select
                            value={address.state || ""}
                            onChange={(e) => {
                              setAddress((p) => ({
                                ...p,
                                state: e.target.value,
                                city: "",
                              }));
                              setCityIsOther(false);
                            }}
                            className="w-full border-2 border-black px-3 py-2 text-sm font-medium bg-white outline-none"
                          >
                            <option value="">Select state</option>
                            {INDIA_STATES.map((st) => (
                              <option key={st} value={st}>
                                {st}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="flex items-center gap-1.5 text-xs font-bold uppercase mb-1">
                            <MapPin className="w-3.5 h-3.5 text-[#024BAB]" />
                            City
                          </label>
                          {cityIsOther ? (
                            <input
                              value={address.city || ""}
                              onChange={(e) =>
                                setAddress((p) => ({
                                  ...p,
                                  city: e.target.value,
                                }))
                              }
                              placeholder="Enter city name"
                              className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none"
                              autoFocus
                            />
                          ) : (
                            <select
                              value={address.city || ""}
                              onChange={(e) => {
                                if (e.target.value === OTHER_CITY) {
                                  setCityIsOther(true);
                                  setAddress((p) => ({ ...p, city: "" }));
                                } else {
                                  setAddress((p) => ({
                                    ...p,
                                    city: e.target.value,
                                  }));
                                }
                              }}
                              disabled={!address.state}
                              className="w-full border-2 border-black px-3 py-2 text-sm font-medium bg-white outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <option value="">
                                {address.state
                                  ? "Select city"
                                  : "Select a state first"}
                              </option>
                              {cityOptions.map((c) => (
                                <option key={c} value={c}>
                                  {c}
                                </option>
                              ))}
                              {address.state && (
                                <option value={OTHER_CITY}>Other</option>
                              )}
                            </select>
                          )}
                        </div>
                        <div>
                          <label className="flex items-center gap-1.5 text-xs font-bold uppercase mb-1">
                            <MapPin className="w-3.5 h-3.5 text-[#024BAB]" />
                            Pincode
                          </label>
                          <input
                            value={address.pincode || ""}
                            onChange={(e) =>
                              setAddress((p) => ({
                                ...p,
                                pincode: e.target.value,
                              }))
                            }
                            placeholder="Enter Pincode"
                            maxLength={6}
                            className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none"
                          />
                        </div>
                        <div>
                          <label className="flex items-center gap-1.5 text-xs font-bold uppercase mb-1">
                            <MapPin className="w-3.5 h-3.5 text-[#024BAB]" />
                            Country
                          </label>
                          <input
                            value={address.country || ""}
                            onChange={(e) =>
                              setAddress((p) => ({
                                ...p,
                                country: e.target.value,
                              }))
                            }
                            className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {}
                {formTab === 2 && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-bold uppercase mb-1">
                        <Award className="w-3.5 h-3.5 text-[#024BAB]" />
                        Experience Level
                      </label>
                      <select
                        value={sportsProfile.experienceLevel || ""}
                        onChange={(e) =>
                          setSportsProfile((p) => ({
                            ...p,
                            experienceLevel: (e.target.value ||
                              undefined) as SportsProfile["experienceLevel"],
                          }))
                        }
                        className="w-full border-2 border-black px-3 py-2 text-sm font-medium bg-white outline-none"
                      >
                        <option value="">Unspecified</option>
                        {EXPERIENCE_LEVELS.map((lvl) => (
                          <option key={lvl} value={lvl}>
                            {lvl}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-bold uppercase mb-1">
                        <GraduationCap className="w-3.5 h-3.5 text-[#024BAB]" />
                        Previous Academy
                      </label>
                      <input
                        value={sportsProfile.previousAcademy || ""}
                        onChange={(e) =>
                          setSportsProfile((p) => ({
                            ...p,
                            previousAcademy: e.target.value,
                          }))
                        }
                        className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none"
                      />
                    </div>
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-bold uppercase mb-1">
                        <Clock className="w-3.5 h-3.5 text-[#024BAB]" />
                        Years of Experience
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={sportsProfile.yearsOfExperience ?? ""}
                        onChange={(e) =>
                          setSportsProfile((p) => ({
                            ...p,
                            yearsOfExperience: e.target.value,
                          }))
                        }
                        className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none"
                      />
                    </div>
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-bold uppercase mb-1">
                        <Trophy className="w-3.5 h-3.5 text-[#024BAB]" />
                        Playing Level
                      </label>
                      <select
                        value={sportsProfile.playingLevel || ""}
                        onChange={(e) =>
                          setSportsProfile((p) => ({
                            ...p,
                            playingLevel: (e.target.value ||
                              undefined) as SportsProfile["playingLevel"],
                          }))
                        }
                        className="w-full border-2 border-black px-3 py-2 text-sm font-medium bg-white outline-none"
                      >
                        <option value="">Unspecified</option>
                        {PLAYING_LEVELS.map((lvl) => (
                          <option key={lvl} value={lvl}>
                            {lvl}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {}
                {formTab === 3 && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-bold text-sm uppercase">
                        Parents / Guardians
                      </h4>
                      <button
                        onClick={addGuardian}
                        className="flex items-center gap-1 text-xs font-bold uppercase border-2 border-black px-3 py-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Guardian
                      </button>
                    </div>

                    {guardians.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No guardians added
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {guardians.map((g, i) => (
                          <div key={i} className="border-2 border-black/20 p-4">
                            <div className="flex items-start gap-4">
                              <div className="w-12 h-12 border-2 border-black bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
                                {g.photoFile ? (
                                  <img
                                    src={URL.createObjectURL(g.photoFile)}
                                    alt={g.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : g.photo ? (
                                  <img
                                    src={g.photo}
                                    alt={g.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <User className="w-5 h-5 text-gray-300" />
                                )}
                              </div>
                              <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                  <label className="flex items-center gap-1.5 text-xs font-bold uppercase mb-1">
                                    <Heart className="w-3.5 h-3.5 text-[#024BAB]" />
                                    Relation *
                                  </label>
                                  <select
                                    value={g.relation}
                                    onChange={(e) =>
                                      updateGuardian(i, {
                                        relation: e.target
                                          .value as Guardian["relation"],
                                      })
                                    }
                                    className="w-full border-2 border-black px-3 py-2 text-sm font-medium bg-white outline-none"
                                  >
                                    {Object.entries(RELATION_LABEL).map(
                                      ([v, label]) => (
                                        <option key={v} value={v}>
                                          {label}
                                        </option>
                                      ),
                                    )}
                                  </select>
                                </div>
                                <div>
                                  <label className="flex items-center gap-1.5 text-xs font-bold uppercase mb-1">
                                    <Users className="w-3.5 h-3.5 text-[#024BAB]" />
                                    Name *
                                  </label>
                                  <input
                                    value={g.name}
                                    onChange={(e) =>
                                      updateGuardian(i, {
                                        name: e.target.value,
                                      })
                                    }
                                    className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none"
                                  />
                                </div>
                                <div>
                                  <label className="flex items-center gap-1.5 text-xs font-bold uppercase mb-1">
                                    <Phone className="w-3.5 h-3.5 text-[#024BAB]" />
                                    Phone
                                  </label>
                                  <input
                                    value={g.phone || ""}
                                    onChange={(e) =>
                                      updateGuardian(i, {
                                        phone: e.target.value,
                                      })
                                    }
                                    className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none"
                                  />
                                </div>
                                <div>
                                  <label className="flex items-center gap-1.5 text-xs font-bold uppercase mb-1">
                                    <Mail className="w-3.5 h-3.5 text-[#024BAB]" />
                                    Email (Parent Login)
                                  </label>
                                  <input
                                    type="email"
                                    value={g.email || ""}
                                    onChange={(e) =>
                                      updateGuardian(i, {
                                        email: e.target.value,
                                      })
                                    }
                                    placeholder="parent@example.com"
                                    className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none"
                                  />
                                </div>
                                <div>
                                  <label className="flex items-center gap-1.5 text-xs font-bold uppercase mb-1">
                                    <Lock className="w-3.5 h-3.5 text-[#024BAB]" />
                                    Password (Parent Login)
                                  </label>
                                  <input
                                    type="text"
                                    value={g.password || ""}
                                    onChange={(e) =>
                                      updateGuardian(i, {
                                        password: e.target.value,
                                      })
                                    }
                                    placeholder="Min 6 characters, optional"
                                    className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none"
                                  />
                                </div>
                                <div className="md:col-span-2 flex items-center gap-3 flex-wrap">
                                  <label className="flex items-center gap-2 border-2 border-black bg-white px-3 py-2 text-xs font-bold uppercase cursor-pointer w-fit">
                                    <Camera className="w-3.5 h-3.5" /> Upload
                                    Photo
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={(e) =>
                                        updateGuardian(i, {
                                          photoFile:
                                            e.target.files?.[0] || null,
                                        })
                                      }
                                    />
                                  </label>
                                  <label
                                    className={cn(
                                      "flex items-center gap-2 border-2 border-black px-3 py-2 text-xs font-bold uppercase cursor-pointer w-fit",
                                      g.receivesWhatsapp
                                        ? "bg-[#00C48C] text-black"
                                        : "bg-white",
                                    )}
                                    title="Only one guardian can receive WhatsApp updates"
                                  >
                                    <input
                                      type="radio"
                                      name="whatsapp-guardian"
                                      className="w-3.5 h-3.5"
                                      checked={!!g.receivesWhatsapp}
                                      onChange={() => setWhatsappGuardian(i)}
                                    />
                                    Sends WhatsApp Updates
                                  </label>
                                </div>
                              </div>
                              <button
                                onClick={() => removeGuardian(i)}
                                className="p-1.5 border border-black/10 hover:border-red-500 hover:text-red-500 hover:bg-red-50 shrink-0"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {formTab === 4 && (
                  <div>
                    <h4 className="font-bold text-sm uppercase mb-3">
                      Subscription Plan
                    </h4>
                    <p className="text-xs text-muted-foreground mb-4">
                      Assign a coaching plan so the parent sees it as due for
                      payment. Leave unset to skip billing for now.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="flex items-center gap-1.5 text-xs font-bold uppercase mb-1">
                          <FileText className="w-3.5 h-3.5 text-[#024BAB]" />
                          Plan
                        </label>
                        <select
                          value={subscriptionPlan.planId}
                          onChange={(e) =>
                            setSubscriptionPlan((p) => ({
                              ...p,
                              planId: e.target.value,
                            }))
                          }
                          className="w-full border-2 border-black px-3 py-2 text-sm font-medium bg-white outline-none"
                        >
                          <option value="">No plan / skip billing</option>
                          {plans.map((p) => (
                            <option key={p._id} value={p._id}>
                              {p.name} ({p.sport})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="flex items-center gap-1.5 text-xs font-bold uppercase mb-1">
                          <Repeat className="w-3.5 h-3.5 text-[#024BAB]" />
                          Billing Cycle
                        </label>
                        <select
                          value={subscriptionPlan.billingCycle}
                          onChange={(e) =>
                            setSubscriptionPlan((p) => ({
                              ...p,
                              billingCycle: e.target.value,
                            }))
                          }
                          disabled={!subscriptionPlan.planId}
                          className="w-full border-2 border-black px-3 py-2 text-sm font-medium bg-white outline-none disabled:opacity-50"
                        >
                          <option value="monthly">Monthly</option>
                          <option value="yearly">Yearly</option>
                        </select>
                      </div>
                    </div>
                    {subscriptionPlan.planId &&
                      (() => {
                        const selected = plans.find(
                          (p) => p._id === subscriptionPlan.planId,
                        );
                        if (!selected) return null;
                        const amount =
                          subscriptionPlan.billingCycle === "yearly"
                            ? selected.yearlyPrice
                            : selected.monthlyPrice;
                        return (
                          <div className="mt-4 border-2 border-black bg-[#024BAB]/5 p-4 flex items-center gap-3">
                            <div className="w-10 h-10 bg-[#FA731C]/10 border-2 border-[#FA731C] flex items-center justify-center shrink-0">
                              <Wallet className="w-5 h-5 text-[#FA731C]" />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                Amount Due ({subscriptionPlan.billingCycle})
                              </p>
                              <p className="text-xl font-bold text-black">
                                ₹{Number(amount).toLocaleString("en-IN")}
                              </p>
                            </div>
                          </div>
                        );
                      })()}
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
                  {STUDENT_FORM_TABS.map((_, idx) => (
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

                {formTab < STUDENT_FORM_TABS.length - 1 ? (
                  <button
                    key="next"
                    type="button"
                    onClick={() =>
                      setFormTab((t) =>
                        Math.min(STUDENT_FORM_TABS.length - 1, t + 1),
                      )
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
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                    {saving
                      ? "Saving..."
                      : editingId
                        ? "Save Changes"
                        : "Enroll Student"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <img src={nesthrlogo} alt="NestSports" className="h-16 w-auto" />
        </div>
      ) : displayed.length === 0 ? (
        <div className="border-2 border-black bg-white p-12 flex flex-col items-center justify-center">
          <GraduationCap className="w-12 h-12 text-muted-foreground/30 mb-3" />
          <p className="font-bold text-black">No students found</p>
          <p className="text-sm text-muted-foreground mt-1">
            Try adjusting your filters
          </p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="grid grid-cols-1 gap-3 sm:hidden">
            {displayed.map((s) => {
              const m = STATUS_META[s.status];
              return (
                <div key={s._id} className="border-2 border-black bg-white p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-11 h-11 border-2 border-black shrink-0 overflow-hidden bg-[#024BAB] flex items-center justify-center text-sm font-bold text-white rounded-full">
                      {s.avatar ? (
                        <img
                          src={s.avatar}
                          alt={s.firstName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        s.firstName?.[0]?.toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-black truncate">
                        {s.firstName} {s.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {s.studentId}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "border-2 border-black/10 text-[10px] font-bold uppercase px-1.5 py-0.5 shrink-0",
                        m.bg,
                        m.text,
                      )}
                    >
                      {s.status.replace("_", " ")}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mb-3">
                    <div>
                      <span className="text-muted-foreground">Sport: </span>
                      <span className="font-bold text-black">{s.sport}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Batch: </span>
                      <span className="font-bold text-black">
                        {s.batch || "—"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Droplet className="w-3 h-3 text-red-500 shrink-0" />
                      <span className="text-muted-foreground">Blood: </span>
                      <span className="font-bold text-black">
                        {s.bloodGroup || "—"}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Coach: </span>
                      <span className="font-bold text-black">
                        {s.coach
                          ? `${s.coach.firstName} ${s.coach.lastName}`
                          : "—"}
                      </span>
                    </div>
                    <div className="col-span-2 truncate">
                      <span className="text-muted-foreground">Guardians: </span>
                      <span className="font-bold text-black">
                        {s.guardians && s.guardians.length > 0
                          ? s.guardians.map((g) => g.name).join(", ")
                          : "—"}
                      </span>
                    </div>
                    <div className="col-span-2 flex items-center gap-2 mt-1">
                      <span className="text-muted-foreground">Parents: </span>
                      <ParentIndicator
                        symbol="♂"
                        name={getGuardianName(s, "father")}
                        color="#024BAB"
                        label="Father"
                      />
                      <ParentIndicator
                        symbol="♀"
                        name={getGuardianName(s, "mother")}
                        color="#A855F7"
                        label="Mother"
                      />
                    </div>
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => startEdit(s)}
                        className="flex-1 flex items-center justify-center gap-1.5 border-2 border-black py-2 text-xs font-bold bg-[#024BAB] text-white hover:bg-[#01368A]"
                      >
                        <Edit2 className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button
                        onClick={() => handleDelete(s._id)}
                        className="p-2 border-2 border-black bg-white hover:bg-red-50"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-600" />
                      </button>
                    </div>
                  )}
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
                    "ID",
                    "Name",
                    "Sport",
                    "Batch",
                    "Blood",
                    "Coach",
                    "Guardians",
                    "Parents",
                    "Status",
                    ...(canManage ? ["Actions"] : []),
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
                {displayed.map((s, idx) => {
                  const m = STATUS_META[s.status];
                  return (
                    <tr
                      key={s._id}
                      className={cn(
                        "border-b border-black/10 hover:bg-[#024BAB]/5 transition-colors",
                        idx % 2 === 0 ? "" : "bg-[#F8FAFF]",
                      )}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {s.studentId}
                      </td>
                      <td className="px-4 py-3 font-bold text-black">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 border-[1px] border-black shrink-0 overflow-hidden bg-[#024BAB] flex items-center justify-center text-xs font-bold text-white rounded-full">
                            {s.avatar ? (
                              <img
                                src={s.avatar}
                                alt={s.firstName}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              s.firstName?.[0]?.toUpperCase()
                            )}
                          </div>
                          {s.firstName} {s.lastName}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-black">{s.sport}</td>
                      <td className="px-4 py-3 text-black">{s.batch || "—"}</td>
                      <td className="px-4 py-3 text-black">
                        {s.bloodGroup || "—"}
                      </td>
                      <td className="px-4 py-3 text-black">
                        {s.coach
                          ? `${s.coach.firstName} ${s.coach.lastName}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-black text-xs max-w-xs truncate">
                        {s.guardians && s.guardians.length > 0
                          ? s.guardians
                              .map(
                                (g) =>
                                  `${g.name} (${RELATION_LABEL[g.relation]})`,
                              )
                              .join(", ")
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <ParentIndicator
                            symbol="♂"
                            name={getGuardianName(s, "father")}
                            color="#024BAB"
                            label="Father"
                          />
                          <ParentIndicator
                            symbol="♀"
                            name={getGuardianName(s, "mother")}
                            color="#A855F7"
                            label="Mother"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "text-[10px] rounded-full font-bold uppercase px-1.5 py-0.5 border-2 border-black",
                            m.bg,
                            m.text,
                          )}
                        >
                          {s.status.replace("_", " ")}
                        </span>
                      </td>
                      {canManage && (
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <button
                              onClick={() => startEdit(s)}
                              className="p-1.5 border-2 border-transparent hover:border-black hover:bg-[#024BAB]/10 transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(s._id)}
                              className="p-1.5 border-2 border-transparent hover:border-black hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-600" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {page < pages && (
            <div className="flex flex-col items-center gap-2 mt-4">
              <p className="text-xs text-muted-foreground">
                Showing {students.length} of {total}
              </p>
              <button
                onClick={loadMore}
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
      <ImportExportModal
        open={importModal}
        onClose={() => setImportModal(false)}
        entityLabel="Student"
        headers={STUDENT_IMPORT_HEADERS}
        templateFilename="students_import_template.xlsx"
        notes={
          <>
            <p>
              • <strong>Date of Birth</strong> and{" "}
              <strong>Enrollment Date</strong> must be in{" "}
              <strong>YYYY-MM-DD</strong> format.
            </p>
            <p>
              • <strong>Coach Name</strong> must exactly match an existing
              employee's full name.
            </p>
            <p>
              • <strong>Guardian Relation</strong> must be one of:{" "}
              <code>father</code>, <code>mother</code>, <code>guardian</code>,{" "}
              <code>other</code>.
            </p>
            <p>
              • Maximum <strong>200 students</strong> per import.
            </p>
          </>
        }
        previewColumns={[
          {
            key: "name",
            label: "Name",
            render: (r) => `${r.firstName} ${r.lastName}`,
          },
          { key: "sport", label: "Sport" },
          { key: "batch", label: "Batch" },
          { key: "coach", label: "Coach" },
        ]}
        onImport={(rows) => studentAPI.bulkImport(rows) as any}
        onImported={load}
      />
    </AppLayout>
  );
}
