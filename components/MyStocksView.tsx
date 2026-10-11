"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useConnection } from "wagmi";
import type { ApiResult, HoldingPnl, Portfolio } from "@/lib/types";
import { pct, usd } from "@/lib/format";
import { useWallet } from "./buy-hooks";
import { useSelectedToken } from "./SelectedToken";
import WalletButton from "./WalletButton";

const fmtAmount = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: n < 1 ? 6 : 4 });

async function loadHoldings(address: string) {
  const res = await fetch(`/api/holdings?address=${address}`, { cache: "no-store" });
  const json = (await res.json()) as ApiResult<Portfolio>;
  if (!json.ok) throw new Error(json.error);
  return json.data;
}

// Profit/loss with a green ▲ or red ▼, so it never relies on colour alone.
function Pnl({ pnl }: { pnl: HoldingPnl }) {
  const up = pnl.pnlUsd > 0.005;
  const down = pnl.pnlUsd < -0.005;
  return (
    <span
      className={`text-xs font-semibold tabular-nums ${
        up ? "text-emerald-600 dark:text-emerald-400" : down ? "text-red-600 dark:text-red-400" : "text-muted"
      }`}
    >
      {up ? "▲ " : down ? "▼ " : ""}
      {usd(Math.abs(pnl.pnlUsd))} ({pct(Math.abs(pnl.pnlPct))})
      <span className="sr-only"> {up ? "profit" : down ? "loss" : "no change"}</span>
    </span>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-line bg-card p-8 text-center">{children}</div>;
}

// MyStocks: the connected wallet's tokenized stocks, read-only. Nothing here can
// sell or send anything.
export default function MyStocksView() {
  const wallet = useWallet();
  const { status } = useConnection();
  const { select } = useSelectedToken();
  const router = useRouter();
  const holdings = useQuery({
    queryKey: ["holdings", wallet.address],
    queryFn: () => loadHoldings(wallet.address!),
    enabled: Boolean(wallet.address),
    // Holdings change slowly and a large wallet means many API calls, so refresh
    // less often than prices.
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    staleTime: 60_000,
  });

  // A returning visitor's wallet reconnects after load: don't ask them to
  // connect while that's still happening.
  if (status === "reconnecting" || status === "connecting") {
    return (
      <p className="py-8 text-center text-sm text-muted" aria-live="polite">
        Checking your wallet…
      </p>
    );
  }
  if (!wallet.connected) {
    return (
      <Card>
        <p className="font-semibold">Connect your wallet to see your stocks.</p>
        <p className="mt-2 text-sm text-muted">Bystok only reads your balances. It never sees your keys.</p>
        <div className="mt-4 flex justify-center">
          <WalletButton />
        </div>
      </Card>
    );
  }
  if (!wallet.onBsc) {
    return (
      <Card>
        <p className="font-semibold">Switch your wallet to BNB Chain to see your stocks.</p>
        <div className="mt-4 flex justify-center">
          <WalletButton />
        </div>
      </Card>
    );
  }
  if (holdings.isPending) {
    return (
      <div className="grid gap-2" aria-busy="true" aria-label="Loading your stocks">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-[72px] animate-pulse rounded-xl bg-line/60" />
        ))}
        <p className="text-xs text-muted">Reading your wallet. Large wallets can take a few seconds.</p>
      </div>
    );
  }
  if (holdings.isError) {
    return (
      <div role="alert" className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm">
        <p>Couldn’t load your stocks: {holdings.error.message}</p>
        <button
          type="button"
          onClick={() => void holdings.refetch()}
          className="mt-2 rounded-lg border border-line bg-card px-3 py-1.5 font-semibold"
        >
          Try again
        </button>
      </div>
    );
  }

  const p = holdings.data;
  if (p.holdings.length === 0) {
    return (
      <Card>
        <p className="font-semibold">No tokenized stocks in this wallet yet.</p>
        <p className="mt-2 text-sm text-muted">Stocks you hold on BNB Chain (bStocks and Ondo) will show here.</p>
        <Link
          href="/"
          className="mt-4 inline-block rounded-xl bg-brand px-4 py-2 text-sm font-bold text-brand-fg hover:brightness-95"
        >
          Scan stocks
        </Link>
      </Card>
    );
  }

  const partial = p.totalPnl && p.totalPnl.holdingsCovered < p.holdings.length;

  return (
    <div className="grid grid-cols-1 gap-4">
      <ul className="grid grid-cols-1 gap-2">
        {p.holdings.map((h) => (
          <li key={h.token.id} className="min-w-0">
            <button
              type="button"
              onClick={() => {
                select(h.token);
                router.push("/");
              }}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-line bg-card px-3 py-2.5 text-left transition hover:border-muted"
            >
              <span className="min-w-0">
                <span className="block font-semibold">{h.token.symbol}</span>
                <span className="block truncate text-xs text-muted">
                  {h.token.underlying.ticker} · {h.token.underlying.name} · {h.token.provider.name}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end">
                <span className="text-sm font-semibold tabular-nums">{usd(h.valueUsd)}</span>
                <span className="text-xs text-muted tabular-nums">{fmtAmount(h.amount)}</span>
                {h.pnl ? (
                  <Pnl pnl={h.pnl} />
                ) : (
                  <span className="text-xs text-muted" title={h.pnlNote}>
                    {h.pnlNote?.startsWith("P/L not checked") ? "P/L not checked" : "P/L unavailable"}
                  </span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 rounded-2xl border border-line bg-card p-4 text-sm">
        <dt className="font-semibold">Total value</dt>
        <dd className="text-right font-bold tabular-nums">{usd(p.totalValueUsd)}</dd>
        <dt className="font-semibold">Total P/L</dt>
        <dd className="text-right">{p.totalPnl ? <Pnl pnl={p.totalPnl} /> : <span className="text-muted">P/L unavailable</span>}</dd>
        {partial && (
          <dd className="col-span-2 text-xs text-muted">
            P/L covers {p.totalPnl!.holdingsCovered} of {p.holdings.length} holdings. The rest have no complete on-chain
            purchase history.
          </dd>
        )}
      </dl>

      {p.holdings.some((h) => !h.pnl) && (
        <p className="text-xs text-muted">
          P/L uses your average on-chain buy price from the Binance Web3 API. It’s unavailable when some tokens arrived by
          transfer or were never bought on-chain, because their cost is unknown. Only your 20 largest holdings are
          checked.
        </p>
      )}

      {/* Visible but disabled: selling isn't built. The wrapper carries the tooltip,
          because disabled buttons don't show one in every browser. */}
      <span title="Selling isn't built yet." className="block">
        <button
          type="button"
          disabled
          aria-describedby="close-all-note"
          className="w-full cursor-not-allowed rounded-xl border border-line bg-card py-3 font-bold text-muted opacity-60"
        >
          Close all positions (coming with trading)
        </button>
      </span>
      <p id="close-all-note" className="sr-only">
        Selling isn't built yet.
      </p>
    </div>
  );
}
