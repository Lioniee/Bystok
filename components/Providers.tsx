"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "@/lib/wagmi";
import { SelectedTokenProvider } from "./SelectedToken";

// Wallet, data-fetching and selected-stock context for the whole app.
export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <SelectedTokenProvider>{children}</SelectedTokenProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
