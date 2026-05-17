import Link from "next/link";

import { auth } from "@/auth";
import { PricingToggle } from "@/app/pricing/pricing-toggle";
import { getBillingState } from "@/db/queries/billing";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const session = await auth();
  const state = session?.user?.id
    ? await getBillingState(session.user.id)
    : { tier: "free" as const };

  const isPremium = state.tier !== "free";

  return (
    <main id="main" className="flex-1 flex flex-col px-6 py-16 max-w-3xl mx-auto w-full">
      <header className="mb-12 text-center">
        <h1 className="font-serif text-4xl sm:text-5xl">
          Soutiens loopstat, débloque les bonus.
        </h1>
        <p className="mt-4 text-base text-muted-foreground">
          Sans engagement. Annule en 1 click. Apple Pay accepté.
        </p>
      </header>

      <PricingToggle
        isAuthenticated={Boolean(session?.user?.id)}
        isPremium={isPremium}
      />

      <section className="mt-16 grid gap-6">
        <h2 className="text-lg font-semibold">Questions fréquentes</h2>
        <details className="rounded-2xl border bg-card p-4">
          <summary className="cursor-pointer font-medium">Comment annuler ?</summary>
          <p className="mt-2 text-sm text-muted-foreground">
            En 1 click dans tes réglages → Abonnement → Gérer mon abonnement.
            Pas de questions, pas de friction. Tu gardes l&apos;accès jusqu&apos;à
            la fin de la période payée.
          </p>
        </details>
        <details className="rounded-2xl border bg-card p-4">
          <summary className="cursor-pointer font-medium">Quand suis-je charged ?</summary>
          <p className="mt-2 text-sm text-muted-foreground">
            À la fin de tes 14 jours d&apos;essai gratuit. Tu reçois un email
            de rappel 3 jours avant.
          </p>
        </details>
        <details className="rounded-2xl border bg-card p-4">
          <summary className="cursor-pointer font-medium">Apple Pay ?</summary>
          <p className="mt-2 text-sm text-muted-foreground">
            Oui, via Stripe Checkout. CB, Google Pay et prélèvement SEPA
            aussi.
          </p>
        </details>
      </section>

      {!session?.user?.id ? (
        <p className="mt-12 text-center text-sm text-muted-foreground">
          <Link href="/login?next=/pricing" className="underline">
            Se connecter
          </Link>{" "}
          pour démarrer l&apos;essai.
        </p>
      ) : null}
    </main>
  );
}
