import { useAuth } from "@/contexts/AuthContext";
import { attendanceAPI } from "@/services/api";
import { Bell, Search, Menu, LogIn, LogOut, Clock } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";

interface AppHeaderProps {
  title: string;
  onMenuOpen: () => void;
}

interface NotifEntry {
  id: string;
  name: string;
  avatar?: string;
  type: "checkin" | "checkout";
  time: Date;
}

function timeAgo(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function fmt12(date: Date): string {
  return date.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function AppHeader({ title, onMenuOpen }: AppHeaderProps) {
  const { user } = useAuth();
  const [searchVal, setSearchVal] = useState("");
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<NotifEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [seen, setSeen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchToday = useCallback(async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const res: any = await attendanceAPI.getAll({ date: today, limit: "50" });
      if (!res.success) return;

      const entries: NotifEntry[] = [];
      for (const rec of res.data ?? []) {
        const firstName = rec.employee?.firstName ?? rec.employee?.name ?? "";
        const lastName = rec.employee?.lastName ?? "";
        const name = `${firstName} ${lastName}`.trim() || "Unknown";
        const avatar = rec.employee?.avatar;

        if (rec.checkIn) {
          entries.push({
            id: `${rec._id}-in`,
            name,
            avatar,
            type: "checkin",
            time: new Date(rec.checkIn),
          });
        }
        if (rec.checkOut) {
          entries.push({
            id: `${rec._id}-out`,
            name,
            avatar,
            type: "checkout",
            time: new Date(rec.checkOut),
          });
        }
      }

      entries.sort((a, b) => b.time.getTime() - a.time.getTime());
      setNotifs(entries.slice(0, 30));
    } catch {}
    setLoading(false);
  }, []);

  const handleBell = () => {
    if (!open) {
      fetchToday();
      setSeen(true);
    }
    setOpen((v) => !v);
  };

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (!user) return null;

  return (
    <header className="h-16 border-b-2 border-black bg-white flex items-center justify-between px-4 sm:px-6 sticky top-0 z-20 shrink-0">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuOpen}
          className="lg:hidden w-9 h-9 border-2 border-black bg-white flex items-center justify-center hover:bg-[#024BAB]/10 transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-[18px] h-[18px] text-black" />
        </button>
        <h1 className="font-display font-bold text-lg sm:text-xl text-black">
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <div className="hidden md:flex items-center gap-2 border-2 border-black bg-white px-3 py-1.5 w-48 lg:w-52">
          <Search className="w-4 h-4 text-black shrink-0" />
          <input
            type="text"
            placeholder="Search..."
            value={searchVal}
            onChange={(e) => setSearchVal(e.target.value)}
            className="bg-transparent text-sm outline-none w-full text-black placeholder:text-muted-foreground font-medium"
          />
        </div>

        {/* Bell + notification panel */}
        <div className="relative" ref={panelRef}>
          <button
            onClick={handleBell}
            className="relative w-9 h-9 border-2 border-black bg-white flex items-center justify-center hover:bg-[#024BAB]/10 transition-colors"
            aria-label="Notifications"
          >
            <Bell className="w-[18px] h-[18px] text-black" />
            {!seen && (
              <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-[#FA731C] border border-black rounded-xl" />
            )}
          </button>

          {open && (
            <div className="absolute right-0 top-11 w-80 border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] z-50">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b-2 border-black bg-[#024BAB]">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-white" />
                  <span className="text-sm font-bold text-white">
                    Today's Activity
                  </span>
                </div>
                <span className="text-xs text-white/70 font-medium">
                  {new Date().toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
              </div>

              {/* Body */}
              <div className="max-h-80 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-10 gap-2">
                    <div className="w-4 h-4 border-2 border-[#024BAB] border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs text-muted-foreground font-medium">
                      Loading...
                    </span>
                  </div>
                ) : notifs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-2">
                    <Bell className="w-8 h-8 text-muted-foreground/30" />
                    <p className="text-xs font-bold text-muted-foreground">
                      No activity today
                    </p>
                  </div>
                ) : (
                  notifs.map((n) => (
                    <div
                      key={n.id}
                      className="flex items-center gap-3 px-4 py-3 border-b border-black/10 last:border-0 hover:bg-[#024BAB]/5 transition-colors"
                    >
                      {/* Avatar */}
                      <div className="w-8 h-8 rounded-full border-2 border-black shrink-0 overflow-hidden bg-[#024BAB] flex items-center justify-center text-xs font-bold text-white">
                        {n.avatar ? (
                          <img
                            src={n.avatar}
                            alt={n.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          n.name[0]?.toUpperCase()
                        )}
                      </div>

                      {/* Text */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-black truncate">
                          {n.name}
                        </p>
                        <div className="flex items-center gap-1 mt-0.5">
                          {n.type === "checkin" ? (
                            <LogIn className="w-3 h-3 text-[#00C48C] shrink-0" />
                          ) : (
                            <LogOut className="w-3 h-3 text-[#FA731C] shrink-0" />
                          )}
                          <span
                            className={`text-[11px] font-semibold ${n.type === "checkin" ? "text-[#00C48C]" : "text-[#FA731C]"}`}
                          >
                            {n.type === "checkin"
                              ? "Checked in"
                              : "Checked out"}{" "}
                            at {fmt12(n.time)}
                          </span>
                        </div>
                      </div>

                      {/* Time ago */}
                      <span className="text-[10px] text-muted-foreground font-medium shrink-0">
                        {timeAgo(n.time)}
                      </span>
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              {notifs.length > 0 && (
                <div className="border-t-2 border-black px-4 py-2.5 bg-[#F8FAFF] flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground font-medium">
                    {notifs.filter((n) => n.type === "checkin").length}{" "}
                    check-ins ·{" "}
                    {notifs.filter((n) => n.type === "checkout").length}{" "}
                    check-outs
                  </span>
                  <button
                    onClick={fetchToday}
                    className="text-[11px] font-bold text-[#024BAB] hover:underline"
                  >
                    Refresh
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 border-2 border-black bg-[#024BAB] px-2 sm:px-3 py-1.5">
          <div className="w-6 h-6 border-2 border-black shrink-0 overflow-hidden bg-[#FA731C] flex items-center justify-center text-[10px] font-bold text-white rounded-full">
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="w-full h-full object-cover"
              />
            ) : (
              (user.name?.[0]?.toUpperCase() ?? "U")
            )}
          </div>
          <span className="hidden sm:block text-sm font-bold text-white max-w-[100px] truncate">
            {user.name}
          </span>
        </div>
      </div>
    </header>
  );
}
