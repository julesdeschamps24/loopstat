import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { RankedList, RankedRow } from "@/components/stats/ranked-list";
import { EmptyState } from "@/components/stats/empty-state";
import { spotifyFetch } from "@/lib/spotify/client";
import type { SpotifyArtist } from "@/lib/spotify/types";
import {
  getArtistPlayStats,
  getUserTopTracksByArtist,
} from "@/db/queries/stats";
import { formatNumber } from "@/lib/utils";

// Spotify metadata is stable — re-fetch at most once an hour.
export const revalidate = 3600;

export default async function ArtistDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const { id } = await params;

  let artist: SpotifyArtist;
  try {
    artist = await spotifyFetch<SpotifyArtist>(userId, `/artists/${id}`);
  } catch {
    notFound();
  }

  const [stats, topTracks] = await Promise.all([
    getArtistPlayStats(userId, id),
    getUserTopTracksByArtist(userId, id, 10),
  ]);

  const image = artist.images?.[0]?.url;

  return (
    <main className="flex-1 flex flex-col px-6 py-12 max-w-3xl mx-auto w-full">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt=""
            className="size-48 shrink-0 rounded-full object-cover shadow-lg"
          />
        ) : (
          <div className="size-48 shrink-0 rounded-full bg-muted" />
        )}
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">Artiste</p>
          <h1 className="text-3xl font-semibold">{artist.name}</h1>
          {artist.genres && artist.genres.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {artist.genres.slice(0, 6).map((genre) => (
                <span
                  key={genre}
                  className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground"
                >
                  {genre}
                </span>
              ))}
            </div>
          ) : null}
          <p className="mt-3 text-sm text-muted-foreground">
            {formatNumber(stats.count)} écoutes
          </p>
        </div>
      </div>

      <section className="mt-10">
        <h2 className="mb-4 text-lg font-semibold">
          Vos titres les plus écoutés
        </h2>
        {topTracks.length === 0 ? (
          <EmptyState
            title="Pas encore d'écoute enregistrée"
            description="Vos titres les plus écoutés de cet artiste apparaîtront ici."
          />
        ) : (
          <RankedList>
            {topTracks.map((track, index) => (
              <RankedRow
                key={track.trackId}
                rank={index + 1}
                title={track.trackName}
                href={`/track/${track.trackId}`}
                metric={`${formatNumber(track.playCount)} écoutes`}
              />
            ))}
          </RankedList>
        )}
      </section>
    </main>
  );
}
