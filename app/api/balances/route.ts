import type { NextRequest } from "next/server";
import { isAddress } from "viem";
import { fail, fromError, ok } from "@/lib/api-result";
import { getBalances } from "@/lib/trade";

// GET /api/balances?address=0x… — the wallet's USDT and BNB on BNB Chain.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address") ?? "";
  if (!isAddress(address)) return fail("Invalid wallet address.");
  try {
    return ok(await getBalances(address));
  } catch (err) {
    return fromError(err);
  }
}
