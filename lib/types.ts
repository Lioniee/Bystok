// The shape of one tokenized stock. Sample data and (later) the Binance Web3 API
// response both get mapped into this, so the UI never cares where data came from.

export type TokenizedStock = {
  id: string; // url-safe id, e.g. "tslax"
  symbol: string; // token symbol on BNB Chain, e.g. "TSLAx"
  chain: string;
  underlying: {
    ticker: string; // e.g. "TSLA"
    name: string; // e.g. "Tesla, Inc."
    exchange: string; // e.g. "NASDAQ"
    price: number; // last price of the real stock, USD
  };
  provider: {
    name: string; // who issues the token
    backing: string; // how it is backed, in plain words
  };
  tokenPrice: number; // last traded price of the token, USD
  bid: number; // best price someone will buy at
  ask: number; // best price someone will sell at
  liquidityUsd: number; // total value in the trading pool(s)
  volume24hUsd: number;
  risks: string[]; // token-specific risks from the provider/issuer
};

export type TokensResponse = {
  tokens: TokenizedStock[];
  source: "sample" | "live";
  updatedAt: string;
};
