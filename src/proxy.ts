import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Force the canonical host `127.0.0.1`.
 *
 * The Spotify OAuth `redirect_uri` is pinned to `127.0.0.1`, so Auth.js sets
 * the session cookie on that host. If the browser is on `localhost` instead,
 * that cookie is never sent — the user appears logged out and bounces back to
 * `/login` right after a successful login. Redirecting here, server-side on
 * every request, guarantees the app only ever runs on a single origin.
 *
 * (This replaces an inline `<script>` in the root layout that no longer runs:
 * React 19 does not execute script tags rendered by components.)
 */
export function proxy(request: NextRequest) {
  if (request.nextUrl.hostname === "localhost") {
    const url = request.nextUrl.clone();
    url.hostname = "127.0.0.1";
    return NextResponse.redirect(url, 308);
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/:path*",
};
