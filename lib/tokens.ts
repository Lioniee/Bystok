// "server-only" makes the build fail if this file is ever imported into
// browser code, so the API key can never leak to users.
import "server-only";

import { BinanceWeb3Error, hasCredentials, web3Request } from "./binance-web3";
import { COMMON_RISKS, sampleTokens } from "./sample-data";
import type { TokenizedStock, TokensResponse } from "./types";

// Single place where token data comes from. The UI and the /api/tokens route
// only ever call getTokens(). Response shapes below were checked against real
// test calls (Oct 2026), not just the docs.

const CHAIN_ID = "56"; // BNB Chain
const USDT = "0x55d398326f99059ff775485246999027b3197955"; // BSC USDT, 18 decimals
const SAMPLE_QUOTE_USD = 100; // spread is measured on a $100 round trip
const HOUR = 3_600_000;

// Underlyings shown when nobody has searched yet.
const DEFAULT_TICKERS = ["TSLA", "AAPL", "SPY", "MSFT", "NVDA", "COIN"];

const PROVIDER_NAMES: Record<string, string> = {
  ondo: "Ondo Global Markets",
  bstock: "bStocks",
};

// --- Raw API shapes (only the fields we use) ---------------------------------

type StatusInfo = {
  openState: boolean;
  marketStatus: string | null; // "offhours" | "closed" | null
  reasonCode: string | null; // "TRADING" | "MARKET_CLOSED"
  reasonMsg: string | null; // e.g. "Weekend or Holiday"
  nextOpenTime: number | null;
};

type RwaToken = {
  binanceChainId: string;
  tokenContractAddress: string;
  platformId: string;
  tokenSymbol: string;
  decimals: string;
  underlyingTicker: string;
  underlyingName: string | null;
  tokenToShareRatio: string;
  statusInfo: StatusInfo;
  tokenPrice: string;
  referencePrice: string;
};

type RwaPlatform = { platformId: string; website: string };
type RwaPrice = { tokenContractAddress: string; tokenPrice: string; referencePrice: string };
type RwaSearchResult = { assets: { binanceChainId: string; tokenContractAddress: string }[] };

type UnderlyingProfile = {
  underlyingFullName: string | null;
  protections?: { dailyAttestationReport?: { supported: boolean; url: string | null } };
  companyInfo?: { website: string | null };
};

type UnderlyingMarket = {
  marketData: { referencePrice: string; high52W: string; low52W: string; marketCap: string };
};

// volume24H here is the real stock's volume; buy + sell volume is the on-chain figure.
type PriceInfo = {
  tokenContractAddress: string;
  buyVolume24H: string | null;
  sellVolume24H: string | null;
  holders: number | null;
};

type Pool = { liquidityUsd: string | null };
type Quote = { toTokenAmount: string; toToken: { decimal: string } };

// --- Helpers -----------------------------------------------------------------

const num = (s: string | null | undefined) => (s == null || s === "" ? undefined : Number(s));
const toUnits = (amount: number, decimals: number) => BigInt(Math.round(amount * 1e6)) * BigInt(10) ** BigInt(decimals - 6);
const fromUnits = (raw: string, decimals: number) => Number(raw) / 10 ** decimals;

function chunk<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function errorText(err: unknown) {
  return err instanceof Error ? err.message : "unknown error";
}

const nyTime = (ms: number) =>
  new Date(ms).toLocaleString("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }) + " ET";

// --- Per-token lookups (each one is cached by web3Request) --------------------

function quote(amount: bigint, from: string, to: string) {
  return web3Request<Quote[]>("GET", "/api/v1/dex/aggregator/quote", {
    query: { binanceChainId: CHAIN_ID, amount: amount.toString(), fromTokenAddress: from, toTokenAddress: to },
  });
}

// Buys $100 of the token with USDT, then quotes selling that amount back.
// ask = USD paid per token, bid = USD received per token.
async function sampleSpread(t: RwaToken): Promise<{ bid: number | null; ask: number | null; warning?: string }> {
  try {
    const [buy] = await quote(toUnits(SAMPLE_QUOTE_USD, 18), USDT, t.tokenContractAddress);
    const tokenDecimals = Number(buy.toToken.decimal);
    const tokensOut = fromUnits(buy.toTokenAmount, tokenDecimals);
    if (!(tokensOut > 0)) throw new Error("quote returned no tokens");
    const [sell] = await quote(BigInt(buy.toTokenAmount), t.tokenContractAddress, USDT);
    const usdBack = fromUnits(sell.toTokenAmount, Number(sell.toToken.decimal));
    return { ask: SAMPLE_QUOTE_USD / tokensOut, bid: usdBack / tokensOut };
  } catch (err) {
    if (err instanceof BinanceWeb3Error) {
      if (err.code === "40367" || err.code === "40369")
        return { bid: null, ask: null, warning: `Spread unavailable outside market hours (${err.message})` };
      if (/userWalletAddress/i.test(err.apiMessage))
        return {
          bid: null,
          ask: null,
          warning: "Spread unavailable: this token is sold by a market maker (RFQ) that only quotes a connected wallet.",
        };
    }
    return { bid: null, ask: null, warning: `Spread unavailable: ${errorText(err)}` };
  }
}

async function enrich(
  t: RwaToken,
  ctx: { prices: Map<string, RwaPrice>; info: Map<string, PriceInfo>; platforms: Map<string, RwaPlatform> },
): Promise<TokenizedStock> {
  const addr = t.tokenContractAddress;
  const query = { binanceChainId: CHAIN_ID, tokenContractAddress: addr };
  const warnings: string[] = [];

  const [profile, market, pools, spread] = await Promise.all([
    web3Request<UnderlyingProfile>("GET", "/api/v1/dex/market/rwa/underlying-profile", { query, ttlMs: HOUR }).catch(
      () => undefined,
    ),
    web3Request<UnderlyingMarket>("GET", "/api/v1/dex/market/rwa/underlying-market", { query }).catch(() => undefined),
    web3Request<Pool[]>("GET", "/api/v1/dex/market/token/top-liquidity", { query }).catch((err) => {
      warnings.push(`Liquidity unavailable: ${errorText(err)}`);
      return undefined;
    }),
    sampleSpread(t),
  ]);
  if (spread.warning) warnings.push(spread.warning);

  // Pools run by RFQ market makers (Bebop, Native, …) report liquidityUsd: null,
  // so only AMM pools (PancakeSwap, Uniswap) add to the total.
  const reported = (pools ?? []).map((p) => num(p.liquidityUsd)).filter((n): n is number => n !== undefined);
  const liquidityUsd = reported.length ? reported.reduce((a, b) => a + b, 0) : null;
  if (pools && liquidityUsd === null)
    warnings.push("Liquidity unavailable: this token trades through market makers that don't publish pool sizes.");

  const s = t.statusInfo;
  if (!s.openState)
    warnings.push(
      `The issuer has paused trading (${s.reasonMsg ?? s.reasonCode ?? "market closed"})` +
        (s.nextOpenTime ? ` until ${nyTime(s.nextOpenTime)}.` : "."),
    );
  else if (s.marketStatus === "offhours")
    warnings.push('The issuer marks trading as "off-hours". Prices can move more while the stock exchange is shut.');

  const price = ctx.prices.get(addr);
  const info = ctx.info.get(addr);
  const md = market?.marketData;
  const ratio = num(t.tokenToShareRatio) ?? 1;
  const attestation = profile?.protections?.dailyAttestationReport;
  const providerName = PROVIDER_NAMES[t.platformId] ?? t.platformId;

  return {
    id: t.tokenSymbol.toLowerCase(),
    symbol: t.tokenSymbol,
    chain: "BNB Chain",
    contractAddress: addr,
    underlying: {
      ticker: t.underlyingTicker,
      name: t.underlyingName ?? profile?.underlyingFullName ?? t.underlyingTicker,
      exchange: "US-listed", // the API does not say which exchange
      price: num(price?.referencePrice) ?? num(md?.referencePrice) ?? Number(t.referencePrice),
      marketCapUsd: num(md?.marketCap),
      high52w: num(md?.high52W),
      low52w: num(md?.low52W),
    },
    provider: {
      name: providerName,
      backing:
        `Each token tracks ${ratio === 1 ? "1 share" : `${ratio} shares`} of ${t.underlyingTicker}` +
        (attestation?.supported ? "; the issuer publishes daily attestation reports." : "."),
      website: ctx.platforms.get(t.platformId)?.website,
      attestationUrl: attestation?.supported ? (attestation.url ?? undefined) : undefined,
    },
    tokenPrice: num(price?.tokenPrice) ?? Number(t.tokenPrice),
    bid: spread.bid,
    ask: spread.ask,
    liquidityUsd,
    volume24hUsd: (num(info?.buyVolume24H) ?? 0) + (num(info?.sellVolume24H) ?? 0),
    holders: info?.holders ?? undefined,
    risks: COMMON_RISKS,
    warnings,
  };
}

// --- Entry point -------------------------------------------------------------

async function pickTokens(all: RwaToken[], search?: string) {
  if (!search) {
    // bStock before Ondo for each ticker: bStock tokens have AMM pools and quote
    // without a wallet, so the first token shown (TSLAB) has real liquidity and spread.
    const platformRank = (t: RwaToken) => (t.platformId === "bstock" ? 0 : 1);
    return all
      .filter((t) => DEFAULT_TICKERS.includes(t.underlyingTicker))
      .sort(
        (a, b) =>
          DEFAULT_TICKERS.indexOf(a.underlyingTicker) - DEFAULT_TICKERS.indexOf(b.underlyingTicker) ||
          platformRank(a) - platformRank(b),
      );
  }
  // No matches comes back as error 40382 rather than an empty list.
  const results = await web3Request<RwaSearchResult[]>("GET", "/api/v1/dex/market/rwa/search", {
    query: { keyword: search },
  }).catch((err) => {
    if (err instanceof BinanceWeb3Error && err.code === "40382") return [];
    throw err;
  });
  const wanted = new Set(
    results.flatMap((r) => r.assets.filter((a) => a.binanceChainId === CHAIN_ID).map((a) => a.tokenContractAddress)),
  );
  return all.filter((t) => wanted.has(t.tokenContractAddress)).slice(0, 12);
}

async function getLiveTokens(search?: string): Promise<TokenizedStock[]> {
  const [all, platformList] = await Promise.all([
    web3Request<RwaToken[]>("GET", "/api/v1/dex/market/rwa/tokens"),
    web3Request<RwaPlatform[]>("GET", "/api/v1/dex/market/rwa/platforms", { ttlMs: HOUR }).catch(() => []),
  ]);
  const picked = await pickTokens(
    all.filter((t) => t.binanceChainId === CHAIN_ID),
    search,
  );
  if (picked.length === 0) return [];

  const addresses = picked.map((t) => t.tokenContractAddress);
  const [prices, info] = await Promise.all([
    Promise.all(
      chunk(addresses, 20).map((group) =>
        web3Request<RwaPrice[]>("GET", "/api/v1/dex/market/rwa/price", {
          query: { binanceChainId: CHAIN_ID, tokenContractAddresses: group.join(",") },
        }),
      ),
    ).catch(() => [] as RwaPrice[][]),
    Promise.all(
      chunk(addresses, 20).map((group) =>
        web3Request<PriceInfo[]>("POST", "/api/v1/dex/market/price-info", {
          body: group.map((a) => ({ binanceChainId: CHAIN_ID, tokenContractAddress: a })),
        }),
      ),
    ).catch(() => [] as PriceInfo[][]),
  ]);

  const ctx = {
    prices: new Map(prices.flat().map((p) => [p.tokenContractAddress, p])),
    info: new Map(info.flat().map((p) => [p.tokenContractAddress, p])),
    platforms: new Map(platformList.map((p) => [p.platformId, p])),
  };
  return Promise.all(picked.map((t) => enrich(t, ctx)));
}

function sample(notice: string, search?: string): TokensResponse {
  const q = search?.toLowerCase();
  const tokens = q
    ? sampleTokens.filter((t) =>
        [t.symbol, t.underlying.ticker, t.underlying.name].some((s) => s.toLowerCase().includes(q)),
      )
    : sampleTokens;
  return { tokens, source: "sample", updatedAt: new Date().toISOString(), notice };
}

export async function getTokens(search?: string): Promise<TokensResponse> {
  if (!hasCredentials()) return sample("No Binance Web3 API key is configured.", search);

  try {
    const tokens = await getLiveTokens(search?.trim() || undefined);
    return { tokens, source: "live", updatedAt: new Date().toISOString() };
  } catch (err) {
    console.error("Binance Web3 API failed, using sample data:", errorText(err));
    return sample(`Live data is unavailable right now (${errorText(err)}).`, search);
  }
}
