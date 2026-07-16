import { useState, useEffect, useCallback, useMemo } from "react";
import nesthrlogo from "../../assets/nesthr.png";
import { AppLayout } from "@/components/layout/AppLayout";
import { inventoryAPI } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
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
} from "lucide-react";

interface Item {
  _id: string;
  name: string;
  category: string;
  sport: string;
  totalQuantity: number;
  availableQuantity: number;
  unitCost?: number;
  reorderThreshold: number;
}

type SortKey = "name" | "category" | "available" | "total";

export default function InventoryPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const canManage = user?.role === "super_admin" || user?.role === "hr_manager";

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [txnFor, setTxnFor] = useState<Item | null>(null);
  const [txnQty, setTxnQty] = useState("1");
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await inventoryAPI.getAll();
      setItems(r.data);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

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
    setShowForm(false);
  };

  const handleSave = async () => {
    if (saving) return;
    if (!form.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const r = await inventoryAPI.create({
        ...form,
        totalQuantity: Number(form.totalQuantity) || 0,
        unitCost: Number(form.unitCost) || 0,
        reorderThreshold: Number(form.reorderThreshold) || 0,
      });
      setItems((p) => [...p, r.data]);
      toast({ title: "Item added" });
      resetForm();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleTxn = async (
    type: "purchase" | "consume" | "damage" | "return",
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

  const sportOptions = useMemo(
    () => Array.from(new Set(items.map((i) => i.sport).filter(Boolean))).sort(),
    [items],
  );

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (search && !i.name.toLowerCase().includes(search.toLowerCase()))
        return false;
      if (filterCategory && i.category !== filterCategory) return false;
      if (filterSport && i.sport !== filterSport) return false;
      if (lowStockOnly && i.availableQuantity > i.reorderThreshold)
        return false;
      return true;
    });
  }, [items, search, filterCategory, filterSport, lowStockOnly]);

  const displayed = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else if (sortKey === "category")
        cmp = a.category.localeCompare(b.category);
      else if (sortKey === "available")
        cmp = a.availableQuantity - b.availableQuantity;
      else if (sortKey === "total") cmp = a.totalQuantity - b.totalQuantity;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

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
        {canManage && (
          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="border-2 border-black bg-[#024BAB] text-white px-4 py-2 text-sm flex items-center gap-1.5 font-bold hover:bg-[#01368A] transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Item
          </button>
        )}
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
            <p className="text-2xl font-bold text-black">{items.length}</p>
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
          <h3 className="font-bold text-base mb-4">Add Inventory Item</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase mb-1">
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
              <label className="block text-xs font-bold uppercase mb-1">
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
              <label className="block text-xs font-bold uppercase mb-1">
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
              <label className="block text-xs font-bold uppercase mb-1">
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
              <label className="block text-xs font-bold uppercase mb-1">
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
              <label className="block text-xs font-bold uppercase mb-1">
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
          <h3 className="font-bold text-base mb-4">
            Stock Movement — {txnFor.name}
          </h3>
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="number"
              value={txnQty}
              onChange={(e) => setTxnQty(e.target.value)}
              className="w-28 border-2 border-black px-3 py-2 text-sm font-medium outline-none"
            />
            <button
              onClick={() => handleTxn("purchase")}
              className="flex items-center gap-1 bg-green-500 text-white border-2 border-black px-3 py-2 text-xs font-bold uppercase"
            >
              <ArrowDownCircle className="w-3.5 h-3.5" /> Purchase
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
                  {canManage && (
                    <button
                      onClick={() => setTxnFor(i)}
                      className="mt-3 w-full border-2 border-black bg-white py-2 text-xs font-bold hover:bg-[#024BAB]/5"
                    >
                      Record Movement
                    </button>
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
                          <button
                            onClick={() => setTxnFor(i)}
                            className="text-xs font-bold text-[#024BAB] hover:underline"
                          >
                            Record movement →
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </AppLayout>
  );
}
