// "server-only" makes the build fail if this file is ever imported into
// browser code, so the API key can never leak to users.
import "server-only";

import { BinanceWeb3Error, hasCredentials, web3Request } from "./binance-web3";
import { CHAIN_ID, sampleSpread } from "./trade";
import { COMMON_RISKS, sampleTokens } from "./sample-data";
import type { TokenizedStock, TokenSummary, TokensResponse } from "./types";

// Single place where token data comes from. Response shapes below were checked
// against real test calls (Oct 2026), not just the docs.
//
// Two levels of detail:
// - the list, ticker and search get light summaries (price, 24h change, 24h
//   volume) from batch calls: one /rwa/tokens plus /price-info per 100 tokens;
// - the selected token gets full details (profile, pools, spread quote,
//   attestation) from getTokenDetail(), fetched only when it is clicked.
// Every API response is cached for 30 seconds (see binance-web3.ts).

const HOUR = 3_600_000;
const LIST_SIZE = 30;
const SEARCH_LIMIT = 20;
const PRICE_INFO_BATCH = 100; // the API rejects larger batches ("size must <= 100")

// Always in the list and selected first: NVDAB has deep AMM liquidity, a live
// spread and a live price.
export const DEFAULT_TOKEN_ID = "nvdab";

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
  underlyingTicker: string;
  underlyingName: string | null;
  tokenToShareRatio: string;
  statusInfo: StatusInfo;
  tokenPrice: string;
  referencePrice: string;
};

type RwaPlatform = { platformId: string; website: string };
type RwaPrice = { tokenContractAddress: string; tokenPrice: string; referencePrice: string };
type SearchAsset = { platformId: string; binanceChainId: string; tokenContractAddress: string; tokenSymbol: string };
type RwaSearchResult = { ticker: string; companyName: string; assets: SearchAsset[] };

type UnderlyingProfile = {
  platformId?: string;
  underlyingTicker?: string;
  underlyingFullName: string | null;
  tokenToShareRatio?: string;
  protections?: { dailyAttestationReport?: { supported: boolean; url: string | null } };
};

type UnderlyingMarket = {
  statusInfo?: StatusInfo;
  marketData: { referencePrice: string; high52W: string; low52W: string; marketCap: string };
};

// volume24H here is the real stock's volume; buy + sell volume is the on-chain figure.
type PriceInfo = {
  tokenContractAddress: string;
  price: string | null;
  buyVolume24H: string | null;
  sellVolume24H: string | null;
  holders: number | null;
  priceChange24H: string | null; // already a percentage: "-0.59" means -0.59%
};

type Pool = { liquidityUsd: string | null };

// --- Helpers -----------------------------------------------------------------

const num = (s: string | null | undefined) => (s == null || s === "" ? undefined : Number(s));
const lower = (s: string) => s.toLowerCase();

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

const onChainVolume = (info?: PriceInfo) => (num(info?.buyVolume24H) ?? 0) + (num(info?.sellVolume24H) ?? 0);

// --- Batch data ----------------------------------------------------------------

// All tokenized stocks on BNB Chain that /rwa/tokens lists (488 in Oct 2026).
// Note: it leaves out about half of the bStock tokens (46 of 91), which /rwa/search
// still finds; see searchTokens().
async function catalog() {
  const all = await web3Request<RwaToken[]>("GET", "/api/v1/dex/market/rwa/tokens");
  return all.filter((t) => t.binanceChainId === CHAIN_ID);
}

// Price, 24h change, 24h volume and holders for many tokens, 100 per call.
async function priceInfo(addresses: string[]) {
  const batches = await Promise.all(
    chunk([...new Set(addresses.map(lower))].sort(), PRICE_INFO_BATCH).map((group) =>
      web3Request<PriceInfo[]>("POST", "/api/v1/dex/market/price-info", {
        body: group.map((a) => ({ binanceChainId: CHAIN_ID, tokenContractAddress: a })),
      }),
    ),
  );
  return new Map(batches.flat().map((p) => [lower(p.tokenContractAddress), p]));
}

function summary(
  t: { address: string; symbol: string; platformId: string; ticker: string; name: string; price?: number },
  info?: PriceInfo,
): TokenSummary {
  return {
    id: lower(t.symbol),
    symbol: t.symbol,
    chain: "BNB Chain",
    contractAddress: t.address,
    provider: { name: PROVIDER_NAMES[t.platformId] ?? t.platformId },
    underlying: { ticker: t.ticker, name: t.name },
    tokenPrice: t.price ?? num(info?.price) ?? 0,
    change24hPct: num(info?.priceChange24H),
    volume24hUsd: onChainVolume(info),
  };
}

const fromCatalog = (t: RwaToken) => ({
  address: t.tokenContractAddress,
  symbol: t.tokenSymbol,
  platformId: t.platformId,
  ticker: t.underlyingTicker,
  name: t.underlyingName ?? t.underlyingTicker,
  price: num(t.tokenPrice),
});

// Top tokens by on-chain 24h trading volume. Ranking needs the volume of every
// token, which is 5 batch calls (488 tokens, 100 per call).
async function listTop(): Promise<{ tokens: TokenSummary[]; total: number }> {
  const all = await catalog();
  // The browser asks for the default token's details right after the list. Start
  // those calls now, in parallel; identical in-flight calls are shared (see
  // web3Request), so its detail request finishes about when the list does.
  const preselected = all.find((t) => lower(t.tokenSymbol) === DEFAULT_TOKEN_ID);
  if (preselected) void getTokenDetail(preselected.tokenContractAddress).catch(() => undefined);
  const info = await priceInfo(all.map((t) => t.tokenContractAddress));
  const ranked = all
    .map((t) => ({ t, vol: onChainVolume(info.get(lower(t.tokenContractAddress))) }))
    .sort((a, b) => b.vol - a.vol);
  const top = ranked.slice(0, LIST_SIZE);
  if (!top.some(({ t }) => lower(t.tokenSymbol) === DEFAULT_TOKEN_ID)) {
    const pinned = ranked.find(({ t }) => lower(t.tokenSymbol) === DEFAULT_TOKEN_ID);
    if (pinned) top[top.length - 1] = pinned;
  }
  return {
    tokens: top.map(({ t }) => summary(fromCatalog(t), info.get(lower(t.tokenContractAddress)))),
    total: all.length,
  };
}

// --- Search ----------------------------------------------------------------------

// "TSLAon" -> "tsla", "TSLAB" -> "tsla": the issuer suffix isn't part of the ticker.
function baseSymbol(symbol: string, platformId: string) {
  const s = lower(symbol);
  if (platformId === "ondo" && s.endsWith("on")) return s.slice(0, -2);
  if (platformId === "bstock" && s.endsWith("b")) return s.slice(0, -1);
  return s;
}

const normalise = (s: string) => lower(s).replace(/[^a-z0-9]+/g, " ").trim();

// 0 = no match; higher is better.
function matchScore(t: RwaToken, q: string) {
  const ticker = lower(t.underlyingTicker);
  const base = baseSymbol(t.tokenSymbol, t.platformId);
  const name = normalise(t.underlyingName ?? "");
  const qn = normalise(q);
  const qt = qn.replace(/ /g, "");
  if (!qt) return 0;
  if (ticker === qt || base === qt || lower(t.tokenSymbol) === qt) return 100;
  if (ticker.startsWith(qt) || base.startsWith(qt)) return 60;
  if (qn.length >= 3 && (` ${name} `.includes(` ${qn}`) || name.replace(/ /g, "").includes(qt))) return 40;
  return 0;
}

async function rwaSearch(keyword: string): Promise<RwaSearchResult[]> {
  // No matches comes back as error 40382 rather than an empty list.
  return web3Request<RwaSearchResult[]>("GET", "/api/v1/dex/market/rwa/search", { query: { keyword } }).catch(
    (err) => {
      if (err instanceof BinanceWeb3Error && err.code === "40382") return [];
      throw err;
    },
  );
}

// Matches the whole catalogue by ticker, company name or symbol (with or
// without the "on" / "B" suffix). Falls back to /rwa/search when nothing
// matches, or when a matched stock is missing its bStock or Ondo version in
// the catalogue (e.g. NFLXB isn't listed by /rwa/tokens).
async function searchTokens(query: string): Promise<TokenSummary[]> {
  const all = await catalog();
  const local = all
    .map((t) => ({ t, score: matchScore(t, query) }))
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score || a.t.underlyingTicker.localeCompare(b.t.underlyingTicker))
    .slice(0, SEARCH_LIMIT)
    .map((m) => fromCatalog(m.t));

  const tickers = [...new Set(local.map((t) => t.ticker))];
  const incomplete = tickers.filter(
    (ticker) => new Set(local.filter((t) => t.ticker === ticker).map((t) => t.platformId)).size < 2,
  );
  // The search keyword is fuzzy ("DIS" also returns Himax), so when we only
  // look for a missing version of a stock, keep results for that exact ticker.
  const found =
    local.length === 0
      ? await rwaSearch(query)
      : (await Promise.all(incomplete.slice(0, 3).map(async (ticker) => (await rwaSearch(ticker)).filter((r) => r.ticker === ticker)))).flat();

  const known = new Set(local.map((t) => lower(t.address)));
  const extra = found.flatMap((r) =>
    r.assets
      .filter((a) => a.binanceChainId === CHAIN_ID && !known.has(lower(a.tokenContractAddress)))
      .map((a) => {
        known.add(lower(a.tokenContractAddress));
        return {
          address: a.tokenContractAddress,
          symbol: a.tokenSymbol,
          platformId: a.platformId,
          ticker: r.ticker,
          name: r.companyName,
          price: undefined as number | undefined,
        };
      }),
  );

  // Group both versions of each stock together (best match first), bStock first.
  const order = [...new Set([...local, ...extra].map((t) => t.ticker))];
  const matches = [...local, ...extra]
    .sort(
      (a, b) =>
        order.indexOf(a.ticker) - order.indexOf(b.ticker) ||
        (a.platformId === "bstock" ? 0 : 1) - (b.platformId === "bstock" ? 0 : 1),
    )
    .slice(0, SEARCH_LIMIT);
  if (matches.length === 0) return [];
  const info = await priceInfo(matches.map((m) => m.address));
  return matches.map((m) => summary(m, info.get(lower(m.address))));
}

// --- Details for one token -------------------------------------------------------

// True if the address is a tokenized stock on BNB Chain. Used to validate input
// to the detail, quote and spread routes, so they can't be used as an open proxy.
// Tokens missing from /rwa/tokens are confirmed through their underlying profile.
export async function isRwaToken(address: string) {
  const a = lower(address);
  if ((await catalog()).some((t) => lower(t.tokenContractAddress) === a)) return true;
  const profile = await web3Request<UnderlyingProfile>("GET", "/api/v1/dex/market/rwa/underlying-profile", {
    query: { binanceChainId: CHAIN_ID, tokenContractAddress: address },
    ttlMs: HOUR,
  }).catch(() => undefined);
  return Boolean(profile?.platformId);
}

// Full report data for the selected token: profile, market data, liquidity
// pools and a spread quote. `symbolHint` names tokens that /rwa/tokens leaves
// out (the address is still verified as a real tokenized stock first).
export async function getTokenDetail(address: string, symbolHint?: string): Promise<TokenizedStock | null> {
  const query = { binanceChainId: CHAIN_ID, tokenContractAddress: address };
  const listed = (await catalog()).find((t) => lower(t.tokenContractAddress) === lower(address));
  const warnings: string[] = [];

  const [profile, market, pools, spread, prices, info, platforms] = await Promise.all([
    web3Request<UnderlyingProfile>("GET", "/api/v1/dex/market/rwa/underlying-profile", { query, ttlMs: HOUR }).catch(
      () => undefined,
    ),
    web3Request<UnderlyingMarket>("GET", "/api/v1/dex/market/rwa/underlying-market", { query }).catch(() => undefined),
    web3Request<Pool[]>("GET", "/api/v1/dex/market/token/top-liquidity", { query }).catch((err) => {
      warnings.push(`Liquidity unavailable: ${errorText(err)}`);
      return undefined;
    }),
    sampleSpread(address),
    web3Request<RwaPrice[]>("GET", "/api/v1/dex/market/rwa/price", {
      query: { binanceChainId: CHAIN_ID, tokenContractAddresses: address },
    }).catch(() => [] as RwaPrice[]),
    priceInfo([address]).catch(() => new Map<string, PriceInfo>()),
    web3Request<RwaPlatform[]>("GET", "/api/v1/dex/market/rwa/platforms", { ttlMs: HOUR }).catch(() => []),
  ]);

  const platformId = listed?.platformId ?? profile?.platformId;
  if (!platformId) return null; // not a tokenized stock we know about
  const ticker = listed?.underlyingTicker ?? profile?.underlyingTicker ?? "?";
  const symbol = listed?.tokenSymbol ?? symbolHint ?? ticker;
  const status = listed?.statusInfo ?? market?.statusInfo;

  if (spread.warning) warnings.push(spread.warning);

  // Pools run by RFQ market makers (Bebop, Native, …) report liquidityUsd: null,
  // so only AMM pools (PancakeSwap, Uniswap) add to the total.
  const reported = (pools ?? []).map((p) => num(p.liquidityUsd)).filter((n): n is number => n !== undefined);
  const liquidityUsd = reported.length ? reported.reduce((a, b) => a + b, 0) : null;
  if (pools && liquidityUsd === null)
    warnings.push("Liquidity unavailable: this token trades through market makers that don't publish pool sizes.");

  if (status && !status.openState)
    warnings.push(
      `The issuer has paused trading (${status.reasonMsg ?? status.reasonCode ?? "market closed"})` +
        (status.nextOpenTime ? ` until ${nyTime(status.nextOpenTime)}.` : "."),
    );
  else if (status?.marketStatus === "offhours")
    warnings.push('The issuer marks trading as "off-hours". Prices can move more while the stock exchange is shut.');

  const price = prices[0];
  const pi = info.get(lower(address));
  const md = market?.marketData;
  const ratio = num(listed?.tokenToShareRatio ?? profile?.tokenToShareRatio) ?? 1;
  const attestation = profile?.protections?.dailyAttestationReport;

  return {
    id: lower(symbol),
    symbol,
    chain: "BNB Chain",
    contractAddress: listed?.tokenContractAddress ?? address,
    underlying: {
      ticker,
      name: listed?.underlyingName ?? profile?.underlyingFullName ?? ticker,
      exchange: "US-listed", // the API does not say which exchange
      price: num(price?.referencePrice) ?? num(md?.referencePrice) ?? num(listed?.referencePrice) ?? 0,
      sharesPerToken: ratio,
      marketCapUsd: num(md?.marketCap),
      high52w: num(md?.high52W),
      low52w: num(md?.low52W),
    },
    provider: {
      name: PROVIDER_NAMES[platformId] ?? platformId,
      backing:
        `Each token tracks ${ratio === 1 ? "1 share" : `${ratio.toLocaleString("en-US", { maximumFractionDigits: 4 })} shares`} of ${ticker}` +
        (attestation?.supported ? "; the issuer publishes daily attestation reports." : "."),
      website: platforms.find((p) => p.platformId === platformId)?.website,
      attestationUrl: attestation?.supported ? (attestation.url ?? undefined) : undefined,
    },
    tokenPrice: num(price?.tokenPrice) ?? num(pi?.price) ?? num(listed?.tokenPrice) ?? 0,
    bid: spread.bid,
    ask: spread.ask,
    liquidityUsd,
    volume24hUsd: onChainVolume(pi),
    holders: pi?.holders ?? undefined,
    change24hPct: num(pi?.priceChange24H),
    risks: COMMON_RISKS,
    warnings,
  };
}

// --- Entry points --------------------------------------------------------------------

function sample(notice: string, search?: string): TokensResponse {
  const q = search?.toLowerCase();
  const tokens = q
    ? sampleTokens.filter((t) =>
        [t.symbol, t.underlying.ticker, t.underlying.name].some((s) => s.toLowerCase().includes(q)),
      )
    : sampleTokens;
  return { tokens, total: sampleTokens.length, source: "sample", updatedAt: new Date().toISOString(), notice };
}

// The list (no search) or search results, as light summaries.
export async function getTokens(search?: string): Promise<TokensResponse> {
  if (!hasCredentials()) return sample("No Binance Web3 API key is configured.", search);
  const q = search?.trim();
  try {
    if (q) {
      const tokens = await searchTokens(q);
      return { tokens, source: "live", updatedAt: new Date().toISOString() };
    }
    const { tokens, total } = await listTop();
    return { tokens, total, source: "live", updatedAt: new Date().toISOString() };
  } catch (err) {
    console.error("Binance Web3 API failed, using sample data:", errorText(err));
    return sample(`Live data is unavailable right now (${errorText(err)}).`, search);
  }
}
