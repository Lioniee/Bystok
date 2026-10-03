import "server-only";

import { NextResponse } from "next/server";
import { BinanceWeb3Error } from "./binance-web3";
import { isMarketClosed } from "./trade";
import type { ApiResult } from "./types";

// Shared JSON helpers for the buy-flow routes. Errors are returned with a plain
// message; the secret and raw request details never reach the browser.

export function ok<T>(data: T) {
  return NextResponse.json<ApiResult<T>>({ ok: true, data });
}

export function fail(error: string, status = 400) {
  return NextResponse.json<ApiResult<never>>({ ok: false, error }, { status });
}

export function fromError(err: unknown) {
  if (isMarketClosed(err)) {
    return NextResponse.json<ApiResult<never>>(
      { ok: false, error: `Market closed: ${(err as Error).message}`, marketClosed: true },
      { status: 200 },
    );
  }
  if (err instanceof BinanceWeb3Error) {
    console.error(`Binance Web3 API error ${err.code}:`, err.apiMessage);
    return fail(err.message, 502);
  }
  console.error("Buy-flow route failed:", err instanceof Error ? err.message : err);
  return fail("Something went wrong. Please try again.", 500);
}
