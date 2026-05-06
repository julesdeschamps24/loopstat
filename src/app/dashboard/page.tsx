import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <main className="flex-1 flex flex-col px-6 py-12 max-w-5xl mx-auto w-full">
      <header className="flex items-center justify-between mb-12">
        <div className="flex items-center gap-3">
          {session.user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={session.user.image}
              alt={session.user.name ?? ""}
              className="size-12 rounded-full"
            />
          ) : null}
          <div>
            <p className="text-sm text-muted-foreground">Connecté en tant que</p>
            <p className="font-medium">{session.user.name ?? session.user.spotifyId}</p>
          </div>
        </div>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            className="rounded-full border px-4 py-2 text-sm hover:bg-accent transition"
          >
            Déconnexion
          </button>
        </form>
      </header>

      <section className="rounded-2xl border bg-card p-8 text-center space-y-2">
        <h2 className="text-xl font-semibold">Phase 1 — Auth Spotify ✅</h2>
        <p className="text-muted-foreground text-sm">
          Tes tokens sont chiffrés en DB. Les pages stats arrivent en Phase 5.
        </p>
      </section>
    </main>
  );
}
