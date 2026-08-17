import * as Sentry from "@sentry/nextjs";

/**
 * Hook de boot Next.js — s'exécute UNE fois au démarrage du serveur
 * (jamais pendant `next build`). Fail fast sur une config invalide,
 * puis initialise Sentry (no-op si SENTRY_DSN absent).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateServerEnv } = await import("@/lib/env");
    validateServerEnv();

    if (process.env.SENTRY_DSN) {
      Sentry.init({
        dsn: process.env.SENTRY_DSN,
        tracesSampleRate: 0.1,
        environment: process.env.NODE_ENV,
      });
    }
  }
}

/** Capture les erreurs des Server Components / Actions / Route Handlers. */
export const onRequestError = Sentry.captureRequestError;
