# Bystok

**Know it, then buy it.**

Bystok is a tokenized-stock scanner for BNB Chain, built for the BNB Chain hackathon.
Pick a tokenized stock (for example `TSLAx`) and see, on one screen:

- the **underlying stock** and its real price
- the **token provider** and how the token is backed
- **liquidity**, **spread** and **price deviation** from the real stock
- whether the US stock **market is open** right now, with a live countdown to the next open or close
- the **key risks**, in plain English

Then buy from the same screen.

> Token data is **live** from the Binance Web3 API when a key is configured, and falls back to clearly labelled **sample data** otherwise. Connect a browser wallet to see your balances and a live quote. The swap itself isn't built yet, so **no transaction is ever sent**.

---

## Run it locally

You need **Node.js 20 or newer** ([nodejs.org](https://nodejs.org)). Check with `node -v`.

```bash
# 1. Install dependencies (first time only)
npm install

# 2. Start the dev server
npm run dev
```

Open **http://localhost:3000**. Saving any file reloads the page automatically.

Other commands:

| Command             | What it does                                        |
| ------------------- | --------------------------------------------------- |
| `npm run dev`       | Development server with live reload                 |
| `npm run build`     | Production build (also catches type errors)         |
| `npm start`         | Run the production build (after `npm run build`)    |
| `npm run typecheck` | Check TypeScript types without building             |

---

## How the project is organised

```
app/
  layout.tsx            Page shell: <html>, title, mobile viewport
  page.tsx              Home page: header, scanner, footer
  globals.css           Tailwind + color tokens (light & dark mode)
  api/tokens/route.ts   GET /api/tokens: scanner data (server only)
  api/balances/route.ts GET /api/balances?address=: USDT + BNB balances
  api/quote/route.ts    GET /api/quote?token=&amount=&wallet=: live buy quote
  api/spread/route.ts   GET /api/spread?token=&wallet=: bid/ask quoted for a wallet
components/
  Scanner.tsx           Fetches /api/tokens, holds the selected token
  TokenPicker.tsx       Markets / Watchlist tabs, search, token cards (24h change, + to watch)
  useWatchlist.ts       Watchlist saved in this browser (localStorage)
  useAutoScroll.ts      Self-scrolling, looping token strip (all screen sizes)
  TokenReport.tsx       Verdict, stock, provider, checks, risks
  BuyPanel.tsx          Amount, balances, live quote + countdown, guards
  WalletButton.tsx      Connect / switch to BNB Chain / disconnect
  Providers.tsx         wagmi + React Query context
  buy-hooks.ts          Client hooks: wallet, balances, live quote, wallet spread
  LevelBadge.tsx        Good / Caution / Risky pill
lib/
  types.ts              The TokenizedStock data shape
  sample-data.ts        Made-up tokens used until the real API is wired in
  analysis.ts           The scanner logic: thresholds -> checks -> verdict + risks
  tokens.ts             getTokens(): the ONE place scanner data is loaded (server-only)
  trade.ts              Quotes, spread and wallet balances (server-only)
  binance-web3.ts       Signed API client: HMAC signing, cache, rate limiting (server-only)
  wagmi.ts              Wallet config: BNB Chain, injected wallets
  format.ts             $ and % formatting
  market-hours.ts       Live NYSE open/closed + countdown (New York time, DST-aware)
```

### How data flows

```
Browser (Scanner.tsx)
   │  fetch("/api/tokens")
   ▼
app/api/tokens/route.ts      ← runs on the server
   │  getTokens()
   ▼
lib/tokens.ts                ← picks tokens, maps API data into TokenizedStock
   │                              falls back to sample-data.ts if the API fails
   ▼
lib/binance-web3.ts          ← signs requests (server only), 30s cache, rate limiting
   │
   ▼
https://web3.binance.com/build
```

The browser never sees the API key. It only talks to our own `/api/tokens` route.
`lib/tokens.ts` imports `server-only`, so the build fails if someone accidentally imports it into browser code.

### How the checks are graded

All thresholds are in `lib/analysis.ts` (`THRESHOLDS`):

| Check           | Good          | Caution        | Risky        |
| --------------- | ------------- | -------------- | ------------ |
| Liquidity       | ≥ $1M         | ≥ $250K        | below $250K  |
| Spread          | ≤ 0.3%        | ≤ 1%           | above 1%     |
| Price deviation | within ±0.5%  | within ±1.5%   | beyond ±1.5% |
| Market status   | Open          | Closed         | n/a          |

The overall verdict is **High risk** if any check is Risky, **Proceed with care** if any is Caution, otherwise **Looks healthy**.

---

## Binance Web3 API

1. Copy `.env.example` to `.env.local` and paste your key and secret:
   ```
   BINANCE_WEB3_API_KEY=your_key_here
   BINANCE_WEB3_API_SECRET=your_secret_here
   ```
   `.env.local` is git-ignored. Don't prefix the variables with `NEXT_PUBLIC_`, because that would expose them to the browser.
2. Restart `npm run dev` (env files are only read at startup).

When deploying (e.g. Vercel), add the same variables in the host's environment settings.
The server clock must be accurate: requests with a timestamp even 30 seconds off are rejected (error 40103).

### Where each number comes from (BNB Chain only)

| Field | Endpoint | Notes |
| --- | --- | --- |
| Token list, status | `GET /api/v1/dex/market/rwa/tokens` | Default view shows NVDA, TSLA, AAPL, SPY, MSFT, COIN (NVDAB selected first) |
| Provider | `GET /rwa/platforms` + `/rwa/underlying-profile` | Attestation report link when the issuer publishes one |
| Search | `GET /rwa/search` | Used when a search has no local match |
| Token vs stock price | `GET /rwa/price` | `tokenPrice` vs `referencePrice` |
| Market cap | `GET /rwa/underlying-market` | |
| Liquidity | `GET /market/token/top-liquidity` | Sum of pools that report `liquidityUsd`. Ondo tokens trade only via RFQ market makers, which report none, so liquidity shows **Unavailable** |
| Volume, holders, 24h change | `POST /market/price-info` | Volume is `buyVolume24H + sellVolume24H` (on-chain). `volume24H` is the real stock's volume, so it's not used |
| Spread | `GET /aggregator/quote` | Buy $100 with USDT, then quote selling it back. Ondo needs a wallet to quote, so spread shows **Unavailable** |

Responses are cached on the server for 30 seconds, and calls to the same endpoint are spaced 220ms apart (the limit is 5/second).

**Token picker.** Cards show the 24h price change from `price-info` (`priceChange24H` is already a percentage). Tap **+** to add a stock to the **Watchlist** tab; it's saved in this browser only. The tokens sit in a full-width strip under the header, like a market ticker, on every screen size. It scrolls by itself in a loop, pausing on hover, touch, keyboard focus, wheel or swipe and resuming 3 seconds later; it stays still if the device asks for reduced motion. The report and Buy panel use the full width below it.

**Freshness.** The page itself is a static shell with no prices in it; the browser loads data from `/api/tokens`, which runs on every request (never at build time) and is sent with `Cache-Control: no-store`. The scanner refetches every 30 seconds while the tab is visible and again when you return to the tab. The "updated" time is shown in the viewer's own time zone, and turns into a **Delayed** warning if data is over 90 seconds old or a refresh fails.

### Wallet and buy flow (no transactions yet)

- **Connect:** injected browser wallets only (Binance Web3 Wallet extension, MetaMask), via wagmi + viem on BNB Chain (chain 56). Wallets on another network are asked to switch. Bystok never sees a private key.
- **Balances:** `POST /api/v1/dex/balance/token-balances-by-address` with `{ address, tokenContractAddresses: [{ binanceChainId, tokenContractAddress }] }`. Native BNB is `""`; zero balances are left out of the response.
- **Live quote:** `GET /aggregator/quote` with `userWalletAddress`, refreshed when its 30 seconds run out. Price impact is computed from the quote's own unit prices.
- **Ondo spread:** Ondo tokens only quote for a wallet, so once one is connected the selected token's spread is quoted for that wallet.
- **Guards:** "Not enough USDT" and "You need a little BNB for network fees" (below 0.002 BNB). The button says **Swap coming next** and stays disabled.

Requests send `X-OC-RECV-WINDOW: 60000`. Without it, a timestamp only ~3 seconds old is rejected (40103).

---

_Bystok is an educational tool, not financial advice._

## Market hours

`lib/market-hours.ts` works out whether the US market is open from the **real current time**:
9:30am–4:00pm New York time, Monday–Friday (NASDAQ shares NYSE's hours).
It uses the `America/New_York` time zone, so daylight-saving changes are handled automatically,
and the scanner refreshes the status and countdown every second.

Not handled yet: **exchange holidays** (e.g. Thanksgiving, New Year's Day) and **early closes** (1pm).
On those days the app will say "Open" when the exchange is actually closed.
