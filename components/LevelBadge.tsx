import type { Level } from "@/lib/analysis";

// Colors + text labels for good / caution / bad, so status is never color-only.
export const LEVEL_STYLES: Record<Level, { pill: string; dot: string; label: string }> = {
  good: {
    pill: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    dot: "bg-emerald-500",
    label: "Good",
  },
  caution: {
    pill: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    dot: "bg-amber-500",
    label: "Caution",
  },
  bad: {
    pill: "bg-red-500/10 text-red-700 dark:text-red-400",
    dot: "bg-red-500",
    label: "Risky",
  },
};

export default function LevelBadge({ level, text }: { level: Level; text?: string }) {
  const s = LEVEL_STYLES[level];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.pill}`}>
      <span className={`size-1.5 rounded-full ${s.dot}`} />
      {text ?? s.label}
    </span>
  );
}
