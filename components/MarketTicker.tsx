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

// "Most traded (24h)" ticker for wider screens: the loaded tokens ranked by
// on-chain 24h trading volume (already in the token data, so no extra API
// calls). It loops slowly, like a market ticker, with the same pause rules as
// the phone strip.
export default function MarketTicker({ tokens, selectedId, onSelect }: Props) {
  const top = [...tokens]
    .filter((t) => t.volume24hUsd > 0)
    .sort((a, b) => b.volume24hUsd - a.volume24hUsd)
    .slice(0, TOP_N);

  const listRef = useRef<HTMLUListElement>(null);
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const loopWanted = isDesktop && !reducedMotion;
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
    <section aria-label="Most traded tokens in the last 24 hours" className="hidden min-w-0 items-center gap-3 md:flex">
      <p className="shrink-0 text-xs font-bold uppercase tracking-wide text-muted">
        Most traded
        <span className="block font-medium normal-case tracking-normal">24h volume</span>
      </p>
      <ul
        ref={listRef}
        className="no-scrollbar relative flex min-w-0 flex-1 gap-2 overflow-x-auto py-1 [mask-image:linear-gradient(to_right,transparent,black_32px,black_calc(100%-32px),transparent)]"
      >
        {top.map((t, i) => item(t, i + 1, false))}
        {looping && top.map((t, i) => item(t, i + 1, true, i === 0))}
      </ul>
    </section>
  );
}
