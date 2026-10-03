"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { TokenizedStock } from "@/lib/types";

// The viewer's watchlist, kept in this browser only (localStorage). Every
// storage access is wrapped in try/catch: private windows and blocked storage
// throw, and the watchlist then simply lasts for this visit.

const KEY = "bystok:watchlist";

// `ticker` lets us search for a saved token again after a reload, when it isn't
// in the default list (e.g. one that was found by searching).
export type WatchEntry = { id: string; ticker: string };

function read(): WatchEntry[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((e): e is WatchEntry => typeof e?.id === "string" && typeof e?.ticker === "string")
      : [];
  } catch {
    return [];
  }
}

function write(entries: WatchEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    // storage unavailable or full: keep the in-memory list
  }
}

export function useWatchlist() {
  const [entries, setEntries] = useState<WatchEntry[]>([]);

  // Load after mount (localStorage doesn't exist on the server), and follow
  // changes made in other tabs.
  useEffect(() => {
    setEntries(read());
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setEntries(read());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const toggle = useCallback((t: TokenizedStock) => {
    setEntries((prev) => {
      const next = prev.some((e) => e.id === t.id)
        ? prev.filter((e) => e.id !== t.id)
        : [...prev, { id: t.id, ticker: t.underlying.ticker }];
      write(next);
      return next;
    });
  }, []);

  const ids = useMemo(() => new Set(entries.map((e) => e.id)), [entries]);
  return { entries, ids, toggle };
}
