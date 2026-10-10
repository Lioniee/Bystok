import Image from "next/image";
import Link from "next/link";
import { DesktopTabs } from "./AppNav";
import ThemeToggle from "./ThemeToggle";
import WalletButton from "./WalletButton";

// Logo (links to Scan), the desktop tab bar, theme toggle and wallet button.
// On phones the tabs move to the bottom bar (see AppNav).
export default function SiteHeader() {
  return (
    <header className="flex items-center justify-between gap-3 py-4">
      <div className="flex min-w-0 items-center gap-4 lg:gap-6">
        <Link href="/" className="flex min-w-0 shrink-0 items-center gap-3">
          <Image src="/logo.png" alt="Bystok" width={40} height={40} loading="eager" className="size-10 shrink-0 rounded-xl" />
          <div className="min-w-0">
            <p className="text-xl font-bold leading-tight">Bystok</p>
            <p className="hidden text-sm text-muted lg:block">Know it, then buy it.</p>
          </div>
        </Link>
        <DesktopTabs />
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <ThemeToggle />
        <span className="hidden rounded-full border border-line bg-card px-3 py-1 text-xs font-medium text-muted xl:inline">
          BNB Chain
        </span>
        <WalletButton />
      </div>
    </header>
  );
}
