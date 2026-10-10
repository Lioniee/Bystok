import type { TokensResponse } from "@/lib/types";

// Browser-side fetch for our own /api/tokens route: the top-30 list, or search
// results when a query is given.
export async function loadTokens(query?: string) {
  const res = await fetch(query ? `/api/tokens?q=${encodeURIComponent(query)}` : "/api/tokens", { cache: "no-store" });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return (await res.json()) as TokensResponse;
}
