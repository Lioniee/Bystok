import { pct } from "@/lib/format";

// 24h price change, colour plus an arrow so it never relies on colour alone.
export default function PriceChange({ pctValue }: { pctValue: number }) {
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
