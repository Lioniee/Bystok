"use client";

import { useEffect, useState } from "react";

// Sun/moon button. The theme is applied before first paint by the script in
// app/layout.tsx; this button flips it and remembers the choice. With no saved
// choice, it keeps following the system setting.

const KEY = "bystok:theme";
type Theme = "light" | "dark";

function saved(): Theme | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null;
  }
}

function apply(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light");
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = () => {
      if (saved()) return;
      const next: Theme = mql.matches ? "dark" : "light";
      apply(next);
      setTheme(next);
    };
    mql.addEventListener("change", onSystemChange);
    return () => mql.removeEventListener("change", onSystemChange);
  }, []);

  const next: Theme = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => {
        apply(next);
        setTheme(next);
        try {
          localStorage.setItem(KEY, next);
        } catch {
          // storage unavailable: the choice lasts for this visit
        }
      }}
      aria-label={theme ? `Switch to ${next} mode` : "Switch theme"}
      title={theme ? `Switch to ${next} mode` : "Switch theme"}
      className="grid size-9 shrink-0 place-items-center rounded-full border border-line bg-card text-muted hover:text-fg"
    >
      {/* Before mount the theme isn't known yet; show the moon to avoid a mismatch. */}
      {theme === "dark" ? (
        <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
        </svg>
      )}
    </button>
  );
}
