"use client";

import { useEffect, useMemo, useState } from "react";
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

// Loads tokens from our own server route (/api/tokens), never from Binance
// directly, so the API key stays on the server.
export default function Scanner() {
  const [data, setData] = useState<TokensResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");
  const clock = useMarketClock();

  useEffect(() => {
    fetch("/api/tokens")
      .then((res) => {
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        return res.json() as Promise<TokensResponse>;
      })
      .then((json) => {
        setData(json);
        setSelectedId(json.tokens[0]?.id ?? "");
      })
      .catch((err: Error) => setError(err.message));
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
        <TokenPicker tokens={data.tokens} selectedId={selectedId} onSelect={setSelectedId} clock={clock} />
        {data.source === "sample" && (
          <p className="mt-2 text-xs text-muted">Showing sample data. Live Binance Web3 data coming soon.</p>
        )}
      </div>
      {selected && analysis && <TokenReport token={selected} analysis={analysis} />}
    </div>
  );
}
