import type { TokenizedStock } from "./types";
import { compactUsd, pct } from "./format";
import { formatCountdown, type MarketClock } from "./market-hours";

// The "scanner brain": turns raw numbers into plain-English checks.
// Thresholds live here so they are easy to tune in one place.

export type Level = "good" | "caution" | "bad";

export type Check = {
  label: string;
  value: string;
  level: Level;
  hint: string; // one beginner-friendly sentence
  detail?: string; // optional extra line, e.g. a countdown
};

export type Analysis = {
  spreadPct: number | null; // null when no quote was possible
  deviationPct: number;
  checks: {
    liquidity: Check;
    spread: Check;
    deviation: Check;
    market: Check;
  };
  verdict: { level: Level; title: string; text: string };
  risks: string[];
};

const THRESHOLDS = {
  liquidityGood: 1_000_000,
  liquidityOk: 250_000,
  spreadGood: 0.3, // %
  spreadOk: 1, // %
  deviationGood: 0.5, // % (absolute)
  deviationOk: 1.5, // % (absolute)
};

// `clock` is the live US market clock (see market-hours.ts), shared by every token.
export function analyze(t: TokenizedStock, clock: MarketClock): Analysis {
  const spreadPct = t.bid !== null && t.ask !== null ? ((t.ask - t.bid) / ((t.bid + t.ask) / 2)) * 100 : null;
  const deviationPct = ((t.tokenPrice - t.underlying.price) / t.underlying.price) * 100;
  const absDev = Math.abs(deviationPct);

  // Missing data is a "caution", not a pass: we can't vouch for what we can't measure.
  const liquidity: Check =
    t.liquidityUsd === null
      ? {
          label: "Liquidity",
          value: "Unavailable",
          level: "caution",
          hint: "This token is sold by market makers that don't publish pool sizes, so we can't measure it.",
        }
      : {
          label: "Liquidity",
          value: compactUsd(t.liquidityUsd),
          level:
            t.liquidityUsd >= THRESHOLDS.liquidityGood
              ? "good"
              : t.liquidityUsd >= THRESHOLDS.liquidityOk
                ? "caution"
                : "bad",
          hint: "How much money is in the pool. More liquidity means your order moves the price less.",
        };

  const spread: Check =
    spreadPct === null
      ? {
          label: "Spread",
          value: "Unavailable",
          level: "caution",
          hint: "We couldn't get a buy and sell quote, so the gap is unknown. Key risks below says why.",
        }
      : {
          label: "Spread",
          value: pct(spreadPct),
          level:
            spreadPct <= THRESHOLDS.spreadGood ? "good" : spreadPct <= THRESHOLDS.spreadOk ? "caution" : "bad",
          hint: "Gap between the buy and sell price on a $100 round trip. It is a hidden cost you pay every time.",
        };

  // An exact match is suspicious rather than reassuring: the issuer may simply be
  // reporting the last reference price instead of a live token price.
  const pegged = t.tokenPrice === t.underlying.price;
  const deviation: Check = pegged
    ? {
        label: "Price deviation",
        value: pct(deviationPct, true),
        level: "caution",
        hint:
          "Token price matches the last reference price exactly; it may be pegged rather than live." +
          (clock.isOpen ? "" : " The market is closed, so neither price may be updating."),
      }
    : {
        label: "Price deviation",
        value: pct(deviationPct, true),
        level:
          absDev <= THRESHOLDS.deviationGood ? "good" : absDev <= THRESHOLDS.deviationOk ? "caution" : "bad",
        hint: "How far the token price is from the real stock price. Close to 0% is what you want.",
      };

  const countdown = formatCountdown(clock.msUntilChange);
  const market: Check = {
    label: "Market status",
    value: clock.isOpen ? "Open" : "Closed",
    level: clock.isOpen ? "good" : "caution",
    hint: clock.isOpen
      ? "The real stock is trading now, so the token price can stay in line with it."
      : "The real stock isn't trading, so the token price can drift until the market reopens.",
    detail: clock.isOpen ? `Closes in ${countdown}` : `Opens in ${countdown}`,
  };

  const checks = { liquidity, spread, deviation, market };
  const levels = Object.values(checks).map((c) => c.level);

  const verdict: Analysis["verdict"] = levels.includes("bad")
    ? { level: "bad", title: "High risk", text: "One or more checks failed. Read the risks before buying." }
    : levels.includes("caution")
      ? { level: "caution", title: "Proceed with care", text: "Mostly fine, but a few things are worth knowing." }
      : { level: "good", title: "Looks healthy", text: "Good liquidity, tight spread and a fair price." };

  // Risks generated from the numbers come first, then the issuer's own list.
  const risks: string[] = [];
  if (t.liquidityUsd !== null && liquidity.level !== "good")
    risks.push(`Liquidity is only ${liquidity.value}. Large orders may move the price against you.`);
  if (spreadPct !== null && spread.level !== "good")
    risks.push(`The spread is ${spread.value}. Buying then selling right away would lose about that much.`);
  if (pegged)
    risks.push(
      "The token price matches the last reference price exactly, so it may be pegged rather than live. The price you actually get could differ.",
    );
  else if (deviation.level !== "good")
    risks.push(
      deviationPct > 0
        ? `The token costs ${pct(absDev)} more than the real stock. You'd be paying a premium.`
        : `The token is ${pct(absDev)} cheaper than the real stock. A discount can signal low demand or a problem.`,
    );
  if (market.level !== "good")
    risks.push("The US stock market is closed. Prices can jump when trading resumes.");
  risks.push(...t.warnings, ...t.risks);

  return { spreadPct, deviationPct, checks, verdict, risks };
}
