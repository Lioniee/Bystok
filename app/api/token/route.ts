import type { NextRequest } from "next/server";
import { isAddress } from "viem";
import { fail, fromError, ok } from "@/lib/api-result";
import { getTokenDetail, isRwaToken } from "@/lib/tokens";

// GET /api/token?address=0x…[&symbol=NFLXB] — full report data for one token:
// underlying profile, liquidity pools, spread quote, attestation. Fetched only
// for the token the viewer selects; every upstream call is cached for 30s.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address") ?? "";
  // Display name for tokens /rwa/tokens leaves out; never trusted for anything else.
  const symbol = req.nextUrl.searchParams.get("symbol")?.match(/^[A-Za-z0-9.]{1,16}$/)?.[0];
  if (!isAddress(address, { strict: false })) return fail("Invalid token address.");
  try {
    if (!(await isRwaToken(address))) return fail("Unknown token.", 404);
    const detail = await getTokenDetail(address, symbol);
    return detail ? ok(detail) : fail("Unknown token.", 404);
  } catch (err) {
    return fromError(err);
  }
}
