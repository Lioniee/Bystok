"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { TokenSummary } from "@/lib/types";
import { usd } from "@/lib/format";
import PriceChange from "./PriceChange";
import { loadTokens } from "./token-api";

type Tab = "markets" | "watchlist";

// On phones the list starts collapsed to this many cards.
const PHONE_PREVIEW = 4;
// Wait this long after the last keystroke before searching the server.
const SEARCH_DELAY_MS = 300;

type Props = {
  tokens: TokenSummary[]; // the top-30 list
  total?: number; // size of the full list, e.g. 488
  known: TokenSummary[]; // list + watched tokens outside it
  live: boolean; // false on sample data: search can't reach the full list
  selectedId: string;
  onSelect: (t: TokenSummary) => void;
  watchlist: Set<string>;
  watchlistPending: number; // saved tokens still being fetched
  onToggleWatch: (t: TokenSummary) => void;
};

const matchesText = (t: TokenSummary, q: string) =>
  [t.symbol, t.underlying.ticker, t.underlying.name].some((s) => s.toLowerCase().includes(q));

function useDebounced<T>(value: T, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

// Tabs, search and a vertical list of token cards. Typing filters what's
// already loaded straight away, then searches all ~488 tokens on the server
// (by ticker and company name, both the bStock and Ondo versions). On phones
// the list shows the first few cards with a "Show all stocks" toggle.
export default function TokenPicker(props: Props) {
  const { tokens, total, known, live, selectedId, onSelect, watchlist, watchlistPending, onToggleWatch } = props;
  const [tab, setTab] = useState<Tab>("markets");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);

  const q = query.trim();
  const qLower = q.toLowerCase();
  const debounced = useDebounced(q, SEARCH_DELAY_MS);
  const searching = tab === "markets" && Boolean(q);
  const server = useQuery({
    queryKey: ["tokens", debounced],
    queryFn: () => loadTokens(debounced),
    enabled: live && searching && debounced === q,
    staleTime: 30_000,
  });

  let shown: TokenSummary[];
  if (tab === "watchlist") {
    shown = known.filter((t) => watchlist.has(t.id) && (!q || matchesText(t, qLower)));
  } else if (!q) {
    shown = tokens;
  } else {
    // Server results first (they cover the full list), then local matches.
    const fromServer = live && debounced === q ? (server.data?.tokens ?? []) : [];
    const seen = new Set<string>();
    shown = [...fromServer, ...known.filter((t) => matchesText(t, qLower))].filter(
      (t) => !seen.has(t.id) && seen.add(t.id),
    );
  }
  const waiting = searching && live && (debounced !== q || server.isFetching);

  // Collapsing is done with CSS (max-md:hidden) so desktop never flickers; a
  // search always shows every match.
  const collapsible = !q && shown.length > PHONE_PREVIEW;

  const card = (t: TokenSummary, index: number) => {
    const active = t.id === selectedId;
    const watched = watchlist.has(t.id);
    return (
      <li key={t.id} className={`relative ${collapsible && !expanded && index >= PHONE_PREVIEW ? "max-md:hidden" : ""}`}>
        <button
          type="button"
          onClick={() => onSelect(t)}
          aria-pressed={active}
          className={`flex w-full items-center justify-between gap-3 rounded-xl border py-2.5 pl-3 pr-12 text-left transition ${
            active ? "border-brand bg-brand/10" : "border-line bg-card hover:border-muted"
          }`}
        >
          <span className="min-w-0">
            <span className="block font-semibold">{t.symbol}</span>
            <span className="block truncate text-xs text-muted">{t.underlying.name}</span>
          </span>
          <span className="flex shrink-0 flex-col items-end">
            <span className="text-sm font-medium tabular-nums">{usd(t.tokenPrice)}</span>
            {t.change24hPct !== undefined && <PriceChange pctValue={t.change24hPct} />}
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

  let empty: React.ReactNode = null;
  if (shown.length === 0) {
    if (tab === "watchlist" && !q) {
      empty =
        watchlistPending > 0 ? (
          "Loading your saved stocks…"
        ) : (
          <span className="block rounded-xl border border-dashed border-line p-4 text-center">
            <span className="mx-auto mb-2 grid size-8 place-items-center rounded-full border border-line font-bold">
              +
            </span>
            Tap + on any stock to watch it here.
          </span>
        );
    } else if (waiting) {
      empty = "Searching all stocks…";
    } else if (searching && server.isError) {
      empty = "Search failed. Try again in a moment.";
    } else {
      empty = `No ${tab === "watchlist" ? "watched " : ""}stocks found for “${q}”.${
        searching && !live ? " Searching all stocks needs live data." : ""
      }`;
    }
  }

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
            onClick={() => setTab(id)}
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
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search PLTR, Netflix, Disney…"
        autoComplete="off"
        className="mb-2 w-full rounded-xl border border-line bg-card px-3 py-2.5 text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
      />

      <p className="mb-2 px-1 text-xs text-muted" data-list-count aria-live="polite">
        {tab === "watchlist"
          ? `${shown.length} watched`
          : q
            ? waiting && shown.length > 0
              ? `${shown.length} found so far · searching all stocks…`
              : `${shown.length} found`
            : total && total > tokens.length
              ? `${tokens.length} of ${total} stocks · search for more`
              : `${tokens.length} stocks`}
      </p>

      <ul id="token-list" role="tabpanel" aria-labelledby={`tab-${tab}`} className="flex flex-col gap-2">
        {shown.map((t, i) => card(t, i))}
        {empty && <li className="px-1 py-2 text-sm text-muted">{empty}</li>}
      </ul>

      {collapsible && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          aria-controls="token-list"
          className="mt-2 w-full rounded-xl border border-line bg-card py-2.5 text-sm font-semibold hover:border-muted md:hidden"
        >
          {expanded ? "Show less" : `Show all stocks (${shown.length})`}
        </button>
      )}
    </section>
  );
}
