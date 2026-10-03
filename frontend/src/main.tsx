import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import "./index.css";
import App from "./App.tsx";

// Error monitoring is optional: set VITE_SENTRY_DSN to enable it.
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
  });
}

function CrashScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="border-2 border-black bg-white p-8 max-w-md text-center">
        <h1 className="font-display font-bold text-2xl mb-2">
          Something went wrong
        </h1>
        <p className="text-sm text-muted-foreground mb-5">
          The page hit an unexpected error. Reloading usually fixes it — if it
          keeps happening, please contact support.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="border-2 border-black bg-[#024BAB] text-white px-5 py-2 text-sm font-bold uppercase"
        >
          Reload
        </button>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<CrashScreen />}>
      <App />
    </Sentry.ErrorBoundary>
  </StrictMode>,
);
