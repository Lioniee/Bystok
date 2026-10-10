import Scanner from "@/components/Scanner";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import WalletButton from "@/components/WalletButton";

export default function Home() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl xl:max-w-7xl flex-col px-4 sm:px-6">
      <SiteHeader brandAs="h1">
        <span className="hidden rounded-full border border-line bg-card px-3 py-1 text-xs font-medium text-muted sm:inline">
          BNB Chain
        </span>
        <WalletButton />
      </SiteHeader>

      <main className="flex-1 pb-10">
        <Scanner />
      </main>

      <SiteFooter />
    </div>
  );
}
