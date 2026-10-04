import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import { authAPI } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";

interface Account {
  userId: string;
  academy: { id: string; name: string };
}

// Shown only to parents signed in by phone OTP whose number is enrolled in
// more than one academy. Switching swaps the session to that academy's
// account, then reloads so every page refetches against the new academy.
export function AcademySwitcher() {
  const { user, completeLogin } = useAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [currentId, setCurrentId] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    authAPI
      .listAcademies()
      .then((res) => {
        if (cancelled) return;
        setAccounts(res.data.accounts || []);
        setCurrentId(String(res.data.currentUserId));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  if (accounts.length < 2) return null;

  const onChange = async (userId: string) => {
    if (userId === currentId) return;
    setBusy(true);
    try {
      const res = await authAPI.switchAcademy(userId);
      const { token, ...userData } = res.data;
      completeLogin(userData, token);
      window.location.assign("/");
    } catch {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2 mt-2">
      <Building2 className="w-4 h-4 text-[#024BAB]" />
      <label className="text-xs font-bold uppercase tracking-wider text-black">
        Academy
      </label>
      <select
        value={currentId}
        disabled={busy}
        onChange={(e) => onChange(e.target.value)}
        className="border-2 border-black bg-white px-3 py-1.5 text-sm font-bold focus:outline-none focus:border-[#024BAB] min-w-[200px] disabled:opacity-60"
      >
        {accounts.map((a) => (
          <option key={a.userId} value={a.userId}>
            {a.academy.name}
          </option>
        ))}
      </select>
    </div>
  );
}
