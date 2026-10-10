"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// The four app sections. Desktop shows them as pill tabs in the header; phones
// show them as a fixed bottom tab bar instead.

type Tab = { href: string; label: string; icon: React.ReactNode };

const icon = (path: React.ReactNode) => (
  <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {path}
  </svg>
);

const TABS: Tab[] = [
  {
    href: "/",
    label: "Scan",
    icon: icon(
      <>
        <circle cx="11" cy="11" r="6.5" />
        <path d="M20 20l-4.2-4.2" />
        <path d="M8 12.5l2-2 1.5 1.5 2.5-2.5" />
      </>,
    ),
  },
  {
    href: "/swap",
    label: "Swap",
    icon: icon(
      <>
        <path d="M4 8h13l-3.5-3.5" />
        <path d="M20 16H7l3.5 3.5" />
      </>,
    ),
  },
  {
    href: "/mystoks",
    label: "MyStoks",
    icon: icon(
      <>
        <rect x="3.5" y="6.5" width="17" height="13" rx="2.5" />
        <path d="M3.5 10.5h17" />
        <path d="M16 15h1.5" />
        <path d="M7 6.5V5a1.5 1.5 0 0 1 1.5-1.5h7A1.5 1.5 0 0 1 17 5v1.5" />
      </>,
    ),
  },
  {
    href: "/docs",
    label: "Docs",
    icon: icon(
      <>
        <path d="M5 4.5h9.5a3 3 0 0 1 3 3v12H8a3 3 0 0 1-3-3z" />
        <path d="M5 16.5a3 3 0 0 1 3-3h9.5" />
        <path d="M9 8.5h5" />
      </>,
    ),
  },
];

function useIsActive() {
  const pathname = usePathname();
  return (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));
}

export function DesktopTabs() {
  const isActive = useIsActive();
  return (
    <nav aria-label="Main" className="hidden items-center gap-1 rounded-full border border-line bg-card p-1 md:flex">
      {TABS.map((t) => {
        const active = isActive(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
              active ? "bg-brand text-brand-fg" : "text-muted hover:bg-bg hover:text-fg"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function BottomTabs() {
  const isActive = useIsActive();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-4">
        {TABS.map((t) => {
          const active = isActive(t.href);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${
                  active ? "text-fg" : "text-muted"
                }`}
              >
                <span className={`grid h-7 w-12 place-items-center rounded-full ${active ? "bg-brand text-brand-fg" : ""}`}>
                  {t.icon}
                </span>
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
