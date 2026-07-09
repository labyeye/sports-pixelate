import React, { useState, useEffect } from "react";
import { attendanceCorrectionAPI } from "@/services/api";
import {
  Loader2,
  Plus,
  Clock,
  Calendar,
  Check,
  AlertTriangle,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  toast: any;
}

export function AttendanceCorrectionPane({ toast }: Props) {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const [form, setForm] = useState({
    date: "",
    type: "regularization",
    checkIn: "",
    checkOut: "",
    reason: "",
  });

  const loadRequests = async () => {
    try {
      const res = await attendanceCorrectionAPI.getAll();
      if (res.success) {
        setRequests(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.date || !form.reason) {
      toast({
        title: "Error",
        description: "Please enter date and reason",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      // Build ISO DateTimes for checkIn and checkOut using the date field
      let checkInISO = undefined;
      let checkOutISO = undefined;

      if (form.checkIn) {
        checkInISO = new Date(`${form.date}T${form.checkIn}:00`).toISOString();
      }
      if (form.checkOut) {
        checkOutISO = new Date(
          `${form.date}T${form.checkOut}:00`,
        ).toISOString();
      }

      const res = await attendanceCorrectionAPI.create({
        date: form.date,
        type: form.type as "regularization" | "missed_punch",
        checkIn: checkInISO,
        checkOut: checkOutISO,
        reason: form.reason,
      });

      if (res.success) {
        toast({
          title: "Success",
          description: "Attendance correction request raised successfully.",
        });
        setShowModal(false);
        setForm({
          date: "",
          type: "regularization",
          checkIn: "",
          checkOut: "",
          reason: "",
        });
        await loadRequests();
      }
    } catch (err: any) {
      toast({
        title: "Failed",
        description: err.message || "Failed to raise request",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-10 bg-white">
        <Loader2 className="w-6 h-6 animate-spin text-[#024BAB]" />
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-6">
      <div className="flex justify-between items-center bg-[#F8FAFF] border-2 border-black p-4">
        <div>
          <p className="text-xs font-bold uppercase text-black">
            Attendance Corrections
          </p>
          <p className="text-[11px] text-muted-foreground">
            Request regularization or missed punch corrections for previous
            dates.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1 bg-[#024BAB] text-white border border-black px-3 py-1.5 text-xs font-bold uppercase hover:bg-[#024BAB]/90"
        >
          <Plus className="w-3.5 h-3.5" /> Request Correction
        </button>
      </div>

      <div className="border-2 border-black bg-white overflow-hidden">
        <div className="px-4 py-2 bg-[#024BAB]/5 border-b-2 border-black flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-[#024BAB]" />
          <p className="text-[10px] font-bold uppercase tracking-wider text-black">
            Correction Request Logs
          </p>
        </div>
        <div className="overflow-x-auto">
          {requests.length === 0 ? (
            <p className="p-5 text-center text-xs text-muted-foreground">
              No correction requests submitted.
            </p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b-2 border-black bg-[#024BAB]/5">
                  {["Date", "Type", "Proposed Times", "Reason", "Status"].map(
                    (h) => (
                      <th
                        key={h}
                        className="px-3 py-2 text-left font-bold uppercase tracking-wider text-black"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr
                    key={r._id}
                    className="border-b border-black/5 last:border-0 hover:bg-gray-50"
                  >
                    <td className="px-3 py-2.5 font-mono">
                      {new Date(r.date).toLocaleDateString("en-IN")}
                    </td>
                    <td className="px-3 py-2.5 font-bold uppercase text-[#024BAB]">
                      {r.type.replace("_", " ")}
                    </td>
                    <td className="px-3 py-2.5">
                      {r.checkIn
                        ? new Date(r.checkIn).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                      {" - "}
                      {r.checkOut
                        ? new Date(r.checkOut).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </td>
                    <td className="px-3 py-2.5 font-medium text-black">
                      <p>{r.reason}</p>
                      {r.rejectionReason && (
                        <p className="text-[10px] text-red-600 font-bold mt-0.5">
                          Note: {r.rejectionReason}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={cn(
                          "text-[9px] font-bold uppercase border px-1.5 py-0.5",
                          r.status === "approved" &&
                            "bg-green-100 text-green-700 border-green-700",
                          r.status === "pending" &&
                            "bg-yellow-100 text-yellow-700 border-yellow-700",
                          r.status === "rejected" &&
                            "bg-red-100 text-red-700 border-red-700",
                        )}
                      >
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm border-2 border-black bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
            <div className="px-4 py-3 bg-[#024BAB] border-b-2 border-black flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-white">
                Request Attendance Correction
              </p>
              <button
                onClick={() => setShowModal(false)}
                className="text-white hover:text-black"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-3">
              <div>
                <label className="block text-[10px] font-bold uppercase mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, date: e.target.value }))
                  }
                  className="w-full border-2 border-black px-2 py-1.5 text-xs font-medium focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase mb-1">
                  Correction Type
                </label>
                <select
                  value={form.type}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, type: e.target.value }))
                  }
                  className="w-full border-2 border-black px-2 py-1.5 text-xs font-medium focus:outline-none bg-white"
                >
                  <option value="regularization">
                    Regularization (Late Entry/Early Exit)
                  </option>
                  <option value="missed_punch">
                    Missed Punch (Forgot to Check In/Out)
                  </option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase mb-1">
                    Proposed Check In
                  </label>
                  <input
                    type="time"
                    value={form.checkIn}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, checkIn: e.target.value }))
                    }
                    className="w-full border-2 border-black px-2 py-1.5 text-xs font-medium focus:outline-none bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase mb-1">
                    Proposed Check Out
                  </label>
                  <input
                    type="time"
                    value={form.checkOut}
                    onChange={(e) =>
                      setForm((p) => ({ ...p, checkOut: e.target.value }))
                    }
                    className="w-full border-2 border-black px-2 py-1.5 text-xs font-medium focus:outline-none bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase mb-1">
                  Reason
                </label>
                <textarea
                  value={form.reason}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, reason: e.target.value }))
                  }
                  placeholder="Explain why the regularization/correction is needed..."
                  className="w-full border-2 border-black px-2 py-1.5 text-xs font-medium focus:outline-none h-16"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-1.5 bg-[#024BAB] text-white border-2 border-black py-2 font-bold text-xs uppercase disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Clock className="w-3.5 h-3.5" />
                )}
                {submitting ? "Submitting..." : "Submit Request"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
