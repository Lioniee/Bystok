import type { Metadata, Viewport } from "next";
import Script from "next/script";
import Providers from "@/components/Providers";
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
  themeColor: "#f0b90b",
};

// Browser extensions (MetaMask, wallets, etc.) inject their own scripts into every
// page, and their failures show up as if they were ours. This runs before Next.js'
// own handlers and drops only errors whose stack points into an extension.
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
      <body className="min-h-dvh font-sans antialiased" suppressHydrationWarning>
        <Script id="ignore-extension-errors" strategy="beforeInteractive">
          {ignoreExtensionErrors}
        </Script>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
