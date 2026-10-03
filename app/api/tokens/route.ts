import { NextResponse, type NextRequest } from "next/server";
import { getTokens } from "@/lib/tokens";

// GET /api/tokens[?q=apple] — runs on the server only.
// The browser calls this route; this route (via getTokens) is the only code
// that talks to the Binance Web3 API with the secret key.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.slice(0, 40) ?? undefined;
  try {
    const data = await getTokens(q);
    return NextResponse.json(data);
  } catch (err) {
    console.error("Failed to load tokens", err);
    return NextResponse.json({ error: "Could not load token data." }, { status: 502 });
  }
}
