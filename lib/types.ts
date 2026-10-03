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
    price: number; // reference price of the real stock, USD
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
  risks: string[]; // token-specific risks from the provider/issuer
  warnings: string[]; // live notices, e.g. "issuer paused trading: weekend"
};

export type TokensResponse = {
  tokens: TokenizedStock[];
  source: "sample" | "live";
  updatedAt: string;
  notice?: string; // why we fell back to sample data, in plain words
};
