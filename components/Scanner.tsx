"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import type { ApiResult, TokenizedStock, TokenSummary, TokensResponse } from "@/lib/types";
import { analyze } from "@/lib/analysis";
import { formatCountdown, getMarketClock } from "@/lib/market-hours";
import TokenPicker from "./TokenPicker";
import TokenReport from "./TokenReport";
import BuyPanel from "./BuyPanel";
import MarketTicker from "./MarketTicker";
import { useNow, useWallet, useWalletSpread } from "./buy-hooks";
import { useWatchlist } from "./useWatchlist";
import { loadTokens } from "./token-api";

// The server caches Binance responses for 30s, so polling faster gains nothing.
const REFRESH_MS = 30_000;
// Past this age the "updated" time is shown as a warning.
const STALE_AFTER_MS = 90_000;

// Re-reads the US market clock every second so status and countdown stay live.
function useMarketClock() {
  const [clock, setClock] = useState(() => getMarketClock());
  useEffect(() => {
    const id = setInterval(() => setClock(getMarketClock()), 1000);
    return () => clearInterval(id);
  }, []);
  return clock;
}

// Selected on first load: NVDAB has deep liquidity, a live spread and a live price.
const DEFAULT_TOKEN_ID = "nvdab";

// Module-level so React Query can keep the combined result stable between renders.
function combineRestored(results: { data?: TokensResponse; isPending: boolean }[]) {
  return { tokens: results.flatMap((r) => r.data?.tokens ?? []), pending: results.filter((r) => r.isPending).length };
}

// Full report data for one token. The symbol is only a display hint for tokens
// that /rwa/tokens leaves out.
async function loadDetail(t: TokenSummary) {
  const params = new URLSearchParams({ address: t.contractAddress ?? "", symbol: t.symbol });
  const res = await fetch(`/api/token?${params}`, { cache: "no-store" });
  const json = (await res.json()) as ApiResult<TokenizedStock>;
  if (!json.ok) throw new Error(json.error);
  return json.data;
}

const dedupe = (tokens: TokenSummary[]) => {
  const seen = new Set<string>();
  return tokens.filter((t) => !seen.has(t.id) && seen.add(t.id));
};

// Says plainly whether the numbers are real. Sample data gets a loud label.
function DataSource({ data, refreshFailed }: { data: TokensResponse; refreshFailed: boolean }) {
  const now = useNow(true);
  if (data.source === "sample") {
    return (
      <div role="status" className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/15 p-3 text-xs">
        <p className="font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400">Sample data</p>
        <p className="mt-1">These are made-up numbers, not live prices. {data.notice}</p>
      </div>
    );
  }
  // Formatted in the browser, so it is in the viewer's own time zone (e.g. "2:01 PM WAT").
  const updated = new Date(data.updatedAt);
  const time = updated.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZoneName: "short" });
  const ageMin = Math.floor((now - updated.getTime()) / 60_000);
  const stale = refreshFailed || now - updated.getTime() > STALE_AFTER_MS;
  return (
    <p className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
      <span
        className={`rounded-full px-2 py-0.5 font-semibold ${
          stale
            ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
            : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
        }`}
      >
        {stale ? "Delayed" : "Live"}
      </span>
      <span>
        Binance Web3 API · updated <time dateTime={data.updatedAt}>{time}</time>
        {stale && (
          <span className="text-amber-700 dark:text-amber-400">
            {" "}
            ({ageMin < 1 ? "under a minute" : `${ageMin} min`} ago{refreshFailed ? ", couldn’t refresh, retrying" : ""})
          </span>
        )}
      </span>
    </p>
  );
}

// Ondo tokens only quote for a connected wallet, so their spread is
// "Unavailable" in the shared token list. Once a wallet is connected, quote the
// selected token for that wallet and fill in its bid/ask.
function useWalletQuotedSpread(token: TokenizedStock | undefined) {
  const wallet = useWallet();
  const needed = token?.contractAddress && token.bid === null ? token.contractAddress : undefined;
  const spread = useWalletSpread(needed, wallet.address);
  return useMemo(() => {
    const result = spread.data?.ok ? spread.data.data : undefined;
    if (!token || !needed || !result) return token;
    const others = token.warnings.filter((w) => !w.startsWith("Spread unavailable"));
    return {
      ...token,
      bid: result.bid,
      ask: result.ask,
      warnings: result.warning ? [result.warning, ...others] : others,
    };
  }, [token, needed, spread.data]);
}

// Placeholder with the same shape as the real page, shown during the first
// load (several seconds while live quotes are gathered).
function ScannerSkeleton() {
  const block = "animate-pulse rounded-2xl bg-line/60";
  const bar = "animate-pulse rounded-xl bg-line/60";
  return (
    <div className="grid grid-cols-1 gap-6" aria-busy="true" aria-label="Loading tokens">
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className={`${bar} h-11 w-64 shrink-0`} />
        ))}
      </div>
      <div className="grid gap-6 md:grid-cols-[260px_minmax(0,1fr)] md:items-start xl:grid-cols-[260px_minmax(0,1fr)_320px]">
        <div className="grid content-start gap-2 md:row-span-2 xl:row-span-1">
          <div className={`${bar} h-5 w-48`} />
          <div className={`${bar} h-10`} />
          <div className={`${bar} h-11`} />
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className={`${bar} h-16 ${i >= 4 ? "max-md:hidden" : ""}`} />
          ))}
        </div>
        <div className="grid gap-4 md:col-start-2">
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
        <div className={`${block} h-80 md:col-start-2 xl:col-start-3 xl:row-start-1`} />
      </div>
      <p className="sr-only">Loading live token data. This can take a few seconds.</p>
    </div>
  );
}

// Loads tokens from our own server routes, never from Binance directly, so the
// API key stays on the server:
// - /api/tokens: the top 30 by 24h volume as light summaries (price, change,
//   volume), refetched every 30 seconds while the tab is visible;
// - /api/token: full details for the selected token only, cached for 30 seconds.
export default function Scanner() {
  const [selected, setSelected] = useState<TokenSummary | null>(null);
  const [restoreQueries, setRestoreQueries] = useState<string[]>([]);
  const clock = useMarketClock();

  const refresh = { refetchInterval: REFRESH_MS, refetchOnWindowFocus: true, staleTime: REFRESH_MS } as const;
  const main = useQuery({ queryKey: ["tokens"], queryFn: () => loadTokens(), ...refresh });
  const restored = useQueries({
    queries: restoreQueries.map((q) => ({ queryKey: ["tokens", q], queryFn: () => loadTokens(q), ...refresh })),
    combine: combineRestored,
  });
  const data = main.data ?? null;
  const live = data?.source === "live";

  // Every token summary we know about: the list plus watched tokens outside it.
  const known = useMemo(() => dedupe([...(data?.tokens ?? []), ...restored.tokens]), [data, restored.tokens]);

  useEffect(() => {
    if (!selected && data?.tokens.length) setSelected(data.tokens.find((t) => t.id === DEFAULT_TOKEN_ID) ?? data.tokens[0]);
  }, [data, selected]);

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
  const selectToken = useCallback((t: TokenSummary) => {
    setSelected(t);
    setScrollRequest((n) => n + 1);
  }, []);
  useEffect(() => {
    if (scrollRequest === 0 || !window.matchMedia("(max-width: 767px)").matches) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    reportRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }, [scrollRequest]);

  // The freshest summary for the selected token, then its full details. Sample
  // data already contains everything, so it needs no detail request.
  const current = selected ? (known.find((t) => t.id === selected.id) ?? selected) : undefined;
  const detailQuery = useQuery({
    queryKey: ["token", current?.contractAddress],
    queryFn: () => loadDetail(current!),
    enabled: live && Boolean(current?.contractAddress),
    ...refresh,
  });
  const detail = useWalletQuotedSpread(live ? detailQuery.data : (current as TokenizedStock | undefined));
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

  // "Most traded" ticker on top at every size, then:
  // wide screens: sidebar | report | Buy panel; medium: the Buy panel moves
  // under the report; phones: one column (picker, report, Buy panel).
  return (
    <div className="grid grid-cols-1 gap-6">
      <MarketTicker tokens={data.tokens} selectedId={current?.id ?? ""} onSelect={selectToken} />
      <div className="grid gap-6 md:grid-cols-[260px_minmax(0,1fr)] md:items-start xl:grid-cols-[260px_minmax(0,1fr)_320px]">
        <div className="min-w-0 md:row-span-2 xl:row-span-1">
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
        <div ref={reportRef} className="min-w-0 scroll-mt-4 md:col-start-2">
          {detail && analysis ? (
            <TokenReport token={detail} analysis={analysis} />
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
        {detail && analysis && (
          <div className="min-w-0 md:col-start-2 xl:col-start-3 xl:row-start-1">
            {/* key resets the form whenever a different token is picked */}
            <BuyPanel key={detail.id} token={detail} analysis={analysis} />
          </div>
        )}
      </div>
    </div>
  );
}

// Shown while the selected token's details load (a second or two).
function ReportSkeleton({ symbol }: { symbol: string }) {
  const block = "animate-pulse rounded-2xl bg-line/60";
  return (
    <div className="grid gap-4" aria-busy="true">
      <p className="sr-only" aria-live="polite">
        Loading details for {symbol}…
      </p>
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
