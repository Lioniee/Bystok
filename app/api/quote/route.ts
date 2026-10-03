import type { NextRequest } from "next/server";
import { isAddress } from "viem";
import { fail, fromError, ok } from "@/lib/api-result";
import { isRwaToken } from "@/lib/tokens";
import { getBuyQuote } from "@/lib/trade";

// GET /api/quote?token=0x…&amount=100&wallet=0x… — a live quote for buying
// `token` with `amount` USDT. Quotes only; nothing is signed or sent.
export const dynamic = "force-dynamic";

const MAX_USDT = 1_000_000;

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const token = p.get("token") ?? "";
  const wallet = p.get("wallet") ?? "";
  const amount = Number(p.get("amount"));

  if (!isAddress(wallet)) return fail("Invalid wallet address.");
  if (!isAddress(token)) return fail("Invalid token address.");
  if (!(amount > 0 && amount <= MAX_USDT)) return fail(`Enter an amount between 0 and ${MAX_USDT.toLocaleString("en-US")} USDT.`);

  try {
    if (!(await isRwaToken(token))) return fail("Unknown token.");
    return ok(await getBuyQuote(token, amount, wallet));
  } catch (err) {
    return fromError(err);
  }
}
