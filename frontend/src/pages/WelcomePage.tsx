import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Zap,
  Users,
  Clock,
  IndianRupee,
  BarChart3,
  Shield,
  ArrowRight,
  CheckCircle,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const FEATURES = [
  { icon: Users, label: "Employee Management", color: "#024BAB" },
  { icon: Clock, label: "Attendance Tracking", color: "#FA731C" },
  { icon: IndianRupee, label: "Payroll Processing", color: "#00C48C" },
  { icon: BarChart3, label: "Reports & Analytics", color: "#A855F7" },
  { icon: Shield, label: "Leave Management", color: "#EF4444" },
  { icon: Sparkles, label: "Performance Reviews", color: "#F59E0B" },
];

const STEPS = [
  {
    num: "01",
    title: "Add your team",
    desc: "Import or add employees one by one",
  },
  {
    num: "02",
    title: "Set up departments",
    desc: "Organise your workforce by teams",
  },
  {
    num: "03",
    title: "Configure payroll",
    desc: "Set salary heads and pay cycles",
  },
];

export default function WelcomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [visible, setVisible] = useState(false);
  const [featuresVisible, setFeaturesVisible] = useState(false);
  const [stepsVisible, setStepsVisible] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    // Staggered entrance animations
    const t1 = setTimeout(() => setVisible(true), 100);
    const t2 = setTimeout(() => setFeaturesVisible(true), 600);
    const t3 = setTimeout(() => setStepsVisible(true), 1000);
    // Start countdown after animations settle
    const t4 = setTimeout(() => setCountdown(10), 1400);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, []);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      navigate("/", { replace: true });
      return;
    }
    const t = setTimeout(
      () => setCountdown((c) => (c !== null ? c - 1 : null)),
      1000,
    );
    return () => clearTimeout(t);
  }, [countdown, navigate]);

  const companyName = user?.company?.name || "your SportsClub";
  const userName = user?.name?.split(" ")[0] || "there";

  return (
    <div className="min-h-screen bg-[#F0F6FF] flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b-2 border-black">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center gap-3">
          <div className="w-9 h-9 bg-[#024BAB] border-2 border-black flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="font-display font-bold text-xl text-black">
            NestSports
          </span>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-12 flex flex-col gap-10">
        {/* Hero block */}
        <div
          className={cn(
            "transition-all duration-700 ease-out",
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8",
          )}
        >
          <div className="bg-white border-2 border-black overflow-hidden">
            {/* Blue banner */}
            <div className="bg-[#024BAB] px-8 py-10 relative overflow-hidden">
              {/* Diagonal stripe texture */}
              <div
                className="absolute inset-0 opacity-10 pointer-events-none"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(45deg,#fff 0,#fff 1px,transparent 0,transparent 50%)",
                  backgroundSize: "14px 14px",
                }}
              />
              {/* Animated check circle */}
              <div className="flex items-center gap-4 mb-5 relative">
                <div className="w-14 h-14 bg-white border-2 border-black flex items-center justify-center shrink-0 animate-bounce">
                  <CheckCircle className="w-7 h-7 text-[#024BAB]" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-0.5">
                    Subscription Active
                  </p>
                  <p className="text-white font-bold text-lg leading-tight">
                    {companyName} is ready to go
                  </p>
                </div>
              </div>

              <h1 className="font-display font-bold text-3xl sm:text-4xl text-white leading-tight">
                Welcome aboard,
                <br />
                <span className="text-[#FA731C]">{userName}!</span>
              </h1>
              <p className="mt-3 text-white/80 text-sm font-medium max-w-md">
                Your NestSports workspace is live. Everything you need to manage
                your team — payroll, attendance, leaves, performance — is ready.
              </p>
            </div>

            {/* CTA strip */}
            <div className="px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-4 border-t-2 border-black bg-white">
              <p className="text-sm font-bold text-gray-500">
                {countdown !== null ? (
                  <>
                    Redirecting to your dashboard in{" "}
                    <span className="text-[#024BAB] font-bold tabular-nums">
                      {countdown}s
                    </span>
                  </>
                ) : (
                  "Your workspace is ready"
                )}
              </p>
              <button
                onClick={() => navigate("/", { replace: true })}
                className="flex items-center gap-2 bg-[#FA731C] text-white border-2 border-black font-bold uppercase text-sm px-6 py-3 hover:bg-[#e06419] transition-all active:scale-95"
              >
                Go to Dashboard
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Features grid */}
        <div
          className={cn(
            "transition-all duration-700 ease-out",
            featuresVisible
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-8",
          )}
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">
            Everything included in your plan
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {FEATURES.map(({ icon: Icon, label, color }, i) => (
              <div
                key={label}
                className="bg-white border-2 border-black px-4 py-3 flex items-center gap-3 group hover:border-[#024BAB] transition-colors"
                style={{
                  transitionDelay: featuresVisible ? `${i * 60}ms` : "0ms",
                }}
              >
                <div
                  className="w-8 h-8 border-2 border-black flex items-center justify-center shrink-0"
                  style={{ backgroundColor: color + "15" }}
                >
                  <Icon className="w-4 h-4" style={{ color }} />
                </div>
                <span className="text-xs font-bold text-black">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Getting started steps */}
        <div
          className={cn(
            "transition-all duration-700 ease-out",
            stepsVisible
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-8",
          )}
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-4">
            Quick setup checklist
          </p>
          <div className="bg-white border-2 border-black divide-y-2 divide-black">
            {STEPS.map(({ num, title, desc }, i) => (
              <div
                key={num}
                className="flex items-center gap-5 px-6 py-5 hover:bg-[#F8FAFF] transition-colors cursor-default"
              >
                <div className="w-10 h-10 bg-[#024BAB] border-2 border-black flex items-center justify-center shrink-0">
                  <span className="text-white font-bold text-xs">{num}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-black">{title}</p>
                  <p className="text-xs text-gray-500 font-medium mt-0.5">
                    {desc}
                  </p>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-300 shrink-0" />
              </div>
            ))}
          </div>
        </div>

        {/* Bottom note */}
        <div
          className={cn(
            "text-center transition-all duration-700 ease-out",
            stepsVisible ? "opacity-100" : "opacity-0",
          )}
        >
          <p className="text-xs text-gray-400 font-medium">
            Need help?{" "}
            <a
              href="mailto:support@pixelatenest.com"
              className="text-[#024BAB] font-bold underline"
            >
              support@pixelatenest.com
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
