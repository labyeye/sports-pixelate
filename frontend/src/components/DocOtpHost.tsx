import { useEffect, useRef, useState } from "react";
import { documentAPI } from "@/services/api";
import { registerDocOtpPrompt, setDocAccessToken } from "@/services/docAccess";

// Mounted once: shows the WhatsApp OTP dialog whenever a confidential
// document is opened without a live access token.
export default function DocOtpHost() {
  const [open, setOpen] = useState(false);
  const [otp, setOtp] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const resolver = useRef<((t: string | null) => void) | null>(null);

  const send = async () => {
    setBusy(true);
    setMsg("");
    try {
      const r = await documentAPI.sendOtp();
      setMsg(r.message || "OTP sent on WhatsApp");
    } catch (e: any) {
      setMsg(e?.message || "Could not send OTP");
    }
    setBusy(false);
  };

  useEffect(() => {
    registerDocOtpPrompt(
      () =>
        new Promise<string | null>((resolve) => {
          resolver.current = resolve;
          setOtp("");
          setOpen(true);
          send();
        }),
    );
    return () => registerDocOtpPrompt(null);
  }, []);

  const close = (t: string | null) => {
    setOpen(false);
    resolver.current?.(t);
    resolver.current = null;
  };

  const verify = async () => {
    setBusy(true);
    try {
      const r = await documentAPI.verifyOtp(otp);
      setDocAccessToken(r.data.docAccessToken, r.data.expiresInSec);
      setBusy(false);
      close(r.data.docAccessToken);
    } catch (e: any) {
      setMsg(e?.message || "Incorrect OTP");
      setBusy(false);
    }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm border-2 border-black bg-white p-5 shadow-[6px_6px_0_#000]">
        <h2 className="text-lg font-bold">Confidential document</h2>
        <p className="mt-1 text-sm text-gray-600">
          Enter the 6-digit OTP we sent to your WhatsApp number to open it.
        </p>
        <input
          inputMode="numeric"
          maxLength={6}
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && otp.length === 6 && verify()}
          placeholder="000000"
          autoFocus
          className="mt-3 w-full border-2 border-black px-3 py-2 text-center text-2xl tracking-[0.4em]"
        />
        {msg && <p className="mt-2 text-xs text-gray-600">{msg}</p>}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={busy || otp.length !== 6}
            onClick={verify}
            className="flex-1 border-2 border-black bg-[#024BAB] px-3 py-2 text-sm font-bold uppercase text-white disabled:opacity-50"
          >
            Verify
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={send}
            className="border-2 border-black px-3 py-2 text-sm font-bold uppercase"
          >
            Resend
          </button>
          <button
            type="button"
            onClick={() => close(null)}
            className="border-2 border-black px-3 py-2 text-sm font-bold uppercase"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
