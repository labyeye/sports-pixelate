import { useState, useEffect, useCallback } from "react";
import nesthrlogo from "../../assets/nesthr.png";
import { AppLayout } from "@/components/layout/AppLayout";
import { departmentAPI } from "@/services/api";
import { Department } from "@/types/hrms";
import { cn } from "@/lib/utils";
import {
  Plus,
  Building2,
  Users,
  Edit,
  X,
  Search,
  ArrowUp,
  ArrowDown,
  Hash,
  FileText,
} from "lucide-react";
import { ActionModal } from "@/components/ui/ActionModal";

const DEPT_BG_COLORS = [
  "bg-[#024BAB]",
  "bg-[#FA731C]",
  "bg-[#00C48C]",
  "bg-[#A855F7]",
  "bg-[#EF4444]",
  "bg-[#FFD60A]",
  "bg-[#0D9488]",
  "bg-[#EC4899]",
];

interface DeptForm {
  name: string;
  code: string;
  description: string;
}
const EMPTY_FORM: DeptForm = {
  name: "",
  code: "",
  description: "",
};

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editDept, setEditDept] = useState<Department | null>(null);
  const [form, setForm] = useState<DeptForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [actionModal, setActionModal] = useState<{
    show: boolean;
    type: "success" | "error";
    title: string;
    message: string;
  }>({ show: false, type: "success", title: "", message: "" });
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<"name" | "headcount">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  // "headcount" isn't a stored field (it's computed per-request from a
  // separate Employee count), so it can't be pushed to the backend sort —
  // it's sorted client-side over whatever page is currently loaded.
  const deptParams = useCallback(
    (pageNum: number): Record<string, string> => {
      const params: Record<string, string> = {
        page: String(pageNum),
        limit: "20",
      };
      if (search) params.search = search;
      if (sortKey !== "headcount") {
        params.sortBy = sortKey;
        params.sortDir = sortDir;
      }
      return params;
    },
    [search, sortKey, sortDir],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await departmentAPI.getAll(deptParams(1));
      if (res.success) {
        setDepartments(res.data);
        setPage(1);
        setPages(res.pages || 1);
        setTotal(res.total ?? res.data.length);
      }
    } catch {}
    setLoading(false);
  }, [deptParams]);

  const loadMore = async () => {
    if (loadingMore || page >= pages) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const res = await departmentAPI.getAll(deptParams(next));
      if (res.success) {
        setDepartments((p) => [...p, ...res.data]);
        setPage(next);
        setPages(res.pages || 1);
      }
    } catch {}
    setLoadingMore(false);
  };

  useEffect(() => {
    load();
  }, [load]);

  const openAdd = () => {
    setEditDept(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };
  const openEdit = (d: Department) => {
    setEditDept(d);
    setForm({
      name: d.name,
      code: d.code,
      description: d.description || "",
    });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editDept) await departmentAPI.update(editDept._id, form);
      else await departmentAPI.create(form);
      setActionModal({
        show: true,
        type: "success",
        title: editDept ? "Department Updated" : "Department Created",
        message: editDept
          ? "Department updated successfully."
          : "New department added successfully.",
      });
      setShowModal(false);
      load();
    } catch (err: any) {
      setActionModal({
        show: true,
        type: "error",
        title: "Error",
        message: err.message || "Failed to save department.",
      });
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deactivate this department?")) return;
    try {
      await departmentAPI.delete(id);
      load();
    } catch {}
  };

  const displayedDepts = [...departments].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "name") cmp = a.name.localeCompare(b.name);
    else if (sortKey === "headcount")
      cmp = (a.headcount ?? 0) - (b.headcount ?? 0);
    return sortDir === "asc" ? cmp : -cmp;
  });

  const loadedHeadcount = departments.reduce(
    (s, d) => s + (d.headcount || 0),
    0,
  );

  return (
    <AppLayout title="Departments">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h1 className="font-display font-bold text-2xl text-black">
          Departments
        </h1>
        <button
          onClick={openAdd}
          className="border-2 border-black bg-[#024BAB] text-white px-4 py-2 text-sm flex items-center gap-1.5 font-bold"
        >
          <Plus className="w-4 h-4" /> Add Department
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-5">
        <div className="border-2 border-black bg-white p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#024BAB]/10 border-2 border-[#024BAB] flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5 text-[#024BAB]" />
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Total Departments
            </p>
            <p className="text-2xl font-bold text-black">{total}</p>
          </div>
        </div>
        <div className="border-2 border-black bg-white p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#00C48C]/10 border-2 border-[#00C48C] flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 text-[#00C48C]" />
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Total Headcount
            </p>
            <p className="text-2xl font-bold text-black">{loadedHeadcount}</p>
          </div>
        </div>
      </div>

      {/* Search & Sort */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex items-center gap-2 border-2 border-black bg-white px-3 py-2 flex-1 min-w-48">
          <Search className="w-4 h-4 shrink-0 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search departments..."
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
          <option value="name">Sort: Name</option>
          <option value="headcount">Sort: Headcount</option>
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

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <img src={nesthrlogo} alt="NestSports" className="h-16 w-auto" />
        </div>
      ) : total === 0 && !search ? (
        <div className="border-2 border-black bg-white p-12 flex flex-col items-center justify-center">
          <Building2 className="w-12 h-12 text-muted-foreground/30 mb-3" />
          <p className="font-bold text-black">No departments yet</p>
          <button
            onClick={openAdd}
            className="border-2 border-black bg-[#024BAB] text-white px-4 py-2 text-sm mt-4 font-bold"
          >
            Create First Department
          </button>
        </div>
      ) : displayedDepts.length === 0 ? (
        <div className="border-2 border-black bg-white p-12 flex flex-col items-center justify-center">
          <Search className="w-12 h-12 text-muted-foreground/30 mb-3" />
          <p className="font-bold text-black">No departments match</p>
          <button
            onClick={() => setSearch("")}
            className="text-sm text-[#024BAB] font-bold mt-2 hover:underline"
          >
            Clear search
          </button>
        </div>
      ) : (
        <div className="border-2 border-black bg-white overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-black bg-[#024BAB]/5">
                {[
                  "",
                  "Department",
                  "Code",
                  "Description",
                  "Headcount",
                  "Head",
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
              {displayedDepts.map((dept, i) => (
                <tr
                  key={dept._id}
                  className={cn(
                    "border-b border-black/10 hover:bg-[#024BAB]/5 transition-colors",
                    i % 2 !== 0 ? "bg-[#F8FAFF]" : "",
                  )}
                >
                  <td className="px-4 py-3">
                    <div
                      className={cn(
                        "w-9 h-9 border-2 border-black flex items-center rounded-full justify-center shrink-0",
                        DEPT_BG_COLORS[i % DEPT_BG_COLORS.length],
                      )}
                    >
                      <Building2 className="w-4 h-4 text-white" />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-bold text-black">{dept.name}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-bold text-black uppercase tracking-wider bg-gray-100 border-2 rounded-full border-black px-2 py-0.5">
                      {dept.code}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground max-w-48">
                    <span className="line-clamp-1">
                      {dept.description || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-6 h-6 bg-[#024BAB]/10 border border-black/20 rounded-full flex items-center justify-center">
                        <Users className="w-3.5 h-3.5 text-[#024BAB]" />
                      </div>
                      <span className="font-bold text-black">
                        {dept.headcount || 0}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {dept.head ? (
                      <div className="flex items-center gap-1.5">
                        <div className="w-6 h-6 bg-[#FA731C] border border-black flex items-center justify-center text-[10px] font-bold text-white">
                          {(dept.head as any)?.name?.[0]?.toUpperCase()}
                        </div>
                        <span className="text-xs font-medium text-black truncate max-w-24">
                          {(dept.head as any)?.name}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEdit(dept)}
                        className="p-1.5 border-2 border-transparent hover:border-black hover:bg-[#024BAB]/10 transition-colors"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(dept._id)}
                        className="p-1.5 border-2 border-transparent hover:border-black hover:bg-red-50 transition-colors"
                      >
                        <X className="w-3.5 h-3.5 text-red-600" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {page < pages && (
        <div className="flex flex-col items-center gap-2 mt-4">
          <p className="text-xs text-muted-foreground">
            Showing {departments.length} of {total}
          </p>
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="border-2 border-black bg-white px-4 py-2 text-sm font-bold uppercase hover:bg-[#024BAB]/5 disabled:opacity-60"
          >
            {loadingMore ? "Loading..." : "Load More"}
          </button>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="border-2 border-black bg-white w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b-2 border-black">
              <h3 className="font-display font-bold text-lg">
                {editDept ? "Edit Department" : "Add Department"}
              </h3>
              <button onClick={() => setShowModal(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
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
              className="p-5 space-y-4"
            >
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-black mb-1">
                    <Building2 className="w-3.5 h-3.5 text-[#024BAB]" />
                    Department Name
                  </label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="border-2 border-black w-full px-3 py-2 text-sm"
                    required
                    placeholder="e.g. Engineering"
                  />
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-bold text-black mb-1">
                    <Hash className="w-3.5 h-3.5 text-[#024BAB]" />
                    Code
                  </label>
                  <input
                    value={form.code}
                    onChange={(e) =>
                      setForm({ ...form, code: e.target.value.toUpperCase() })
                    }
                    className="border-2 border-black w-full px-3 py-2 text-sm uppercase"
                    required
                    placeholder="e.g. ENG"
                  />
                </div>
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-xs font-bold text-black mb-1">
                  <FileText className="w-3.5 h-3.5 text-[#024BAB]" />
                  Description
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  className="border-2 border-black w-full px-3 py-2 text-sm resize-none"
                  rows={2}
                  placeholder="Optional description"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="border-2 border-black bg-[#024BAB] text-white px-6 py-2.5 text-sm font-bold flex-1"
                >
                  {saving
                    ? "Saving..."
                    : editDept
                      ? "Save Changes"
                      : "Create Department"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="border-2 border-black bg-white text-black px-4 py-2.5 text-sm font-bold"
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
    </AppLayout>
  );
}
