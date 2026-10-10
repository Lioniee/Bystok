"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useQueries } from "@tanstack/react-query";
import type { TokenSummary, TokensResponse } from "@/lib/types";
import { analyze } from "@/lib/analysis";
import { formatCountdown } from "@/lib/market-hours";
import TokenPicker from "./TokenPicker";
import TokenReport from "./TokenReport";
import MarketTicker from "./MarketTicker";
import DataSource from "./DataSource";
import { useWatchlist } from "./useWatchlist";
import { useSelectedToken } from "./SelectedToken";
import { loadTokens } from "./token-api";
import { refresh, useDefaultSelection, useMarketClock, useTokenDetail, useTokenList } from "./token-data";

// Module-level so React Query can keep the combined result stable between renders.
function combineRestored(results: { data?: TokensResponse; isPending: boolean }[]) {
  return { tokens: results.flatMap((r) => r.data?.tokens ?? []), pending: results.filter((r) => r.isPending).length };
}

const dedupe = (tokens: TokenSummary[]) => {
  const seen = new Set<string>();
  return tokens.filter((t) => !seen.has(t.id) && seen.add(t.id));
};

// Placeholder with the same shape as the real page, shown during the first load.
function ScannerSkeleton() {
  const bar = "animate-pulse rounded-xl bg-line/60";
  return (
    <div className="grid grid-cols-1 gap-6" aria-busy="true" aria-label="Loading tokens">
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className={`${bar} h-11 w-64 shrink-0`} />
        ))}
      </div>
      <div className="grid gap-6 md:grid-cols-[260px_minmax(0,1fr)] md:items-start">
        <div className="grid content-start gap-2">
          <div className={`${bar} h-5 w-48`} />
          <div className={`${bar} h-10`} />
          <div className={`${bar} h-11`} />
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className={`${bar} h-16 ${i >= 4 ? "max-md:hidden" : ""}`} />
          ))}
        </div>
        <ReportSkeleton />
      </div>
      <p className="sr-only">Loading live token data. This can take a few seconds.</p>
    </div>
  );
}

// Shown while the selected token's details load (a second or two).
function ReportSkeleton({ symbol }: { symbol?: string }) {
  const block = "animate-pulse rounded-2xl bg-line/60";
  return (
    <div className="grid gap-4" aria-busy="true">
      {symbol && (
        <p className="sr-only" aria-live="polite">
          Loading details for {symbol}…
        </p>
      )}
      <div className={`${block} h-24`} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className={`${block} h-36`} />
        <div className={`${block} h-36`} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className={`${block} h-32`} />
        ))}
      </div>
    </div>
  );
}

// The Scan page: "Most traded" ticker, the stock list and the selected stock's
// report. Data comes from our own server routes, never from Binance directly:
// /api/tokens (top 30, light) and /api/token (details for the selected stock).
export default function Scanner() {
  const { selected, select } = useSelectedToken();
  const [restoreQueries, setRestoreQueries] = useState<string[]>([]);
  const clock = useMarketClock();

  const main = useTokenList();
  const restored = useQueries({
    queries: restoreQueries.map((q) => ({ queryKey: ["tokens", q], queryFn: () => loadTokens(q), ...refresh })),
    combine: combineRestored,
  });
  const data = main.data ?? null;
  const live = data?.source === "live";
  useDefaultSelection(data?.tokens, data?.source);

  // Every token summary we know about: the list plus watched tokens outside it.
  const known = useMemo(() => dedupe([...(data?.tokens ?? []), ...restored.tokens]), [data, restored.tokens]);

  // Watched tokens that aren't in the top 30 are looked up again by ticker
  // (after a reload, or when one is added from search results).
  const watchlist = useWatchlist();
  useEffect(() => {
    if (!live) return;
    const have = new Set(known.map((t) => t.id));
    const missing = [...new Set(watchlist.entries.filter((e) => !have.has(e.id)).map((e) => e.ticker))];
    setRestoreQueries((prev) => {
      const add = missing.filter((ticker) => !prev.includes(ticker));
      return add.length ? [...prev, ...add] : prev;
    });
  }, [live, known, watchlist.entries]);

  // Picking a token from the list or ticker. On phones the report is further
  // down the page, so scroll to it (smoothly, unless reduced motion is on).
  // The automatic first selection on load doesn't scroll.
  const reportRef = useRef<HTMLDivElement>(null);
  const [scrollRequest, setScrollRequest] = useState(0);
  const selectToken = useCallback(
    (t: TokenSummary) => {
      select(t);
      setScrollRequest((n) => n + 1);
    },
    [select],
  );
  useEffect(() => {
    if (scrollRequest === 0 || !window.matchMedia("(max-width: 767px)").matches) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    reportRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }, [scrollRequest]);

  // The freshest summary for the selected token, then its full details.
  const current = selected ? (known.find((t) => t.id === selected.id) ?? selected) : undefined;
  const { detail, query: detailQuery } = useTokenDetail(current, data?.source);
  const analysis = useMemo(() => (detail ? analyze(detail, clock) : null), [detail, clock]);

  const error = main.error && !main.data ? main.error.message : null;

  if (error) {
    return (
      <p className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm">
        Couldn’t load token data: {error}
      </p>
    );
  }

  if (!data) return <ScannerSkeleton />;

  // "Most traded" ticker on top, then sidebar | report on wider screens, or
  // one column (picker, report) on phones.
  return (
    <div className="grid grid-cols-1 gap-6">
      <MarketTicker tokens={data.tokens} selectedId={current?.id ?? ""} onSelect={selectToken} />
      <div className="grid gap-6 md:grid-cols-[260px_minmax(0,1fr)] md:items-start">
        <div className="min-w-0">
          <p className="mb-4 flex items-center gap-2 text-sm">
            <span className={`size-2 rounded-full ${clock.isOpen ? "bg-emerald-500" : "bg-amber-500"}`} />
            <span>
              US market <strong>{clock.isOpen ? "open" : "closed"}</strong>
              <span className="text-muted">
                {" "}· {clock.isOpen ? "closes" : "opens"} in{" "}
                <span className="tabular-nums">{formatCountdown(clock.msUntilChange)}</span>
              </span>
            </span>
          </p>
          <DataSource data={data} refreshFailed={main.isRefetchError} />
          <TokenPicker
            tokens={data.tokens}
            total={data.total}
            known={known}
            live={live}
            selectedId={current?.id ?? ""}
            onSelect={selectToken}
            watchlist={watchlist.ids}
            watchlistPending={restored.pending}
            onToggleWatch={watchlist.toggle}
          />
        </div>
        <div ref={reportRef} className="min-w-0 scroll-mt-4">
          {detail && analysis ? (
            <div className="grid gap-4">
              <TokenReport token={detail} analysis={analysis} />
              <Link
                href="/swap"
                className="flex items-center justify-between gap-3 rounded-2xl bg-brand px-4 py-3 font-bold text-brand-fg hover:brightness-95"
              >
                <span>Buy {detail.symbol}: open Swap</span>
                <span aria-hidden>→</span>
              </Link>
            </div>
          ) : detailQuery.isError ? (
            <div role="alert" className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm">
              <p>
                Couldn’t load details for {current?.symbol}: {detailQuery.error.message}
              </p>
              <button
                type="button"
                onClick={() => void detailQuery.refetch()}
                className="mt-2 rounded-lg border border-line bg-card px-3 py-1.5 font-semibold"
              >
                Try again
              </button>
            </div>
          ) : (
            current && <ReportSkeleton symbol={current.symbol} />
          )}
        </div>
      </div>
    </div>
  );
}
