import { createConfig, http } from "wagmi";
import { bsc } from "wagmi/chains";
import { injected } from "wagmi/connectors/injected";

// Wallet connection for BNB Chain only. Injected browser wallets (Binance Web3
// Wallet extension, MetaMask, …) are found automatically via EIP-6963; the plain
// `injected()` connector is a fallback for wallets that don't announce themselves.
// Bystok never sees a private key: the wallet signs everything.
export const wagmiConfig = createConfig({
  chains: [bsc],
  connectors: [injected()],
  transports: { [bsc.id]: http() },
  ssr: true,
});

export const BSC_CHAIN_ID = bsc.id; // 56

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
