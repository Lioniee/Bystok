"use client";

import { useState } from "react";
import type { TokenizedStock } from "@/lib/types";
import type { Analysis } from "@/lib/analysis";
import { pct, usd } from "@/lib/format";
import { useBalances, useLiveQuote, useWallet } from "./buy-hooks";

const QUICK_AMOUNTS = [50, 100, 500];
// Enough BNB for a handful of BNB Chain transactions (approve + swap).
const MIN_BNB = 0.002;

const fmtToken = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: n < 1 ? 6 : 4 });
const fmtBalance = (n: number, d: number) => n.toLocaleString("en-US", { maximumFractionDigits: d });

// Buy form. Quotes are live once a wallet is connected; nothing is signed or
// sent yet. The swap itself comes next.
export default function BuyPanel({ token, analysis }: { token: TokenizedStock; analysis: Analysis }) {
  const [amount, setAmount] = useState("100");
  const [reviewed, setReviewed] = useState(false);

  const wallet = useWallet();
  const balances = useBalances(wallet.address);
  const usdtIn = Math.max(0, Number(amount) || 0);
  const live = useLiveQuote(token.contractAddress, usdtIn, wallet.address);

  const bal = balances.data?.ok ? balances.data.data : undefined;
  const notEnoughUsdt = bal !== undefined && usdtIn > bal.usdt;
  const lowBnb = bal !== undefined && bal.bnb < MIN_BNB;

  // Without a live quote, estimate from the scanner's ask (or last price).
  const estPrice = token.ask ?? token.tokenPrice;
  const poolShare = token.liquidityUsd ? (usdtIn / token.liquidityUsd) * 100 : 0;

  return (
    <section className="rounded-2xl border border-line bg-card p-4 lg:sticky lg:top-4">
      <h3 className="font-bold">Buy {token.symbol}</h3>

      {bal && (
        <p className="mt-1 text-xs text-muted tabular-nums">
          Balance: {fmtBalance(bal.usdt, 2)} USDT · {fmtBalance(bal.bnb, 5)} BNB
        </p>
      )}

      <label htmlFor="amount" className="mt-3 block text-sm text-muted">
        Amount (USDT)
      </label>
      <div className="mt-1 flex items-center rounded-xl border border-line px-3 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/30">
        <input
          id="amount"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
          className="w-full bg-transparent py-2.5 text-lg tabular-nums outline-none"
        />
        <span className="text-sm text-muted">USDT</span>
      </div>
      <div className="mt-2 flex gap-2">
        {QUICK_AMOUNTS.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setAmount(String(a))}
            className="flex-1 rounded-lg border border-line py-1.5 text-sm hover:border-muted"
          >
            {a}
          </button>
        ))}
      </div>

      {!token.contractAddress ? (
        <Note>Live quotes need live data. This is sample data.</Note>
      ) : !wallet.connected ? (
        <>
          <dl className="mt-4 grid grid-cols-2 gap-y-1.5 text-sm">
            <dt className="text-muted">Estimated price</dt>
            <dd className="text-right tabular-nums">{usd(estPrice)}</dd>
            <dt className="text-muted">You receive ≈</dt>
            <dd className="text-right font-semibold tabular-nums">
              {fmtToken(usdtIn / estPrice)} {token.symbol}
            </dd>
            <dt className="text-muted">Price vs stock</dt>
            <dd className="text-right tabular-nums">{pct(analysis.deviationPct, true)}</dd>
          </dl>
          <Note>Connect your wallet for a live quote.</Note>
        </>
      ) : !wallet.onBsc ? (
        <Note>Switch your wallet to BNB Chain to get a live quote.</Note>
      ) : live.loading ? (
        <p className="mt-4 animate-pulse text-sm text-muted" aria-live="polite">
          Getting a live quote…
        </p>
      ) : live.error ? (
        <Note tone={"marketClosed" in live.error && live.error.marketClosed ? "warn" : "error"}>{live.error.error}</Note>
      ) : live.quote ? (
        <>
          <dl className="mt-4 grid grid-cols-2 gap-y-1.5 text-sm">
            <dt className="text-muted">You receive ≈</dt>
            <dd className="text-right font-semibold tabular-nums">
              {fmtToken(live.quote.tokensOut)} {token.symbol}
            </dd>
            <dt className="text-muted">Price per token</dt>
            <dd className="text-right tabular-nums">{usd(live.quote.pricePerToken)}</dd>
            <dt className="text-muted">Price impact</dt>
            <dd
              className={`text-right tabular-nums ${live.quote.priceImpactPct > 1 ? "text-amber-700 dark:text-amber-400" : ""}`}
              title={`vs the market price of ${usd(live.quote.marketPrice)}`}
            >
              {pct(live.quote.priceImpactPct, true)}
            </dd>
            <dt className="text-muted">Fees ≈</dt>
            <dd className="text-right tabular-nums">
              {live.quote.tradeFeeUsd === null ? "—" : usd(live.quote.tradeFeeUsd)}
            </dd>
            <dt className="text-muted">Execution</dt>
            <dd className="text-right" title={live.quote.route.join(", ")}>
              {live.quote.executionMode}
              {live.quote.route.length > 0 && <span className="text-muted"> · {live.quote.route.join(", ")}</span>}
            </dd>
          </dl>
          <p className="mt-2 text-xs text-muted tabular-nums" aria-live="off">
            {live.refreshing ? "Refreshing quote…" : `Quote refreshes in ${live.secondsLeft}s`}
          </p>
          {live.quote.priceImpactPct > 1 && (
            <Note tone="warn">
              You’d pay {pct(live.quote.priceImpactPct)} above the market price. Try a smaller amount.
            </Note>
          )}
        </>
      ) : null}

      {notEnoughUsdt && <Note tone="error">Not enough USDT.</Note>}
      {lowBnb && <Note tone="warn">You need a little BNB for network fees.</Note>}
      {poolShare > 1 && (
        <Note tone="warn">
          This order is {pct(poolShare)} of the pool’s liquidity, so the final price could be noticeably worse.
        </Note>
      )}

      <label className="mt-4 flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={reviewed}
          onChange={(e) => setReviewed(e.target.checked)}
          className="mt-0.5 size-4 accent-[var(--brand)]"
        />
        <span>I’ve read the checks and key risks for {token.symbol}.</span>
      </label>

      <button
        type="button"
        disabled
        className="mt-4 w-full cursor-not-allowed rounded-xl bg-brand py-3 font-bold text-brand-fg opacity-40"
      >
        Swap coming next
      </button>
    </section>
  );
}

function Note({ children, tone = "info" }: { children: React.ReactNode; tone?: "info" | "warn" | "error" }) {
  const styles = {
    info: "border border-line text-muted",
    warn: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    error: "bg-red-500/10 text-red-700 dark:text-red-400",
  }[tone];
  return (
    <p role={tone === "info" ? undefined : "status"} className={`mt-3 rounded-lg p-2 text-xs ${styles}`}>
      {children}
    </p>
  );
}
