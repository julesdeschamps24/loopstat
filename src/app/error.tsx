"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import Link from "next/link";

/**
 * Catch-all error boundary for every route without a more specific one
 * (`/top/*` has its own). Server components like the dashboard and the import
 * page call the Spotify API and the database, which can throw on network
 * failure, an expired token (401) or a DB hiccup. This catches those instead
 * of surfacing a raw 500 and lets the user retry - `unstable_retry` re-fetches
 * the segment.
 */
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[app] render error:", error);
  }, [error]);

  return (
    <main id="main" className="flex-1 flex items-center justify-center px-6 py-12">
      <div className="flex max-w-md flex-col items-center rounded-2xl border bg-card px-6 py-12 text-center">
        <h1 className="text-xl font-semibold">Une erreur est survenue</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Quelque chose s&apos;est mal passé en chargeant cette page. C&apos;est
          peut-être temporaire - réessaie dans un instant.
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
