import { useLocation } from "react-router-dom";
import { useEffect, useRef } from "react";

// Auth pages keep their left panel still; only the form inside animates.
const AUTH_PATH = /^\/(login|register|forgot-password|reset-password)/;

export default function PageTransition({
  children,
}: {
  children: React.ReactNode;
}) {
  const location = useLocation();
  const ref = useRef<HTMLDivElement>(null);
  const isAuth = AUTH_PATH.test(location.pathname);

  useEffect(() => {
    const el = ref.current;
    if (!el || isAuth) return;
    el.classList.remove("page-transition");
    void el.offsetWidth;
    el.classList.add("page-transition");
  }, [location.pathname, isAuth]);

  return (
    <div
      ref={ref}
      className={isAuth ? "" : "page-transition"}
      style={{ minHeight: "100%" }}
    >
      {children}
    </div>
  );
}
