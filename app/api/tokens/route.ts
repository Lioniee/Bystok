import { NextResponse, type NextRequest } from "next/server";
import { NO_STORE } from "@/lib/api-result";
import { getTokens } from "@/lib/tokens";

// GET /api/tokens[?q=apple] — runs on the server only.
// The browser calls this route; this route (via getTokens) is the only code
// that talks to the Binance Web3 API with the secret key.
// Runs on every request (never prerendered at build time); freshness comes from
// the 30-second server cache, and responses are marked no-store.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.slice(0, 40) ?? undefined;
  try {
    const data = await getTokens(q);
    return NextResponse.json(data, { headers: NO_STORE });
  } catch (err) {
    console.error("Failed to load tokens", err);
    return NextResponse.json({ error: "Could not load token data." }, { status: 502, headers: NO_STORE });
  }
}
