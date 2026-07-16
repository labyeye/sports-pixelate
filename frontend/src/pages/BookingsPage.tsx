import { useState, useEffect, useCallback, useMemo } from "react";
import nesthrlogo from "../../assets/nesthr.png";
import { AppLayout } from "@/components/layout/AppLayout";
import { bookingAPI, facilityAPI, studentAPI } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  CalendarClock,
  Plus,
  Loader2,
  X,
  Search,
  ArrowUp,
  ArrowDown,
  IndianRupee,
  CheckCircle2,
} from "lucide-react";

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface Booking {
  _id: string;
  facility: { _id: string; name: string; hourlyFee: number };
  student?: { _id: string; firstName: string; lastName: string };
  bookedBy: { _id: string; name: string };
  date: string;
  startTime: string;
  endTime: string;
  fee: number;
  status: string;
  paymentStatus: string;
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const STATUS_META: Record<string, { bg: string; text: string }> = {
  confirmed: { bg: "bg-green-50", text: "text-green-700" },
  cancelled: { bg: "bg-red-50", text: "text-red-600" },
  completed: { bg: "bg-gray-50", text: "text-gray-500" },
};

type SortKey = "date" | "facility" | "fee";

export default function BookingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isParent = user?.role === "parent";

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [facilities, setFacilities] = useState<any[]>([]);
  const [children, setChildren] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    facilityId: "",
    studentId: "",
    date: toDateStr(new Date()),
    startTime: "09:00",
    endTime: "10:00",
  });

  const [search, setSearch] = useState("");
  const [filterFacility, setFilterFacility] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [bookingRes, facilityRes] = await Promise.all([
        bookingAPI.getAll(),
        facilityAPI.getAll(),
      ]);
      setBookings(bookingRes.data);
      setFacilities(facilityRes.data);
      if (isParent) {
        const studRes = await studentAPI.getAll();
        setChildren(studRes.data);
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [isParent]);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setForm({
      facilityId: "",
      studentId: "",
      date: toDateStr(new Date()),
      startTime: "09:00",
      endTime: "10:00",
    });
    setShowForm(false);
  };

  const handleCreate = async () => {
    if (saving) return;
    if (!form.facilityId) {
      toast({ title: "Choose a facility", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await bookingAPI.create(form);
      if (res.payment) {
        const loaded = await loadRazorpayScript();
        if (!loaded) throw new Error("Failed to load Razorpay checkout.");
        await new Promise<void>((resolve, reject) => {
          const rzp = new window.Razorpay({
            key: res.payment.keyId,
            order_id: res.payment.orderId,
            amount: res.payment.amount * 100,
            currency: res.payment.currency,
            name: "NestSports",
            description: "Facility booking",
            theme: { color: "#024BAB" },
            handler: async (response: any) => {
              try {
                await bookingAPI.verifyPayment({
                  bookingId: res.data._id,
                  razorpayOrderId: response.razorpay_order_id,
                  razorpayPaymentId: response.razorpay_payment_id,
                  razorpaySignature: response.razorpay_signature,
                });
                resolve();
              } catch (err: any) {
                reject(err);
              }
            },
            modal: { ondismiss: () => reject(new Error("Payment cancelled")) },
          });
          rzp.open();
        });
      }
      toast({ title: "Booking confirmed" });
      resetForm();
      load();
    } catch (e: any) {
      if (e.message !== "Payment cancelled") {
        toast({
          title: "Error",
          description: e.message,
          variant: "destructive",
        });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm("Cancel this booking?")) return;
    try {
      await bookingAPI.cancel(id);
      toast({ title: "Booking cancelled" });
      load();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const filtered = useMemo(() => {
    return bookings.filter((b) => {
      if (search) {
        const name = b.student
          ? `${b.student.firstName} ${b.student.lastName}`
          : b.bookedBy?.name || "";
        const hay = `${b.facility?.name || ""} ${name}`.toLowerCase();
        if (!hay.includes(search.toLowerCase())) return false;
      }
      if (filterFacility && b.facility?._id !== filterFacility) return false;
      if (filterStatus && b.status !== filterStatus) return false;
      return true;
    });
  }, [bookings, search, filterFacility, filterStatus]);

  const displayed = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "date")
        cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
      else if (sortKey === "facility")
        cmp = (a.facility?.name || "").localeCompare(b.facility?.name || "");
      else if (sortKey === "fee") cmp = a.fee - b.fee;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const confirmedCount = bookings.filter(
    (b) => b.status === "confirmed",
  ).length;
  const totalRevenue = bookings.reduce(
    (s, b) => s + (b.paymentStatus === "completed" ? b.fee : 0),
    0,
  );

  return (
    <AppLayout title="Bookings">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="font-display font-bold text-2xl text-black">Bookings</h1>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="border-2 border-black bg-[#024BAB] text-white px-4 py-2 text-sm flex items-center gap-1.5 font-bold hover:bg-[#01368A] transition-colors"
        >
          <Plus className="w-4 h-4" /> New Booking
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-5">
        <div className="border-2 border-black bg-white p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#024BAB]/10 border-2 border-[#024BAB] flex items-center justify-center shrink-0">
            <CalendarClock className="w-5 h-5 text-[#024BAB]" />
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Total Bookings
            </p>
            <p className="text-2xl font-bold text-black">{bookings.length}</p>
          </div>
        </div>
        <div className="border-2 border-black bg-white p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#00C48C]/10 border-2 border-[#00C48C] flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5 text-[#00C48C]" />
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Confirmed
            </p>
            <p className="text-2xl font-bold text-black">{confirmedCount}</p>
          </div>
        </div>
        <div className="border-2 border-black bg-white p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#024BAB]/10 border-2 border-[#024BAB] flex items-center justify-center shrink-0">
            <IndianRupee className="w-5 h-5 text-[#024BAB]" />
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Total Revenue
            </p>
            <p className="text-2xl font-bold text-black">
              ₹{totalRevenue.toLocaleString("en-IN")}
            </p>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex items-center gap-2 border-2 border-black bg-white px-3 py-2 flex-1 min-w-48">
          <Search className="w-4 h-4 shrink-0" />
          <input
            type="text"
            placeholder="Search by facility or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-sm outline-none w-full font-medium"
          />
        </div>
        <select
          value={filterFacility}
          onChange={(e) => setFilterFacility(e.target.value)}
          className="border-2 border-black bg-white px-3 py-2 text-sm font-semibold outline-none"
        >
          <option value="">All Facilities</option>
          {facilities.map((f) => (
            <option key={f._id} value={f._id}>
              {f.name}
            </option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="border-2 border-black bg-white px-3 py-2 text-sm font-semibold outline-none"
        >
          <option value="">All Status</option>
          <option value="confirmed">Confirmed</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        {(search || filterFacility || filterStatus) && (
          <button
            onClick={() => {
              setSearch("");
              setFilterFacility("");
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
          <option value="date">Sort: Date</option>
          <option value="facility">Sort: Facility</option>
          <option value="fee">Sort: Fee</option>
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

      {showForm && (
        <div className="bg-white border-2 border-black p-6 mb-6">
          <h3 className="font-bold text-base mb-4">New Booking</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase mb-1">
                Facility *
              </label>
              <select
                value={form.facilityId}
                onChange={(e) =>
                  setForm((p) => ({ ...p, facilityId: e.target.value }))
                }
                className="w-full border-2 border-black px-3 py-2 text-sm font-medium bg-white outline-none"
              >
                <option value="">Choose a facility</option>
                {facilities.map((f) => (
                  <option key={f._id} value={f._id}>
                    {f.name}{" "}
                    {f.hourlyFee > 0 ? `(₹${f.hourlyFee}/hr)` : "(free)"}
                  </option>
                ))}
              </select>
            </div>
            {isParent && (
              <div>
                <label className="block text-xs font-bold uppercase mb-1">
                  For Child
                </label>
                <select
                  value={form.studentId}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, studentId: e.target.value }))
                  }
                  className="w-full border-2 border-black px-3 py-2 text-sm font-medium bg-white outline-none"
                >
                  <option value="">—</option>
                  {children.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.firstName} {c.lastName}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-bold uppercase mb-1">
                Date
              </label>
              <input
                type="date"
                value={form.date}
                onChange={(e) =>
                  setForm((p) => ({ ...p, date: e.target.value }))
                }
                className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none"
              />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-xs font-bold uppercase mb-1">
                  Start
                </label>
                <input
                  type="time"
                  value={form.startTime}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, startTime: e.target.value }))
                  }
                  className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-bold uppercase mb-1">
                  End
                </label>
                <input
                  type="time"
                  value={form.endTime}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, endTime: e.target.value }))
                  }
                  className="w-full border-2 border-black px-3 py-2 text-sm font-medium outline-none"
                />
              </div>
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={handleCreate}
              disabled={saving}
              className="flex items-center gap-2 bg-[#024BAB] text-white border-2 border-black px-4 py-2 font-bold text-sm uppercase disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CalendarClock className="w-4 h-4" />
              )}
              Book
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
          <CalendarClock className="w-12 h-12 text-muted-foreground/30 mb-3" />
          <p className="font-bold text-black">No bookings found</p>
          <p className="text-sm text-muted-foreground mt-1">
            Try adjusting your filters
          </p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="grid grid-cols-1 gap-3 sm:hidden">
            {displayed.map((b) => {
              const m = STATUS_META[b.status] || STATUS_META.confirmed;
              return (
                <div key={b._id} className="border-2 border-black bg-white p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-bold text-black">{b.facility?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {b.student
                          ? `${b.student.firstName} ${b.student.lastName}`
                          : b.bookedBy?.name}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "border-2 text-[10px] font-bold uppercase px-1.5 py-0.5 shrink-0",
                        m.bg,
                        m.text,
                        "border-black/10",
                      )}
                    >
                      {b.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mb-3">
                    <div>
                      <span className="text-muted-foreground">Date: </span>
                      <span className="font-bold text-black">
                        {new Date(b.date).toLocaleDateString("en-IN")}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Time: </span>
                      <span className="font-bold text-black">
                        {b.startTime}–{b.endTime}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Fee: </span>
                      <span className="font-bold text-black">
                        {b.fee > 0 ? `₹${b.fee}` : "Free"}
                      </span>
                    </div>
                  </div>
                  {b.status === "confirmed" && (
                    <button
                      onClick={() => handleCancel(b._id)}
                      className="w-full border-2 border-black bg-white py-2 text-xs font-bold text-red-600 hover:bg-red-50"
                    >
                      Cancel Booking
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
                    "Facility",
                    "For",
                    "Date",
                    "Time",
                    "Fee",
                    "Status",
                    "Actions",
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
                {displayed.map((b, idx) => {
                  const m = STATUS_META[b.status] || STATUS_META.confirmed;
                  return (
                    <tr
                      key={b._id}
                      className={cn(
                        "border-b border-black/10 hover:bg-[#024BAB]/5 transition-colors",
                        idx % 2 === 0 ? "" : "bg-[#F8FAFF]",
                      )}
                    >
                      <td className="px-4 py-3 font-bold text-black">
                        {b.facility?.name}
                      </td>
                      <td className="px-4 py-3 text-black">
                        {b.student
                          ? `${b.student.firstName} ${b.student.lastName}`
                          : b.bookedBy?.name}
                      </td>
                      <td className="px-4 py-3 text-black">
                        {new Date(b.date).toLocaleDateString("en-IN")}
                      </td>
                      <td className="px-4 py-3 text-black">
                        {b.startTime}–{b.endTime}
                      </td>
                      <td className="px-4 py-3 text-black font-medium">
                        {b.fee > 0 ? `₹${b.fee}` : "Free"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "text-[10px] font-bold uppercase px-1.5 py-0.5 border",
                            m.bg,
                            m.text,
                            "border-black/10",
                          )}
                        >
                          {b.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {b.status === "confirmed" && (
                          <button
                            onClick={() => handleCancel(b._id)}
                            className="text-xs font-bold text-red-500 hover:underline"
                          >
                            Cancel
                          </button>
                        )}
                      </td>
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
