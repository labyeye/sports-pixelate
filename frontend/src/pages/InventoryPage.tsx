import { useState, useEffect, useCallback } from "react";
import nesthrlogo from "../../assets/nesthr.png";
import { AppLayout } from "@/components/layout/AppLayout";
import { inventoryAPI, studentAPI, employeeAPI } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  ImportExportModal,
  type ImportHeader,
} from "@/components/ImportExportModal";
import { exportRowsToExcel } from "@/utils/excelImportExport";
import {
  Package,
  Plus,
  Check,
  X,
  Loader2,
  ArrowDownCircle,
  ArrowUpCircle,
  Search,
  ArrowUp,
  ArrowDown,
  Boxes,
  AlertTriangle,
  Edit2,
  Trash2,
  UserCheck,
  Undo2,
  Truck,
  Download,
  FileSpreadsheet,
  Tag,
  Layers,
  Trophy,
  Hash,
  IndianRupee,
  User,
  FileText,
} from "lucide-react";

const INVENTORY_IMPORT_HEADERS: ImportHeader[] = [
  { key: "name", label: "Item Name", required: true, example: "Tennis Racket" },
  {
    key: "category",
    label: "Category",
    required: true,
    example: "equipment",
  },
  { key: "sport", label: "Sport", required: false, example: "Tennis" },
  {
    key: "trackQuantity",
    label: "Track Quantity",
    required: false,
    example: "true",
  },
  {
    key: "totalQuantity",
    label: "Total Quantity",
    required: false,
    example: "20",
  },
  {
    key: "availableQuantity",
    label: "Available Quantity",
    required: false,
    example: "20",
  },
  {
    key: "onOrderQuantity",
    label: "On Order Quantity",
    required: false,
    example: "0",
  },
  { key: "unitCost", label: "Unit Cost", required: false, example: "1500" },
  {
    key: "reorderThreshold",
    label: "Reorder Threshold",
    required: false,
    example: "5",
  },
];

interface Assignment {
  _id: string;
  assignedTo: { _id: string; firstName: string; lastName: string } | string;
  assignedToModel: "Student" | "Employee";
  quantity: number;
  assignedAt: string;
  returnedAt?: string;
  notes?: string;
}

interface Item {
  _id: string;
  name: string;
  category: string;
  sport: string;
  totalQuantity: number;
  availableQuantity: number;
  onOrderQuantity?: number;
  unitCost?: number;
  reorderThreshold: number;
  assignments?: Assignment[];
}

interface Person {
  _id: string;
  firstName: string;
  lastName: string;
}

type SortKey = "name" | "category" | "available" | "total";

export default function InventoryPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const canManage = user?.role === "super_admin" || user?.role === "hr_manager";

  const [items, setItems] = useState<Item[]>([]);
  const [importModal, setImportModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [txnFor, setTxnFor] = useState<Item | null>(null);
  const [txnQty, setTxnQty] = useState("1");
  const [assignFor, setAssignFor] = useState<Item | null>(null);
  const [assignSaving, setAssignSaving] = useState(false);
  const [assignForm, setAssignForm] = useState({
    assignedToModel: "Student" as "Student" | "Employee",
    assignedTo: "",
    quantity: "1",
    notes: "",
  });
  const [assignPeople, setAssignPeople] = useState<Person[]>([]);
  const [assignPeopleLoading, setAssignPeopleLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    category: "equipment",
    sport: "",
    totalQuantity: "0",
    unitCost: "",
    reorderThreshold: "0",
  });

  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterSport, setFilterSport] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  const SORT_FIELD: Record<SortKey, string> = {
    name: "name",
    category: "category",
    available: "availableQuantity",
    total: "totalQuantity",
  };

  const itemParams = useCallback(
    (pageNum: number): Record<string, string> => {
      const params: Record<string, string> = {
        page: String(pageNum),
        limit: "20",
      };
      if (search) params.search = search;
      if (filterCategory) params.category = filterCategory;
      if (filterSport) params.sport = filterSport;
      if (lowStockOnly) params.lowStock = "true";
      params.sortBy = SORT_FIELD[sortKey];
      params.sortDir = sortDir;
      return params;
    },
    [search, filterCategory, filterSport, lowStockOnly, sortKey, sortDir],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await inventoryAPI.getAll(itemParams(1));
      setItems(r.data);
      setPage(1);
      setPages(r.pages || 1);
      setTotal(r.total ?? r.data.length);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [itemParams]);

  const loadMore = async () => {
    if (loadingMore || page >= pages) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const r = await inventoryAPI.getAll(itemParams(next));
      setItems((p) => [...p, ...r.data]);
      setPage(next);
      setPages(r.pages || 1);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
    setLoadingMore(false);
  };

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setForm({
      name: "",
      category: "equipment",
      sport: "",
      totalQuantity: "0",
      unitCost: "",
      reorderThreshold: "0",
    });
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (i: Item) => {
    setEditingId(i._id);
    setForm({
      name: i.name,
      category: i.category,
      sport: i.sport || "",
      totalQuantity: String(i.totalQuantity),
      unitCost: String(i.unitCost || ""),
      reorderThreshold: String(i.reorderThreshold),
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (saving) return;
    if (!form.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        totalQuantity: Number(form.totalQuantity) || 0,
        unitCost: Number(form.unitCost) || 0,
        reorderThreshold: Number(form.reorderThreshold) || 0,
      };
      if (editingId) {
        const r = await inventoryAPI.update(editingId, payload);
        setItems((p) => p.map((x) => (x._id === editingId ? r.data : x)));
        toast({ title: "Item updated" });
      } else {
        const r = await inventoryAPI.create(payload);
        setItems((p) => [...p, r.data]);
        toast({ title: "Item added" });
      }
      resetForm();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this inventory item? This cannot be undone.")) return;
    try {
      await inventoryAPI.delete(id);
      setItems((p) => p.filter((x) => x._id !== id));
      toast({ title: "Item deleted" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleTxn = async (
    type: "order" | "purchase" | "consume" | "damage" | "return",
  ) => {
    if (!txnFor) return;
    const qty = Number(txnQty);
    if (!qty || qty <= 0) {
      toast({ title: "Enter a valid quantity", variant: "destructive" });
      return;
    }
    try {
      const r = await inventoryAPI.recordTransaction(txnFor._id, {
        type,
        quantity: qty,
      });
      setItems((p) => p.map((i) => (i._id === txnFor._id ? r.data.item : i)));
      toast({ title: `Recorded ${type}` });
      setTxnFor(null);
      setTxnQty("1");
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const openAssign = (item: Item) => {
    setAssignFor(item);
    setAssignForm({
      assignedToModel: "Student",
      assignedTo: "",
      quantity: "1",
      notes: "",
    });
  };

  useEffect(() => {
    if (!assignFor) return;
    setAssignPeopleLoading(true);
    setAssignPeople([]);
    const api =
      assignForm.assignedToModel === "Student" ? studentAPI : employeeAPI;
    api
      .getAll({ limit: "500" })
      .then((r: any) => setAssignPeople(r.data || []))
      .catch(() => {})
      .finally(() => setAssignPeopleLoading(false));
  }, [assignFor, assignForm.assignedToModel]);

  const handleAssign = async () => {
    if (!assignFor) return;
    const qty = Number(assignForm.quantity);
    if (!assignForm.assignedTo) {
      toast({ title: "Select who is taking the item", variant: "destructive" });
      return;
    }
    if (!qty || qty <= 0) {
      toast({ title: "Enter a valid quantity", variant: "destructive" });
      return;
    }
    setAssignSaving(true);
    try {
      const r = await inventoryAPI.assign(assignFor._id, {
        assignedTo: assignForm.assignedTo,
        assignedToModel: assignForm.assignedToModel,
        quantity: qty,
        notes: assignForm.notes || undefined,
      });
      setItems((p) => p.map((i) => (i._id === assignFor._id ? r.data : i)));
      setAssignFor(r.data);
      setAssignForm((f) => ({
        ...f,
        assignedTo: "",
        quantity: "1",
        notes: "",
      }));
      toast({ title: "Item checked out" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setAssignSaving(false);
    }
  };

  const handleReturnAssignment = async (assignmentId: string) => {
    if (!assignFor) return;
    try {
      const r = await inventoryAPI.returnAssignment(
        assignFor._id,
        assignmentId,
      );
      setItems((p) => p.map((i) => (i._id === assignFor._id ? r.data : i)));
      setAssignFor(r.data);
      toast({ title: "Item returned" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const [sportOptions, setSportOptions] = useState<string[]>([]);
  useEffect(() => {
    inventoryAPI
      .getAll({ limit: "200" })
      .then((r) =>
        setSportOptions(
          Array.from(
            new Set((r.data as Item[]).map((i) => i.sport).filter(Boolean)),
          ).sort(),
        ),
      )
      .catch(() => {});
  }, []);

  const displayed = items;

  const lowStockCount = items.filter(
    (i) => i.availableQuantity <= i.reorderThreshold,
  ).length;
  const totalAvailable = items.reduce(
    (s, i) => s + (i.availableQuantity || 0),
    0,
  );

  return (
    <AppLayout title="Inventory">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="font-display font-bold text-2xl text-black">
          Inventory
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              exportRowsToExcel(
                INVENTORY_IMPORT_HEADERS.map((h) => ({
                  key: h.key,
                  label: h.label,
                })),
                displayed,
                "inventory_export.xlsx",
                "Inventory",
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
                <Plus className="w-4 h-4" /> Add Item
              </button>
            </>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-5">
        <div className="border-2 border-black bg-white p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#024BAB]/10 border-2 border-[#024BAB] flex items-center justify-center shrink-0">
            <Package className="w-5 h-5 text-[#024BAB]" />
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Total Items
            </p>
            <p className="text-2xl font-bold text-black">{total}</p>
          </div>
        </div>
        <div className="border-2 border-black bg-white p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#00C48C]/10 border-2 border-[#00C48C] flex items-center justify-center shrink-0">
            <Boxes className="w-5 h-5 text-[#00C48C]" />
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Units Available
            </p>
            <p className="text-2xl font-bold text-black">{totalAvailable}</p>
          </div>
        </div>
        <div className="border-2 border-black bg-white p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#EF4444]/10 border-2 border-[#EF4444] flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-[#EF4444]" />
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Low Stock Items
            </p>
            <p className="text-2xl font-bold text-[#EF4444]">{lowStockCount}</p>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex items-center gap-2 border-2 border-black bg-white px-3 py-2 flex-1 min-w-48">
          <Search className="w-4 h-4 shrink-0" />
          <input
            type="text"
            placeholder="Search by item name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-sm outline-none w-full font-medium"
          />
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="border-2 border-black bg-white px-3 py-2 text-sm font-semibold outline-none"
        >
          <option value="">All Categories</option>
          {["equipment", "apparel", "consumable", "other"].map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
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
        <button
          onClick={() => setLowStockOnly((v) => !v)}
          className={cn(
            "border-2 border-black px-3 py-2 text-sm font-bold transition-colors",
            lowStockOnly
              ? "bg-[#EF4444] text-white"
              : "bg-white text-black hover:bg-red-50",
          )}
        >
          Low Stock Only
        </button>
        {(search || filterCategory || filterSport || lowStockOnly) && (
          <button
            onClick={() => {
              setSearch("");
              setFilterCategory("");
              setFilterSport("");
              setLowStockOnly(false);
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
          <option value="category">Sort: Category</option>
          <option value="available">Sort: Available Qty</option>
          <option value="total">Sort: Total Qty</option>
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
            {editingId ? "Edit Inventory Item" : "Add Inventory Item"}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold uppercase mb-1">
                <Tag className="w-3.5 h-3.5 text-[#024BAB]" />
                Name *
              </label>
              <input
                value={form.name}
                onChange={(e) =>
                  setForm((p) => ({ ...p, name: e.target.value }))
                }
                placeholder="e.g. Tennis Racket"
                className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none"
              />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold uppercase mb-1">
                <Layers className="w-3.5 h-3.5 text-[#024BAB]" />
                Category
              </label>
              <select
                value={form.category}
                onChange={(e) =>
                  setForm((p) => ({ ...p, category: e.target.value }))
                }
                className="w-full border-2 border-black px-3 py-2 text-sm font-medium bg-white outline-none"
              >
                {["equipment", "apparel", "consumable", "other"].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold uppercase mb-1">
                <Trophy className="w-3.5 h-3.5 text-[#024BAB]" />
                Sport
              </label>
              <input
                value={form.sport}
                onChange={(e) =>
                  setForm((p) => ({ ...p, sport: e.target.value }))
                }
                className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none"
              />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold uppercase mb-1">
                <Hash className="w-3.5 h-3.5 text-[#024BAB]" />
                Initial Quantity
              </label>
              <input
                type="number"
                value={form.totalQuantity}
                onChange={(e) =>
                  setForm((p) => ({ ...p, totalQuantity: e.target.value }))
                }
                className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none"
              />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold uppercase mb-1">
                <IndianRupee className="w-3.5 h-3.5 text-[#024BAB]" />
                Unit Cost (₹)
              </label>
              <input
                type="number"
                value={form.unitCost}
                onChange={(e) =>
                  setForm((p) => ({ ...p, unitCost: e.target.value }))
                }
                className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none"
              />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold uppercase mb-1">
                <AlertTriangle className="w-3.5 h-3.5 text-[#024BAB]" />
                Reorder Threshold
              </label>
              <input
                type="number"
                value={form.reorderThreshold}
                onChange={(e) =>
                  setForm((p) => ({ ...p, reorderThreshold: e.target.value }))
                }
                className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none"
              />
            </div>
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
              Save
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

      {txnFor && (
        <div className="bg-white border-2 border-black p-6 mb-6">
          <h3 className="font-bold text-base mb-1">
            Stock Movement — {txnFor.name}
          </h3>
          {!!txnFor.onOrderQuantity && (
            <p className="text-xs font-bold text-purple-600 mb-3">
              {txnFor.onOrderQuantity} unit
              {txnFor.onOrderQuantity === 1 ? "" : "s"} on order, not yet
              received
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="number"
              value={txnQty}
              onChange={(e) => setTxnQty(e.target.value)}
              className="w-28 border-2 border-black px-3 py-2 text-sm font-medium outline-none"
            />
            <button
              onClick={() => handleTxn("order")}
              className="flex items-center gap-1 bg-purple-500 text-white border-2 border-black px-3 py-2 text-xs font-bold uppercase"
            >
              <Truck className="w-3.5 h-3.5" /> Order Placed
            </button>
            <button
              onClick={() => handleTxn("purchase")}
              className="flex items-center gap-1 bg-green-500 text-white border-2 border-black px-3 py-2 text-xs font-bold uppercase"
            >
              <ArrowDownCircle className="w-3.5 h-3.5" /> Received
            </button>
            <button
              onClick={() => handleTxn("return")}
              className="flex items-center gap-1 bg-blue-500 text-white border-2 border-black px-3 py-2 text-xs font-bold uppercase"
            >
              <ArrowDownCircle className="w-3.5 h-3.5" /> Return
            </button>
            <button
              onClick={() => handleTxn("consume")}
              className="flex items-center gap-1 bg-orange-500 text-white border-2 border-black px-3 py-2 text-xs font-bold uppercase"
            >
              <ArrowUpCircle className="w-3.5 h-3.5" /> Consume
            </button>
            <button
              onClick={() => handleTxn("damage")}
              className="flex items-center gap-1 bg-red-500 text-white border-2 border-black px-3 py-2 text-xs font-bold uppercase"
            >
              <ArrowUpCircle className="w-3.5 h-3.5" /> Damage
            </button>
            <button
              onClick={() => setTxnFor(null)}
              className="ml-auto p-2 border-2 border-black"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {assignFor && (
        <div className="bg-white border-2 border-black p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-base">
              Check Out — {assignFor.name}
            </h3>
            <button
              onClick={() => setAssignFor(null)}
              className="p-2 border-2 border-black"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Record who is taking this item so you know where it is and when it's
            due back.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold uppercase mb-1">
                <User className="w-3.5 h-3.5 text-[#024BAB]" />
                Taken by
              </label>
              <select
                value={assignForm.assignedToModel}
                onChange={(e) =>
                  setAssignForm((f) => ({
                    ...f,
                    assignedToModel: e.target.value as "Student" | "Employee",
                    assignedTo: "",
                  }))
                }
                className="w-full border-2 border-black px-3 py-2 text-sm font-medium bg-white outline-none"
              >
                <option value="Student">Student</option>
                <option value="Employee">Employee / Coach</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="flex items-center gap-1.5 text-xs font-bold uppercase mb-1">
                <UserCheck className="w-3.5 h-3.5 text-[#024BAB]" />
                {assignForm.assignedToModel}
              </label>
              <select
                value={assignForm.assignedTo}
                onChange={(e) =>
                  setAssignForm((f) => ({ ...f, assignedTo: e.target.value }))
                }
                className="w-full border-2 border-black px-3 py-2 text-sm font-medium bg-white outline-none"
                disabled={assignPeopleLoading}
              >
                <option value="">
                  {assignPeopleLoading ? "Loading..." : "Select person"}
                </option>
                {assignPeople.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.firstName} {p.lastName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold uppercase mb-1">
                <Hash className="w-3.5 h-3.5 text-[#024BAB]" />
                Quantity
              </label>
              <input
                type="number"
                min={1}
                value={assignForm.quantity}
                onChange={(e) =>
                  setAssignForm((f) => ({ ...f, quantity: e.target.value }))
                }
                className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none"
              />
            </div>
            <div className="md:col-span-3">
              <label className="flex items-center gap-1.5 text-xs font-bold uppercase mb-1">
                <FileText className="w-3.5 h-3.5 text-[#024BAB]" />
                Notes (optional)
              </label>
              <input
                value={assignForm.notes}
                onChange={(e) =>
                  setAssignForm((f) => ({ ...f, notes: e.target.value }))
                }
                placeholder="e.g. for weekend tournament"
                className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none"
              />
            </div>
            <button
              onClick={handleAssign}
              disabled={assignSaving}
              className="flex items-center justify-center gap-2 bg-[#024BAB] text-white border-2 border-black px-4 py-2 font-bold text-xs uppercase disabled:opacity-60"
            >
              {assignSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <UserCheck className="w-4 h-4" />
              )}
              Record
            </button>
          </div>

          {!!assignFor.assignments?.filter((a) => !a.returnedAt).length && (
            <div className="mt-5 border-t-2 border-black pt-4">
              <p className="text-xs font-bold uppercase mb-2">
                Currently taken out
              </p>
              <div className="flex flex-col gap-2">
                {assignFor.assignments
                  .filter((a) => !a.returnedAt)
                  .map((a) => (
                    <div
                      key={a._id}
                      className="flex flex-wrap items-center justify-between gap-2 border-2 border-black px-3 py-2 text-sm"
                    >
                      <span className="font-bold text-black">
                        {typeof a.assignedTo === "object"
                          ? `${a.assignedTo.firstName} ${a.assignedTo.lastName}`
                          : "Unknown"}{" "}
                        <span className="font-medium text-muted-foreground">
                          ({a.assignedToModel}) · Qty {a.quantity}
                        </span>
                      </span>
                      <button
                        onClick={() => handleReturnAssignment(a._id)}
                        className="flex items-center gap-1 bg-blue-500 text-white border-2 border-black px-2 py-1 text-[10px] font-bold uppercase"
                      >
                        <Undo2 className="w-3 h-3" /> Mark Returned
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <img src={nesthrlogo} alt="NestSports" className="h-16 w-auto" />
        </div>
      ) : displayed.length === 0 ? (
        <div className="border-2 border-black bg-white p-12 flex flex-col items-center justify-center">
          <Package className="w-12 h-12 text-muted-foreground/30 mb-3" />
          <p className="font-bold text-black">No inventory items found</p>
          <p className="text-sm text-muted-foreground mt-1">
            Try adjusting your filters
          </p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="grid grid-cols-1 gap-3 sm:hidden">
            {displayed.map((i) => {
              const low = i.availableQuantity <= i.reorderThreshold;
              return (
                <div
                  key={i._id}
                  className={cn(
                    "border-2 border-black bg-white p-4",
                    low && "border-[#EF4444]",
                  )}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-bold text-black">{i.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {i.category} {i.sport ? `· ${i.sport}` : ""}
                      </p>
                    </div>
                    {low && (
                      <span className="border-2 border-[#EF4444] text-[#EF4444] text-[10px] font-bold px-1.5 py-0.5 shrink-0">
                        LOW STOCK
                      </span>
                    )}
                  </div>
                  <p className="text-2xl font-bold text-[#024BAB]">
                    {i.availableQuantity}
                    <span className="text-xs text-muted-foreground font-medium">
                      /{i.totalQuantity} available
                    </span>
                  </p>
                  {!!i.onOrderQuantity && (
                    <p className="text-xs font-bold text-purple-600 flex items-center gap-1 mt-1">
                      <Truck className="w-3 h-3" /> {i.onOrderQuantity} on order
                    </p>
                  )}
                  {canManage && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        onClick={() => openAssign(i)}
                        className="flex-1 border-2 border-black bg-white py-2 text-xs font-bold hover:bg-[#024BAB]/5 flex items-center justify-center gap-1"
                      >
                        <UserCheck className="w-3.5 h-3.5" /> Check Out
                      </button>
                      <button
                        onClick={() => setTxnFor(i)}
                        className="flex-1 border-2 border-black bg-white py-2 text-xs font-bold hover:bg-[#024BAB]/5"
                      >
                        Record Movement
                      </button>
                      <button
                        onClick={() => startEdit(i)}
                        className="p-2 border-2 border-black bg-white hover:bg-[#024BAB]/5"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(i._id)}
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
                    "Item",
                    "Category",
                    "Sport",
                    "Available / Total",
                    "Reorder Threshold",
                    "Status",
                    ...(canManage ? ["Actions"] : []),
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
                {displayed.map((i, idx) => {
                  const low = i.availableQuantity <= i.reorderThreshold;
                  return (
                    <tr
                      key={i._id}
                      className={cn(
                        "border-b border-black/10 hover:bg-[#024BAB]/5 transition-colors",
                        idx % 2 === 0 ? "" : "bg-[#F8FAFF]",
                      )}
                    >
                      <td className="px-4 py-3 font-bold text-black">
                        {i.name}
                      </td>
                      <td className="px-4 py-3 text-black capitalize">
                        {i.category}
                      </td>
                      <td className="px-4 py-3 text-black">{i.sport || "—"}</td>
                      <td className="px-4 py-3 font-bold text-black">
                        {i.availableQuantity}
                        <span className="text-muted-foreground font-medium">
                          /{i.totalQuantity}
                        </span>
                        {!!i.onOrderQuantity && (
                          <span className="block text-[10px] font-bold text-purple-600 flex items-center gap-1 mt-0.5">
                            <Truck className="w-3 h-3" /> {i.onOrderQuantity} on
                            order
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-black">
                        {i.reorderThreshold}
                      </td>
                      <td className="px-4 py-3">
                        {low ? (
                          <span className="border-2 border-[#EF4444] text-[#EF4444] text-[10px] font-bold px-1.5 py-0.5">
                            LOW STOCK
                          </span>
                        ) : (
                          <span className="border-2 border-[#00C48C] text-[#00C48C] text-[10px] font-bold px-1.5 py-0.5">
                            OK
                          </span>
                        )}
                      </td>
                      {canManage && (
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openAssign(i)}
                              className="text-xs font-bold text-[#024BAB] hover:underline mr-2"
                            >
                              Check out →
                            </button>
                            <button
                              onClick={() => setTxnFor(i)}
                              className="text-xs font-bold text-[#024BAB] hover:underline mr-2"
                            >
                              Record movement →
                            </button>
                            <button
                              onClick={() => startEdit(i)}
                              className="p-1.5 border-2 border-transparent hover:border-black hover:bg-[#024BAB]/10 transition-colors"
                              title="Edit"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(i._id)}
                              className="p-1.5 border-2 border-transparent hover:border-black hover:bg-red-50 transition-colors"
                              title="Delete"
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
                Showing {items.length} of {total}
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
        entityLabel="Item"
        headers={INVENTORY_IMPORT_HEADERS}
        templateFilename="inventory_import_template.xlsx"
        notes={
          <>
            <p>
              • <strong>Category</strong> must be one of: <code>equipment</code>
              , <code>apparel</code>, <code>consumable</code>,{" "}
              <code>other</code>.
            </p>
            <p>
              • If <strong>Available Quantity</strong> is blank, it defaults to{" "}
              <strong>Total Quantity</strong>.
            </p>
            <p>
              • Maximum <strong>200 items</strong> per import.
            </p>
          </>
        }
        previewColumns={[
          { key: "name", label: "Name" },
          { key: "category", label: "Category" },
          { key: "totalQuantity", label: "Total Qty" },
          { key: "unitCost", label: "Unit Cost" },
        ]}
        onImport={(rows) => inventoryAPI.bulkImport(rows) as any}
        onImported={load}
      />
    </AppLayout>
  );
}
