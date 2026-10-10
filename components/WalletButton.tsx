"use client";

import { useEffect, useRef, useState } from "react";
import { useConnect, useConnection, useConnectors, useDisconnect, useSwitchChain } from "wagmi";
import { BSC_CHAIN_ID } from "@/lib/wagmi";

export const shortAddress = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

// WalletConnect's blue square with its "bridge" mark (drawn here, not copied).
function WalletConnectIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-6 shrink-0 rounded" aria-hidden>
      <rect width="24" height="24" rx="6" fill="#3B99FC" />
      <path d="M6.5 10.2c3-2.9 8-2.9 11 0" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" />
      <path
        d="M4.6 12.6l3.3 3.2 4.1-3.9 4.1 3.9 3.3-3.2"
        fill="none"
        stroke="#fff"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Phones and tablets (including iPads, which report a desktop user agent).
function isMobileBrowser() {
  const nav = navigator as Navigator & { userAgentData?: { mobile?: boolean } };
  if (nav.userAgentData?.mobile) return true;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(nav.userAgent) || (nav.platform === "MacIntel" && nav.maxTouchPoints > 1);
}

// MetaMask universal link: opens this exact page in MetaMask's in-app browser
// (or the app store if MetaMask isn't installed). It takes host + path, no protocol.
function metaMaskDappLink() {
  const { host, pathname, search } = window.location;
  return `https://metamask.app.link/dapp/${host}${pathname}${search}`;
}

const pill = "rounded-full border border-line bg-card px-3 py-1.5 text-sm font-medium";

// Connect / switch network / disconnect. Only injected browser wallets.
export default function WalletButton() {
  const { address, chainId, status } = useConnection();
  const connectors = useConnectors();
  const connect = useConnect();
  const disconnect = useDisconnect();
  const switchChain = useSwitchChain();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Wallet state only exists in the browser; render a stable placeholder on the server.
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  if (!mounted || status === "reconnecting" || status === "connecting") {
    return (
      <span className={`${pill} text-muted`} aria-live="polite">
        {mounted && status === "connecting" ? "Check your wallet…" : "Wallet"}
      </span>
    );
  }

  if (address) {
    const wrongNetwork = chainId !== BSC_CHAIN_ID;
    return (
      <div className="flex items-center gap-2">
        {wrongNetwork ? (
          <button
            type="button"
            onClick={() => switchChain.mutate({ chainId: BSC_CHAIN_ID })}
            disabled={switchChain.isPending}
            className="rounded-full bg-amber-500 px-3 py-1.5 text-sm font-bold text-black disabled:opacity-60"
          >
            {switchChain.isPending ? "Confirm in wallet…" : "Switch to BNB Chain"}
          </button>
        ) : (
          <span className={`${pill} flex items-center gap-2 whitespace-nowrap tabular-nums`} title={address}>
            <span className="size-2 rounded-full bg-emerald-500" aria-hidden />
            {shortAddress(address)}
          </span>
        )}
        <button
          type="button"
          onClick={() => disconnect.mutate()}
          aria-label="Disconnect wallet"
          className="rounded-full px-2 py-1.5 text-sm text-muted underline-offset-2 hover:underline"
        >
          <span aria-hidden className="sm:hidden">✕</span>
          <span className="hidden sm:inline">Disconnect</span>
        </button>
      </div>
    );
  }

  // Wallets that announce themselves (EIP-6963) have their own names; hide the
  // generic "Injected" fallback when at least one of those is present.
  const injectedConnectors = connectors.filter((c) => c.type === "injected");
  const named = injectedConnectors.filter((c) => c.id !== "injected");
  const hasInjected = named.length > 0 || "ethereum" in window;
  const installed = hasInjected ? (named.length > 0 ? named : injectedConnectors) : [];
  // Only present when NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is set (see lib/wagmi.ts).
  const walletConnector = connectors.find((c) => c.type === "walletConnect");
  const connectWith = (c: (typeof connectors)[number]) =>
    connect.mutate({ connector: c, chainId: BSC_CHAIN_ID }, { onSuccess: () => setOpen(false) });
  // A normal phone browser has no injected wallet: offer to reopen the page
  // inside MetaMask's in-app browser instead.
  const showMobileHelp = !hasInjected && isMobileBrowser();

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="rounded-full bg-brand px-4 py-1.5 text-sm font-bold text-brand-fg hover:brightness-95"
      >
        Connect wallet
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-2 w-72 rounded-xl border border-line bg-card p-2 shadow-lg">
          {installed.length > 0 && (
            <>
              <p className="px-2 pb-1 pt-1 text-xs font-bold uppercase tracking-wide text-muted">Installed</p>
              <ul className="grid gap-1">
                {installed.map((c) => (
                  <li key={c.uid}>
                    <button
                      type="button"
                      onClick={() => connectWith(c)}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-bg"
                    >
                      {c.icon ? (
                        <img src={c.icon} alt="" className="size-6 rounded" />
                      ) : (
                        <span className="size-6 rounded bg-line" aria-hidden />
                      )}
                      {c.id === "injected" ? "Browser wallet" : c.name}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          {walletConnector && (
            <div className={installed.length > 0 ? "mt-1 border-t border-line pt-1" : ""}>
              <button
                type="button"
                onClick={() => connectWith(walletConnector)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-bg"
              >
                <WalletConnectIcon />
                <span className="min-w-0">
                  <span className="block font-medium">Other wallets</span>
                  <span className="block text-xs text-muted">(MetaMask mobile, Trust, Binance Wallet, OKX...)</span>
                </span>
              </button>
            </div>
          )}
          {showMobileHelp ? (
            <div className="grid gap-2 p-2">
              <a
                href={metaMaskDappLink()}
                className="rounded-lg bg-brand px-3 py-2 text-center text-sm font-bold text-brand-fg hover:brightness-95"
              >
                Open in MetaMask
              </a>
              <p className="text-xs text-muted">Or open this page inside your wallet app’s browser.</p>
            </div>
          ) : (
            !hasInjected && (
              <p className="p-2 text-sm">
                No browser wallet found. Install the Binance Web3 Wallet extension or MetaMask, then reload.
              </p>
            )
          )}
          {connect.error && (
            <p role="alert" className="mt-1 p-2 text-xs text-red-600 dark:text-red-400">
              {connect.error.name === "UserRejectedRequestError"
                ? "Connection cancelled in the wallet."
                : connect.error.message.split("\n")[0]}
            </p>
          )}
          <p className="mt-1 border-t border-line p-2 text-xs text-muted">
            Bystok never sees your keys. Your wallet signs everything.
          </p>
        </div>
      )}
    </div>
  );
}
