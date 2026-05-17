import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Album,
  ChevronRight,
  Clock,
  Download,
  Music2,
  Sparkles,
  Users,
} from "lucide-react";

import { auth } from "@/auth";
import { AlbumWall } from "@/components/album-wall";
import { AppHeader } from "@/components/app-header";
import { CurrentlyPlaying } from "@/components/stats/currently-playing";
import { RankedRow } from "@/components/stats/ranked-list";
import { StatCard } from "@/components/stats/stat-card";
import { EmptyState } from "@/components/stats/empty-state";
import { StaggerItem, StaggerList } from "@/components/ui/motion";
import { fetchTopArtists, fetchTopTracks } from "@/lib/spotify/top";
import { getListeningTotals } from "@/db/queries/stats";
import { getProfile } from "@/db/queries/users";
import { cn, formatMs, formatNumber, glassCard } from "@/lib/utils";
import { ImportBanner } from "@/components/import-banner";
import { OwnProfileCard } from "@/components/profile/own-profile-card";

const WALL_CELLS = 40;

// User-scoped (auth()) → la route est dynamique de toute façon ; un
// revalidate ISR ici serait silencieusement no-op (Next force dynamic
// dès qu'on lit la session). Pas de cache à expirer.
export const dynamic = "force-dynamic";

const WINDOW_LABELS: Record<"7d" | "30d" | "lifetime", string> = {
  "7d": "7 jours",
  "30d": "30 jours",
  lifetime: "Total",
};

const NAV_LINKS = [
  { href: "/top/tracks", label: "Top titres", icon: Music2 },
  { href: "/top/artists", label: "Top artistes", icon: Users },
  { href: "/top/albums", label: "Top albums", icon: Album },
  { href: "/listening-clock", label: "Horloge d'écoute", icon: Clock },
];

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const [totals, topTracks, topArtists, topTracks1y, profile] =
    await Promise.all([
      getListeningTotals(userId),
      fetchTopTracks(userId, "4w").catch(() => []),
      fetchTopArtists(userId, "4w").catch(() => []),
      fetchTopTracks(userId, "1y").catch(() => []),
      getProfile(userId),
    ]);
  const shareUsername =
    profile?.isPublic && profile.username ? profile.username : undefined;

  const totalsByWindow = new Map(totals.map((t) => [t.window, t]));
  const orderedWindows: ("7d" | "30d" | "lifetime")[] = [
    "7d",
    "30d",
    "lifetime",
  ];

  // État "fresh user" : zéro écoute enregistrée nulle part (ni polling ni
  // import). Plutôt que d'afficher un dashboard tout vide qui a l'air
  // cassé, on montre un welcome hero qui explique ce qui va se passer.
  const lifetimeCount = totalsByWindow.get("lifetime")?.count ?? 0;
  const isFreshUser = lifetimeCount === 0;

  const top5Tracks = topTracks.slice(0, 5);
  const top5Artists = topArtists.slice(0, 5);

  // Dédup les top tracks 1y par album.id, garde les 40 premières pochettes
  // uniques pour le mur de fond, pad avec null pour atteindre 40.
  const seenAlbums = new Set<string>();
  const wallCovers: (string | null)[] = [];
  for (const track of topTracks1y) {
    const id = track.album?.id;
    if (!id || seenAlbums.has(id)) continue;
    seenAlbums.add(id);
    wallCovers.push(track.album?.images?.[0]?.url ?? null);
    if (wallCovers.length === WALL_CELLS) break;
  }
  while (wallCovers.length < WALL_CELLS) wallCovers.push(null);

  return (
    <>
      <AlbumWall covers={wallCovers} />
      <main id="main" className="flex-1 flex flex-col px-6 py-12 max-w-5xl mx-auto w-full">
        <AppHeader session={session} shareUsername={shareUsername} shareContext="dashboard" />

      <div className="flex flex-col gap-12">
        <OwnProfileCard profile={profile} />
        <ImportBanner />

        {isFreshUser ? (
          <section
            className={cn(
              glassCard,
              "relative overflow-hidden p-8 sm:p-10",
            )}
          >
            <div className="absolute -right-10 -top-10 size-48 rounded-full bg-[#7c3aed]/15 blur-3xl" />
            <div className="relative flex flex-col gap-5">
              <div className="inline-flex w-fit items-center gap-2 rounded-full bg-[#7c3aed]/15 px-3 py-1 text-xs font-medium uppercase tracking-wider text-[#c4b5fd]">
                <Sparkles className="size-3.5" />
                Bienvenue
              </div>
              <h2 className="font-serif text-3xl leading-tight sm:text-4xl">
                Tes stats arrivent.
              </h2>
              <p className="max-w-2xl text-base text-muted-foreground">
                On synchronise automatiquement tes écoutes Spotify toutes les
                30 minutes. Tu verras tes tops apparaître ici au fil de
                l&apos;eau. Pour débloquer ton historique complet depuis
                ton inscription Spotify, importe ton export RGPD.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/import"
                  className="inline-flex items-center gap-2 rounded-full bg-[#7c3aed] px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
                >
                  <Download className="size-4" />
                  Importer mon historique
                </Link>
                <Link
                  href="/settings"
                  className="inline-flex items-center rounded-full border border-white/10 px-5 py-2.5 text-sm text-muted-foreground transition hover:bg-white/5 hover:text-foreground"
                >
                  Réglages
                </Link>
              </div>
            </div>
          </section>
        ) : null}

        {/* CurrentlyPlaying */}
        <section>
          <CurrentlyPlaying />
        </section>

        {/* Listening totals */}
        <section>
          <h2 className="mb-4 text-lg font-semibold">Écoutes</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {orderedWindows.map((window) => {
              const row = totalsByWindow.get(window);
              const count = row?.count ?? 0;
              const msPlayed = row?.msPlayed ?? 0;
              return (
                <StatCard
                  key={window}
                  label={WINDOW_LABELS[window]}
                  value={formatNumber(count)}
                  sublabel={
                    msPlayed > 0 ? formatMs(msPlayed) : undefined
                  }
                />
              );
            })}
          </div>
        </section>

        {/* Top 5 titres */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Top 5 titres</h2>
            <Link
              href="/top/tracks"
              className="flex items-center gap-1 text-sm text-primary hover:underline"
            >
              Voir tout
              <ChevronRight className="size-4" />
            </Link>
          </div>
          {top5Tracks.length === 0 ? (
            <EmptyState
              title="Pas encore de titres"
              description="Tes titres les plus écoutés apparaîtront ici."
              icon={Music2}
            />
          ) : (
            <StaggerList className="flex flex-col gap-1">
              {top5Tracks.map((track, index) => (
                <StaggerItem key={track.id}>
                  <RankedRow
                    rank={index + 1}
                    title={track.name}
                    href={`/track/${track.id}`}
                    subtitle={track.artists.map((a) => a.name).join(", ")}
                    imageUrl={track.album?.images?.[0]?.url}
                  />
                </StaggerItem>
              ))}
            </StaggerList>
          )}
        </section>

        {/* Top 5 artistes */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Top 5 artistes</h2>
            <Link
              href="/top/artists"
              className="flex items-center gap-1 text-sm text-primary hover:underline"
            >
              Voir tout
              <ChevronRight className="size-4" />
            </Link>
          </div>
          {top5Artists.length === 0 ? (
            <EmptyState
              title="Pas encore d'artistes"
              description="Tes artistes les plus écoutés apparaîtront ici."
              icon={Users}
            />
          ) : (
            <StaggerList className="flex flex-col gap-1">
              {top5Artists.map((artist, index) => (
                <StaggerItem key={artist.id}>
                  <RankedRow
                    rank={index + 1}
                    title={artist.name}
                    href={`/artist/${artist.id}`}
                    imageUrl={artist.images?.[0]?.url}
                  />
                </StaggerItem>
              ))}
            </StaggerList>
          )}
        </section>

        {/* Navigation */}
        <section>
          <h2 className="mb-4 text-lg font-semibold">Explorer</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {NAV_LINKS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
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
      </main>
    </>
  );
}
