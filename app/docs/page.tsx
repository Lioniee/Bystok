import type { Metadata } from "next";
import DocsToc from "@/components/DocsToc";
import { PARTS } from "./sections";

export const metadata: Metadata = {
  title: "Docs · Bystok",
  description: "The story behind Bystok and how its tokenized-stock checks work.",
};

// Everything on this page comes from the codebase or from earlier test runs
// against the Binance Web3 API. No invented numbers.

const number = Object.fromEntries(PARTS.flatMap((p) => p.sections.map((s, i) => [s.id, `${i + 1}`])));
const title = Object.fromEntries(PARTS.flatMap((p) => p.sections.map((s) => [s.id, s.title])));

function Section({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 border-b border-line py-8 last:border-b-0">
      <h3 className="mb-3 text-xl font-bold">
        <span className="mr-2 text-muted tabular-nums">{number[id]}.</span>
        {title[id]}
      </h3>
      <div className="grid gap-3 text-[15px] leading-relaxed">{children}</div>
    </section>
  );
}

function PartHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-4 rounded-xl bg-brand px-4 py-2 text-sm font-bold uppercase tracking-wide text-brand-fg">
      {children}
    </h2>
  );
}

function List({ children }: { children: React.ReactNode }) {
  return <ul className="grid list-disc gap-1.5 pl-5 marker:text-muted">{children}</ul>;
}

function Note({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
      <p className="font-bold text-amber-700 dark:text-amber-400">{label}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-card px-1 py-0.5 text-[0.85em] [overflow-wrap:anywhere]">{children}</code>;
}

const ENDPOINTS: [string, string][] = [
  ["GET /api/v1/dex/market/rwa/tokens", "The list of tokenized stocks on BNB Chain: price, issuer and trading status."],
  ["GET /api/v1/dex/market/rwa/platforms", "Issuer details (Ondo, bStocks)."],
  ["GET /api/v1/dex/market/rwa/search", "Search fallback, for stocks the token list leaves out."],
  ["GET /api/v1/dex/market/rwa/price", "Token price vs the real stock's reference price."],
  ["GET /api/v1/dex/market/rwa/underlying-profile", "Shares per token and the issuer's attestation report."],
  ["GET /api/v1/dex/market/rwa/underlying-market", "Market cap and market status of the real stock."],
  ["POST /api/v1/dex/market/price-info", "24h on-chain volume, 24h change and holders, up to 100 tokens per call."],
  ["GET /api/v1/dex/market/token/top-liquidity", "Liquidity: the token's trading pools."],
  ["GET /api/v1/dex/aggregator/quote", "Spread (a $100 buy and sell-back quote) and the live buy quote."],
  ["POST /api/v1/dex/balance/token-balances-by-address", "The connected wallet's USDT and BNB balances."],
  ["GET /api/v1/dex/balance/all-token-balances-by-address", "Every token the connected wallet holds, filtered to tokenized stocks for MyStoks."],
  ["GET /api/v1/dex/market/portfolio/token/latest-pnl", "Average on-chain buy price per holding, for MyStoks profit/loss."],
];

const CHECKS: { name: string; good: string; caution: string; risky: string; note: string }[] = [
  {
    name: "Liquidity",
    good: "$1M or more",
    caution: "$250K to $1M",
    risky: "below $250K",
    note: "Total value in the token's pools. Unavailable counts as Caution.",
  },
  {
    name: "Spread",
    good: "0.3% or less",
    caution: "up to 1%",
    risky: "above 1%",
    note: "Gap between buy and sell price on a $100 round trip. Unavailable counts as Caution.",
  },
  {
    name: "Price deviation",
    good: "within ±0.5%",
    caution: "within ±1.5%",
    risky: "beyond ±1.5%",
    note: "Token price vs share price × shares per token. An exact match counts as Caution: the price may be pegged.",
  },
  {
    name: "Market status",
    good: "US market open",
    caution: "US market closed",
    risky: "n/a",
    note: "Regular NYSE/NASDAQ session in New York time.",
  },
];

export default function DocsPage() {
  return (
    <>
      <div className="mb-6 max-w-2xl">
        <h1 className="text-3xl font-bold">Bystok docs</h1>
        <p className="mt-2 text-muted">
          Why Bystok exists, what it checks before you buy a tokenized stock on BNB Chain, and how it works.
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-[230px_minmax(0,1fr)] md:items-start">
        <aside className="min-w-0 md:sticky md:top-4">
          <DocsToc parts={PARTS} />
        </aside>

        <article className="min-w-0 max-w-3xl">
          <PartHeading>Part I · The story</PartHeading>

          <Section id="friday-4pm">
            <p>
              At 4pm New York time on Friday, the US stock market closes until Monday morning. Tokenized stocks on
              BNB Chain don’t: they keep trading through the weekend.
            </p>
            <p>
              The reference price they track freezes at Friday’s close. The token can drift away from it, or sit on a
              stale number that looks live. Most apps show a price and a Buy button, and don’t tell you what you’re
              actually buying: how deep the market is, how wide the spread is, or that the real exchange is shut.
            </p>
          </Section>

          <Section id="meet-ada">
            <Note label="Illustrative example">Ada is not a real person. She’s here to show how Bystok is meant to be used.</Note>
            <p>
              It’s Saturday, and Ada wants to buy her first tokenized Nvidia. She opens Bystok and finds two versions:
              NVDAB (bStocks) and NVDAon (Ondo).
            </p>
            <List>
              <li>The market status says Closed, with a countdown to Monday’s open.</li>
              <li>
                NVDAB shows live liquidity and a spread from a real quote. In our test on Saturday 3 October 2026, its
                spread was under 0.1%.
              </li>
              <li>
                NVDAon’s spread shows Unavailable until she connects a wallet. In the same test, with a wallet
                connected, it was 2.03%.
              </li>
              <li>
                If a token’s price exactly matches the frozen reference price, Bystok says it may be pegged rather
                than live.
              </li>
            </List>
            <p>
              The verdict reads <strong>Proceed with care</strong>, with the reasons listed. Ada still decides, but
              now she knows what she’s buying.
            </p>
          </Section>

          <Section id="what-bystok-checks">
            <List>
              <li>
                <strong>Liquidity</strong>: how much money sits in the token’s pools. More means your order moves the
                price less.
              </li>
              <li>
                <strong>Spread</strong>: the gap between the buy and sell price, a hidden cost on every round trip.
              </li>
              <li>
                <strong>Price deviation</strong>: how far the token is from the real share price.
              </li>
              <li>
                <strong>Market status</strong>: whether the real stock is trading right now.
              </li>
              <li>
                <strong>Token provider and backing</strong>: who issues the token, how many shares it tracks, and
                their attestation report when published.
              </li>
              <li>
                <strong>Key risks</strong>, in plain English, and an overall <strong>verdict</strong>.
              </li>
            </List>
          </Section>

          <Section id="why-it-exists">
            <p>Bystok was built solo from Nigeria for BNB Hack: Tokenized Stocks Edition.</p>
            <p>
              Getting started was the hardest part. The Binance developer portal and API wouldn’t load on my MTN
              connection. I needed a VPN to get the API key, which took about 16 hours, then a DNS change, then
              moving the server region before the app could reach the API reliably.
            </p>
            <p>
              That’s also why Bystok tells you plainly when live data can’t be loaded, instead of quietly showing
              something old.
            </p>
          </Section>

          <Section id="the-honest-part">
            <p>What doesn’t work yet:</p>
            <List>
              <li>
                <strong>Buying isn’t built.</strong> You can connect a wallet and see a live quote, but the button
                reads “Swap coming next” and no transaction is ever sent.
              </li>
              <li>
                <strong>Ondo tokens need a wallet for quotes</strong>, so their spread shows Unavailable until one is
                connected.
              </li>
              <li>
                <strong>Ondo liquidity is always Unavailable</strong>: Ondo trades through market makers that don’t
                publish pool sizes.
              </li>
              <li>
                <strong>Prices can be pegged while the market is closed.</strong> Bystok flags an exact match, but
                can’t tell what a fill would really cost.
              </li>
              <li>
                <strong>If the API fails</strong>, the app shows clearly labelled sample data (made-up numbers).
              </li>
            </List>
          </Section>

          <PartHeading>Part II · How it works</PartHeading>

          <Section id="overview">
            <p>
              Bystok is a Next.js web app. The browser only talks to Bystok’s own server routes; the server signs every
              Binance Web3 API request with the API key, which never reaches the browser.
            </p>
            <List>
              <li>The market list loads light data for the top 30 stocks: price, 24h change and 24h volume.</li>
              <li>Full details (pools, spread quote, issuer profile) load only for the stock you select.</li>
              <li>Search covers all 488 listed tokens by ticker or company name.</li>
              <li>A connected wallet adds balances and a live buy quote.</li>
            </List>
          </Section>

          <Section id="data-sources">
            <p>
              All calls go to <Code>https://web3.binance.com/build</Code>, signed with HMAC-SHA256. Data is for BNB
              Chain only.
            </p>
            <dl className="grid gap-2">
              {ENDPOINTS.map(([endpoint, use]) => (
                <div key={endpoint} className="rounded-xl border border-line bg-card p-3">
                  <dt>
                    <Code>{endpoint}</Code>
                  </dt>
                  <dd className="mt-1 text-sm text-muted">{use}</dd>
                </div>
              ))}
            </dl>
            <p className="text-sm text-muted">
              Note: <Code>/rwa/tokens</Code> returned 442 of 458 Ondo tokens and 46 of 91 bStock tokens in our tests.
              The rest are only reachable through search.
            </p>
          </Section>

          <Section id="checks-and-thresholds">
            <p>
              Thresholds live in <Code>lib/analysis.ts</Code>:
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {CHECKS.map((c) => (
                <div key={c.name} className="rounded-xl border border-line bg-card p-3">
                  <p className="font-semibold">{c.name}</p>
                  <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                    <dt className="font-semibold text-emerald-700 dark:text-emerald-400">Good</dt>
                    <dd>{c.good}</dd>
                    <dt className="font-semibold text-amber-700 dark:text-amber-400">Caution</dt>
                    <dd>{c.caution}</dd>
                    <dt className="font-semibold text-red-700 dark:text-red-400">Risky</dt>
                    <dd>{c.risky}</dd>
                  </dl>
                  <p className="mt-2 text-xs text-muted">{c.note}</p>
                </div>
              ))}
            </div>
          </Section>

          <Section id="the-verdict">
            <List>
              <li>
                Any check <strong>Risky</strong> → <strong>High risk</strong>.
              </li>
              <li>
                Otherwise, any check <strong>Caution</strong> → <strong>Proceed with care</strong>.
              </li>
              <li>
                Otherwise → <strong>Looks healthy</strong>.
              </li>
            </List>
            <p>
              Missing data never passes: an Unavailable liquidity or spread counts as Caution. The key risks list
              explains each non-Good check, then adds the issuer’s live notices (for example a weekend trading pause)
              and general tokenized-stock risks.
            </p>
          </Section>

          <Section id="market-hours">
            <p>
              The market clock uses the regular NYSE/NASDAQ session: 9:30am to 4:00pm New York time, Monday to Friday,
              in the <Code>America/New_York</Code> time zone, so daylight saving is automatic. It updates every
              second. Exchange holidays and early closes aren’t handled yet.
            </p>
            <p>What we saw on a Saturday (3 October 2026):</p>
            <List>
              <li>All 46 listed bStock tokens reported “trading”.</li>
              <li>
                411 Ondo tokens reported closed (“Weekend or Holiday”) and 31 reported “off-hours” but still
                tradable.
              </li>
              <li>Ondo’s session showed a short break: close Sunday 7:55pm ET, reopen 8:05pm ET.</li>
            </List>
            <p>
              With the reference price frozen, a token that matches it exactly is flagged as possibly pegged.
            </p>
          </Section>

          <Section id="ondo-vs-bstock">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl border border-line bg-card p-3 text-sm">
                <p className="font-semibold">bStock (e.g. NVDAB)</p>
                <List>
                  <li>Quotes without a wallet.</li>
                  <li>Trades in AMM pools (PancakeSwap, Uniswap) and through market makers.</li>
                  <li>Pools report USD liquidity, so liquidity is measurable.</li>
                  <li>Reported “trading” on a Saturday in our tests.</li>
                </List>
              </div>
              <div className="rounded-xl border border-line bg-card p-3 text-sm">
                <p className="font-semibold">Ondo (e.g. NVDAon)</p>
                <List>
                  <li>Quotes need a wallet address: “userWalletAddress is required for RFQ (Ondo) quote”.</li>
                  <li>Pools report no USD liquidity, so liquidity is Unavailable.</li>
                  <li>
                    Closed tokens return error 40367: “The stock market is currently closed. Expected to open in…”
                  </li>
                </List>
              </div>
            </div>
            <p className="text-sm text-muted">
              Every quote we saw reported execution mode <Code>SWAP</Code>, even when routed through market makers
              (“Rfq Halfmoon”, “Rfq Bebop”). The bStock market-hours error, 40369, never appeared in our tests.
            </p>
          </Section>

          <Section id="reliability">
            <List>
              <li>Server-side cache of 30 seconds; identical in-flight requests are shared.</li>
              <li>Calls to the same endpoint are spaced 220ms apart (the API allows 5 per second).</li>
              <li>One retry on rate limits (42900) and stale timestamps (40103).</li>
              <li>
                Requests send <Code>X-OC-RECV-WINDOW: 60000</Code>; by default, a timestamp only about 3 seconds old
                is rejected.
              </li>
              <li>
                The page refreshes data every 30 seconds while visible. The “updated” time turns into a{" "}
                <strong>Delayed</strong> warning after 90 seconds or a failed refresh.
              </li>
              <li>If the API can’t be reached, clearly labelled sample data is shown instead.</li>
              <li>API errors are shown in plain English, never as raw codes or keys.</li>
            </List>
          </Section>

          <Section id="wallet-connect">
            <List>
              <li>
                <strong>Desktop:</strong> wallets found in the browser (Binance Web3 Wallet, MetaMask, …) are listed
                under <strong>Installed</strong>.
              </li>
              <li>
                <strong>Phones:</strong> a normal mobile browser has no wallet, so Bystok offers{" "}
                <strong>Open in MetaMask</strong>, which reopens the page inside MetaMask’s browser.
              </li>
              <li>
                <strong>Other wallets</strong> (MetaMask mobile, Trust, Binance Wallet, OKX…) connect through
                WalletConnect, when a project ID is configured.
              </li>
              <li>Wallets on another network get a Switch to BNB Chain prompt.</li>
              <li>
                Once connected: USDT and BNB balances, a live quote that refreshes every 30 seconds, and warnings for
                not enough USDT or less than 0.002 BNB for fees.
              </li>
            </List>
            <p>Bystok never sees private keys; the wallet signs everything.</p>
          </Section>

          <Section id="planned-buy-flow">
            <Note label="Planned, not built">This is the design for the next step. None of it sends transactions today.</Note>
            <p>For bStock tokens:</p>
            <ol className="grid list-decimal gap-1.5 pl-5 marker:text-muted">
              <li>Approve the exact USDT amount for the swap, never unlimited.</li>
              <li>Build the swap from the same quote, within 30 seconds; re-quote if it’s older than 25 seconds.</li>
              <li>Simulate the transaction and stop with the reason if it would fail.</li>
              <li>Show what you pay, the minimum you receive after 1% slippage, the router and the network fee.</li>
              <li>Your wallet signs; Bystok then tracks the transaction until confirmed or failed.</li>
            </ol>
            <p>Safety rules:</p>
            <List>
              <li>A cap of 20 USDT per buy.</li>
              <li>
                The transaction must come from your connected wallet and go to an allowlisted router address, with no
                BNB attached.
              </li>
              <li>The risk checkboxes stay required; High risk needs an extra confirmation.</li>
              <li>Ondo buying stays disabled until its separate flow is built.</li>
            </List>
          </Section>

          <Section id="tech-stack">
            <List>
              <li>Next.js 16, React 19, TypeScript</li>
              <li>Tailwind CSS 4</li>
              <li>wagmi 3 and viem 2 for wallets, WalletConnect for mobile wallet apps</li>
              <li>TanStack Query for data fetching and refresh</li>
              <li>Binance Web3 API for all market and wallet data</li>
              <li>Hosted on Vercel</li>
            </List>
          </Section>

          <Section id="whats-next">
            <ol className="grid list-decimal gap-1.5 pl-5 marker:text-muted">
              <li>bStock buying, with the safety rules above.</li>
              <li>Ondo buying: sign the market maker’s order in the wallet and track it until filled.</li>
              <li>US exchange holidays and early closes in the market clock.</li>
              <li>Price and spread alerts for watchlist stocks.</li>
            </ol>
          </Section>
        </article>
      </div>
    </>
  );
}
