"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useConnection } from "wagmi";
import { BSC_CHAIN_ID } from "@/lib/wagmi";
import type { ApiResult, Balances, QuoteSummary } from "@/lib/types";

// Browser-side hooks for the buy flow. They only call our own /api routes;
// the signed Binance Web3 calls happen on the server.

async function getJson<T>(url: string): Promise<ApiResult<T>> {
  const res = await fetch(url);
  return (await res.json()) as ApiResult<T>;
}

// The connected wallet, if it's on BNB Chain.
export function useWallet() {
  const { address, chainId } = useConnection();
  const onBsc = chainId === BSC_CHAIN_ID;
  return { address: address && onBsc ? address : undefined, connected: Boolean(address), onBsc };
}

export function useBalances(address?: string) {
  return useQuery({
    queryKey: ["balances", address],
    queryFn: () => getJson<Balances>(`/api/balances?address=${address}`),
    enabled: Boolean(address),
    refetchInterval: 30_000,
  });
}

function useDebounced<T>(value: T, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

// Ticks once a second so countdowns stay live.
export function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

// Live quote for `amount` USDT → token. Waits until typing pauses, then
// refreshes itself whenever the 30-second quote expires.
export function useLiveQuote(token: string | undefined, amount: number, wallet: string | undefined) {
  const debouncedAmount = useDebounced(amount, 500);
  const enabled = Boolean(token && wallet && debouncedAmount > 0);
  const query = useQuery({
    queryKey: ["quote", token, debouncedAmount, wallet],
    queryFn: () => getJson<QuoteSummary>(`/api/quote?token=${token}&amount=${debouncedAmount}&wallet=${wallet}`),
    enabled,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });

  const now = useNow(enabled);
  const quote = query.data?.ok ? query.data.data : undefined;
  const secondsLeft = quote ? Math.max(0, Math.ceil((quote.expiresAt - now) / 1000)) : 0;
  const { refetch, isFetching } = query;

  useEffect(() => {
    if (quote && secondsLeft === 0 && !isFetching) void refetch();
  }, [quote, secondsLeft, isFetching, refetch]);

  return {
    quote,
    error: query.data && !query.data.ok ? query.data : query.error ? { error: "Couldn't reach the server." } : undefined,
    loading: enabled && (query.isPending || amount !== debouncedAmount),
    refreshing: isFetching,
    secondsLeft,
    enabled,
  };
}

// Bid/ask from a $100 round trip, quoted for the connected wallet. Used for
// tokens (Ondo) that only quote when a wallet is connected.
export function useWalletSpread(token: string | undefined, wallet: string | undefined) {
  return useQuery({
    queryKey: ["spread", token, wallet],
    queryFn: () =>
      getJson<{ bid: number | null; ask: number | null; warning?: string }>(`/api/spread?token=${token}&wallet=${wallet}`),
    enabled: Boolean(token && wallet),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}
