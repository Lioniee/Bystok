"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { TokenSummary } from "@/lib/types";

// The stock the viewer is looking at, shared by every page (pick NVDAB on Scan,
// open Swap, and it's still NVDAB). Also saved in localStorage so a reload or a
// direct visit to /swap keeps it; storage errors (private mode) are ignored.

const KEY = "bystok:selected";

type SelectedToken = {
  selected: TokenSummary | null;
  select: (t: TokenSummary) => void;
};

const Ctx = createContext<SelectedToken>({ selected: null, select: () => {} });

function read(): TokenSummary | null {
  try {
    const t = JSON.parse(localStorage.getItem(KEY) ?? "null") as TokenSummary | null;
    return t && typeof t.id === "string" && typeof t.symbol === "string" && t.underlying ? t : null;
  } catch {
    return null;
  }
}

export function SelectedTokenProvider({ children }: { children: React.ReactNode }) {
  const [selected, setSelected] = useState<TokenSummary | null>(null);

  useEffect(() => {
    const saved = read();
    if (saved) setSelected((current) => current ?? saved);
  }, []);

  const select = useCallback((t: TokenSummary) => {
    setSelected(t);
    try {
      localStorage.setItem(KEY, JSON.stringify(t));
    } catch {
      // storage unavailable: the choice lasts for this visit
    }
  }, []);

  return <Ctx.Provider value={{ selected, select }}>{children}</Ctx.Provider>;
}

export const useSelectedToken = () => useContext(Ctx);
