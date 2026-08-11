import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/auth";

const SESSION_COOKIE = "pb_session";

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // API: anything except the login endpoint needs a valid session cookie.
  if (path.startsWith("/api/")) {
    if (path !== "/api/login") {
      if (!(await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value))) {
        return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
      }
      return NextResponse.next();
    }
    return NextResponse.next();
  }

  // Pages: send unauthenticated visitors to the lock screen.
  if (path !== "/login" && !(await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value))) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/:path*",
    "/((?!login|_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest).*)",
  ],
};