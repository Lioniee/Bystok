"use client";

import { useRef, useState } from "react";
import type { TokenizedStock } from "@/lib/types";
import { analyze } from "@/lib/analysis";
import { pct, usd } from "@/lib/format";
import type { MarketClock } from "@/lib/market-hours";
import { LEVEL_STYLES } from "./LevelBadge";
import { useAutoScroll, useMediaQuery } from "./useAutoScroll";

type Tab = "markets" | "watchlist";

type Props = {
  tokens: TokenizedStock[];
  selectedId: string;
  onSelect: (id: string) => void;
  onSearchAll?: (query: string) => Promise<number>; // server-side search across every token
  watchlist: Set<string>;
  watchlistPending: number; // saved tokens still being fetched after a reload
  onToggleWatch: (t: TokenizedStock) => void;
  clock: MarketClock;
};

// Tabs, search and the token list. On phones the list is a sideways strip
// that scrolls by itself; on desktop it stacks as a list.
export default function TokenPicker(props: Props) {
  const { tokens, selectedId, onSelect, onSearchAll, watchlist, watchlistPending, onToggleWatch, clock } = props;
  const [tab, setTab] = useState<Tab>("markets");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchNote, setSearchNote] = useState<string | null>(null);

  async function searchAll() {
    if (!onSearchAll) return;
    setSearching(true);
    setSearchNote(null);
    try {
      const n = await onSearchAll(query.trim());
      if (n === 0) setSearchNote(`No tokenized stocks on BNB Chain match “${query}”.`);
    } catch {
      setSearchNote("Search failed. Try again in a moment.");
    } finally {
      setSearching(false);
    }
  }

  const q = query.trim().toLowerCase();
  const inTab = tab === "watchlist" ? tokens.filter((t) => watchlist.has(t.id)) : tokens;
  const filtered = inTab.filter((t) =>
    [t.symbol, t.underlying.ticker, t.underlying.name].some((s) => s.toLowerCase().includes(q)),
  );

  // Auto-scroll only on the phone strip, only with motion allowed, and not
  // while the viewer is searching.
  const listRef = useRef<HTMLUListElement>(null);
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const loopWanted = !isDesktop && !reducedMotion && !q;
  const overflowing = useAutoScroll(listRef, loopWanted, `${tab}:${filtered.map((t) => t.id).join(",")}`);
  const looping = loopWanted && overflowing && filtered.length > 0;

  // `copy`: part of the duplicate used for the seamless loop. `loopStart`: its
  // first item, used to measure the width of one copy.
  const card = (t: TokenizedStock, copy: boolean, loopStart = false) => {
    const verdict = analyze(t, clock).verdict;
    const active = t.id === selectedId;
    const watched = watchlist.has(t.id);
    const change = t.change24hPct;
    return (
      <li
        key={copy ? `copy-${t.id}` : t.id}
        className={`relative shrink-0 md:shrink ${looping ? "" : "snap-start"}`}
        // The duplicate exists only to make the loop seamless: hidden from screen
        // readers and skipped by Tab, but still tappable.
        aria-hidden={copy || undefined}
        data-loop-copy={copy || undefined}
        data-loop-start={loopStart || undefined}
      >
        <button
          type="button"
          onClick={() => onSelect(t.id)}
          aria-pressed={active}
          tabIndex={copy ? -1 : undefined}
          className={`flex w-56 items-center justify-between gap-3 rounded-xl border py-2.5 pl-3 pr-12 text-left transition md:w-full ${
            active ? "border-brand bg-brand/10" : "border-line bg-card hover:border-muted"
          }`}
        >
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 font-semibold">
              {t.symbol}
              <span className={`size-1.5 rounded-full ${LEVEL_STYLES[verdict.level].dot}`} title={verdict.title} />
            </span>
            <span className="block truncate text-xs text-muted">{t.underlying.name}</span>
          </span>
          <span className="flex shrink-0 flex-col items-end">
            <span className="text-sm font-medium tabular-nums">{usd(t.tokenPrice)}</span>
            {change !== undefined && <Change pctValue={change} />}
          </span>
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation(); // never also select the card
            onToggleWatch(t);
          }}
          aria-pressed={watched}
          aria-label={watched ? `Remove ${t.symbol} from watchlist` : `Add ${t.symbol} to watchlist`}
          title={watched ? "Remove from watchlist" : "Add to watchlist"}
          tabIndex={copy ? -1 : undefined}
          className={`absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full border text-sm font-bold transition ${
            watched
              ? "border-brand bg-brand text-brand-fg"
              : "border-line bg-bg text-muted hover:border-muted hover:text-fg"
          }`}
        >
          <span aria-hidden>{watched ? "✓" : "+"}</span>
        </button>
      </li>
    );
  };

  return (
    <section aria-label="Pick a tokenized stock" className="min-w-0">
      <div role="tablist" aria-label="Token lists" className="mb-3 flex gap-1 rounded-xl border border-line bg-card p-1">
        {(["markets", "watchlist"] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`tab-${id}`}
            aria-selected={tab === id}
            aria-controls="token-list"
            onClick={() => {
              setTab(id);
              setSearchNote(null);
            }}
            className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              tab === id ? "bg-brand text-brand-fg" : "text-muted hover:text-fg"
            }`}
          >
            {id === "markets" ? "Markets" : `Watchlist${watchlist.size ? ` (${watchlist.size})` : ""}`}
          </button>
        ))}
      </div>

      <label htmlFor="token-search" className="sr-only">
        Search tokenized stocks
      </label>
      <input
        id="token-search"
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setSearchNote(null);
        }}
        placeholder="Search TSLA, Apple, SPY…"
        className="mb-3 w-full rounded-xl border border-line bg-card px-3 py-2.5 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
      />

      <ul
        ref={listRef}
        id="token-list"
        role="tabpanel"
        aria-labelledby={`tab-${tab}`}
        className={`no-scrollbar relative -mx-4 flex gap-2 overflow-x-auto px-4 pb-2 md:mx-0 md:flex-col md:overflow-visible md:px-0 ${
          looping ? "" : "snap-x"
        }`}
      >
        {filtered.map((t) => card(t, false))}
        {looping && filtered.map((t, i) => card(t, true, i === 0))}

        {filtered.length === 0 && (
          <li className="px-1 py-2 text-sm text-muted">
            {tab === "watchlist" && !q ? (
              watchlistPending > 0 ? (
                "Loading your saved stocks…"
              ) : (
                <span className="block rounded-xl border border-dashed border-line p-4 text-center">
                  <span className="mx-auto mb-2 grid size-8 place-items-center rounded-full border border-line font-bold">
                    +
                  </span>
                  Tap + on any stock to watch it here.
                </span>
              )
            ) : tab === "markets" && onSearchAll && !searchNote ? (
              <button
                type="button"
                onClick={searchAll}
                disabled={searching}
                className="rounded-lg border border-line px-3 py-1.5 text-fg hover:border-muted disabled:opacity-50"
              >
                {searching ? "Searching…" : `Search all tokens for “${query.trim()}”`}
              </button>
            ) : (
              (searchNote ?? `No ${tab === "watchlist" ? "watched " : ""}stocks match “${query}”.`)
            )}
          </li>
        )}
      </ul>
    </section>
  );
}

// 24h price change, colour plus an arrow so it never relies on colour alone.
function Change({ pctValue }: { pctValue: number }) {
  const up = pctValue > 0.004;
  const down = pctValue < -0.004;
  return (
    <span
      className={`text-xs font-semibold tabular-nums ${
        up ? "text-emerald-600 dark:text-emerald-400" : down ? "text-red-600 dark:text-red-400" : "text-muted"
      }`}
      title="24h price change"
    >
      {up ? "▲ " : down ? "▼ " : ""}
      {pct(Math.abs(pctValue))}
      <span className="sr-only"> {up ? "up" : down ? "down" : "unchanged"} in 24 hours</span>
    </span>
  );
}
