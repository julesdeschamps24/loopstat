import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { CopyProfileLinkButton } from "@/components/profile/own-profile-card-actions";
import type { ProfileRow } from "@/db/queries/users";
import { cn, glassCard } from "@/lib/utils";

export function OwnProfileCard({ profile }: { profile: ProfileRow | null }) {
  if (!profile?.username) return null;

  if (!profile.isPublic) {
    return (
      <section
        className={cn(
          glassCard,
          "flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between",
        )}
      >
        <div>
          <p className="text-sm font-medium">Ton profil est privé</p>
          <p className="text-xs text-muted-foreground">
            Active-le pour partager tes stats sur{" "}
            <span className="font-mono">
              loopstat.fr/u/{profile.username}
            </span>
            .
          </p>
        </div>
        <Link
          href="/settings"
          className="inline-flex items-center justify-center rounded-full bg-[#7c3aed] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#6d28d9]"
        >
          Activer mon profil public →
        </Link>
      </section>
    );
  }

  const url = `loopstat.fr/u/${profile.username}`;
  return (
    <section className={cn(glassCard, "flex flex-col gap-4 p-5")}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Mon profil public</p>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
            <span className="size-1.5 rounded-full bg-emerald-400" />
            Public
          </span>
        </div>
      </div>
      <p className="font-mono text-sm text-muted-foreground">{url}</p>
      <div className="flex flex-wrap gap-2">
        <CopyProfileLinkButton username={profile.username} />
        <Link
          href={`/u/${profile.username}`}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-2 rounded-full border bg-white/5 px-4 py-2 text-sm transition hover:bg-white/10"
        >
          <ExternalLink className="size-4" /> Voir mon profil
        </Link>
      </div>
    </section>
  );
}
