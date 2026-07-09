import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import nesthrlogo from "../../assets/nesthr.png";
import { AppLayout } from "@/components/layout/AppLayout";
import { studentAPI, studentAttendanceAPI, subscriptionAPI } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { GraduationCap, Wallet, Clock, CalendarClock, CheckCircle2, XCircle } from "lucide-react";

export default function ParentHomePage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [children, setChildren] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      const [studRes, attRes, subRes] = await Promise.all([
        studentAPI.getAll(),
        studentAttendanceAPI.getAll({
          month: String(now.getMonth() + 1),
          year: String(now.getFullYear()),
        }),
        subscriptionAPI.getAll(),
      ]);
      setChildren(studRes.data);
      setAttendance(attRes.data);
      setSubscriptions(subRes.data);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <AppLayout title="Home">
        <div className="flex justify-center py-16">
          <img src={nesthrlogo} alt="loading" className="h-16 w-auto" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Home">
      <div className="max-w-4xl mx-auto">
        <h1 className="font-display font-bold text-3xl text-black mb-1">My Children</h1>
        <p className="text-gray-600 font-medium mb-6">Attendance and subscription overview</p>

        {children.length === 0 ? (
          <div className="text-center py-16 bg-white border-2 border-black">
            <GraduationCap className="w-14 h-14 text-gray-200 mx-auto mb-3" />
            <p className="font-bold text-gray-400 text-lg">No children linked to your account yet</p>
            <p className="text-sm text-gray-400 mt-1">Contact the academy to link your child's profile.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {children.map((child) => {
              const records = attendance.filter((a) => a.student?._id === child._id);
              const present = records.filter((a) => a.status === "present").length;
              const total = records.length;
              const rate = total > 0 ? Math.round((present / total) * 100) : 0;
              const sub = subscriptions.find((s) => s.student?._id === child._id && s.status === "active");

              return (
                <div key={child._id} className="border-2 border-black bg-white p-5 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-lg text-black">{child.firstName} {child.lastName}</p>
                      <p className="text-xs text-gray-500">{child.sport} {child.batch ? `· ${child.batch}` : ""}</p>
                    </div>
                    <GraduationCap className="w-8 h-8 text-[#024BAB]" />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="border-2 border-black p-3 bg-[#024BAB]/5">
                      <div className="flex items-center gap-1.5 text-xs font-bold uppercase text-gray-500 mb-1">
                        <Clock className="w-3.5 h-3.5" /> Attendance (this month)
                      </div>
                      <p className="text-2xl font-bold text-black">{rate}%</p>
                      <p className="text-xs text-gray-500">{present}/{total} sessions</p>
                    </div>
                    <div className="border-2 border-black p-3 bg-[#024BAB]/5">
                      <div className="flex items-center gap-1.5 text-xs font-bold uppercase text-gray-500 mb-1">
                        <Wallet className="w-3.5 h-3.5" /> Subscription
                      </div>
                      {sub ? (
                        <>
                          <p className="text-sm font-bold text-black flex items-center gap-1">
                            <CheckCircle2 className="w-4 h-4 text-green-600" /> {sub.planName}
                          </p>
                          <p className="text-xs text-gray-500">
                            renews {new Date(sub.renewalDate).toLocaleDateString("en-IN")}
                          </p>
                        </>
                      ) : (
                        <p className="text-sm font-bold text-red-500 flex items-center gap-1">
                          <XCircle className="w-4 h-4" /> Not subscribed
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 mt-1">
                    <button
                      onClick={() => navigate("/subscriptions")}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 border-2 border-black px-3 py-2 text-xs font-bold uppercase",
                        sub ? "bg-white" : "bg-[#024BAB] text-white",
                      )}
                    >
                      <Wallet className="w-3.5 h-3.5" /> {sub ? "Manage Plan" : "Subscribe"}
                    </button>
                    <button
                      onClick={() => navigate("/bookings")}
                      className="flex-1 flex items-center justify-center gap-2 bg-white border-2 border-black px-3 py-2 text-xs font-bold uppercase"
                    >
                      <CalendarClock className="w-3.5 h-3.5" /> Book Slot
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
