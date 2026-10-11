// "server-only" makes the build fail if this file is ever imported into
// browser code, so the API secret can never leak to users.
import "server-only";

import { web3Request } from "./binance-web3";
import { CHAIN_ID } from "./trade";
import { describeToken, listedAddresses } from "./tokens";
import type { Holding, Portfolio } from "./types";

// A wallet's tokenized-stock holdings, read-only. Shapes checked against real
// test calls (Oct 2026).

const PAGE_SIZE = 50; // the API caps pages at 50, even if asked for more
const MAX_PAGES = 10;
// About 45 bStock tokens are missing from /rwa/tokens, so allow for all of them.
const MAX_UNLISTED_CHECKS = 50;
// P/L takes one call per holding (paced at 5/second), so only the largest are checked.
const MAX_PNL_CHECKS = 20;
// latest-pnl's balance must match the real balance this closely for its
// average buy price to be the cost of everything held.
const BALANCE_TOLERANCE = 0.005;

type Asset = { tokenContractAddress: string; symbol: string; balance: string; tokenPrice: string; isRiskToken?: boolean };

// latest-pnl: realized P/L and trade history for one token. Its
// tokenBalanceAmount is "bought minus sold", not the wallet balance, so tokens
// received by transfer have no known cost. There is no unrealized P/L field.
type LatestPnl = {
  isPnlSupported: boolean;
  tokenBalanceAmount: string | null;
  buyAvgPrice: string | null;
};

// Every token the wallet holds on BNB Chain. Note the parameter is `chains`,
// unlike `binanceChainId` elsewhere in the API.
async function allBalances(address: string) {
  const assets: Asset[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const data = await web3Request<{ tokenAssets: Asset[] }[]>("GET", "/api/v1/dex/balance/all-token-balances-by-address", {
      query: { address, chains: CHAIN_ID, page, pageSize: PAGE_SIZE },
    });
    const batch = data.flatMap((d) => d.tokenAssets);
    assets.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return assets;
}

// The holding without P/L yet: which stock, how much, and what it's worth.
async function holdingFor(asset: Asset): Promise<Holding | null> {
  const amount = Number(asset.balance);
  if (!(amount > 0)) return null;
  const price = Number(asset.tokenPrice) || undefined;
  const token = await describeToken(asset.tokenContractAddress, asset.symbol, price);
  if (!token) return null;
  return { token, amount, valueUsd: amount * token.tokenPrice, pnl: null };
}

// P/L of what's held now, from the API's average on-chain buy price. Only
// trusted when its trade history covers the whole balance.
async function withPnl(wallet: string, h: Holding): Promise<Holding> {
  const { token, amount, valueUsd } = h;
  const pnl = await web3Request<LatestPnl>("GET", "/api/v1/dex/market/portfolio/token/latest-pnl", {
    query: { binanceChainId: CHAIN_ID, walletAddress: wallet, tokenContractAddress: token.contractAddress ?? "" },
  }).catch(() => undefined);
  const traded = Number(pnl?.tokenBalanceAmount);
  const avgBuy = Number(pnl?.buyAvgPrice);
  const covered = Math.abs(traded - amount) <= amount * BALANCE_TOLERANCE;

  if (!pnl?.isPnlSupported) return { token, amount, valueUsd, pnl: null, pnlNote: "P/L unavailable" };
  if (!(avgBuy > 0)) {
    return { token, amount, valueUsd, pnl: null, pnlNote: "P/L unavailable: no on-chain purchases found" };
  }
  if (!covered) {
    return {
      token,
      amount,
      valueUsd,
      pnl: null,
      pnlNote: "P/L unavailable: some of these tokens weren't bought on-chain, so their cost is unknown",
    };
  }
  const costUsd = avgBuy * amount;
  const pnlUsd = valueUsd - costUsd;
  return { token, amount, valueUsd, pnl: { costUsd, pnlUsd, pnlPct: (pnlUsd / costUsd) * 100 } };
}

export async function getHoldings(wallet: string): Promise<Portfolio> {
  const [assets, listed] = await Promise.all([allBalances(wallet), listedAddresses()]);
  // Listed tokenized stocks, plus unlisted tokens named like one (bStock "…B",
  // Ondo "…on") that the API doesn't flag as risky, checked against their
  // issuer profile.
  const unlisted = assets.filter(
    (a) => !listed.has(a.tokenContractAddress.toLowerCase()) && !a.isRiskToken && /(?:on|B)$/.test(a.symbol),
  );
  const candidates = [
    ...assets.filter((a) => listed.has(a.tokenContractAddress.toLowerCase())),
    ...unlisted.slice(0, MAX_UNLISTED_CHECKS),
  ];
  const found = (await Promise.all(candidates.map(holdingFor)))
    .filter((h): h is Holding => h !== null)
    .sort((a, b) => b.valueUsd - a.valueUsd);
  const holdings = await Promise.all(
    found.map((h, i) =>
      i < MAX_PNL_CHECKS
        ? withPnl(wallet, h)
        : { ...h, pnlNote: `P/L not checked: only the ${MAX_PNL_CHECKS} largest holdings are checked` },
    ),
  );

  const priced = holdings.filter((h) => h.pnl);
  const costUsd = priced.reduce((s, h) => s + h.pnl!.costUsd, 0);
  const pnlUsd = priced.reduce((s, h) => s + h.pnl!.pnlUsd, 0);
  return {
    address: wallet,
    holdings,
    totalValueUsd: holdings.reduce((s, h) => s + h.valueUsd, 0),
    totalPnl: priced.length
      ? { costUsd, pnlUsd, pnlPct: costUsd > 0 ? (pnlUsd / costUsd) * 100 : 0, holdingsCovered: priced.length }
      : null,
  };
}
