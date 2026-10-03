// "server-only" makes the build fail if this file is ever imported into
// browser code, so the API secret can never leak to users.
import "server-only";

import { BinanceWeb3Error, MARKET_CLOSED_CODES, web3Request } from "./binance-web3";
import type { Balances, QuoteSummary } from "./types";

// Quotes and wallet balances on BNB Chain. Shapes checked against real calls (Oct 2026).

export const CHAIN_ID = "56";
export const USDT = "0x55d398326f99059ff775485246999027b3197955"; // BSC USDT, 18 decimals
const NATIVE_BNB = ""; // the balance API also accepts 0xeeee…eeee; the zero address is silently ignored
const QUOTE_TTL_MS = 30_000; // quotes expire after 30 seconds
const SPREAD_SAMPLE_USD = 100; // spread is measured on a $100 round trip

type RawQuote = {
  quoteId: string;
  executionMode: string;
  toTokenAmount: string;
  tradeFee: string | null;
  fromToken: { tokenUnitPrice: string };
  toToken: { decimal: string; tokenUnitPrice: string };
  dexRouterList?: { dexProtocol: { dexName: string } }[];
};

type RawBalances = { tokenAssets: { tokenContractAddress: string; balance: string; tokenPrice: string }[] }[];

export const toUnits = (amount: number, decimals: number) =>
  BigInt(Math.round(amount * 1e6)) * BigInt(10) ** BigInt(decimals - 6);
const fromUnits = (raw: string, decimals: number) => Number(raw) / 10 ** decimals;

export function isMarketClosed(err: unknown) {
  return err instanceof BinanceWeb3Error && MARKET_CLOSED_CODES.includes(err.code);
}

// `ttlMs` 0 means always fetch fresh (live quotes for the Buy panel).
async function quote(amount: bigint, from: string, to: string, wallet?: string, ttlMs?: number) {
  const [q] = await web3Request<RawQuote[]>("GET", "/api/v1/dex/aggregator/quote", {
    query: {
      binanceChainId: CHAIN_ID,
      amount: amount.toString(),
      fromTokenAddress: from,
      toTokenAddress: to,
      userWalletAddress: wallet,
    },
    ttlMs,
  });
  if (!q || !(Number(q.toTokenAmount) > 0)) throw new Error("The quote returned no tokens.");
  return q;
}

export async function getBuyQuote(token: string, usdtIn: number, wallet: string): Promise<QuoteSummary> {
  const q = await quote(toUnits(usdtIn, 18), USDT, token, wallet, 0);
  const tokensOut = fromUnits(q.toTokenAmount, Number(q.toToken.decimal));
  const pricePerToken = usdtIn / tokensOut;
  const marketPrice = Number(q.toToken.tokenUnitPrice);
  const usdtPrice = Number(q.fromToken.tokenUnitPrice) || 1;
  // The API's priceImpactPercent is ambiguous (percent vs fraction), so impact is
  // computed from the API's own unit prices instead: what you pay vs the market price.
  const priceImpactPct = marketPrice > 0 ? ((pricePerToken * usdtPrice) / marketPrice - 1) * 100 : 0;
  const fetchedAt = Date.now();
  return {
    quoteId: q.quoteId,
    executionMode: q.executionMode,
    route: [...new Set((q.dexRouterList ?? []).map((r) => r.dexProtocol.dexName))],
    usdtIn,
    tokensOut,
    pricePerToken,
    marketPrice,
    priceImpactPct,
    tradeFeeUsd: q.tradeFee == null ? null : Number(q.tradeFee),
    fetchedAt,
    expiresAt: fetchedAt + QUOTE_TTL_MS,
  };
}

// Buys $100 of the token with USDT, then quotes selling that amount back.
// ask = USD paid per token, bid = USD received per token. Ondo tokens only
// quote when a wallet address is given.
export async function sampleSpread(
  token: string,
  wallet?: string,
): Promise<{ bid: number | null; ask: number | null; warning?: string }> {
  try {
    const buy = await quote(toUnits(SPREAD_SAMPLE_USD, 18), USDT, token, wallet);
    const tokensOut = fromUnits(buy.toTokenAmount, Number(buy.toToken.decimal));
    const sell = await quote(BigInt(buy.toTokenAmount), token, USDT, wallet);
    const usdBack = fromUnits(sell.toTokenAmount, 18);
    return { ask: SPREAD_SAMPLE_USD / tokensOut, bid: usdBack / tokensOut };
  } catch (err) {
    if (isMarketClosed(err))
      return { bid: null, ask: null, warning: `Spread unavailable outside market hours: ${(err as Error).message}` };
    if (err instanceof BinanceWeb3Error && /userWalletAddress/i.test(err.apiMessage))
      return {
        bid: null,
        ask: null,
        warning: "Spread unavailable: this token is sold by a market maker (RFQ) that only quotes a connected wallet.",
      };
    return { bid: null, ask: null, warning: `Spread unavailable: ${err instanceof Error ? err.message : "unknown error"}` };
  }
}

// USDT and BNB balances. Tokens with a zero balance are left out of the
// response entirely, so a missing entry means 0.
export async function getBalances(address: string): Promise<Balances> {
  const data = await web3Request<RawBalances>("POST", "/api/v1/dex/balance/token-balances-by-address", {
    body: {
      address,
      tokenContractAddresses: [
        { binanceChainId: CHAIN_ID, tokenContractAddress: NATIVE_BNB },
        { binanceChainId: CHAIN_ID, tokenContractAddress: USDT },
      ],
    },
    ttlMs: 10_000,
  });
  const assets = data.flatMap((d) => d.tokenAssets);
  const usdt = assets.find((a) => a.tokenContractAddress.toLowerCase() === USDT);
  const bnb = assets.find((a) => /^0xe{40}$/i.test(a.tokenContractAddress) || a.tokenContractAddress === "");
  return {
    usdt: usdt ? Number(usdt.balance) : 0,
    bnb: bnb ? Number(bnb.balance) : 0,
    bnbPriceUsd: bnb ? Number(bnb.tokenPrice) : null,
  };
}
