import type { NextRequest } from "next/server";
import { isAddress } from "viem";
import { fail, fromError, ok } from "@/lib/api-result";
import { getHoldings } from "@/lib/portfolio";

// GET /api/holdings?address=0x… — the wallet's tokenized stocks on BNB Chain,
// with value and (where the API's trade history allows) profit/loss. Read-only.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address") ?? "";
  if (!isAddress(address, { strict: false })) return fail("Invalid wallet address.");
  try {
    return ok(await getHoldings(address));
  } catch (err) {
    return fromError(err);
  }
}
