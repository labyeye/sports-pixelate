import { useEffect, useRef, useState } from "react";
import { registerConfirmOpener } from "@/lib/confirmDialog";

// Mounted once: the in-app confirmation dialog behind confirmDialog().
export default function ConfirmHost() {
  const [message, setMessage] = useState<string | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  useEffect(() => {
    registerConfirmOpener(
      (m) =>
        new Promise<boolean>((resolve) => {
          resolver.current = resolve;
          setMessage(m);
        }),
    );
    return () => registerConfirmOpener(null);
  }, []);

  const close = (ok: boolean) => {
    setMessage(null);
    resolver.current?.(ok);
    resolver.current = null;
  };

  useEffect(() => {
    if (message === null) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [message]);

  if (message === null) return null;
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4">
      <div
        role="alertdialog"
        aria-modal="true"
        className="w-full max-w-sm border-2 border-black bg-white p-5 shadow-[6px_6px_0_#000]"
      >
        <p className="text-sm font-medium text-black">{message}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => close(false)}
            className="border-2 border-black px-4 py-2 text-xs font-bold uppercase"
          >
            Cancel
          </button>
          <button
            type="button"
            autoFocus
            onClick={() => close(true)}
            className="border-2 border-black bg-[#024BAB] px-4 py-2 text-xs font-bold uppercase text-white"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
