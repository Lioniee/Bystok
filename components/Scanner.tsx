"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { TokenizedStock, TokensResponse } from "@/lib/types";
import { analyze } from "@/lib/analysis";
import { formatCountdown, getMarketClock } from "@/lib/market-hours";
import TokenPicker from "./TokenPicker";
import TokenReport from "./TokenReport";
import { useWallet, useWalletSpread } from "./buy-hooks";

// Re-reads the US market clock every second so status and countdown stay live.
function useMarketClock() {
  const [clock, setClock] = useState(() => getMarketClock());
  useEffect(() => {
    const id = setInterval(() => setClock(getMarketClock()), 1000);
    return () => clearInterval(id);
  }, []);
  return clock;
}

async function loadTokens(query?: string) {
  const res = await fetch(query ? `/api/tokens?q=${encodeURIComponent(query)}` : "/api/tokens");
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return (await res.json()) as TokensResponse;
}

// Says plainly whether the numbers are real. Sample data gets a loud label.
function DataSource({ data }: { data: TokensResponse }) {
  if (data.source === "sample") {
    return (
      <div role="status" className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/15 p-3 text-xs">
        <p className="font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400">Sample data</p>
        <p className="mt-1">These are made-up numbers, not live prices. {data.notice}</p>
      </div>
    );
  }
  const time = new Date(data.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return (
    <p className="mb-4 flex items-center gap-2 text-xs text-muted">
      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-semibold text-emerald-700 dark:text-emerald-400">
        Live
      </span>
      Binance Web3 API · updated {time}
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
  return (
    <div className="grid gap-6 md:grid-cols-[260px_1fr]" aria-busy="true" aria-label="Loading tokens">
      <div className="grid content-start gap-2">
        <div className="h-5 w-40 animate-pulse rounded bg-line/60" />
        <div className="h-11 animate-pulse rounded-xl bg-line/60" />
        <div className="flex gap-2 overflow-hidden md:grid">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-14 w-44 shrink-0 animate-pulse rounded-xl bg-line/60 md:w-full" />
          ))}
        </div>
      </div>
      <div className="grid min-w-0 gap-4 lg:grid-cols-[1fr_320px] lg:items-start">
        <div className="grid gap-4">
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
        <div className={`${block} h-80`} />
      </div>
      <p className="sr-only md:col-span-2">Loading live token data. This can take a few seconds.</p>
    </div>
  );
}

// Loads tokens from our own server route (/api/tokens), never from Binance
// directly, so the API key stays on the server.
export default function Scanner() {
  const [data, setData] = useState<TokensResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");
  const clock = useMarketClock();

  useEffect(() => {
    loadTokens()
      .then((json) => {
        setData(json);
        setSelectedId(json.tokens[0]?.id ?? "");
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  // Searches every tokenized stock on the server and adds the matches to the list.
  const searchAll = useCallback(async (query: string) => {
    const found = await loadTokens(query);
    setData((prev) => {
      if (!prev) return found;
      const known = new Set(prev.tokens.map((t) => t.id));
      return { ...prev, tokens: [...prev.tokens, ...found.tokens.filter((t) => !known.has(t.id))] };
    });
    return found.tokens.length;
  }, []);

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

  return (
    <div className="grid gap-6 md:grid-cols-[260px_1fr]">
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
        <DataSource data={data} />
        <TokenPicker
          tokens={data.tokens}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onSearchAll={data.source === "live" ? searchAll : undefined}
          clock={clock}
        />
      </div>
      {selected && analysis && <TokenReport token={selected} analysis={analysis} />}
    </div>
  );
}
