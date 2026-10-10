import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "MyStoks · Bystok" };

// Placeholder: holdings will show here once buying is built.
export default function MyStoksPage() {
  return (
    <div className="mx-auto grid max-w-lg gap-4">
      <h1 className="text-2xl font-bold">MyStoks</h1>
      <div className="rounded-2xl border border-dashed border-line bg-card p-8 text-center">
        <p className="font-semibold">Your tokenized stocks will show here.</p>
        <p className="mt-2 text-sm text-muted">Buying is coming next. Until then, scan a stock and add it to your watchlist.</p>
        <Link
          href="/"
          className="mt-4 inline-block rounded-xl bg-brand px-4 py-2 text-sm font-bold text-brand-fg hover:brightness-95"
        >
          Go to Scan
        </Link>
      </div>
    </div>
  );
}
