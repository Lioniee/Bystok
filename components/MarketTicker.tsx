"use client";

import { useRef } from "react";
import type { TokenizedStock } from "@/lib/types";
import { compactUsd, usd } from "@/lib/format";
import PriceChange from "./PriceChange";
import { useAutoScroll, useMediaQuery } from "./useAutoScroll";

const TOP_N = 8;

type Props = {
  tokens: TokenizedStock[];
  selectedId: string;
  onSelect: (id: string) => void;
};

// "Most traded (24h)" ticker at the top of the page: the loaded tokens ranked
// by on-chain 24h trading volume (already in the token data, so no extra API
// calls). It loops slowly, like a market ticker, pausing on hover, touch,
// wheel, swipe and keyboard focus (see useAutoScroll).
export default function MarketTicker({ tokens, selectedId, onSelect }: Props) {
  const top = [...tokens]
    .filter((t) => t.volume24hUsd > 0)
    .sort((a, b) => b.volume24hUsd - a.volume24hUsd)
    .slice(0, TOP_N);

  const listRef = useRef<HTMLUListElement>(null);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const loopWanted = !reducedMotion;
  const overflowing = useAutoScroll(listRef, loopWanted, top.map((t) => t.id).join(","));
  const looping = loopWanted && overflowing;

  if (top.length === 0) return null;

  const item = (t: TokenizedStock, rank: number, copy: boolean, loopStart = false) => {
    const active = t.id === selectedId;
    return (
      <li
        key={copy ? `copy-${t.id}` : t.id}
        className="shrink-0"
        aria-hidden={copy || undefined}
        data-loop-copy={copy || undefined}
        data-loop-start={loopStart || undefined}
      >
        <button
          type="button"
          onClick={() => onSelect(t.id)}
          aria-pressed={active}
          tabIndex={copy ? -1 : undefined}
          className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-left transition ${
            active ? "border-brand bg-brand/10" : "border-line bg-card hover:border-muted"
          }`}
        >
          <span className="text-xs font-semibold text-muted tabular-nums">#{rank}</span>
          <span className="font-semibold">{t.symbol}</span>
          <span className="text-sm tabular-nums">{usd(t.tokenPrice)}</span>
          {t.change24hPct !== undefined && <PriceChange pctValue={t.change24hPct} />}
          <span className="text-xs text-muted tabular-nums">Vol {compactUsd(t.volume24hUsd)}</span>
        </button>
      </li>
    );
  };

  return (
    <section
      aria-label="Most traded tokens in the last 24 hours"
      className="flex min-w-0 flex-col gap-1 md:flex-row md:items-center md:gap-3"
    >
      <p className="text-xs font-bold uppercase tracking-wide text-muted md:shrink-0">
        Most traded
        <span className="ml-1.5 font-medium normal-case tracking-normal md:ml-0 md:block">24h volume</span>
      </p>
      <ul
        ref={listRef}
        // Runs edge to edge on phones; both ends fade out, ticker-style.
        className="no-scrollbar relative -mx-4 flex min-w-0 flex-1 gap-2 overflow-x-auto px-4 py-1 [mask-image:linear-gradient(to_right,transparent,black_24px,black_calc(100%-24px),transparent)] sm:-mx-6 sm:px-6 md:mx-0 md:px-0"
      >
        {top.map((t, i) => item(t, i + 1, false))}
        {looping && top.map((t, i) => item(t, i + 1, true, i === 0))}
      </ul>
    </section>
  );
}
