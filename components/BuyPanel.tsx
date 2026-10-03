"use client";

import { useState } from "react";
import type { TokenizedStock } from "@/lib/types";
import type { Analysis } from "@/lib/analysis";
import { pct, usd } from "@/lib/format";

const QUICK_AMOUNTS = [50, 100, 500];

// Buy form. DEMO ONLY: nothing is sent on-chain yet. The real version will
// ask a server route for a quote and have the user sign with their wallet.
export default function BuyPanel({ token, analysis }: { token: TokenizedStock; analysis: Analysis }) {
  const [amount, setAmount] = useState("100");
  const [reviewed, setReviewed] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const usdIn = Math.max(0, Number(amount) || 0);
  // You buy at the ask. Without a live quote (RFQ tokens) we can only estimate from the last price.
  const hasQuote = token.bid !== null && token.ask !== null;
  const buyPrice = token.ask ?? token.tokenPrice;
  const tokensOut = usdIn / buyPrice;
  const mid = hasQuote ? (token.bid! + token.ask!) / 2 : buyPrice;
  const spreadCost = usdIn * ((buyPrice - mid) / buyPrice); // what you pay above the mid price
  const poolShare = token.liquidityUsd ? (usdIn / token.liquidityUsd) * 100 : 0;
  const canBuy = usdIn > 0 && reviewed;

  return (
    <section className="rounded-2xl border border-line bg-card p-4 lg:sticky lg:top-4">
      <h3 className="font-bold">Buy {token.symbol}</h3>

      <label htmlFor="amount" className="mt-3 block text-sm text-muted">
        Amount (USD)
      </label>
      <div className="mt-1 flex items-center rounded-xl border border-line px-3 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/30">
        <span className="text-muted">$</span>
        <input
          id="amount"
          inputMode="decimal"
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value.replace(/[^0-9.]/g, ""));
            setSubmitted(false);
          }}
          className="w-full bg-transparent px-2 py-2.5 text-lg tabular-nums outline-none"
        />
      </div>
      <div className="mt-2 flex gap-2">
        {QUICK_AMOUNTS.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setAmount(String(a))}
            className="flex-1 rounded-lg border border-line py-1.5 text-sm hover:border-muted"
          >
            ${a}
          </button>
        ))}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-y-1.5 text-sm">
        <dt className="text-muted">{hasQuote ? "Price (ask)" : "Last price"}</dt>
        <dd className="text-right tabular-nums">{usd(buyPrice)}</dd>
        <dt className="text-muted">You receive ≈</dt>
        <dd className="text-right font-semibold tabular-nums">
          {tokensOut.toFixed(4)} {token.symbol}
        </dd>
        <dt className="text-muted">Spread cost ≈</dt>
        <dd className="text-right tabular-nums">{hasQuote ? usd(spreadCost) : "Unknown"}</dd>
        <dt className="text-muted">Price vs stock</dt>
        <dd className="text-right tabular-nums">{pct(analysis.deviationPct, true)}</dd>
      </dl>

      {poolShare > 1 && (
        <p className="mt-3 rounded-lg bg-amber-500/15 p-2 text-xs text-amber-700 dark:text-amber-400">
          This order is {pct(poolShare)} of the pool’s liquidity, so the final price could be noticeably worse.
        </p>
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
        disabled={!canBuy}
        onClick={() => setSubmitted(true)}
        className="mt-4 w-full rounded-xl bg-brand py-3 font-bold text-brand-fg transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Buy {token.symbol}
      </button>

      {submitted && (
        <p role="status" className="mt-3 rounded-lg border border-line p-2 text-xs text-muted">
          Demo mode: no transaction was sent. Wallet connection and on-chain swaps come next.
        </p>
      )}
    </section>
  );
}
