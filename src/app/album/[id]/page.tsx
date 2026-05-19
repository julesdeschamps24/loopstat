import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import type { AlbumTrack } from "@/components/album/album-tracklist";
import { AlbumTracklist } from "@/components/album/album-tracklist";
import { OtherArtistAlbums } from "@/components/album/other-artist-albums";
import { TopTrackCard } from "@/components/album/top-track-card";
import { getDemoAlbum, isDemoId } from "@/lib/demo/data";
import { HourHeatmap } from "@/components/stats/hour-heatmap";
import { PeriodBreakdownGrid } from "@/components/stats/period-breakdown-grid";
import { SparklineMonthly } from "@/components/stats/sparkline-monthly";
import { formatDate, formatRelativeDate } from "@/lib/format/date";
import { upsertCatalogFromTracks } from "@/lib/spotify/catalog";
import { spotifyFetch } from "@/lib/spotify/client";
import type { SpotifyAlbum, SpotifyTrack } from "@/lib/spotify/types";
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

  if (isDemoId(id)) {
    const demo = getDemoAlbum(id);
    if (!demo) notFound();
    const { album, stats, tracks, breakdown, monthly, hours, quality, otherAlbums } = demo;
    const artistName = album.artistNames[0] ?? "";

    // Top track = celui avec le plus de plays (only shown if album has > 1 track with plays)
    const playedTracks = tracks.filter((t) => t.plays > 0);
    const topTrack =
      tracks.length > 1 && playedTracks.length > 1
        ? tracks.reduce((a, b) => (a.plays >= b.plays ? a : b))
        : null;

    return (
      <main
        id="main"
        className="flex-1 flex flex-col gap-8 px-6 py-12 max-w-3xl mx-auto w-full"
      >
        {/* 1. Hero */}
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
          <div className="size-48 shrink-0 rounded-2xl bg-muted" />
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">Album</p>
            <h1 className="text-3xl font-semibold">{album.name}</h1>
            <p className="mt-1 text-lg text-muted-foreground">
              {album.artistNames.join(", ")}
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              {formatNumber(stats.count)} écoute{stats.count > 1 ? "s" : ""}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Première écoute : {formatDate(stats.firstPlayedAt)}
            </p>
          </div>
        </div>

        {/* 2. Top track card */}
        {topTrack ? (
          <TopTrackCard
            trackId={topTrack.trackId}
            trackName={topTrack.name}
            artistName={artistName}
            imageUrl={null}
            plays={topTrack.plays}
            shareOfAlbum={topTrack.plays / stats.count}
          />
        ) : null}

        {/* 3. Tracklist with bars */}
        {tracks.length > 0 ? (
          <section className={cn(glassCard, "p-6")}>
            <h2 className="text-lg font-semibold">Tracklist</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Plays par titre — la barre montre la part au sein de l&apos;album.
            </p>
            <div className="mt-4">
              <AlbumTracklist tracks={tracks} />
            </div>
          </section>
        ) : null}

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
        </section>

        {/* 8. Autres albums de l'artiste */}
        {otherAlbums.length > 0 ? (
          <OtherArtistAlbums artistName={artistName} albums={otherAlbums} />
        ) : null}
      </main>
    );
  }

  let album: SpotifyAlbum;
  try {
    album = await spotifyFetch<SpotifyAlbum>(userId, `/albums/${id}`);
  } catch {
    notFound();
  }

  const primaryArtist = album.artists?.[0];
  const primaryArtistId = primaryArtist?.id ?? null;

  // Lazy-enrich : la réponse Spotify /albums/{id} contient déjà tous les champs
  // dont upsertCatalogFromTracks a besoin (sauf popularity, non critique).
  // On enrichit donc tous les tracks de cet album en 0 appel Spotify
  // supplémentaire. Permet à la page d'afficher les bons artistes/durées sans
  // attendre que le bulk worker arrive jusqu'à cet album.
  // Best-effort : un échec ne bloque pas le render (le worker rattrapera).
  try {
    const albumSimple = {
      id: album.id,
      name: album.name,
      release_date: album.release_date,
      release_date_precision: album.release_date_precision,
      images: album.images,
      total_tracks: album.total_tracks,
      album_type: album.album_type,
      artists: album.artists,
    };
    const lazyTracks: SpotifyTrack[] = (album.tracks?.items ?? [])
      .filter((t) => t.duration_ms != null)
      .map((t) => ({
        id: t.id,
        name: t.name,
        duration_ms: t.duration_ms!,
        explicit: t.explicit,
        preview_url: t.preview_url,
        external_ids: t.external_ids,
        artists: t.artists ?? album.artists ?? [],
        album: albumSimple,
      }));
    if (lazyTracks.length > 0) await upsertCatalogFromTracks(lazyTracks);
  } catch {
    // Best-effort, ne pas bloquer le render
  }

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
