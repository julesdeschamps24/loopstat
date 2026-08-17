import * as Sentry from "@sentry/nextjs";

// Sentry côté navigateur — no-op si NEXT_PUBLIC_SENTRY_DSN absent.
// (Le DSN est une clé PUBLIQUE d'ingestion, pas un secret.)
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
