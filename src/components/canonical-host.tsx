"use client";

import { useEffect } from "react";

/**
 * Force the canonical host `127.0.0.1`.
 *
 * The Spotify OAuth `redirect_uri` is pinned to `127.0.0.1`, so Auth.js sets
 * the session cookie on that host. If the browser is on `localhost` instead,
 * that cookie is never sent — the user appears logged out and bounces back to
 * `/login` right after a successful login.
 *
 * This must run client-side: a `proxy.ts` (ex-middleware) redirect cannot do
 * it — Next normalises a localhost↔127.0.0.1 redirect Location to a relative
 * path, so the browser never actually switches host (and loops). A raw
 * `<script>` tag in the layout does not run either (React 19 ignores script
 * tags rendered by components). A client component effect does work — this is
 * the same trick `SpotifyLoginButton` already relies on, lifted app-wide.
 */
export function CanonicalHost() {
  useEffect(() => {
    if (window.location.hostname === "localhost") {
      window.location.replace(
        window.location.href.replace("//localhost", "//127.0.0.1"),
      );
    }
  }, []);

  return null;
}
