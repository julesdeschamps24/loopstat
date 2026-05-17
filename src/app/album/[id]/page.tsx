import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import type { AlbumTrack } from "@/components/album/album-tracklist";
import { AlbumTracklist } from "@/components/album/album-tracklist";
import { OtherArtistAlbums } from "@/components/album/other-artist-albums";
import { TopTrackCard } from "@/components/album/top-track-card";
import { HourHeatmap } from "@/components/stats/hour-heatmap";
import { PeriodBreakdownGrid } from "@/components/stats/period-breakdown-grid";
import { SparklineMonthly } from "@/components/stats/sparkline-monthly";
import { formatDate, formatRelativeDate } from "@/lib/format/date";
import { spotifyFetch } from "@/lib/spotify/client";
import type { SpotifyAlbum } from "@/lib/spotify/types";
import {
  getAlbumBreakdownByWindow,
  getAlbumListeningHours,
  getAlbumMonthlyPlays,
  getAlbumPlayQuality,
  getAlbumPlayStats,
  getAlbumTrackPlays,
  getOtherAlbumsByArtist,
} from "@/db/queries/stats";
import { cn, formatMs, formatNumber, glassCard } from "@/lib/utils";

// Spotify metadata is stable — re-fetch at most once an hour.
export const revalidate = 3600;

function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)} %`;
}

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

  const primaryArtist = album.artists?.[0];
  const primaryArtistId = primaryArtist?.id ?? null;

  const [stats, trackPlays, breakdown, monthly, hours, quality, otherAlbums] =
    await Promise.all([
      getAlbumPlayStats(userId, id),
      getAlbumTrackPlays(userId, id),
      getAlbumBreakdownByWindow(userId, id),
      getAlbumMonthlyPlays(userId, id),
      getAlbumListeningHours(userId, id),
      getAlbumPlayQuality(userId, id),
      primaryArtistId
        ? getOtherAlbumsByArtist(userId, primaryArtistId, id, 10)
        : Promise.resolve([]),
    ]);

  const image = album.images?.[0]?.url;
  const artistNames = album.artists?.map((a) => a.name).join(", ");
  const hasPlays = stats.count > 0;

  // Compose tracklist in Spotify's track_number order (DB schema doesn't
  // persist track_number, so we use Spotify's items[] as authority and join
  // with per-track plays from getAlbumTrackPlays via a Map lookup).
  const playsByTrackId = new Map(trackPlays.map((t) => [t.trackId, t.plays]));
  const orderedTracks: AlbumTrack[] = (album.tracks?.items ?? []).map(
    (item, idx) => ({
      trackId: item.id,
      name: item.name,
      trackNumber: item.track_number ?? idx + 1,
      plays: playsByTrackId.get(item.id) ?? 0,
    }),
  );

  // Top track: ligne avec plays max. null si 0 plays globaux OU 1 seul track
  // joué OU 1 seul track total dans l'album (single — redondant avec la
  // tracklist).
  const playedTracks = orderedTracks.filter((t) => t.plays > 0);
  const topTrack =
    orderedTracks.length > 1 && playedTracks.length > 1
      ? orderedTracks.reduce((a, b) => (a.plays >= b.plays ? a : b))
      : null;

  const totalHours = stats.totalMsPlayed / (1000 * 60 * 60);
  const totalMinutesRemainder = Math.floor(
    (stats.totalMsPlayed / (1000 * 60)) % 60,
  );
  const totalDurationStr =
    stats.totalMsPlayed > 0
      ? totalHours >= 1
        ? `${Math.floor(totalHours)} h ${totalMinutesRemainder} m`
        : `${Math.floor(stats.totalMsPlayed / (1000 * 60))} m`
      : null;

  return (
    <main
      id="main"
      className="flex-1 flex flex-col gap-8 px-6 py-12 max-w-3xl mx-auto w-full"
    >
      {/* 1. Hero */}
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
          <p className="text-sm text-muted-foreground">
            Album
            {album.release_date ? ` · ${album.release_date}` : ""}
            {album.total_tracks != null
              ? ` · ${album.total_tracks} titre${album.total_tracks > 1 ? "s" : ""}`
              : ""}
          </p>
          <h1 className="text-3xl font-semibold">{album.name}</h1>
          {artistNames ? (
            <p className="mt-1 text-lg text-muted-foreground">{artistNames}</p>
          ) : null}
          {hasPlays ? (
            <>
              <p className="mt-3 text-sm text-muted-foreground">
                {formatNumber(stats.count)} écoute{stats.count > 1 ? "s" : ""}
                {totalDurationStr ? ` · ${totalDurationStr} d'écoute` : ""}
              </p>
              {stats.firstPlayedAt && stats.lastPlayedAt ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Première : {formatDate(stats.firstPlayedAt)} · Dernière :{" "}
                  {formatRelativeDate(stats.lastPlayedAt)}
                </p>
              ) : null}
            </>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Pas encore d&apos;écoute enregistrée.
            </p>
          )}
        </div>
      </div>

      {/* 2. Top track card (album-specific) */}
      {topTrack ? (
        <TopTrackCard
          trackId={topTrack.trackId}
          trackName={topTrack.name}
          artistName={artistNames ?? ""}
          imageUrl={image ?? null}
          plays={topTrack.plays}
          shareOfAlbum={topTrack.plays / stats.count}
        />
      ) : null}

      {/* 3. Tracklist with bars */}
      {orderedTracks.length > 0 ? (
        <section className={cn(glassCard, "p-6")}>
          <h2 className="text-lg font-semibold">Tracklist</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Plays par titre — la barre montre la part au sein de l&apos;album.
          </p>
          <div className="mt-4">
            <AlbumTracklist tracks={orderedTracks} />
          </div>
        </section>
      ) : null}

      {hasPlays ? (
        <>
          {/* 4. Évolution mensuelle */}
          {monthly.length >= 2 ? (
            <section className={cn(glassCard, "p-6")}>
              <h2 className="text-lg font-semibold">Évolution mensuelle</h2>
              <div className="mt-4">
                <SparklineMonthly data={monthly} />
              </div>
            </section>
          ) : null}

          {/* 5. Par période */}
          <section className={cn(glassCard, "p-6")}>
            <h2 className="text-lg font-semibold">Par période</h2>
            <PeriodBreakdownGrid data={breakdown} />
          </section>

          {/* 6. Heure préférée */}
          <section className={cn(glassCard, "p-6")}>
            <h2 className="text-lg font-semibold">Heure préférée</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Répartition des écoutes selon l&apos;heure de la journée.
            </p>
            <HourHeatmap data={hours} />
          </section>

          {/* 7. Qualité d'écoute */}
          <section className={cn(glassCard, "p-6")}>
            <h2 className="text-lg font-semibold">Qualité d&apos;écoute</h2>
            {quality.avgMs == null || quality.skipRate == null ? (
              <p className="mt-4 text-sm text-muted-foreground">
                Donnée indisponible pour cette source d&apos;écoute.
              </p>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="rounded-xl bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">
                    Durée moyenne
                  </p>
                  <p className="mt-2 font-display italic text-2xl leading-none tabular-nums">
                    {formatMs(quality.avgMs)}
                  </p>
                </div>
                <div className="rounded-xl bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">
                    Taux de skip
                  </p>
                  <p className="mt-2 font-display italic text-2xl leading-none tabular-nums">
                    {formatPercent(quality.skipRate)}
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Écoute &lt; 30 s
                  </p>
                </div>
              </div>
            )}
          </section>
        </>
      ) : null}

      {/* 8. Autres albums de l'artiste */}
      {primaryArtist && otherAlbums.length > 0 ? (
        <OtherArtistAlbums
          artistName={primaryArtist.name}
          albums={otherAlbums}
        />
      ) : null}
    </main>
  );
}
