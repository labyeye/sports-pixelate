import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import nesthrlogo from "../../assets/nesthr.png";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  studentAPI,
  studentAttendanceAPI,
  subscriptionAPI,
  authAPI,
} from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  GraduationCap,
  Wallet,
  Clock,
  CalendarClock,
  CheckCircle2,
  XCircle,
  Camera,
  Loader2,
  ChevronRight,
  Users,
  TrendingUp,
  FileText,
} from "lucide-react";

export default function ParentHomePage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const [children, setChildren] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please choose an image under 3 MB",
        variant: "destructive",
      });
      return;
    }
    setPhotoUploading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      let finalBase64 = base64;
      if (base64.length > 500_000) {
        const img = new Image();
        img.src = base64;
        await new Promise<void>((r) => {
          img.onload = () => r();
        });
        const canvas = document.createElement("canvas");
        const MAX = 400;
        const scale = Math.min(MAX / img.width, MAX / img.height, 1);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        canvas
          .getContext("2d")!
          .drawImage(img, 0, 0, canvas.width, canvas.height);
        finalBase64 = canvas.toDataURL("image/jpeg", 0.8);
      }
      await authAPI.updateProfile({ avatar: finalBase64 });
      updateUser({ avatar: finalBase64 });
      toast({
        title: "Photo updated",
        description: "Your profile photo has been saved.",
      });
    } catch (err: any) {
      toast({
        title: "Upload failed",
        description: err.message || "Could not save photo",
        variant: "destructive",
      });
    } finally {
      setPhotoUploading(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  };

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

  const activeSubs = subscriptions.filter((s) => s.status === "active").length;
  const overallPresent = attendance.filter(
    (a) => a.status === "present",
  ).length;
  const overallTotal = attendance.length;
  const overallRate =
    overallTotal > 0 ? Math.round((overallPresent / overallTotal) * 100) : 0;

  return (
    <AppLayout title="Home">
      {/* Profile banner — mirrors the staff dashboard's banner card */}
      <div className="border-2 border-black mb-6 overflow-hidden">
        <div className="bg-[#024BAB] h-28 relative">
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg,#fff 0,#fff 1px,transparent 0,transparent 50%)",
              backgroundSize: "12px 12px",
            }}
          />
        </div>

        <div className="bg-white px-6 pb-5">
          <div className="flex flex-col sm:flex-row gap-4 -mt-10">
            <div className="relative shrink-0 group">
              <div className="w-32 h-32 border-4 border-white bg-[#024BAB] flex items-center justify-center text-2xl font-bold text-white overflow-hidden shadow-lg">
                {user?.avatar ? (
                  <img
                    src={user.avatar}
                    alt="avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{user?.name?.[0]?.toUpperCase() ?? "P"}</span>
                )}
              </div>
              <button
                onClick={() => photoInputRef.current?.click()}
                disabled={photoUploading}
                className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                title="Change photo"
              >
                {photoUploading ? (
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                ) : (
                  <Camera className="w-5 h-5 text-white" />
                )}
              </button>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoChange}
              />
            </div>

            <div className="flex-1 min-w-0 pb-2 mt-12">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-display font-bold text-black">
                  {user?.name}
                </h1>
                <span className="text-[10px] font-bold uppercase border-2 px-2 py-0.5 bg-[#024BAB]/10 text-[#024BAB] border-[#024BAB]">
                  Parent
                </span>
                <div className="ml-auto flex flex-wrap gap-2">
                  {[
                    {
                      label: "Children",
                      value: children.length,
                      color: "text-[#024BAB]",
                      icon: Users,
                    },
                    {
                      label: "Attendance",
                      value: `${overallRate}%`,
                      color: "text-[#00C48C]",
                      icon: TrendingUp,
                    },
                    {
                      label: "Active Plans",
                      value: activeSubs,
                      color: "text-[#FA731C]",
                      icon: Wallet,
                    },
                  ].map(({ label, value, color, icon: Icon }) => (
                    <div
                      key={label}
                      className="border-2 border-black px-3 py-1.5 text-center bg-white min-w-[90px] flex flex-col items-center gap-0.5"
                    >
                      <Icon className={cn("w-3.5 h-3.5 mt-0.5", color)} />
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {label}
                      </p>
                      <p className={cn("text-sm font-bold", color)}>{value}</p>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-sm text-muted-foreground font-medium mt-1">
                {user?.email}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-display font-bold text-2xl text-black">
            My Children
          </h2>
          <p className="text-gray-600 font-medium">
            Attendance and subscription overview
          </p>
        </div>
        <div className="hidden sm:flex gap-2">
          <button
            onClick={() => navigate("/parent-attendance")}
            className="flex items-center gap-1.5 border-2 border-black bg-white px-3 py-2 text-xs font-bold uppercase hover:bg-[#024BAB]/5"
          >
            <Clock className="w-3.5 h-3.5" /> Full Attendance
          </button>
          <button
            onClick={() => navigate("/parent-report")}
            className="flex items-center gap-1.5 border-2 border-black bg-white px-3 py-2 text-xs font-bold uppercase hover:bg-[#024BAB]/5"
          >
            <FileText className="w-3.5 h-3.5" /> Report
          </button>
        </div>
      </div>

      {children.length === 0 ? (
        <div className="text-center py-16 bg-white border-2 border-black">
          <GraduationCap className="w-14 h-14 text-gray-200 mx-auto mb-3" />
          <p className="font-bold text-gray-400 text-lg">
            No children linked to your account yet
          </p>
          <p className="text-sm text-gray-400 mt-1">
            Contact the academy to link your child's profile.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {children.map((child) => {
            const records = attendance.filter(
              (a) => a.student?._id === child._id,
            );
            const present = records.filter(
              (a) => a.status === "present",
            ).length;
            const total = records.length;
            const rate = total > 0 ? Math.round((present / total) * 100) : 0;
            const sub = subscriptions.find(
              (s) => s.student?._id === child._id && s.status === "active",
            );

            return (
              <div
                key={child._id}
                className="border-2 border-black bg-white p-5 flex flex-col gap-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {child.avatar ? (
                      <img
                        src={child.avatar}
                        alt={child.firstName}
                        className="w-11 h-11 rounded-full border-2 border-black object-cover"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-full border-2 border-black bg-[#024BAB] flex items-center justify-center text-white font-bold">
                        {child.firstName?.[0]?.toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="font-bold text-lg text-black">
                        {child.firstName} {child.lastName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {child.sport} {child.batch ? `· ${child.batch}` : ""}
                      </p>
                    </div>
                  </div>
                  <GraduationCap className="w-8 h-8 text-[#024BAB]" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="border-2 border-black p-3 bg-[#024BAB]/5">
                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase text-gray-500 mb-1">
                      <Clock className="w-3.5 h-3.5" /> Attendance (this month)
                    </div>
                    <p className="text-2xl font-bold text-black">{rate}%</p>
                    <p className="text-xs text-gray-500">
                      {present}/{total} sessions
                    </p>
                  </div>
                  <div className="border-2 border-black p-3 bg-[#024BAB]/5">
                    <div className="flex items-center gap-1.5 text-xs font-bold uppercase text-gray-500 mb-1">
                      <Wallet className="w-3.5 h-3.5" /> Subscription
                    </div>
                    {sub ? (
                      <>
                        <p className="text-sm font-bold text-black flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4 text-green-600" />{" "}
                          {sub.planName}
                        </p>
                        <p className="text-xs text-gray-500">
                          renews{" "}
                          {new Date(sub.renewalDate).toLocaleDateString(
                            "en-IN",
                          )}
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
                    onClick={() => navigate("/parent-attendance")}
                    className="flex-1 flex items-center justify-center gap-2 bg-white border-2 border-black px-3 py-2 text-xs font-bold uppercase hover:bg-[#024BAB]/5"
                  >
                    <Clock className="w-3.5 h-3.5" /> Attendance{" "}
                    <ChevronRight className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => navigate("/subscriptions")}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 border-2 border-black px-3 py-2 text-xs font-bold uppercase",
                      sub ? "bg-white" : "bg-[#024BAB] text-white",
                    )}
                  >
                    <Wallet className="w-3.5 h-3.5" />{" "}
                    {sub ? "Manage Plan" : "Subscribe"}
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
    </AppLayout>
  );
}
