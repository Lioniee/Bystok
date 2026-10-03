"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TokenizedStock, TokensResponse } from "@/lib/types";
import { analyze } from "@/lib/analysis";
import { formatCountdown, getMarketClock } from "@/lib/market-hours";
import TokenPicker from "./TokenPicker";
import TokenReport from "./TokenReport";
import BuyPanel from "./BuyPanel";
import MarketTicker from "./MarketTicker";
import { useNow, useWallet, useWalletSpread } from "./buy-hooks";
import { useWatchlist } from "./useWatchlist";

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

// Module-level so React Query can keep the combined result stable between renders.
function allSearchedTokens(results: { data?: TokensResponse }[]) {
  return results.flatMap((r) => r.data?.tokens ?? []);
}

async function loadTokens(query?: string) {
  const res = await fetch(query ? `/api/tokens?q=${encodeURIComponent(query)}` : "/api/tokens", { cache: "no-store" });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return (await res.json()) as TokensResponse;
}

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
      <div className="hidden gap-2 overflow-hidden md:flex">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className={`${bar} h-11 w-64 shrink-0`} />
        ))}
      </div>
      <div className="grid gap-6 md:grid-cols-[260px_minmax(0,1fr)] md:items-start xl:grid-cols-[260px_minmax(0,1fr)_320px]">
        <div className="grid content-start gap-2 md:row-span-2 xl:row-span-1">
          <div className={`${bar} h-5 w-48`} />
          <div className={`${bar} h-10`} />
          <div className={`${bar} h-11`} />
          <div className="flex gap-2 overflow-hidden md:grid">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className={`${bar} h-16 w-56 shrink-0 md:w-full`} />
            ))}
          </div>
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

// Loads tokens from our own server route (/api/tokens), never from Binance
// directly, so the API key stays on the server.
// Data is refetched every 30 seconds while the tab is visible, and right away
// when the viewer comes back to the tab, so a page left open never shows
// hours-old prices.
export default function Scanner() {
  const queryClient = useQueryClient();
  const [searches, setSearches] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const clock = useMarketClock();

  const refresh = { refetchInterval: REFRESH_MS, refetchOnWindowFocus: true, staleTime: REFRESH_MS } as const;
  const main = useQuery({ queryKey: ["tokens"], queryFn: () => loadTokens(), ...refresh });
  const searchedTokens = useQueries({
    queries: searches.map((q) => ({ queryKey: ["tokens", q], queryFn: () => loadTokens(q), ...refresh })),
    combine: allSearchedTokens,
  });

  // Default list first, then tokens found by searching, without duplicates.
  const data = useMemo<TokensResponse | null>(() => {
    if (!main.data) return null;
    const known = new Set(main.data.tokens.map((t) => t.id));
    const extra = searchedTokens.filter((t) => !known.has(t.id) && known.add(t.id));
    return { ...main.data, tokens: [...main.data.tokens, ...extra] };
  }, [main.data, searchedTokens]);

  useEffect(() => {
    if (!selectedId && data?.tokens[0]) setSelectedId(data.tokens[0].id);
  }, [data, selectedId]);

  // Searches every tokenized stock on the server and adds the matches to the list.
  const searchAll = useCallback(
    async (query: string) => {
      const found = await queryClient.fetchQuery({ queryKey: ["tokens", query], queryFn: () => loadTokens(query) });
      setSearches((prev) => (prev.includes(query) ? prev : [...prev, query]));
      return found.tokens.length;
    },
    [queryClient],
  );

  // Saved tokens that aren't in the default list (found by searching earlier)
  // are fetched again by ticker after a reload, once per ticker.
  const watchlist = useWatchlist();
  const restoreTried = useRef(new Set<string>());
  const [restoring, setRestoring] = useState(0);
  const live = data?.source === "live";
  useEffect(() => {
    if (!live || !data) return;
    const have = new Set(data.tokens.map((t) => t.id));
    const tickers = [
      ...new Set(watchlist.entries.filter((e) => !have.has(e.id)).map((e) => e.ticker)),
    ].filter((ticker) => !restoreTried.current.has(ticker));
    for (const ticker of tickers) {
      restoreTried.current.add(ticker);
      setRestoring((n) => n + 1);
      searchAll(ticker)
        .catch(() => 0)
        .finally(() => setRestoring((n) => n - 1));
    }
  }, [live, data, watchlist.entries, searchAll]);

  const error = main.error && !main.data ? main.error.message : null;

  const listed = data?.tokens.find((t) => t.id === selectedId);
  const selected = useWalletQuotedSpread(listed);
  const analysis = useMemo(() => (selected ? analyze(selected, clock) : null), [selected, clock]);

  if (error) {
    return (
      <p className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm">
        Couldn’t load token data: {error}
      </p>
    );
  }

  if (!data) return <ScannerSkeleton />;

  // Wide screens: "Most traded" ticker on top, then sidebar | report | Buy panel.
  // Medium screens: the Buy panel moves under the report. Phones: one column
  // (status, token strip, report, Buy panel) and no ticker.
  return (
    <div className="grid grid-cols-1 gap-6">
      <MarketTicker tokens={data.tokens} selectedId={selectedId} onSelect={setSelectedId} />
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
            selectedId={selectedId}
            onSelect={setSelectedId}
            onSearchAll={data.source === "live" ? searchAll : undefined}
            watchlist={watchlist.ids}
            watchlistPending={restoring}
            onToggleWatch={watchlist.toggle}
            clock={clock}
          />
        </div>
        {selected && analysis && (
          <>
            <div className="min-w-0 md:col-start-2">
              <TokenReport token={selected} analysis={analysis} />
            </div>
            <div className="min-w-0 md:col-start-2 xl:col-start-3 xl:row-start-1">
              {/* key resets the form whenever a different token is picked */}
              <BuyPanel key={selected.id} token={selected} analysis={analysis} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
