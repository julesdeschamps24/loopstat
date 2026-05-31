import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { auth } from "@/auth";
import { AppHeader } from "@/components/app-header";
import { AppearanceForm } from "@/components/profile/appearance-form";
import { PremiumGate } from "@/components/premium-gate";
import { DeleteAccountForm } from "@/components/settings/delete-account-form";
import { ProfileForm } from "@/components/settings/profile-form";
import { isPremium } from "@/db/queries/billing";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { deriveUsername } from "@/lib/derive-username";
import { isAccent, isBackground } from "@/lib/profile/appearance";

// No Spotify calls here — keep the standard revalidate window for consistency
// with the other authenticated pages.
export const revalidate = 3600;

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // Fetch email and displayName from DB since session.user.email is not reliably
  // propagated by the current JWT session callback
  const userRow = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: {
      email: true,
      displayName: true,
      username: true,
      isPublic: true,
      profileSettings: true,
    },
  });

  const premium = await isPremium(session.user.id);
  const settings = userRow?.profileSettings ?? {};
  const initialBackground = isBackground(settings.background) ? settings.background : "mesh";
  const initialAccent = isAccent(settings.accent) ? settings.accent : "violet";

  const displayName = userRow?.displayName ?? session.user.name ?? "";
  const email = userRow?.email ?? null;
  // Preview du pseudo si pas encore persisté. La résolution réelle (incl. la
  // gestion de collision) se fait dans la server action au moment du save.
  const previewUsername =
    userRow?.username ??
    deriveUsername(userRow?.displayName ?? null, session.user.id ?? "");

  return (
    <main id="main" className="flex-1 flex flex-col px-6 py-12 max-w-3xl mx-auto w-full">
      <AppHeader session={session} />

      <div className="flex flex-col gap-12">
        <section>
          <h2 className="mb-2 text-lg font-semibold">Profil public</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Choisis un pseudo et active ton profil public pour partager tes
            stats avec qui tu veux via une URL canonique.
          </p>
          <ProfileForm
            username={previewUsername}
            initialIsPublic={userRow?.isPublic ?? false}
          />
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">Apparence du profil</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Customise le fond et la couleur d&apos;accent de ton profil public.
          </p>
          <PremiumGate isPremium={premium}>
            {userRow?.username ? (
              <AppearanceForm
                username={userRow.username}
                displayName={displayName}
                initialBackground={initialBackground}
                initialAccent={initialAccent}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Choisis d&apos;abord un pseudo dans la section &quot;Profil public&quot;
                ci-dessus.
              </p>
            )}
          </PremiumGate>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">Compte</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Identité Spotify utilisée pour te connecter à loopstat.
          </p>
          <dl className="mb-6 grid gap-3 rounded-2xl border bg-card p-4 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-6 sm:gap-y-2">
            <dt className="text-muted-foreground">Nom affiché</dt>
            <dd className="font-medium">{displayName || "—"}</dd>
            {email ? (
              <>
                <dt className="text-muted-foreground">Email</dt>
                <dd className="font-medium">{email}</dd>
              </>
            ) : null}
          </dl>
          <DeleteAccountForm />
          <Link
            href="/settings/billing"
            className="self-start text-sm text-[#c4b5fd] hover:underline"
          >
            Mon abonnement →
          </Link>
        </section>
      </div>
    </main>
  );
}
