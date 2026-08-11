import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, makeSessionToken, matchesPin, pinConfigured } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!pinConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Access PIN not configured on the server" },
      { status: 503 },
    );
  }
  let body: { pin?: string };
  try {
    body = (await request.json()) as { pin?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "missing PIN" }, { status: 400 });
  }
  if (!matchesPin(String(body.pin ?? ""))) {
    return NextResponse.json({ ok: false, error: "Incorrect PIN" }, { status: 401 });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, await makeSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}