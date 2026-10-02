import { NextResponse } from "next/server";
import { getTokens } from "@/lib/tokens";

// GET /api/tokens — runs on the server only.
// The browser calls this route; this route (via getTokens) is the only code
// that will ever talk to the Binance Web3 API with the secret key.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getTokens();
    return NextResponse.json(data);
  } catch (err) {
    console.error("Failed to load tokens", err);
    return NextResponse.json({ error: "Could not load token data." }, { status: 502 });
  }
}
