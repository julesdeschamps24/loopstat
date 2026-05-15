import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { spotifyFetch } from "@/lib/spotify/client";
import { upsertCatalogFromTracks } from "@/lib/spotify/catalog";
import type { SpotifyTrack } from "@/lib/spotify/types";
import { getTrackPlayStats } from "@/db/queries/stats";
import { formatNumber } from "@/lib/utils";

// Spotify metadata is stable — re-fetch at most once an hour.
export const revalidate = 3600;

function formatDate(date: Date): string {
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function TrackDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const { id } = await params;

  let track: SpotifyTrack;
  try {
    track = await spotifyFetch<SpotifyTrack>(userId, `/tracks/${id}`);
  } catch {
    notFound();
  }

  const stats = await getTrackPlayStats(userId, id);

  // Keep the catalog warm — best-effort, never block the render on it.
  try {
    await upsertCatalogFromTracks([track]);
  } catch {
    // ignore — purely a cache-warming side effect
  }

  const albumImage = track.album?.images?.[0]?.url;
  const artistNames = track.artists.map((a) => a.name).join(", ");

  return (
    <main id="main" className="flex-1 flex flex-col px-6 py-12 max-w-3xl mx-auto w-full">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
        {albumImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={albumImage}
            alt=""
            decoding="async"
            fetchPriority="high"
            className="size-48 shrink-0 rounded-2xl object-cover shadow-lg"
          />
        ) : (
          <div className="size-48 shrink-0 rounded-2xl bg-muted" />
        )}
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">Titre</p>
          <h1 className="text-3xl font-semibold">{track.name}</h1>
          <p className="mt-1 text-lg text-muted-foreground">{artistNames}</p>
          {track.album?.name ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {track.album.name}
            </p>
          ) : null}
        </div>
      </div>

      <section className="mt-10 rounded-2xl border bg-card p-6">
        <h2 className="text-lg font-semibold">Tes écoutes</h2>
        {stats.count > 0 ? (
          <div className="mt-4 flex flex-col gap-2 text-sm">
            <p className="text-2xl font-semibold">
              {formatNumber(stats.count)} écoutes
            </p>
            {stats.firstPlayedAt ? (
              <p className="text-muted-foreground">
                Première écoute : {formatDate(stats.firstPlayedAt)}
              </p>
            ) : null}
            {stats.lastPlayedAt ? (
              <p className="text-muted-foreground">
                Dernière écoute : {formatDate(stats.lastPlayedAt)}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            Pas encore d&apos;écoute enregistrée.
          </p>
        )}
      </section>
    </main>
  );
}
