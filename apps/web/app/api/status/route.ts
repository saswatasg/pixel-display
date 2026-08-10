import { NextResponse } from "next/server";
import { fetchBridgeStatus } from "@/lib/bridge-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const status = await fetchBridgeStatus();
  return NextResponse.json(status);
}
