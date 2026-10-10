"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ApiResult, TokenizedStock, TokenSummary } from "@/lib/types";
import { getMarketClock } from "@/lib/market-hours";
import { useWallet, useWalletSpread } from "./buy-hooks";
import { useSelectedToken } from "./SelectedToken";
import { loadTokens } from "./token-api";

// Client-side data hooks shared by the Scan and Swap pages. They only call our
// own /api routes; React Query shares the cache between pages.

// The server caches Binance responses for 30s, so polling faster gains nothing.
export const REFRESH_MS = 30_000;
export const refresh = { refetchInterval: REFRESH_MS, refetchOnWindowFocus: true, staleTime: REFRESH_MS } as const;

// Selected on first load: NVDAB has deep liquidity, a live spread and a live price.
const DEFAULT_TOKEN_ID = "nvdab";

// The top-30 list (or sample data), refetched every 30 seconds while visible.
export function useTokenList() {
  return useQuery({ queryKey: ["tokens"], queryFn: () => loadTokens(), ...refresh });
}

// Picks NVDAB (or the first token) when nothing usable is selected: nothing
// yet, or a saved choice from the other data mode (a sample token has no
// address for live details; a live token has no full sample data).
export function useDefaultSelection(tokens: TokenSummary[] | undefined, source: "live" | "sample" | undefined) {
  const { selected, select } = useSelectedToken();
  useEffect(() => {
    if (!tokens?.length) return;
    const usable =
      selected &&
      (source === "live" ? Boolean(selected.contractAddress) : tokens.some((t) => t.id === selected.id));
    if (!usable) select(tokens.find((t) => t.id === DEFAULT_TOKEN_ID) ?? tokens[0]);
  }, [selected, tokens, source, select]);
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

// Details for the given token, cached for 30 seconds. Sample data already
// contains everything, so it needs no request. Until the list has loaded the
// source is unknown, and there are no details yet.
export function useTokenDetail(token: TokenSummary | undefined, source: "live" | "sample" | undefined) {
  const live = source === "live";
  const query = useQuery({
    queryKey: ["token", token?.contractAddress],
    queryFn: () => loadDetail(token!),
    enabled: live && Boolean(token?.contractAddress),
    ...refresh,
  });
  const detail = useWalletQuotedSpread(
    live ? query.data : source === "sample" ? (token as TokenizedStock | undefined) : undefined,
  );
  return { detail, query };
}

// Ondo tokens only quote for a connected wallet, so their spread is
// "Unavailable" in the shared data. Once a wallet is connected, quote the
// token for that wallet and fill in its bid/ask.
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

// Re-reads the US market clock every second so status and countdown stay live.
export function useMarketClock() {
  const [clock, setClock] = useState(() => getMarketClock());
  useEffect(() => {
    const id = setInterval(() => setClock(getMarketClock()), 1000);
    return () => clearInterval(id);
  }, []);
  return clock;
}
