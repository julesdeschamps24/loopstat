import Link from "next/link";
import { Settings } from "lucide-react";
import type { Session } from "next-auth";

import { signOut } from "@/auth";
import { ShareButton } from "@/components/share-button";
import { ThemeToggle } from "@/components/theme-toggle";

export function AppHeader({
  session,
  shareUsername,
}: {
  session: Session;
  shareUsername?: string;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 mb-12">
      <div className="flex items-center gap-3">
        {session.user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={session.user.image}
            alt=""
            decoding="async"
            fetchPriority="high"
            className="size-12 rounded-full"
          />
        ) : null}
        <div>
          <p className="text-sm text-muted-foreground">Connecté en tant que</p>
          <p className="font-medium">
            {session.user.name ?? session.user.spotifyId}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {shareUsername ? <ShareButton username={shareUsername} /> : null}
        <ThemeToggle />
        <Link
          href="/settings"
          aria-label="Paramètres"
          className="inline-flex size-9 items-center justify-center rounded-full border text-sm hover:bg-accent transition"
        >
          <Settings className="size-4" />
        </Link>
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
      </div>
    </header>
  );
}
