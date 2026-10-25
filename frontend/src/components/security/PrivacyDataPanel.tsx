import { useState } from "react";
import { privacyAPI } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";

// Download a copy of the data stored about you, or delete your account
// (password-confirmed). Academy owners are pointed to support instead.
export function PrivacyDataPanel() {
  const { user, logout } = useAuth();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const download = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await privacyAPI.exportMyData();
      const blob = new Blob([JSON.stringify(r.data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "my-data.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e?.message || "Could not download your data");
    }
    setBusy(false);
  };

  const remove = async () => {
    setBusy(true);
    setError("");
    try {
      await privacyAPI.deleteAccount(password);
      await logout();
    } catch (e: any) {
      setError(e?.message || "Could not delete the account");
      setBusy(false);
    }
  };

  return (
    <div className="mt-6 border-2 border-black bg-white">
      <div className="p-4 border-b-2 border-black bg-[#F0F6FF]">
        <h2 className="font-bold text-base">Your data</h2>
        <p className="text-xs text-gray-500">
          Get a copy of the personal data we hold about you, or delete your
          account.
        </p>
      </div>
      <div className="p-5 space-y-3">
        <button
          type="button"
          disabled={busy}
          onClick={download}
          className="border-2 border-black px-4 py-2 text-xs font-bold uppercase disabled:opacity-50"
        >
          Download my data
        </button>
        {user?.role !== "super_admin" &&
          (confirming ? (
            <div className="space-y-2">
              <p className="text-xs text-red-600">
                This permanently removes your sign-in and personal details.
                Enter your password to confirm.
              </p>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full max-w-xs border-2 border-black px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy || !password}
                  onClick={remove}
                  className="border-2 border-black bg-red-600 px-4 py-2 text-xs font-bold uppercase text-white disabled:opacity-50"
                >
                  Delete account
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirming(false);
                    setPassword("");
                  }}
                  className="border-2 border-black px-4 py-2 text-xs font-bold uppercase"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="ml-2 border-2 border-red-600 px-4 py-2 text-xs font-bold uppercase text-red-600"
            >
              Delete my account
            </button>
          ))}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}
