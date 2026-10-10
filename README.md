<p align="center">
  <img src="public/logo.png" alt="Bystok" width="120" height="120">
</p>

# Bystok

**Know it, then buy it.** · Live: **[bystok.vercel.app](https://bystok.vercel.app)** · Docs: **[bystok.vercel.app/docs](https://bystok.vercel.app/docs)**

Bystok is a tokenized-stock scanner for BNB Chain. Tokenized stocks (like NVDAB or TSLAon) track real shares, but the token can trade thin, at a wide spread, or away from the real share price, especially when the US market is closed. Bystok puts the facts a beginner needs on one screen before they buy: the real stock and its price, who issues the token and how it is backed, liquidity, spread, price deviation, whether the market is open, and the key risks in plain English, ending in a simple verdict. All data comes live from the Binance Web3 API.

## Features

- **Scanner report**: underlying stock, issuer and backing (with attestation report link), liquidity, spread, price deviation (adjusted for shares per token) and market status, graded Good / Caution / Risky, plus an overall verdict and key risks.
- **Market list**: the 30 most traded tokenized stocks by 24h on-chain volume, with price and 24h ▲/▼ change, plus a self-scrolling **Most traded (24h)** ticker.
- **Search all 488 stocks** as you type, by ticker or company name, showing both the bStock and Ondo versions.
- **Watchlist**, saved in the browser.
- **Live US market clock**: open/closed with a countdown, in New York time.
- **Wallet connect** on BNB Chain (Binance Web3 Wallet, MetaMask, WalletConnect, or "Open in MetaMask" on phones), showing USDT/BNB balances and a **live buy quote** that refreshes every 30 seconds, with guards for low balances.
- **Fresh data**: refreshed every 30 seconds, with an "updated" time in your time zone and a **Delayed** warning if refreshes fail.
- Works on phones (single column) and desktop (sidebar | report | Buy panel), in light and dark mode, and respects reduced-motion settings.

## Binance Web3 API endpoints used

All calls go to `https://web3.binance.com/build`, signed on the server with HMAC-SHA256. The API key never reaches the browser.

| Endpoint | Used for |
| --- | --- |
| `GET /api/v1/dex/market/rwa/tokens` | The full list of tokenized stocks on BNB Chain: prices, issuer, trading status |
| `GET /api/v1/dex/market/rwa/platforms` | Issuer details (Ondo, bStocks) |
| `GET /api/v1/dex/market/rwa/search` | Search fallback, for stocks missing from the token list |
| `GET /api/v1/dex/market/rwa/price` | Token price vs the real stock's reference price (price deviation) |
| `GET /api/v1/dex/market/rwa/underlying-profile` | Shares per token and the issuer's attestation report |
| `GET /api/v1/dex/market/rwa/underlying-market` | Market cap and market status of the real stock |
| `POST /api/v1/dex/market/price-info` | 24h on-chain volume, 24h price change and holders (batched, 100 tokens per call) |
| `GET /api/v1/dex/market/token/top-liquidity` | Liquidity: sum of the token's trading pools |
| `GET /api/v1/dex/aggregator/quote` | Spread (a $100 buy and sell-back quote) and the live buy quote |
| `POST /api/v1/dex/balance/token-balances-by-address` | The connected wallet's USDT and BNB balances |

Responses are cached on the server for 30 seconds and paced to stay under the 5 requests/second limit. Heavy details (profile, pools, spread) are fetched only for the stock you select.

## Run it locally

You need **Node.js 20+**.

```bash
npm install
cp .env.example .env.local   # then fill in the values below
npm run dev                  # http://localhost:3000
```

| Variable | Required | What it's for |
| --- | --- | --- |
| `BINANCE_WEB3_API_KEY` | Yes, for live data | Binance Web3 API key (server only) |
| `BINANCE_WEB3_API_SECRET` | Yes, for live data | Binance Web3 API secret (server only) |
| `NEXT_PUBLIC_SITE_URL` | No | Public site address for link previews; on Vercel it's detected automatically |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | No | Shows the WalletConnect option (free ID from dashboard.reown.com) |

Without the API key and secret, the app still runs on labelled sample data. `npm run build` makes a production build (and checks types).

## Known limitations

- **Buying isn't built yet.** Bystok connects a wallet and shows a live quote, but the button reads "Swap coming next" and no transaction is ever sent.
- **Ondo tokens need a connected wallet for quotes.** They're sold by market makers (RFQ), so their spread shows "Unavailable" until a wallet is connected, and their liquidity is always "Unavailable" (RFQ pools don't publish sizes).
- **Sample-data fallback.** If the Binance Web3 API can't be reached, the app shows clearly labelled **sample data** (made-up numbers) and search is limited to those sample tokens.
- `/rwa/tokens` lists 488 tokens and leaves out about half of the bStock tokens; those can only be found by searching.
- The market clock doesn't know exchange holidays or early closes yet.

## What's next

1. **bStock buying** (swap): approve the exact USDT amount, build the swap, simulate it, then have the wallet sign. It will have a per-buy cap, 1% slippage, router address checks and transaction tracking. The plan is written.
2. **Ondo buying** (RFQ): sign the market maker's order in the wallet and track it until filled.
3. US exchange holidays and early closes in the market clock.
4. Price and spread alerts for watchlist stocks.

---

_Bystok is an educational tool, not financial advice._
