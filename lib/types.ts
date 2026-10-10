// The shape of one tokenized stock. Sample data and the Binance Web3 API
// response both get mapped into this, so the UI never cares where data came from.

export type TokenizedStock = {
  id: string; // url-safe id, e.g. "tslaon"
  symbol: string; // token symbol on BNB Chain, e.g. "TSLAon"
  chain: string;
  contractAddress?: string;
  underlying: {
    ticker: string; // e.g. "TSLA"
    name: string; // e.g. "Tesla, Inc."
    exchange: string; // e.g. "NASDAQ"
    price: number; // reference price of ONE share of the real stock, USD
    sharesPerToken?: number; // how many shares one token tracks (default 1; NFLXon is 10)
    marketCapUsd?: number;
    high52w?: number;
    low52w?: number;
  };
  provider: {
    name: string; // who issues the token
    backing: string; // how it is backed, in plain words
    website?: string;
    attestationUrl?: string; // latest proof-of-reserves report, if published
  };
  tokenPrice: number; // last price of the token, USD
  // Best buy/sell prices from a small sample quote. null when no quote is
  // possible without a wallet (Ondo and other RFQ-only tokens).
  bid: number | null;
  ask: number | null;
  liquidityUsd: number | null; // null when pools don't report USD liquidity (RFQ market makers)
  volume24hUsd: number; // on-chain token volume, not the real stock's volume
  holders?: number;
  change24hPct?: number; // token price change over 24h, in percent (e.g. -0.59)
  risks: string[]; // token-specific risks from the provider/issuer
  warnings: string[]; // live notices, e.g. "issuer paused trading: weekend"
};

// The light version used by the list, ticker and search: only what a card
// shows. Details (liquidity, spread, provider, …) are fetched for the selected
// token alone. A full TokenizedStock also satisfies this shape.
export type TokenSummary = {
  id: string;
  symbol: string;
  chain: string;
  contractAddress?: string;
  provider: { name: string };
  underlying: { ticker: string; name: string };
  tokenPrice: number;
  change24hPct?: number;
  volume24hUsd: number; // on-chain token volume
};

export type TokensResponse = {
  tokens: TokenSummary[];
  total?: number; // tokens in the full list (e.g. 488), when known
  source: "sample" | "live";
  updatedAt: string;
  notice?: string; // why we fell back to sample data, in plain words
};

// --- Buy flow ----------------------------------------------------------------

export type Balances = {
  usdt: number;
  bnb: number;
  bnbPriceUsd: number | null;
};

// A live quote for buying a token with USDT. Valid for 30 seconds.
export type QuoteSummary = {
  quoteId: string;
  executionMode: string; // "SWAP" or "RFQ", as reported by the API
  route: string[]; // venues, e.g. ["PancakeSwap V3"] or ["Rfq Halfmoon"]
  usdtIn: number;
  tokensOut: number;
  pricePerToken: number; // USDT paid per token, all-in
  marketPrice: number; // the API's own unit price for the token
  priceImpactPct: number; // how much worse pricePerToken is than marketPrice
  tradeFeeUsd: number | null; // the API's `tradeFee`
  fetchedAt: number; // ms since epoch
  expiresAt: number;
};

// Every API route in the buy flow answers with one of these.
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string; marketClosed?: boolean };
