// "server-only" makes the build fail if this file is ever imported into
// browser code, so the API secret below can never leak to users.
import "server-only";

import { createHmac } from "node:crypto";

// Signed client for the Binance Web3 API.
//
// Every request carries three headers:
//   X-OC-APIKEY     the API key
//   X-OC-TIMESTAMP  ISO 8601 with milliseconds, e.g. 2026-10-03T06:49:09.123Z
//   X-OC-SIGN       Base64(HMAC-SHA256(timestamp + METHOD + requestPath + body, secret))
// requestPath includes the /build prefix and the raw, already-encoded query string.
// body is "" for GET.
//
// The default receive window rejects timestamps only ~3s old, which a slightly
// slow clock plus network latency can exceed, so we send X-OC-RECV-WINDOW: 60000
// (tested: accepts ±30s). It is not part of the signature.

const RECV_WINDOW_MS = "60000";

// Calls slower than this are logged (path only, never keys or bodies).
const SLOW_CALL_MS = 1500;

const ORIGIN = "https://web3.binance.com";
const PREFIX = "/build";

// Error codes worth explaining in plain words.
const ERROR_MESSAGES: Record<string, string> = {
  // Codes confirmed by test calls: 40101 bad key, 40102 bad signature, 40103 stale timestamp.
  "40101": "API key missing or not recognised — check BINANCE_WEB3_API_KEY.",
  "40102": "Signature did not match — check BINANCE_WEB3_API_SECRET.",
  "40103": "Request timestamp is outside the allowed window — check the server clock.",
  "40104": "This API key is not allowed to call this endpoint.",
  "42900": "Rate limit hit (5 requests per second per endpoint). Try again shortly.",
};

// Market-hours errors from the Trading API. The API's own message says when the
// market reopens (e.g. "Expected to open in 1d 16h 29m"), so it is kept as-is.
export const MARKET_CLOSED_CODES = ["40367", "40369"]; // Ondo, BStock

export class BinanceWeb3Error extends Error {
  constructor(
    public code: string,
    public status: number,
    public apiMessage: string,
  ) {
    super(ERROR_MESSAGES[code] ?? (apiMessage || `Binance Web3 API error ${code} (HTTP ${status})`));
    this.name = "BinanceWeb3Error";
  }
}

export function hasCredentials() {
  return Boolean(process.env.BINANCE_WEB3_API_KEY && process.env.BINANCE_WEB3_API_SECRET);
}

export function sign(timestamp: string, method: string, requestPath: string, body: string, secret: string) {
  return createHmac("sha256", secret).update(timestamp + method + requestPath + body).digest("base64");
}

type Query = Record<string, string | number | boolean | undefined>;

function toQueryString(query?: Query) {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined) params.append(k, String(v));
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

// --- Server-side cache -------------------------------------------------------
// Successful responses are kept for `ttlMs` (30s by default). Identical calls
// made while one is already in flight share the same promise.

const DEFAULT_TTL_MS = 30_000;
const cache = new Map<string, { expires: number; value: Promise<unknown> }>();

// --- Rate limiting -----------------------------------------------------------
// The API allows 5 requests/second per endpoint, so calls to the same path are
// spaced at least 220ms apart. Different endpoints run in parallel.

const MIN_GAP_MS = 220;
const nextSlot = new Map<string, number>();

async function waitForSlot(path: string) {
  const now = Date.now();
  const slot = Math.max(now, nextSlot.get(path) ?? 0);
  nextSlot.set(path, slot + MIN_GAP_MS);
  if (slot > now) await new Promise((r) => setTimeout(r, slot - now));
}

type RequestOpts = { query?: Query; body?: unknown; ttlMs?: number };

// Cached call. `path` is relative to /build, e.g. "/api/v1/dex/market/rwa/tokens".
// Returns the `data` field of the response envelope.
export function web3Request<T = unknown>(method: "GET" | "POST", path: string, opts: RequestOpts = {}): Promise<T> {
  const requestPath = PREFIX + path + toQueryString(opts.query);
  const body = method === "GET" || opts.body === undefined ? "" : JSON.stringify(opts.body);
  const key = method + requestPath + body;

  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as Promise<T>;

  const value = send<T>(method, path, requestPath, body);
  cache.set(key, { expires: Date.now() + (opts.ttlMs ?? DEFAULT_TTL_MS), value });
  // A definite answer like "wallet required" or "market closed" is cached like a
  // success; auth, rate-limit, server and network failures are retried next time.
  value.catch((err) => {
    if (!isDefiniteAnswer(err)) cache.delete(key);
  });
  return value;
}

function isDefiniteAnswer(err: unknown) {
  return err instanceof BinanceWeb3Error && (err.code === "40001" || err.code.startsWith("403"));
}

async function send<T>(method: string, path: string, requestPath: string, body: string, retried = false): Promise<T> {
  const apiKey = process.env.BINANCE_WEB3_API_KEY;
  const secret = process.env.BINANCE_WEB3_API_SECRET;
  if (!apiKey || !secret) throw new BinanceWeb3Error("40101", 0, "Missing API credentials");

  await waitForSlot(path);
  const started = Date.now();
  const timestamp = new Date().toISOString();

  const res = await fetch(ORIGIN + requestPath, {
    method,
    headers: {
      "X-OC-APIKEY": apiKey,
      "X-OC-TIMESTAMP": timestamp,
      "X-OC-SIGN": sign(timestamp, method, requestPath, body, secret),
      "X-OC-RECV-WINDOW": RECV_WINDOW_MS,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body || undefined,
    cache: "no-store",
  });

  const text = await res.text();
  const took = Date.now() - started;
  if (took > SLOW_CALL_MS) console.warn(`Binance Web3 API slow call: ${method} ${path} took ${(took / 1000).toFixed(1)}s`);
  // Most endpoints answer { code, msg, data }; a wrong HTTP method gets a different
  // envelope: { status: "ERROR", code: "000002", errorData }.
  let json: { code?: string | number; msg?: string; message?: string; errorData?: string; data?: T } | undefined;
  try {
    json = JSON.parse(text);
  } catch {
    // non-JSON body (e.g. a CDN error page)
  }

  // Errors arrive either as an HTTP error (auth: 401) or as HTTP 200 with a non-zero `code`.
  const code = json?.code === undefined ? undefined : String(json.code);
  if (!res.ok || (code !== undefined && code !== "0")) {
    const err = new BinanceWeb3Error(code ?? String(res.status), res.status, json?.msg ?? json?.message ?? json?.errorData ?? text.slice(0, 200));
    // One retry for rate limits and stale timestamps (a fresh timestamp is signed on retry).
    if ((err.code === "42900" || err.code === "40103") && !retried) {
      await new Promise((r) => setTimeout(r, 1000));
      return send<T>(method, path, requestPath, body, true);
    }
    throw err;
  }
  return json?.data as T;
}
