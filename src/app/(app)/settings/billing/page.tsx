import { redirect } from "next/navigation";
import Link from "next/link";

import { auth } from "@/auth";
import { AlbumWall } from "@/components/album-wall";
import { getBillingState } from "@/db/queries/billing";
import { getPaddedWallCovers } from "@/db/queries/wall-covers";
import { OpenPortalButton } from "@/app/settings/billing/portal-form";

export const dynamic = "force-dynamic";

const FR_DATE = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export default async function BillingPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?next=/settings/billing");

  const [state, wallCovers] = await Promise.all([
    getBillingState(session.user.id),
    getPaddedWallCovers(session.user.id, null, 40),
  ]);

  return (
    <>
    <AlbumWall covers={wallCovers} />
    <main
      id="main"
      className="flex-1 flex flex-col px-6 py-12 max-w-3xl mx-auto w-full"
    >
      <header className="mb-8">
        <h1 className="text-2xl font-semibold">Abonnement</h1>
      </header>

      {state.tier === "free" ? (
        <section className="rounded-2xl border bg-card p-6">
          <p className="text-sm">Tu n&apos;es pas encore Premium.</p>
          <Link
            href="/pricing"
            className="mt-4 inline-flex rounded-full bg-[#7c3aed] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#6d28d9]"
          >
            Découvrir Premium →
          </Link>
        </section>
      ) : null}

      {state.tier === "trial" ? (
        <section className="rounded-2xl border bg-card p-6">
          <p className="text-sm">
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-400">
              Essai gratuit
            </span>{" "}
            jusqu&apos;au {FR_DATE.format(state.trialEndsAt)}.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Annule à tout moment, sans frais.
          </p>
          <OpenPortalButton className="mt-4" />
        </section>
      ) : null}

      {state.tier === "active" ? (
        <section className="rounded-2xl border bg-card p-6">
          <p className="text-sm">
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-400">
              Premium actif
            </span>{" "}
            renouvellement le {FR_DATE.format(state.renewsAt)}.
          </p>
          <OpenPortalButton className="mt-4" />
        </section>
      ) : null}

      {state.tier === "past_due" ? (
        <section className="rounded-2xl border border-red-500/40 bg-red-500/10 p-6">
          <p className="text-sm font-medium text-red-400">
            Paiement échoué. Mets à jour ta CB pour conserver Premium.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Accès maintenu jusqu&apos;au {FR_DATE.format(state.expiresAt)}.
          </p>
          <OpenPortalButton className="mt-4" label="Régler →" />
        </section>
      ) : null}

      {state.tier === "canceled" ? (
        <section className="rounded-2xl border bg-card p-6">
          <p className="text-sm">
            Abonnement annulé. Accès Premium maintenu jusqu&apos;au{" "}
            {FR_DATE.format(state.expiresAt)}.
          </p>
          <OpenPortalButton className="mt-4" label="Réactiver →" />
        </section>
      ) : null}
    </main>
    </>
  );
}
