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
import { AppHeader } from "@/components/app-header";
import { DemoModeBanner } from "@/components/onboarding/demo-mode-banner";
import { WelcomeModal } from "@/components/onboarding/welcome-modal";
import { RankedRow } from "@/components/stats/ranked-list";
import { StatCard } from "@/components/stats/stat-card";
import { EmptyState } from "@/components/stats/empty-state";
import { StaggerItem, StaggerList } from "@/components/ui/motion";
import { hasCompletedImport } from "@/db/queries/imports";
import {
  getListeningTotals,
  getTopTracksFromStreams,
  getTopArtistsFromStreams,
  getUserLatestPlayedAt,
} from "@/db/queries/stats";
import { getProfile } from "@/db/queries/users";
import { getWallCovers } from "@/db/queries/wall-covers";
import {
  getEnrichedDemoTopArtists,
  getEnrichedDemoTopTracks,
} from "@/lib/demo/enrich";
import { formatNumber } from "@/lib/utils";
import { DemoShowcase } from "@/components/demo/demo-showcase";
import { ImportBanner } from "@/components/import-banner";
import { OwnProfileCard } from "@/components/profile/own-profile-card";
import { triggerVisibleEnrich } from "@/lib/enrich/trigger";

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
  if (!session?.user?.id) redirect("/connexion");
  const userId = session.user.id;

  const hasImport = await hasCompletedImport(userId);

  // --- MODE DÉMO ---
  if (!hasImport) {
    const profile = await getProfile(userId);
    const shareUsername =
      profile?.isPublic && profile.username ? profile.username : undefined;

    const [enrichedTracks, enrichedArtists] = await Promise.all([
      getEnrichedDemoTopTracks(),
      getEnrichedDemoTopArtists(),
    ]);
    const top5Tracks = enrichedTracks.slice(0, 5);
    const top5Artists = enrichedArtists.slice(0, 5);

    // Démo : le user n'a pas encore importé → 0 streams pour lui.
    // getWallCovers tombe sur la branche "padding catalog global" : on
    // affiche les albums les plus populaires de tous les users déjà sur
    // loopstat. La wall est belle dès le premier load. Padding final
    // (artefact) au cas où le catalog serait vide (très premier user).
    // Le mur de fond est rendu par le layout du groupe (app) ; ici on ne
    // garde que les covers pour le panneau gauche de la WelcomeModal.
    const wallAlbums = await getWallCovers(userId, null, WALL_CELLS);
    // Les 12 premiers covers alimentent le panneau gauche de
    // la WelcomeModal - vraies pochettes plutôt que gradients violet.
    const modalCovers = wallAlbums
      .map((a) => a.imageUrl)
      .filter((u): u is string => u !== null)
      .slice(0, 12);

    return (
      <>
        <WelcomeModal covers={modalCovers} />
        <DemoModeBanner />
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
            <OwnProfileCard profile={profile} />

            <DemoShowcase tracks={top5Tracks} artists={top5Artists} />
          </div>
        </main>
      </>
    );
  }

  // --- MODE RÉEL ---
  // On pivote sur le dernier played_at de l'utilisateur (import statique
  // potentiellement antérieur à aujourd'hui) plutôt que sur now().
  const latestPlayedAt = await getUserLatestPlayedAt(userId);
  const refDate = latestPlayedAt ?? new Date();
  // Aperçu = snapshot des 28 derniers jours.
  const previewSince = new Date(refDate.getTime() - 28 * 24 * 60 * 60 * 1000);

  const [totals, topTracks, topArtists, profile] = await Promise.all([
    getListeningTotals(userId, refDate),
    getTopTracksFromStreams(userId, previewSince, 5),
    getTopArtistsFromStreams(userId, previewSince, 5),
    getProfile(userId),
  ]);
  await triggerVisibleEnrich([
    ...topTracks
      .filter((t) => !t.albumImageUrl && t.albumId)
      .map((t) => ({ type: "album" as const, id: t.albumId! })),
    ...topArtists
      .filter((a) => !a.imageUrl)
      .map((a) => ({ type: "artist" as const, id: a.artistId })),
  ]);
  const shareUsername =
    profile?.isPublic && profile.username ? profile.username : undefined;

  const totalsByWindow = new Map(totals.map((t) => [t.window, t]));
  const orderedWindows: ("7d" | "30d" | "lifetime")[] = ["7d", "30d", "lifetime"];

  const top5Tracks = topTracks;
  const top5Artists = topArtists;

  return (
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
          <OwnProfileCard profile={profile} />
          <ImportBanner />

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
                  <StaggerItem key={track.trackId}>
                    <RankedRow
                      rank={index + 1}
                      title={track.name}
                      href={`/track/${track.trackId}`}
                      subtitle={track.artistNames.join(", ")}
                      imageUrl={track.albumImageUrl ?? undefined}
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
                  <StaggerItem key={artist.artistId}>
                    <RankedRow
                      rank={index + 1}
                      title={artist.name}
                      href={`/artist/${artist.artistId}`}
                      imageUrl={artist.imageUrl ?? undefined}
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
  );
}
