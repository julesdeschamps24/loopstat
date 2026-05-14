import { Suspense } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { RankedList, RankedRow } from "@/components/stats/ranked-list";
import { PeriodSelector } from "@/components/stats/period-selector";
import { EmptyState } from "@/components/stats/empty-state";
import { fetchTopTracks, isTopPeriod, type TopPeriod } from "@/lib/spotify/top";
import type { SpotifyTrack } from "@/lib/spotify/types";

// Re-fetch the Spotify Top Read data at most once an hour; repeated navigation
// between periods reuses the cached RSC payload instead of re-hitting Spotify.
export const revalidate = 3600;

type DerivedAlbum = {
  id: string;
  name: string;
  imageUrl?: string;
  artistNames?: string;
  /** How many of the user's top tracks belong to this album. */
  trackCount: number;
  /** Best (lowest) top-tracks index among the contributing tracks. */
  bestIndex: number;
};

/**
 * Spotify has no /me/top/albums endpoint, so we derive a ranking in-memory
 * from the top-tracks payload: group tracks by album id, then rank albums by
 * how many top tracks they contribute, tie-broken by the best (lowest) track
 * index among those contributors. Tracks with no resolvable album are skipped.
 */
function deriveTopAlbums(tracks: SpotifyTrack[]): DerivedAlbum[] {
  const byId = new Map<string, DerivedAlbum>();

  tracks.forEach((track, index) => {
    const album = track.album;
    if (!album?.id) return;

    const existing = byId.get(album.id);
    if (existing) {
      existing.trackCount += 1;
      if (index < existing.bestIndex) existing.bestIndex = index;
      return;
    }

    const artistNames =
      album.artists?.map((a) => a.name).join(", ") ||
      track.artists.map((a) => a.name).join(", ") ||
      undefined;

    byId.set(album.id, {
      id: album.id,
      name: album.name,
      imageUrl: album.images?.[0]?.url,
      artistNames,
      trackCount: 1,
      bestIndex: index,
    });
  });

  return [...byId.values()].sort(
    (a, b) => b.trackCount - a.trackCount || a.bestIndex - b.bestIndex,
  );
}

export default async function TopAlbumsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const { period: rawPeriod } = await searchParams;
  const period: TopPeriod = isTopPeriod(rawPeriod) ? rawPeriod : "4w";

  const tracks = await fetchTopTracks(userId, period);
  const albums = deriveTopAlbums(tracks);

  return (
    <main className="flex-1 flex flex-col px-6 py-12 max-w-5xl mx-auto w-full">
      <header className="mb-2 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Top albums</h1>
        <Suspense
          fallback={
            <div className="h-10 w-[232px] rounded-full border bg-card" />
          }
        >
          <PeriodSelector current={period} />
        </Suspense>
      </header>

      <p className="mb-8 text-sm text-muted-foreground">
        Classement dérivé de vos top titres — Spotify ne fournit pas de
        palmarès d&apos;albums.
      </p>

      {albums.length === 0 ? (
        <EmptyState
          title="Aucun album pour cette période."
          description="Écoutez quelques titres et revenez plus tard."
        />
      ) : (
        <RankedList>
          {albums.map((album, index) => (
            <RankedRow
              key={album.id}
              rank={index + 1}
              title={album.name}
              href={`/album/${album.id}`}
              subtitle={album.artistNames}
              imageUrl={album.imageUrl}
              metric={`${album.trackCount} ${
                album.trackCount > 1 ? "titres" : "titre"
              }`}
            />
          ))}
        </RankedList>
      )}
    </main>
  );
}
