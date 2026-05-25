import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { RankedList, RankedRow } from "@/components/stats/ranked-list";
import { EmptyState } from "@/components/stats/empty-state";
import { ArtistAvatar } from "@/components/ui/artist-avatar";
import { getDemoArtist, isDemoId } from "@/lib/demo/data";
import { enrichDemoFixtures } from "@/lib/demo/enrich";
import { db } from "@/db/client";
import { artists } from "@/db/schema";
import {
  getArtistPlayStats,
  getUserTopTracksByArtist,
} from "@/db/queries/stats";
import { formatNumber } from "@/lib/utils";

export const revalidate = 3600;

export default async function ArtistDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const { id: rawId } = await params;
  // Next.js 16 passes the param URL-encoded (e.g. "demo%3Asabrina-carpenter"),
  // but our demo fixtures use a literal ":" prefix — decode so lookups match.
  const id = decodeURIComponent(rawId);

  if (isDemoId(id)) {
    const demo = getDemoArtist(id);
    if (!demo) notFound();
    const { artist, stats, topTracks } = demo;
    const { artistImages, trackImages } = await enrichDemoFixtures();
    const artistImage = artistImages.get(artist.artistId) ?? artist.imageUrl;

    return (
      <main id="main" className="flex-1 flex flex-col px-6 py-12 max-w-3xl mx-auto w-full">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
          <ArtistAvatar name={artist.name} imageUrl={artistImage} size={192} />
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">Artiste</p>
            <h1 className="text-3xl font-semibold">{artist.name}</h1>
            <p className="mt-3 text-sm text-muted-foreground">
              {formatNumber(stats.count)} écoutes
            </p>
          </div>
        </div>

        <section className="mt-10">
          <h2 className="mb-4 text-lg font-semibold">
            Tes titres les plus écoutés
          </h2>
          {topTracks.length === 0 ? (
            <EmptyState
              title="Pas encore d'écoute enregistrée"
              description="Tes titres les plus écoutés de cet artiste apparaîtront ici."
            />
          ) : (
            <RankedList>
              {topTracks.map((track, index) => (
                <RankedRow
                  key={track.trackId}
                  rank={index + 1}
                  title={track.trackName}
                  href={`/track/${track.trackId}`}
                  imageUrl={trackImages.get(track.trackId) ?? undefined}
                  metric={`${formatNumber(track.playCount)} écoutes`}
                />
              ))}
            </RankedList>
          )}
        </section>
      </main>
    );
  }

  // --- MODE RÉEL : DB only ---
  const [artist] = await db
    .select()
    .from(artists)
    .where(eq(artists.id, id))
    .limit(1);
  if (!artist) notFound();

  const [stats, topTracks] = await Promise.all([
    getArtistPlayStats(userId, id),
    getUserTopTracksByArtist(userId, id, 10),
  ]);

  return (
    <main id="main" className="flex-1 flex flex-col px-6 py-12 max-w-3xl mx-auto w-full">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
        <ArtistAvatar name={artist.name} imageUrl={artist.imageUrl} size={192} />
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">Artiste</p>
          <h1 className="text-3xl font-semibold">{artist.name}</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {formatNumber(stats.count)} écoutes
          </p>
        </div>
      </div>

      <section className="mt-10">
        <h2 className="mb-4 text-lg font-semibold">
          Tes titres les plus écoutés
        </h2>
        {topTracks.length === 0 ? (
          <EmptyState
            title="Pas encore d'écoute enregistrée"
            description="Tes titres les plus écoutés de cet artiste apparaîtront ici."
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
