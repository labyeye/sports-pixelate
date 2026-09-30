import { useAuth } from "@/contexts/AuthContext";
import { notificationAPI } from "@/services/api";
import { Bell, Search, Menu, CheckCircle2, Clock } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";

interface AppHeaderProps {
  title: string;
  onMenuOpen: () => void;
}

interface NotifEntry {
  _id: string;
  type: "student_attendance" | "employee_attendance" | "general";
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

function timeAgo(iso: string): string {
  const date = new Date(iso);
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function AppHeader({ title, onMenuOpen }: AppHeaderProps) {
  const { user } = useAuth();
  const [searchVal, setSearchVal] = useState("");
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<NotifEntry[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await notificationAPI.getAll({ limit: "30" });
      if (!res.success) return;
      setNotifs(res.data ?? []);
      setUnreadCount(res.unreadCount ?? 0);
    } catch {}
    setLoading(false);
  }, []);

  // Poll for unread count in the background so the badge stays fresh even
  // when the panel is closed.
  useEffect(() => {
    if (!user) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [user, fetchNotifications]);

  const handleBell = () => {
    if (!open) fetchNotifications();
    setOpen((v) => !v);
  };

  const handleMarkRead = async (id: string) => {
    setNotifs((prev) =>
      prev.map((n) => (n._id === id ? { ...n, read: true } : n)),
    );
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await notificationAPI.markRead(id);
    } catch {}
  };

  const handleMarkAllRead = async () => {
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    try {
      await notificationAPI.markAllRead();
    } catch {}
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
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-[#FA731C] border border-black rounded-full flex items-center justify-center text-[9px] font-bold text-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>

          {open && (
            <div className="absolute right-0 top-11 w-80 border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] z-50">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b-2 border-black bg-[#024BAB]">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-white" />
                  <span className="text-sm font-bold text-white">
                    Notifications
                  </span>
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[11px] text-white/80 hover:text-white font-medium"
                  >
                    Mark all read
                  </button>
                )}
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
                      No notifications yet
                    </p>
                  </div>
                ) : (
                  notifs.map((n) => (
                    <button
                      key={n._id}
                      onClick={() => !n.read && handleMarkRead(n._id)}
                      className={`w-full text-left flex items-start gap-2 px-4 py-3 border-b border-black/10 last:border-0 hover:bg-[#024BAB]/5 transition-colors ${
                        n.read ? "" : "bg-[#024BAB]/[0.04]"
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">
                        {n.read ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground/40" />
                        ) : (
                          <span className="block w-2 h-2 mt-0.5 rounded-full bg-[#024BAB]" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-black truncate">
                          {n.title}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                          {n.message}
                        </p>
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground/70 font-medium mt-1">
                          <Clock className="w-2.5 h-2.5" />
                          {timeAgo(n.createdAt)}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
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
