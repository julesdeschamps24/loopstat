import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Album,
  ChevronRight,
  Clock,
  Music2,
  Users,
} from "lucide-react";

import { auth } from "@/auth";
import { AlbumWall } from "@/components/album-wall";
import { AppHeader } from "@/components/app-header";
import { DemoModeBanner } from "@/components/onboarding/demo-mode-banner";
import { WelcomeModal } from "@/components/onboarding/welcome-modal";
import { CurrentlyPlaying } from "@/components/stats/currently-playing";
import { RankedRow } from "@/components/stats/ranked-list";
import { StatCard } from "@/components/stats/stat-card";
import { EmptyState } from "@/components/stats/empty-state";
import { StaggerItem, StaggerList } from "@/components/ui/motion";
import { fetchTopArtists, fetchTopTracks } from "@/lib/spotify/top";
import { isPremium } from "@/db/queries/billing";
import { hasCompletedImport } from "@/db/queries/imports";
import { getListeningTotals } from "@/db/queries/stats";
import { getProfile } from "@/db/queries/users";
import {
  DEMO_TOP_TRACKS,
  DEMO_TOP_ARTISTS,
  DEMO_TOTAL_PLAYS,
  DEMO_TOTAL_HOURS_LISTENED,
} from "@/lib/demo/data";
import { formatNumber } from "@/lib/utils";
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

  const hasImport = await hasCompletedImport(userId);

  // --- MODE DÉMO ---
  if (!hasImport) {
    const profile = await getProfile(userId);
    const premium = await isPremium(userId);
    const shareUsername =
      profile?.isPublic && profile.username ? profile.username : undefined;

    const top5Tracks = DEMO_TOP_TRACKS.slice(0, 5);
    const top5Artists = DEMO_TOP_ARTISTS.slice(0, 5);

    // Pas de wallCovers pour la démo (pas d'images d'album dans les fixtures).
    const wallCovers: (string | null)[] = Array(WALL_CELLS).fill(null);

    return (
      <>
        <WelcomeModal />
        <DemoModeBanner />
        <AlbumWall covers={wallCovers} />
        <main
          id="main"
          className="flex-1 flex flex-col px-6 py-12 max-w-5xl mx-auto w-full"
        >
          <AppHeader
            session={session}
            shareUsername={shareUsername}
            shareContext="dashboard"
          />
          <div className="flex flex-col gap-12">
            <OwnProfileCard profile={profile} isPremium={premium} />

            {/* Listening totals (demo) */}
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

            {/* Top 5 titres (demo, non cliquables) */}
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
              <StaggerList className="flex flex-col gap-1">
                {top5Tracks.map((track, index) => (
                  <StaggerItem key={track.trackId}>
                    <RankedRow
                      rank={index + 1}
                      title={track.name}
                      subtitle={track.artistNames.join(", ")}
                    />
                  </StaggerItem>
                ))}
              </StaggerList>
            </section>

            {/* Top 5 artistes (demo, non cliquables) */}
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
              <StaggerList className="flex flex-col gap-1">
                {top5Artists.map((artist, index) => (
                  <StaggerItem key={artist.artistId}>
                    <RankedRow rank={index + 1} title={artist.name} />
                  </StaggerItem>
                ))}
              </StaggerList>
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

  // --- MODE RÉEL (inchangé sauf retrait de la section isFreshUser) ---
  const [totals, topTracks, topArtists, topTracks1y, profile, premium] =
    await Promise.all([
      getListeningTotals(userId),
      fetchTopTracks(userId, "4w").catch(() => []),
      fetchTopArtists(userId, "4w").catch(() => []),
      fetchTopTracks(userId, "1y").catch(() => []),
      getProfile(userId),
      isPremium(userId),
    ]);
  const shareUsername =
    profile?.isPublic && profile.username ? profile.username : undefined;

  const totalsByWindow = new Map(totals.map((t) => [t.window, t]));
  const orderedWindows: ("7d" | "30d" | "lifetime")[] = ["7d", "30d", "lifetime"];

  const top5Tracks = topTracks.slice(0, 5);
  const top5Artists = topArtists.slice(0, 5);

  // Dédup les top tracks 1y par album.id pour le mur de fond.
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
      <main
        id="main"
        className="flex-1 flex flex-col px-6 py-12 max-w-5xl mx-auto w-full"
      >
        <AppHeader
          session={session}
          shareUsername={shareUsername}
          shareContext="dashboard"
        />
        <div className="flex flex-col gap-12">
          <OwnProfileCard profile={profile} isPremium={premium} />
          <ImportBanner />

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
                      msPlayed > 0
                        ? `${Math.round(msPlayed / 1000 / 60 / 60)} h`
                        : undefined
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
