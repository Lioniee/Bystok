import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { BottomTabs } from "@/components/AppNav";
import Providers from "@/components/Providers";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import "./globals.css";

const title = "Bystok — Know it, then buy it.";
const description = "Scan tokenized stocks on BNB Chain before you buy: liquidity, spread, price deviation and risks.";

// Link previews need absolute image URLs. Set NEXT_PUBLIC_SITE_URL to the live
// address; on Vercel the production URL is used automatically.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

const ogImage = { url: "/og-image.png", width: 1200, height: 630, alt: "Bystok - Know it, then buy it." };

// The favicon (app/icon.png) and Apple touch icon (app/apple-icon.png) are
// picked up from the app folder automatically.
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  openGraph: {
    type: "website",
    siteName: "Bystok",
    title,
    description,
    url: "/",
    images: [ogImage],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [ogImage],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fdcb14",
  // Lets the phone bottom bar sit above the home indicator (safe-area insets).
  viewportFit: "cover",
};

// Browser extensions (MetaMask, wallets, etc.) inject their own scripts into every
// page, and their failures show up as if they were ours. This runs before Next.js'
// own handlers and drops only errors whose stack points into an extension.
// Applies the saved theme (or the system setting) before the first paint, so
// the page never flashes the wrong theme. ThemeToggle changes it afterwards.
const applyTheme = `
(function () {
  var t;
  try { t = localStorage.getItem("bystok:theme"); } catch (e) {}
  if (t !== "light" && t !== "dark") t = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", t);
})();
`;

const ignoreExtensionErrors = `
(function () {
  var EXT = /(chrome|moz|safari-web)-extension:\\/\\//;
  function fromExtension(err) { return !!err && EXT.test(String(err.stack || "")); }
  function drop(e) { e.preventDefault(); e.stopImmediatePropagation(); }
  window.addEventListener("unhandledrejection", function (e) {
    if (fromExtension(e.reason)) drop(e);
  }, true);
  window.addEventListener("error", function (e) {
    if (EXT.test(e.filename || "") || fromExtension(e.error)) drop(e);
  }, true);
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: extensions like Grammarly add attributes to <html>/<body>
    // before React loads. This only silences attribute mismatches on these two tags.
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* A plain inline script (not next/script, which defers it) so it runs
            while the page is parsed, before anything is painted. */}
        <script dangerouslySetInnerHTML={{ __html: applyTheme }} />
      </head>
      <body className="min-h-dvh font-sans antialiased" suppressHydrationWarning>
        <Script id="ignore-extension-errors" strategy="beforeInteractive">
          {ignoreExtensionErrors}
        </Script>
        <Providers>
          {/* On phones, bottom padding keeps content clear of the fixed tab bar. */}
          <div className="mx-auto flex min-h-dvh max-w-6xl flex-col px-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))] sm:px-6 md:pb-0 xl:max-w-7xl">
            <SiteHeader />
            <main className="flex-1 pb-10">{children}</main>
            <SiteFooter />
          </div>
          <BottomTabs />
        </Providers>
      </body>
    </html>
  );
}
