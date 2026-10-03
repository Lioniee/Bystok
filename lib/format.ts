// Small number-formatting helpers shared by the UI and the analysis.

const usdFormatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const compactFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 2,
});

export const usd = (n: number) => usdFormatter.format(n);
export const compactUsd = (n: number) => compactFormatter.format(n);

export function pct(n: number, signed = false) {
  if (Math.abs(n) < 0.005) n = 0; // avoid "-0.00%"
  const s = `${n.toFixed(2)}%`;
  return signed && n > 0 ? `+${s}` : s;
}
