import { createConfig, http } from "wagmi";
import { bsc } from "wagmi/chains";
import { injected } from "wagmi/connectors/injected";
import { walletConnect } from "wagmi/connectors/walletConnect";

// Wallet connection for BNB Chain only. Injected browser wallets (Binance Web3
// Wallet extension, MetaMask, …) are found automatically via EIP-6963; the plain
// `injected()` connector is a fallback for wallets that don't announce themselves.
// WalletConnect (QR code / mobile wallet apps) is added only when a project ID
// is configured. Bystok never sees a private key: the wallet signs everything.

const walletConnectProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

// WalletConnect shows this to the user in their wallet app; `url` should be the
// site they are actually on.
const siteUrl =
  typeof window !== "undefined" ? window.location.origin : (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000");

export const wagmiConfig = createConfig({
  chains: [bsc],
  connectors: [
    injected(),
    ...(walletConnectProjectId
      ? [
          walletConnect({
            projectId: walletConnectProjectId,
            metadata: {
              name: "Bystok",
              description: "Know it, then buy it. Tokenized-stock scanner for BNB Chain.",
              url: siteUrl,
              icons: [`${siteUrl}/logo.png`],
            },
            showQrModal: true,
          }),
        ]
      : []),
  ],
  transports: { [bsc.id]: http() },
  ssr: true,
});

export const BSC_CHAIN_ID = bsc.id; // 56

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
