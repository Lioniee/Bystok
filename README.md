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

> Right now the app uses **sample data** and the Buy button is a **demo** (no transaction is sent).

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
  api/tokens/route.ts   GET /api/tokens: server-only API route
components/
  Scanner.tsx           Fetches /api/tokens, holds the selected token
  TokenPicker.tsx       Search + list of tokens
  TokenReport.tsx       Verdict, stock, provider, checks, risks
  BuyPanel.tsx          Amount, estimate, "I've read the risks", buy
  LevelBadge.tsx        Good / Caution / Risky pill
lib/
  types.ts              The TokenizedStock data shape
  sample-data.ts        Made-up tokens used until the real API is wired in
  analysis.ts           The scanner logic: thresholds -> checks -> verdict + risks
  tokens.ts             getTokens(): the ONE place data is loaded (server-only)
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
lib/tokens.ts                ← reads BINANCE_WEB3_API_KEY (server only)
   │  today: returns sample-data.ts
   ▼  later: calls the Binance Web3 API
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

## Connecting the Binance Web3 API (next step)

1. Copy `.env.example` to `.env.local` and paste your key:
   ```
   BINANCE_WEB3_API_KEY=your_key_here
   ```
   `.env.local` is git-ignored. Don't prefix the variable with `NEXT_PUBLIC_`, because that would expose it to the browser.
2. In `lib/tokens.ts`, replace the `TODO` with a `fetch` to the Binance Web3 API, and map each result into the `TokenizedStock` shape from `lib/types.ts`. Return `source: "live"`.
3. Restart `npm run dev` (env files are only read at startup).

No UI changes are needed. Everything downstream already works from `TokenizedStock`.
When deploying (e.g. Vercel), add the same variable in the host's environment settings.

---

_Bystok is an educational tool, not financial advice._

## Market hours

`lib/market-hours.ts` works out whether the US market is open from the **real current time**:
9:30am–4:00pm New York time, Monday–Friday (NASDAQ shares NYSE's hours).
It uses the `America/New_York` time zone, so daylight-saving changes are handled automatically,
and the scanner refreshes the status and countdown every second.

Not handled yet: **exchange holidays** (e.g. Thanksgiving, New Year's Day) and **early closes** (1pm).
On those days the app will say "Open" when the exchange is actually closed.
