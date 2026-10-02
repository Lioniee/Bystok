"use client";

import { useState } from "react";
import type { TokenizedStock } from "@/lib/types";
import { analyze } from "@/lib/analysis";
import { usd } from "@/lib/format";
import type { MarketClock } from "@/lib/market-hours";
import { LEVEL_STYLES } from "./LevelBadge";

type Props = {
  tokens: TokenizedStock[];
  selectedId: string;
  onSelect: (id: string) => void;
  clock: MarketClock;
};

// Search + list of tokens. Scrolls sideways on phones, stacks as a list on desktop.
export default function TokenPicker({ tokens, selectedId, onSelect, clock }: Props) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filtered = tokens.filter((t) =>
    [t.symbol, t.underlying.ticker, t.underlying.name].some((s) => s.toLowerCase().includes(q)),
  );

  return (
    <section aria-label="Pick a tokenized stock" className="min-w-0">
      <label htmlFor="token-search" className="mb-2 block text-sm font-semibold">
        Pick a tokenized stock
      </label>
      <input
        id="token-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search TSLA, Apple, SPY…"
        className="mb-3 w-full rounded-xl border border-line bg-card px-3 py-2.5 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
      />

      <ul className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-2 md:mx-0 md:flex-col md:overflow-visible md:px-0">
        {filtered.map((t) => {
          const verdict = analyze(t, clock).verdict;
          const active = t.id === selectedId;
          return (
            <li key={t.id} className="shrink-0 snap-start md:shrink">
              <button
                type="button"
                onClick={() => onSelect(t.id)}
                aria-pressed={active}
                className={`flex w-44 items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition md:w-full ${
                  active ? "border-brand bg-brand/10" : "border-line bg-card hover:border-muted"
                }`}
              >
                <span className="min-w-0">
                  <span className="block font-semibold">{t.symbol}</span>
                  <span className="block truncate text-xs text-muted">{t.underlying.name}</span>
                </span>
                <span className="flex flex-col items-end gap-1">
                  <span className="text-sm tabular-nums">{usd(t.tokenPrice)}</span>
                  <span
                    className={`size-2 rounded-full ${LEVEL_STYLES[verdict.level].dot}`}
                    title={verdict.title}
                  />
                </span>
              </button>
            </li>
          );
        })}
        {filtered.length === 0 && <li className="px-1 py-2 text-sm text-muted">No tokens match “{query}”.</li>}
      </ul>
    </section>
  );
}
