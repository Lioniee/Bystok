"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { TokensResponse } from "@/lib/types";
import { analyze } from "@/lib/analysis";
import { formatCountdown, getMarketClock } from "@/lib/market-hours";
import TokenPicker from "./TokenPicker";
import TokenReport from "./TokenReport";

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

  const selected = data?.tokens.find((t) => t.id === selectedId);
  const analysis = useMemo(() => (selected ? analyze(selected, clock) : null), [selected, clock]);

  if (error) {
    return (
      <p className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm">
        Couldn’t load token data: {error}
      </p>
    );
  }

  if (!data) {
    return <p className="py-10 text-center text-muted">Loading tokens…</p>;
  }

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
