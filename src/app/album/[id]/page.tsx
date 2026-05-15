import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { spotifyFetch } from "@/lib/spotify/client";
import type { SpotifyAlbum } from "@/lib/spotify/types";
import { getAlbumPlayStats } from "@/db/queries/stats";
import { formatNumber } from "@/lib/utils";

// Spotify metadata is stable — re-fetch at most once an hour.
export const revalidate = 3600;

export default async function AlbumDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const { id } = await params;

  let album: SpotifyAlbum;
  try {
    album = await spotifyFetch<SpotifyAlbum>(userId, `/albums/${id}`);
  } catch {
    notFound();
  }

  const stats = await getAlbumPlayStats(userId, id);

  const image = album.images?.[0]?.url;
  const artistNames = album.artists?.map((a) => a.name).join(", ");
  const trackItems = album.tracks?.items ?? [];

  return (
    <main id="main" className="flex-1 flex flex-col px-6 py-12 max-w-3xl mx-auto w-full">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt=""
            decoding="async"
            fetchPriority="high"
            className="size-48 shrink-0 rounded-2xl object-cover shadow-lg"
          />
        ) : (
          <div className="size-48 shrink-0 rounded-2xl bg-muted" />
        )}
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">Album</p>
          <h1 className="text-3xl font-semibold">{album.name}</h1>
          {artistNames ? (
            <p className="mt-1 text-lg text-muted-foreground">{artistNames}</p>
          ) : null}
          <p className="mt-1 text-sm text-muted-foreground">
            {[
              album.release_date,
              album.total_tracks != null
                ? `${album.total_tracks} titre${album.total_tracks > 1 ? "s" : ""}`
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            {formatNumber(stats.count)} écoutes
          </p>
        </div>
      </div>

      {trackItems.length > 0 ? (
        <section className="mt-10">
          <h2 className="mb-4 text-lg font-semibold">Titres</h2>
          <div className="flex flex-col gap-1">
            {trackItems.map((track, index) => (
              <Link
                key={track.id}
                href={`/track/${track.id}`}
                className="flex items-center gap-3 rounded-xl px-3 py-2 transition hover:bg-accent"
              >
                <span className="w-6 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
                  {track.track_number ?? index + 1}
                </span>
                <p className="truncate font-medium">{track.name}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
