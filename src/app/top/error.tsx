"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import Link from "next/link";

/**
 * Error boundary for the whole `/top/*` subtree. The top pages call the
 * Spotify Top Read API, which can throw on network failure, an expired token
 * (401) or rate limiting (429). This catches those instead of surfacing a raw
 * 500 and lets the user retry — `unstable_retry` re-fetches the segment.
 */
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[/top] render error:", error);
  }, [error]);

  return (
    <main id="main" className="flex-1 flex items-center justify-center px-6 py-12">
      <div className="flex max-w-md flex-col items-center rounded-2xl border bg-card px-6 py-12 text-center">
        <h1 className="text-xl font-semibold">Oups, un souci côté stats</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Impossible de récupérer tes statistiques Spotify pour le moment.
          C&apos;est peut-être temporaire — réessaie dans un instant.
        </p>
        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={() => unstable_retry()}
            className="rounded-full bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Réessayer
          </button>
          <Link
            href="/dashboard"
            className="rounded-full border px-4 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground"
          >
            Retour au tableau de bord
          </Link>
        </div>
      </div>
    </main>
  );
}
