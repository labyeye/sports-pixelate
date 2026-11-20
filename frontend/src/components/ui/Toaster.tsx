import { X, CheckCircle, AlertCircle, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export function Toaster() {
  const { toasts, dismiss } = useToast();

  const error = toasts.find((t) => t.variant === "destructive");
  const rest = toasts.filter((t) => t.variant !== "destructive");

  return (
    <>
      {error && (
        <div
          role="alertdialog"
          aria-modal="true"
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4"
        >
          <div className="w-full max-w-sm border-2 border-red-500 bg-white p-5 shadow-xl">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
              <p className="text-base font-bold text-red-800">
                {error.title || "Something went wrong"}
              </p>
            </div>
            <p className="mt-2 text-sm text-gray-700">
              {error.description || "Please try again."}
            </p>
            <button
              autoFocus
              onClick={() => dismiss(error.id)}
              className="mt-4 w-full bg-[#024BAB] py-2 text-sm font-bold text-white hover:opacity-90"
            >
              Got it
            </button>
          </div>
        </div>
      )}
      {rest.length > 0 && (
        <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)]">
          {rest.map((t) => {
            const isDestructive = t.variant === "destructive";
            const isSuccess = t.variant === "success";

            return (
              <div
                key={t.id}
                className={cn(
                  "flex items-start gap-3 p-4 border-2 border-black bg-white animate-in slide-in-from-bottom-2 duration-200",
                  isDestructive && "border-red-500 bg-red-50",
                  isSuccess && "border-green-500 bg-green-50",
                )}
              >
                <div className="shrink-0 mt-0.5">
                  {isDestructive ? (
                    <AlertCircle className="w-4 h-4 text-red-600" />
                  ) : isSuccess ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : (
                    <Info className="w-4 h-4 text-[#024BAB]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  {t.title && (
                    <p
                      className={cn(
                        "text-sm font-bold",
                        isDestructive && "text-red-800",
                        isSuccess && "text-green-800",
                      )}
                    >
                      {t.title}
                    </p>
                  )}
                  {t.description && (
                    <p
                      className={cn(
                        "text-xs font-medium mt-0.5",
                        isDestructive
                          ? "text-red-700"
                          : isSuccess
                            ? "text-green-700"
                            : "text-gray-600",
                      )}
                    >
                      {t.description}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => dismiss(t.id)}
                  className="shrink-0 p-0.5 hover:bg-black/10 transition-colors"
                >
                  <X className="w-3.5 h-3.5 text-gray-500" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
