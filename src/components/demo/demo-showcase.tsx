import Link from "next/link";
import { Album, ChevronRight, Clock, Music2, Users } from "lucide-react";

import { RankedRow } from "@/components/stats/ranked-list";
import { StatCard } from "@/components/stats/stat-card";
import { StaggerItem, StaggerList } from "@/components/ui/motion";
import {
  DEMO_TOTAL_PLAYS,
  DEMO_TOTAL_HOURS_LISTENED,
} from "@/lib/demo/data";
import { formatNumber } from "@/lib/utils";

type DemoTrack = {
  trackId: string;
  name: string;
  artistNames: string[];
  albumImageUrl?: string | null;
};
type DemoArtist = {
  artistId: string;
  name: string;
  imageUrl?: string | null;
};

const NAV_LINKS = [
  { key: "tracks", href: "/top/tracks", label: "Top titres", icon: Music2 },
  { key: "artists", href: "/top/artists", label: "Top artistes", icon: Users },
  { key: "albums", href: "/top/albums", label: "Top albums", icon: Album },
  { key: "clock", href: "/listening-clock", label: "Horloge d'écoute", icon: Clock },
] as const;

/**
 * The "compte démo" stats showcase — listening totals, top 5 titres, top 5
 * artistes and the explore grid — built entirely from the demo fixtures.
 *
 * Shared between the in-app dashboard demo (logged-in user without an import)
 * and the public `/demo` landing example, so both show the exact same UI.
 *
 * `interactive` (default true, the in-app case): rows and links navigate to the
 * real detail/top pages. When false (the public example), rows are display-only
 * and every "see more" affordance funnels to /inscription instead of bouncing a
 * logged-out visitor into the auth wall.
 */
export function DemoShowcase({
  tracks,
  artists,
  interactive = true,
}: {
  tracks: DemoTrack[];
  artists: DemoArtist[];
  interactive?: boolean;
}) {
  const seeAll = (href: string) => (interactive ? href : "/inscription");
  const seeAllLabel = interactive ? "Voir tout" : "S'inscrire";

  return (
    <div className="flex flex-col gap-12">
      {/* Listening totals */}
      <section>
        <h2 className="mb-4 text-lg font-semibold">Écoutes</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="7 jours" value={formatNumber(312)} />
          <StatCard label="30 jours" value={formatNumber(1487)} />
          <StatCard
            label="Total"
            value={formatNumber(DEMO_TOTAL_PLAYS)}
            sublabel={`${DEMO_TOTAL_HOURS_LISTENED} h d'écoute`}
          />
        </div>
      </section>

      {/* Top 5 titres */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Top 5 titres</h2>
          <Link
            href={seeAll("/top/tracks")}
            className="flex items-center gap-1 text-sm text-primary hover:underline"
          >
            {seeAllLabel}
            <ChevronRight className="size-4" />
          </Link>
        </div>
        <StaggerList className="flex flex-col gap-1">
          {tracks.map((track, index) => (
            <StaggerItem key={track.trackId}>
              <RankedRow
                rank={index + 1}
                title={track.name}
                href={interactive ? `/track/${track.trackId}` : undefined}
                subtitle={track.artistNames.join(", ")}
                imageUrl={track.albumImageUrl ?? undefined}
              />
            </StaggerItem>
          ))}
        </StaggerList>
      </section>

      {/* Top 5 artistes */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Top 5 artistes</h2>
          <Link
            href={seeAll("/top/artists")}
            className="flex items-center gap-1 text-sm text-primary hover:underline"
          >
            {seeAllLabel}
            <ChevronRight className="size-4" />
          </Link>
        </div>
        <StaggerList className="flex flex-col gap-1">
          {artists.map((artist, index) => (
            <StaggerItem key={artist.artistId}>
              <RankedRow
                rank={index + 1}
                title={artist.name}
                href={interactive ? `/artist/${artist.artistId}` : undefined}
                imageUrl={artist.imageUrl ?? undefined}
                avatarName={artist.name}
                avatarImageUrl={artist.imageUrl}
              />
            </StaggerItem>
          ))}
        </StaggerList>
      </section>

      {/* Navigation / explore */}
      <section>
        <h2 className="mb-4 text-lg font-semibold">Explorer</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {NAV_LINKS.map(({ key, href, label, icon: Icon }) => (
            <Link
              key={key}
              href={interactive ? href : "/inscription"}
              className="flex items-center gap-3 rounded-2xl border bg-card p-4 transition hover:bg-accent"
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                <Icon className="size-5 text-muted-foreground" />
              </div>
              <span className="font-medium">{label}</span>
              <ChevronRight className="ml-auto size-4 text-muted-foreground" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
