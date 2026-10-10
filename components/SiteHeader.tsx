import Image from "next/image";
import Link from "next/link";

// Logo, name and tagline (links home), a Docs link, and optional extras on the
// right (e.g. the wallet button). The home page renders the name as its <h1>;
// other pages have their own <h1>.
export default function SiteHeader({
  children,
  current,
  brandAs: Brand = "p",
}: {
  children?: React.ReactNode;
  current?: "docs";
  brandAs?: "h1" | "p";
}) {
  return (
    <header className="flex items-center justify-between gap-3 py-5">
      <Link href="/" className="flex min-w-0 items-center gap-3">
        <Image src="/logo.png" alt="Bystok" width={40} height={40} loading="eager" className="size-10 shrink-0 rounded-xl" />
        <div className="min-w-0">
          <Brand className="text-xl font-bold leading-tight">Bystok</Brand>
          <p className="text-sm text-muted max-[380px]:hidden">Know it, then buy it.</p>
        </div>
      </Link>
      <nav aria-label="Site" className="flex shrink-0 items-center gap-2">
        <Link
          href="/docs"
          aria-current={current === "docs" ? "page" : undefined}
          className={`rounded-full px-2.5 py-1.5 text-sm font-medium hover:text-fg ${
            current === "docs" ? "text-fg underline decoration-brand decoration-2 underline-offset-4" : "text-muted"
          }`}
        >
          Docs
        </Link>
        {children}
      </nav>
    </header>
  );
}
