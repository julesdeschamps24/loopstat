import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

import { auth } from "@/auth";
import { AppHeader } from "@/components/app-header";
import { DeleteAccountForm } from "@/components/settings/delete-account-form";
import { ProfileForm } from "@/components/settings/profile-form";
import { ThemeToggle } from "@/components/theme-toggle";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { deriveUsername } from "@/lib/derive-username";

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
      spotifyId: true,
      username: true,
      isPublic: true,
    },
  });

  const displayName = userRow?.displayName ?? session.user.name ?? userRow?.spotifyId ?? "";
  const email = userRow?.email ?? null;
  // Preview du pseudo si pas encore persisté. La résolution réelle (incl. la
  // gestion de collision) se fait dans la server action au moment du save.
  const previewUsername =
    userRow?.username ??
    deriveUsername(userRow?.displayName ?? null, userRow?.spotifyId ?? "");

  return (
    <main id="main" className="flex-1 flex flex-col px-6 py-12 max-w-3xl mx-auto w-full">
      <AppHeader session={session} />

      <div className="flex flex-col gap-12">
        <section>
          <h2 className="mb-2 text-lg font-semibold">Apparence</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Choisis le thème de l&apos;interface. Le réglage est conservé sur
            cet appareil.
          </p>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Thème</span>
            <ThemeToggle />
          </div>
        </section>

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
        </section>
      </div>
    </main>
  );
}
