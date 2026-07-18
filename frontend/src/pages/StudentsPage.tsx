import { useState, useEffect, useCallback } from "react";
import nesthrlogo from "../../assets/nesthr.png";
import { AppLayout } from "@/components/layout/AppLayout";
import { SportPicker } from "@/components/SportPicker";
import { studentAPI, employeeAPI } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { ImportExportModal, type ImportHeader } from "@/components/ImportExportModal";
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
} from "lucide-react";

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
}

interface GuardianForm extends Guardian {
  photoFile?: File | null;
}

const EMPTY_GUARDIAN: GuardianForm = {
  relation: "father",
  name: "",
  phone: "",
  email: "",
  photo: "",
  photoFile: null,
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    sport: "",
    batch: "",
    coach: "",
    dateOfBirth: "",
    emergencyContact: "",
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>("");
  const [guardians, setGuardians] = useState<GuardianForm[]>([]);

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
    });
    setAvatarFile(null);
    setAvatarPreview("");
    setGuardians([]);
    setEditingId(null);
    setShowForm(false);
  };

  const addGuardian = () => setGuardians((p) => [...p, { ...EMPTY_GUARDIAN }]);
  const removeGuardian = (i: number) =>
    setGuardians((p) => p.filter((_, idx) => idx !== i));
  const updateGuardian = (i: number, patch: Partial<GuardianForm>) =>
    setGuardians((p) =>
      p.map((g, idx) => (idx === i ? { ...g, ...patch } : g)),
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
    setSaving(true);
    try {
      const payload = {
        ...form,
        coach: form.coach || undefined,
        guardians: guardians.map((g) => ({
          relation: g.relation,
          name: g.name.trim(),
          phone: g.phone || undefined,
          email: g.email || undefined,
          photo: g.photo || undefined,
        })),
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
    });
    setAvatarFile(null);
    setAvatarPreview(s.avatar || "");
    setGuardians(
      (s.guardians || []).map((g: Guardian) => ({ ...g, photoFile: null })),
    );
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
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
                STUDENT_IMPORT_HEADERS.map((h) => ({ key: h.key, label: h.label })),
                displayed.map((s) => ({
                  firstName: s.firstName,
                  lastName: s.lastName,
                  sport: s.sport,
                  batch: s.batch,
                  coach: s.coach ? `${s.coach.firstName} ${s.coach.lastName}` : "",
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
        <div className="bg-white border-2 border-black p-6 mb-6">
          <h3 className="font-bold text-base mb-4">
            {editingId ? "Edit Student" : "Enroll Student"}
          </h3>
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 border-2 border-black bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
              {avatarPreview ? (
                <img
                  src={avatarPreview}
                  alt="Student"
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-7 h-7 text-gray-300" />
              )}
            </div>
            <div>
              <label className="block text-xs font-bold uppercase mb-1">
                Student Photo
              </label>
              <label className="flex items-center gap-2 border-2 border-black bg-white px-3 py-2 text-xs font-bold uppercase cursor-pointer w-fit">
                <Camera className="w-3.5 h-3.5" /> Upload
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setAvatarFile(file);
                    if (file) setAvatarPreview(URL.createObjectURL(file));
                  }}
                />
              </label>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase mb-1">
                First Name *
              </label>
              <input
                value={form.firstName}
                onChange={(e) =>
                  setForm((p) => ({ ...p, firstName: e.target.value }))
                }
                className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase mb-1">
                Last Name *
              </label>
              <input
                value={form.lastName}
                onChange={(e) =>
                  setForm((p) => ({ ...p, lastName: e.target.value }))
                }
                className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase mb-1">
                Sport *
              </label>
              <SportPicker
                value={form.sport}
                onChange={(sport) => setForm((p) => ({ ...p, sport }))}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase mb-1">
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
              <label className="block text-xs font-bold uppercase mb-1">
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
              <label className="block text-xs font-bold uppercase mb-1">
                Date of Birth
              </label>
              <input
                type="date"
                value={form.dateOfBirth}
                onChange={(e) =>
                  setForm((p) => ({ ...p, dateOfBirth: e.target.value }))
                }
                className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-bold uppercase mb-1">
                Emergency Contact
              </label>
              <input
                value={form.emergencyContact}
                onChange={(e) =>
                  setForm((p) => ({ ...p, emergencyContact: e.target.value }))
                }
                className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none"
              />
            </div>
          </div>

          <div className="mt-6 pt-4 border-t-2 border-black/10">
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
                          <label className="block text-xs font-bold uppercase mb-1">
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
                          <label className="block text-xs font-bold uppercase mb-1">
                            Name *
                          </label>
                          <input
                            value={g.name}
                            onChange={(e) =>
                              updateGuardian(i, { name: e.target.value })
                            }
                            className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold uppercase mb-1">
                            Phone
                          </label>
                          <input
                            value={g.phone || ""}
                            onChange={(e) =>
                              updateGuardian(i, { phone: e.target.value })
                            }
                            className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold uppercase mb-1">
                            Email
                          </label>
                          <input
                            value={g.email || ""}
                            onChange={(e) =>
                              updateGuardian(i, { email: e.target.value })
                            }
                            className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="flex items-center gap-2 border-2 border-black bg-white px-3 py-2 text-xs font-bold uppercase cursor-pointer w-fit">
                            <Camera className="w-3.5 h-3.5" /> Upload Photo
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) =>
                                updateGuardian(i, {
                                  photoFile: e.target.files?.[0] || null,
                                })
                              }
                            />
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

          <div className="flex gap-3 mt-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-[#024BAB] text-white border-2 border-black px-4 py-2 font-bold text-sm uppercase disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={resetForm}
              className="flex items-center gap-2 bg-white border-2 border-black px-4 py-2 font-bold text-sm uppercase"
            >
              <X className="w-4 h-4" /> Cancel
            </button>
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
                    "Coach",
                    "Guardians",
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
