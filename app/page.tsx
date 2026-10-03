import Scanner from "@/components/Scanner";
import WalletButton from "@/components/WalletButton";

export default function Home() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col px-4 sm:px-6">
      <header className="flex items-center justify-between gap-4 py-5">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-xl bg-brand text-lg font-black text-brand-fg">
            B
          </div>
          <div>
            <h1 className="text-xl font-bold leading-tight">Bystok</h1>
            <p className="text-sm text-muted">Know it, then buy it.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden rounded-full border border-line bg-card px-3 py-1 text-xs font-medium text-muted sm:inline">
            BNB Chain
          </span>
          <WalletButton />
        </div>
      </header>

      <main className="flex-1 pb-10">
        <Scanner />
      </main>

      <footer className="border-t border-line py-6 text-xs text-muted">
        Bystok is an educational scanner, not financial advice. Always do your own research.
      </footer>
    </div>
  );
}
