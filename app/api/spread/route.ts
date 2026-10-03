import type { NextRequest } from "next/server";
import { isAddress } from "viem";
import { fail, fromError, ok } from "@/lib/api-result";
import { isRwaToken } from "@/lib/tokens";
import { sampleSpread } from "@/lib/trade";

// GET /api/spread?token=0x…&wallet=0x… — bid/ask from a $100 round-trip quote
// made on behalf of a connected wallet. Ondo (RFQ) tokens only quote with a wallet.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const wallet = req.nextUrl.searchParams.get("wallet") ?? "";
  if (!isAddress(wallet)) return fail("Invalid wallet address.");
  if (!isAddress(token)) return fail("Invalid token address.");
  try {
    if (!(await isRwaToken(token))) return fail("Unknown token.");
    return ok(await sampleSpread(token, wallet));
  } catch (err) {
    return fromError(err);
  }
}
