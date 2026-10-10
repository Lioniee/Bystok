import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-line py-6 text-xs text-muted">
      <p>Bystok is an educational scanner, not financial advice. Always do your own research.</p>
      <nav aria-label="Footer" className="flex gap-4">
        <Link href="/" className="hover:text-fg">
          Scanner
        </Link>
        <Link href="/docs" className="hover:text-fg">
          Docs
        </Link>
      </nav>
    </footer>
  );
}
