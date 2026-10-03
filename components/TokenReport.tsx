import type { TokenizedStock } from "@/lib/types";
import type { Analysis, Check } from "@/lib/analysis";
import { compactUsd, usd } from "@/lib/format";
import LevelBadge, { LEVEL_STYLES } from "./LevelBadge";

const card = "rounded-2xl border border-line bg-card p-4";

function CheckCard({ check }: { check: Check }) {
  return (
    <div className={card}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-muted">{check.label}</h3>
        <LevelBadge level={check.level} />
      </div>
      <p className="mt-1 text-2xl font-bold tabular-nums">{check.value}</p>
      {check.detail && <p className="text-sm font-medium tabular-nums">{check.detail}</p>}
      <p className="mt-1 text-xs leading-relaxed text-muted">{check.hint}</p>
    </div>
  );
}

// The full scan for one token: verdict, facts, checks, risks. The Buy panel is
// placed next to (or below) it by Scanner.
export default function TokenReport({ token, analysis }: { token: TokenizedStock; analysis: Analysis }) {
  const { checks, verdict, risks } = analysis;

  return (
    <div className="grid min-w-0 gap-4">
      {/* Verdict */}
      <section className={`${card} flex flex-wrap items-center justify-between gap-3`}>
        <div>
          <p className="text-sm text-muted">
            {token.symbol} on {token.chain}
          </p>
          <h2 className="text-2xl font-bold">{token.underlying.name}</h2>
        </div>
        <div className={`rounded-xl px-3 py-2 ${LEVEL_STYLES[verdict.level].pill}`}>
          <p className="font-bold">{verdict.title}</p>
          <p className="text-xs">{verdict.text}</p>
        </div>
      </section>

      {/* Underlying stock + provider */}
      <div className="grid gap-4 sm:grid-cols-2">
        <section className={card}>
          <h3 className="text-sm font-medium text-muted">Underlying stock</h3>
          <p className="mt-1 text-lg font-bold">
            {token.underlying.ticker} <span className="font-normal text-muted">· {token.underlying.exchange}</span>
          </p>
          <dl className="mt-2 grid grid-cols-2 gap-y-1 text-sm">
            <dt className="text-muted">Stock price</dt>
            <dd className="text-right tabular-nums">{usd(token.underlying.price)}</dd>
            <dt className="text-muted">Token price</dt>
            <dd className="text-right tabular-nums">{usd(token.tokenPrice)}</dd>
            <dt className="text-muted">Token 24h volume</dt>
            <dd className="text-right tabular-nums">{compactUsd(token.volume24hUsd)}</dd>
            {token.holders !== undefined && (
              <>
                <dt className="text-muted">Token holders</dt>
                <dd className="text-right tabular-nums">{token.holders.toLocaleString("en-US")}</dd>
              </>
            )}
            {token.underlying.marketCapUsd !== undefined && (
              <>
                <dt className="text-muted">Company value</dt>
                <dd className="text-right tabular-nums">{compactUsd(token.underlying.marketCapUsd)}</dd>
              </>
            )}
          </dl>
        </section>
        <section className={card}>
          <h3 className="text-sm font-medium text-muted">Token provider</h3>
          <p className="mt-1 text-lg font-bold">{token.provider.name}</p>
          <p className="mt-2 text-sm">
            <span className="text-muted">Backing: </span>
            {token.provider.backing}
          </p>
          {token.provider.attestationUrl && (
            <a
              href={token.provider.attestationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-sm font-medium underline decoration-brand decoration-2 underline-offset-2"
            >
              Latest attestation report
            </a>
          )}
        </section>
      </div>

      {/* The four checks */}
      <div className="grid gap-4 sm:grid-cols-2">
        <CheckCard check={checks.liquidity} />
        <CheckCard check={checks.spread} />
        <CheckCard check={checks.deviation} />
        <CheckCard check={checks.market} />
      </div>

      {/* Risks */}
      <section className={card}>
        <h3 className="font-bold">Key risks</h3>
        <ul className="mt-2 grid gap-2 text-sm">
          {risks.map((r) => (
            <li key={r} className="flex gap-2">
              <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-amber-500" />
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
