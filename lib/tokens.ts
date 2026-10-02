// "server-only" makes the build fail if this file is ever imported into
// browser code, so the API key below can never leak to users.
import "server-only";

import { sampleTokens } from "./sample-data";
import type { TokensResponse } from "./types";

// Single place where token data comes from. The UI and the /api/tokens route
// only ever call getTokens(), so swapping in the real API touches only this file.
export async function getTokens(): Promise<TokensResponse> {
  const apiKey = process.env.BINANCE_WEB3_API_KEY;

  if (apiKey) {
    // TODO (later): call the Binance Web3 API here, e.g.
    //   const res = await fetch(BINANCE_URL, { headers: { /* auth header with apiKey */ } });
    //   const raw = await res.json();
    //   return { tokens: raw.map(toTokenizedStock), source: "live", updatedAt: new Date().toISOString() };
    // Until that's written, fall through to sample data.
  }

  return { tokens: sampleTokens, source: "sample", updatedAt: new Date().toISOString() };
}
