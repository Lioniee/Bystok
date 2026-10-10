"use client";

import { useEffect, useRef, useState } from "react";
import type { DocPart } from "@/app/docs/sections";

// The section whose heading has scrolled past this line counts as "current".
const ACTIVE_LINE_PX = 120;

function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      let current = ids[0];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= ACTIVE_LINE_PX) current = id;
      }
      // At the very bottom, the last section is current even if it's short.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) current = ids[ids.length - 1];
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [ids]);
  return active;
}

function Links({ parts, active, onPick }: { parts: DocPart[]; active: string; onPick?: () => void }) {
  return (
    <div className="grid gap-5">
      {parts.map((part) => (
        <div key={part.title}>
          <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted">{part.title}</p>
          <ol className="grid gap-0.5">
            {part.sections.map((s, i) => {
              const current = s.id === active;
              return (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    onClick={onPick}
                    aria-current={current ? "location" : undefined}
                    className={`flex gap-2 rounded-lg border-l-2 px-2.5 py-1.5 text-sm transition ${
                      current
                        ? "border-brand bg-brand/10 font-semibold text-fg"
                        : "border-transparent text-muted hover:bg-card hover:text-fg"
                    }`}
                  >
                    <span className="w-4 shrink-0 tabular-nums">{i + 1}.</span>
                    <span>{s.title}</span>
                  </a>
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </div>
  );
}

// Desktop: sticky sidebar. Phones: a collapsible "Contents" menu.
export default function DocsToc({ parts }: { parts: DocPart[] }) {
  const ids = useRef(parts.flatMap((p) => p.sections.map((s) => s.id))).current;
  const active = useActiveSection(ids);
  const menuRef = useRef<HTMLDetailsElement>(null);
  const activeTitle = parts.flatMap((p) => p.sections).find((s) => s.id === active)?.title;

  return (
    <>
      <details ref={menuRef} className="group mb-6 rounded-xl border border-line bg-card md:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold [&::-webkit-details-marker]:hidden">
          <span>
            Contents
            {activeTitle && <span className="ml-2 font-normal text-muted">· {activeTitle}</span>}
          </span>
          <span aria-hidden className="text-muted transition group-open:rotate-180">
            ▾
          </span>
        </summary>
        <nav aria-label="Contents" className="border-t border-line px-2 py-3">
          <Links parts={parts} active={active} onPick={() => menuRef.current?.removeAttribute("open")} />
        </nav>
      </details>

      <nav
        aria-label="Contents"
        className="hidden max-h-[calc(100dvh-2rem)] overflow-y-auto pb-4 md:block"
      >
        <Links parts={parts} active={active} />
      </nav>
    </>
  );
}
