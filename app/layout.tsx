import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bystok — Know it, then buy it.",
  description: "Scan tokenized stocks on BNB Chain before you buy: liquidity, spread, price deviation and risks.",
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
        {children}
      </body>
    </html>
  );
}
