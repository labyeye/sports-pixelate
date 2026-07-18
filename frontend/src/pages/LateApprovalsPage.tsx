import { useState, useEffect, useCallback } from "react";
import nesthrlogo from "../../assets/nesthr.png";
import { AppLayout } from "@/components/layout/AppLayout";
import { lateApprovalAPI } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { cn, formatDate } from "@/lib/utils";
import { AlarmClock, CheckCircle, Clock3, XCircle, Timer } from "lucide-react";

interface LateApproval {
  _id: string;
  employee: {
    _id: string;
    firstName: string;
    lastName: string;
    employeeId: string;
  };
  date: string;
  checkInTime?: string;
  minutesLate: number;
  reason?: string;
  status: string;
}

const ACTIONS: {
  status: string;
  label: string;
  icon: any;
  className: string;
}[] = [
  {
    status: "present",
    label: "Present",
    icon: CheckCircle,
    className:
      "bg-[#00C48C]/10 text-[#00C48C] border-[#00C48C] hover:bg-[#00C48C]/20",
  },
  {
    status: "late",
    label: "Late",
    icon: Clock3,
    className:
      "bg-[#FA731C]/10 text-[#FA731C] border-[#FA731C] hover:bg-[#FA731C]/20",
  },
  {
    status: "half_day",
    label: "Half Day",
    icon: Timer,
    className:
      "bg-[#024BAB]/10 text-[#024BAB] border-[#024BAB] hover:bg-[#024BAB]/20",
  },
  {
    status: "absent",
    label: "Absent",
    icon: XCircle,
    className: "bg-red-50 text-red-600 border-red-600 hover:bg-red-100",
  },
];

export default function LateApprovalsPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<LateApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await lateApprovalAPI.getAll();
      setItems(res.data ?? []);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const resolve = async (id: string, resolvedStatus: string) => {
    setResolvingId(id);
    try {
      await lateApprovalAPI.resolve(id, resolvedStatus);
      toast({
        title: "Resolved",
        description: `Marked as ${resolvedStatus.replace("_", " ")}`,
        variant: "success",
      });
      load();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <AppLayout title="Late Approvals">
      <div className="mb-6">
        <h1 className="font-display font-bold text-3xl text-black">
          Late Approvals
        </h1>
        <p className="text-gray-600 font-medium mt-1">
          Employees who exceeded their monthly late allowance — set the final
          attendance status for each pending record.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-5">
        <div className="border-2 border-black bg-white p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#024BAB]/10 border-2 border-[#024BAB] flex items-center justify-center shrink-0">
            <AlarmClock className="w-5 h-5 text-[#024BAB]" />
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Total Requests
            </p>
            <p className="text-2xl font-bold text-black">{items.length}</p>
          </div>
        </div>
        <div className="border-2 border-black bg-white p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#FA731C]/10 border-2 border-[#FA731C] flex items-center justify-center shrink-0">
            <Clock3 className="w-5 h-5 text-[#FA731C]" />
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Total Minutes Late
            </p>
            <p className="text-2xl font-bold text-black">
              {items.reduce((s, i) => s + (i.minutesLate || 0), 0)}
            </p>
          </div>
        </div>
        <div className="border-2 border-black bg-white p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-[#00C48C]/10 border-2 border-[#00C48C] flex items-center justify-center shrink-0">
            <Timer className="w-5 h-5 text-[#00C48C]" />
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Avg. Minutes Late
            </p>
            <p className="text-2xl font-bold text-black">
              {items.length
                ? Math.round(
                    items.reduce((s, i) => s + (i.minutesLate || 0), 0) /
                      items.length,
                  )
                : 0}
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <img src={nesthrlogo} alt="NestSports" className="h-16 w-auto" />
        </div>
      ) : items.length === 0 ? (
        <div className="border-2 bg-white p-12 flex flex-col items-center justify-center">
          <AlarmClock className="w-12 h-12 text-muted-foreground/30 mb-3" />
          <p className="font-bold text-black">No pending late approvals</p>
        </div>
      ) : (
        <div className="border-2 bg-white overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-black bg-[#024BAB]/5">
                {["Employee", "Date", "Minutes Late", "Reason", "Actions"].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr
                  key={item._id}
                  className={cn(
                    "border-b border-black/10",
                    i % 2 === 0 ? "" : "bg-[#F8FAFF]",
                  )}
                >
                  <td className="px-4 py-3">
                    <p className="font-bold text-black text-xs">
                      {item.employee?.firstName} {item.employee?.lastName}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {item.employee?.employeeId}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-xs text-black">
                    {formatDate(item.date)}
                  </td>
                  <td className="px-4 py-3 text-xs font-bold text-black">
                    {item.minutesLate} min
                  </td>
                  <td className="px-4 py-3 text-xs text-black max-w-48 truncate">
                    {item.reason || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5 flex-wrap">
                      {ACTIONS.map((a) => (
                        <button
                          key={a.status}
                          disabled={resolvingId === item._id}
                          onClick={() => resolve(item._id, a.status)}
                          className={cn(
                            "flex items-center gap-1 border-2 px-2 py-1 text-[10px] font-bold transition-colors disabled:opacity-40",
                            a.className,
                          )}
                        >
                          <a.icon className="w-3 h-3" />
                          {a.label}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppLayout>
  );
}
