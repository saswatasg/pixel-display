import { NextResponse } from "next/server";
import { fetchBridgeStatus } from "@/lib/bridge-server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await fetchBridgeStatus());
  } catch {
    return NextResponse.json(
      { bridgeOnline: false, configured: false, reason: "status unavailable", fetchedAt: Date.now() },
      { status: 500 },
    );
  }
}
