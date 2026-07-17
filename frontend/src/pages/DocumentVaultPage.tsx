import { useState, useEffect, useRef } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { employeeAPI } from "@/services/api";
import { documentAPI } from "@/services/api";
import {
  FolderOpen,
  Upload,
  Download,
  Trash2,
  X,
  Search,
  FileText,
  File,
  Shield,
  Scroll,
  Briefcase,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const DOC_TYPES = [
  { value: "id_proof", label: "ID Proof", icon: Shield },
  { value: "certificate", label: "Certificate", icon: Scroll },
  { value: "contract", label: "Contract", icon: FileText },
  { value: "resume", label: "Resume", icon: Briefcase },
  { value: "offer_letter", label: "Offer Letter", icon: File },
  { value: "other", label: "Other", icon: File },
];

const DOC_TYPE_MAP: Record<string, string> = Object.fromEntries(
  DOC_TYPES.map((d) => [d.value, d.label]),
);

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentVaultPage() {
  const { user } = useAuth();
  const isEmployee = user?.role === "employee";
  const [docs, setDocs] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [filterType, setFilterType] = useState("");
  const [search, setSearch] = useState("");
  const [uploadModal, setUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    employeeId: "",
    name: "",
    docType: "id_proof",
  });
  const [fileObj, setFileObj] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  const docParams = (pageNum: number, empId?: string): Record<string, string> => {
    const params: Record<string, string> = { page: String(pageNum), limit: "20" };
    const targetEmp = empId !== undefined ? empId : selectedEmployee;
    if (targetEmp) params.employeeId = targetEmp;
    if (filterType) params.docType = filterType;
    if (search) params.search = search;
    return params;
  };

  const load = async (empId?: string) => {
    setLoading(true);
    try {
      const res = await documentAPI.getAll(docParams(1, empId));
      if (res.success) {
        setDocs(res.data);
        setPage(1);
        setPages(res.pages || 1);
        setTotal(res.total ?? res.data.length);
      }
    } catch {}
    setLoading(false);
  };

  const loadMore = async () => {
    if (loadingMore || page >= pages) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const res = await documentAPI.getAll(docParams(next));
      if (res.success) {
        setDocs((p) => [...p, ...res.data]);
        setPage(next);
        setPages(res.pages || 1);
      }
    } catch {}
    setLoadingMore(false);
  };

  useEffect(() => {
    if (!isEmployee) {
      employeeAPI
        .getAll({ status: "active" })
        .then((r) => {
          if (r.success) setEmployees(r.data);
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType, search]);

  const handleEmployeeChange = (id: string) => {
    setSelectedEmployee(id);
    load(id);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileObj(f);
    if (!form.name)
      setForm((prev) => ({ ...prev, name: f.name.replace(/\.[^.]+$/, "") }));
  };

  const handleUpload = async () => {
    if (!fileObj || !form.name || !form.docType) return;
    if (!isEmployee && !form.employeeId) return;

    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const fileData = e.target?.result as string;
        await documentAPI.upload({
          employeeId: form.employeeId || undefined,
          name: form.name,
          docType: form.docType,
          mimeType: fileObj.type,
          fileData,
        });
        setUploadModal(false);
        setForm({ employeeId: "", name: "", docType: "id_proof" });
        setFileObj(null);
        load(form.employeeId || undefined);
      };
      reader.readAsDataURL(fileObj);
    } catch (err: any) {
      alert(err.message || "Upload failed");
    }
    setUploading(false);
  };

  const handleDownload = async (doc: any) => {
    try {
      const res = await documentAPI.download(doc._id);
      if (!res.success) throw new Error("Download failed");
      const { fileData, mimeType, name } = res.data;
      const byteChars = atob(fileData);
      const byteArr = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++)
        byteArr[i] = byteChars.charCodeAt(i);
      const blob = new Blob([byteArr], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || "Download failed");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this document?")) return;
    try {
      await documentAPI.delete(id);
      setDocs((prev) => prev.filter((d) => d._id !== id));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const displayed = docs;

  return (
    <AppLayout title="Document Vault">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex flex-wrap gap-2 flex-1">
          {!isEmployee && (
            <div className="relative">
              <select
                value={selectedEmployee}
                onChange={(e) => handleEmployeeChange(e.target.value)}
                className="border-2 border-black px-3 py-2 text-sm font-semibold outline-none bg-white pr-8 appearance-none"
              >
                <option value="">All Employees</option>
                {employees.map((e) => (
                  <option key={e._id} value={e._id}>
                    {e.firstName} {e.lastName}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          )}
          <div className="relative">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="border-2 border-black px-3 py-2 text-sm font-semibold outline-none bg-white pr-8 appearance-none"
            >
              <option value="">All Types</option>
              {DOC_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          <div className="flex items-center gap-2 border-2 border-black bg-white px-3 py-2 min-w-48">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              type="text"
              placeholder="Search by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent text-sm outline-none w-full font-medium"
            />
            {search && (
              <button onClick={() => setSearch("")}>
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
        {!isEmployee && (
          <button
            onClick={() => setUploadModal(true)}
            className="border-2 bg-[#024BAB] text-white px-4 py-2 text-sm flex items-center gap-1.5 font-bold"
          >
            <Upload className="w-4 h-4" /> Upload Document
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-[#024BAB] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : displayed.length === 0 ? (
        <div className="border-2 bg-white p-12 flex flex-col items-center justify-center">
          <FolderOpen className="w-12 h-12 text-muted-foreground/30 mb-3" />
          <p className="font-bold text-black">No documents found</p>
          <p className="text-sm text-muted-foreground mt-1">
            {!isEmployee
              ? "Upload documents for employees"
              : "No documents uploaded yet"}
          </p>
        </div>
      ) : (
        <div className="border-2 bg-white overflow-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b-2 border-black bg-[#024BAB]/5">
                {[
                  "Document Name",
                  "Type",
                  !isEmployee ? "Employee" : null,
                  "Size",
                  "Uploaded",
                  "",
                ]
                  .filter(Boolean)
                  .map((h) => (
                    <th
                      key={h as string}
                      className="px-4 py-3 text-xs font-bold text-black uppercase tracking-wider text-left"
                    >
                      {h}
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody>
              {displayed.map((doc) => {
                const TypeIcon =
                  DOC_TYPES.find((t) => t.value === doc.docType)?.icon || File;
                return (
                  <tr
                    key={doc._id}
                    className="border-b border-black/10 hover:bg-[#024BAB]/5"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <TypeIcon className="w-4 h-4 text-[#024BAB] shrink-0" />
                        <span className="font-semibold text-black">
                          {doc.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="border-2 border-[#024BAB] text-[#024BAB] text-[10px] font-bold px-2 py-0.5">
                        {DOC_TYPE_MAP[doc.docType] || doc.docType}
                      </span>
                    </td>
                    {!isEmployee && (
                      <td className="px-4 py-3 font-medium text-black text-xs">
                        {doc.employee?.firstName} {doc.employee?.lastName}
                        <p className="text-[10px] text-muted-foreground">
                          {doc.employee?.employeeId}
                        </p>
                      </td>
                    )}
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {formatBytes(doc.sizeBytes)}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(doc.createdAt).toLocaleDateString("en-IN")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleDownload(doc)}
                          className="flex items-center gap-1 text-xs font-bold border-2 border-black px-2 py-1 hover:bg-[#024BAB] hover:text-white transition-colors"
                        >
                          <Download className="w-3 h-3" /> Download
                        </button>
                        {!isEmployee && (
                          <button
                            onClick={() => handleDelete(doc._id)}
                            className="flex items-center gap-1 text-xs font-bold border-2 border-red-500 text-red-500 px-2 py-1 hover:bg-red-500 hover:text-white transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {page < pages && (
            <div className="flex flex-col items-center gap-2 py-4">
              <p className="text-xs text-muted-foreground">
                Showing {docs.length} of {total}
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
        </div>
      )}

      {uploadModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="border-2 bg-white w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b-2 border-black">
              <h3 className="font-display font-bold text-lg">
                Upload Document
              </h3>
              <button
                onClick={() => {
                  setUploadModal(false);
                  setFileObj(null);
                  setForm({ employeeId: "", name: "", docType: "id_proof" });
                }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-black uppercase tracking-wider mb-1">
                  Employee *
                </label>
                <select
                  value={form.employeeId}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, employeeId: e.target.value }))
                  }
                  className="border-2 border-black px-3 py-2 text-sm font-medium outline-none bg-white w-full"
                >
                  <option value="">Select Employee</option>
                  {employees.map((e) => (
                    <option key={e._id} value={e._id}>
                      {e.firstName} {e.lastName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-black uppercase tracking-wider mb-1">
                  Document Type *
                </label>
                <select
                  value={form.docType}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, docType: e.target.value }))
                  }
                  className="border-2 border-black px-3 py-2 text-sm font-medium outline-none bg-white w-full"
                >
                  {DOC_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-black uppercase tracking-wider mb-1">
                  Document Name *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, name: e.target.value }))
                  }
                  placeholder="e.g. Aadhar Card"
                  className="border-2 border-black px-3 py-2 text-sm font-medium outline-none w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-black uppercase tracking-wider mb-1">
                  File * (max 4 MB)
                </label>
                <input
                  ref={fileRef}
                  type="file"
                  onChange={handleFileChange}
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  className={cn(
                    "border-2 border-dashed border-black w-full py-4 text-sm font-semibold flex flex-col items-center gap-1 hover:bg-[#024BAB]/5 transition-colors",
                    fileObj
                      ? "border-[#00C48C] text-[#00C48C]"
                      : "text-muted-foreground",
                  )}
                >
                  <Upload className="w-5 h-5" />
                  {fileObj ? fileObj.name : "Click to select file"}
                  {fileObj && (
                    <span className="text-[10px]">
                      {formatBytes(fileObj.size)}
                    </span>
                  )}
                </button>
              </div>
              <button
                onClick={handleUpload}
                disabled={
                  uploading || !fileObj || !form.name || !form.employeeId
                }
                className="border-2 bg-[#024BAB] text-white px-6 py-2.5 text-sm font-bold w-full disabled:opacity-50"
              >
                {uploading ? "Uploading..." : "Upload Document"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
