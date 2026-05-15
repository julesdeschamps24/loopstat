import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AppHeader } from "@/components/app-header";
import { DeleteAccountForm } from "@/components/settings/delete-account-form";
import { ThemeToggle } from "@/components/theme-toggle";

// No Spotify calls here — keep the standard revalidate window for consistency
// with the other authenticated pages.
export const revalidate = 3600;

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const displayName = session.user.name ?? session.user.spotifyId ?? "";
  const email = session.user.email ?? null;

  return (
    <main className="flex-1 flex flex-col px-6 py-12 max-w-3xl mx-auto w-full">
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
