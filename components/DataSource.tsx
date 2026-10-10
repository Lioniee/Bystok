"use client";

import type { TokensResponse } from "@/lib/types";
import { useNow } from "./buy-hooks";

// Past this age the "updated" time is shown as a warning.
const STALE_AFTER_MS = 90_000;

// Says plainly whether the numbers are real. Sample data gets a loud label.
export default function DataSource({ data, refreshFailed }: { data: TokensResponse; refreshFailed: boolean }) {
  const now = useNow(true);
  if (data.source === "sample") {
    return (
      <div role="status" className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/15 p-3 text-xs">
        <p className="font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400">Sample data</p>
        <p className="mt-1">These are made-up numbers, not live prices. {data.notice}</p>
      </div>
    );
  }
  // Formatted in the browser, so it is in the viewer's own time zone (e.g. "2:01 PM WAT").
  const updated = new Date(data.updatedAt);
  const time = updated.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZoneName: "short" });
  const ageMin = Math.floor((now - updated.getTime()) / 60_000);
  const stale = refreshFailed || now - updated.getTime() > STALE_AFTER_MS;
  return (
    <p className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
      <span
        className={`rounded-full px-2 py-0.5 font-semibold ${
          stale
            ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
            : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
        }`}
      >
        {stale ? "Delayed" : "Live"}
      </span>
      <span>
        Binance Web3 API · updated <time dateTime={data.updatedAt}>{time}</time>
        {stale && (
          <span className="text-amber-700 dark:text-amber-400">
            {" "}
            ({ageMin < 1 ? "under a minute" : `${ageMin} min`} ago{refreshFailed ? ", couldn’t refresh, retrying" : ""})
          </span>
        )}
      </span>
    </p>
  );
}
