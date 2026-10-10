"use client";

import { useMemo } from "react";
import Link from "next/link";
import { analyze } from "@/lib/analysis";
import { usd } from "@/lib/format";
import BuyPanel from "./BuyPanel";
import DataSource from "./DataSource";
import { LEVEL_STYLES } from "./LevelBadge";
import PriceChange from "./PriceChange";
import { useSelectedToken } from "./SelectedToken";
import { useDefaultSelection, useMarketClock, useTokenDetail, useTokenList } from "./token-data";

// The Swap page: pick a stock (the one chosen on Scan is preselected), see its
// verdict at a glance, then the Buy panel with amount, balances, live quote and
// guards. The swap button itself stays disabled until buying is built.
export default function SwapView() {
  const { selected, select } = useSelectedToken();
  const clock = useMarketClock();
  const list = useTokenList();
  const data = list.data;
  useDefaultSelection(data?.tokens, data?.source);

  const current = selected ? (data?.tokens.find((t) => t.id === selected.id) ?? selected) : undefined;
  const { detail, query } = useTokenDetail(current, data?.source);
  const analysis = useMemo(() => (detail ? analyze(detail, clock) : null), [detail, clock]);

  // The list, plus the selected stock if it came from search and isn't in it.
  const options = data ? (current && !data.tokens.some((t) => t.id === current.id) ? [current, ...data.tokens] : data.tokens) : [];

  return (
    <div className="mx-auto grid max-w-lg gap-4">
      <div>
        <h1 className="text-2xl font-bold">Swap</h1>
        <p className="text-sm text-muted">Buy a tokenized stock with USDT on BNB Chain.</p>
      </div>

      {data && <DataSource data={data} refreshFailed={list.isRefetchError} />}

      <div>
        <label htmlFor="swap-stock" className="mb-1 block text-sm font-semibold">
          Stock
        </label>
        <select
          id="swap-stock"
          value={current?.id ?? ""}
          disabled={!data}
          onChange={(e) => {
            const t = options.find((o) => o.id === e.target.value);
            if (t) select(t);
          }}
          className="w-full rounded-xl border border-line bg-card px-3 py-2.5 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand/30 disabled:opacity-60"
        >
          {!data && <option value="">Loading stocks…</option>}
          {options.map((t) => (
            <option key={t.id} value={t.id}>
              {t.symbol} · {t.underlying.name}
            </option>
          ))}
        </select>
      </div>

      {current && (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-card p-4">
          <div className="min-w-0">
            <p className="font-bold">{current.symbol}</p>
            <p className="truncate text-sm text-muted">
              {current.underlying.name} · {current.provider.name}
            </p>
          </div>
          <div className="text-right">
            <p className="font-semibold tabular-nums">{usd(detail?.tokenPrice ?? current.tokenPrice)}</p>
            {current.change24hPct !== undefined && <PriceChange pctValue={current.change24hPct} />}
          </div>
          {analysis && (
            <div className="flex w-full flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${LEVEL_STYLES[analysis.verdict.level].pill}`}>
                {analysis.verdict.title}
              </span>
              <Link href="/" className="text-sm font-medium underline decoration-brand decoration-2 underline-offset-4">
                See the full report
              </Link>
            </div>
          )}
        </section>
      )}

      {detail && analysis ? (
        // key resets the form whenever a different stock is picked
        <BuyPanel key={detail.id} token={detail} analysis={analysis} />
      ) : query.isError ? (
        <div role="alert" className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm">
          <p>
            Couldn’t load {current?.symbol}: {query.error.message}
          </p>
          <button
            type="button"
            onClick={() => void query.refetch()}
            className="mt-2 rounded-lg border border-line bg-card px-3 py-1.5 font-semibold"
          >
            Try again
          </button>
        </div>
      ) : (
        <div className="h-96 animate-pulse rounded-2xl bg-line/60" aria-busy="true" aria-label="Loading" />
      )}
    </div>
  );
}
