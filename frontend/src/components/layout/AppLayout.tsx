import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { Toaster } from "@/components/ui/Toaster";
import { useAuth } from "@/contexts/AuthContext";

interface AppLayoutProps {
  title: string;
  children: React.ReactNode;
}

function TrialBanner() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const sub = user?.subscription;
  if (!sub?.isTrial) return null;

  const endDate = sub.trialEndDate ? new Date(sub.trialEndDate) : null;
  const daysLeft = endDate
    ? Math.max(0, Math.ceil((endDate.getTime() - Date.now()) / 86400000))
    : null;

  if (daysLeft === null) return null;

  const isUrgent = daysLeft <= 14;

  return (
    <div
      className={`w-full px-4 py-2 flex items-center justify-between gap-2 text-sm font-medium border-b-2 border-black ${isUrgent ? "bg-[#EF4444] text-white" : "bg-[#FBBF24] text-black"}`}
    >
      <span>
        {daysLeft > 0
          ? `Free trial: ${daysLeft} day${daysLeft !== 1 ? "s" : ""} remaining`
          : "Your free trial has ended"}
        {endDate &&
          ` — expires ${endDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`}
      </span>
      <button
        onClick={() => navigate("/billing")}
        className={`shrink-0 px-3 py-0.5 border-2 border-black font-bold text-xs ${isUrgent ? "bg-white text-[#EF4444]" : "bg-black text-white"}`}
      >
        Upgrade Now
      </button>
    </div>
  );
}

export function AppLayout({ title, children }: AppLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen flex w-full bg-background">
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <AppSidebar
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <AppHeader title={title} onMenuOpen={() => setMobileOpen(true)} />
        <TrialBanner />
        <main className="flex-1 p-4 sm:p-6 overflow-auto">{children}</main>
      </div>
      <Toaster />
    </div>
  );
}
