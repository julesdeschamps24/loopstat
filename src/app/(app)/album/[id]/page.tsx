import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import type { AlbumTrack } from "@/components/album/album-tracklist";
import { AlbumTracklist } from "@/components/album/album-tracklist";
import { OtherArtistAlbums } from "@/components/album/other-artist-albums";
import { TopTrackCard } from "@/components/album/top-track-card";
import { getDemoAlbum, isDemoId } from "@/lib/demo/data";
import { enrichDemoFixtures } from "@/lib/demo/enrich";
import { HourHeatmap } from "@/components/stats/hour-heatmap";
import { PeriodBreakdownGrid } from "@/components/stats/period-breakdown-grid";
import { SparklineMonthly } from "@/components/stats/sparkline-monthly";
import { formatDate, formatRelativeDate } from "@/lib/format/date";
import { db } from "@/db/client";
import { albums, albumArtists, artists } from "@/db/schema";
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
import { triggerSingleEnrich } from "@/lib/enrich/trigger";
import { enrichAlbumImageByDeezer } from "@/lib/deezer/catalog";

function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)} %`;
}

export default async function AlbumDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/connexion");
  const userId = session.user.id;

  const { id: rawId } = await params;
  // Next.js 16 passes the param URL-encoded (e.g. "demo%3Ashort-n-sweet"),
  // but our demo fixtures use a literal ":" prefix — decode so lookups match.
  const id = decodeURIComponent(rawId);

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

    const { albumImages, trackImages } = await enrichDemoFixtures();
    const cover = albumImages.get(album.albumId) ?? null;

    return (
      <main
        id="main"
        className="flex-1 flex flex-col gap-8 px-6 py-12 max-w-3xl mx-auto w-full"
      >
        {/* 1. Hero */}
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cover}
              alt=""
              className="size-48 shrink-0 rounded-2xl object-cover shadow-lg"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="size-48 shrink-0 rounded-2xl bg-muted" />
          )}
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
            imageUrl={trackImages.get(topTrack.trackId) ?? cover}
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
          <OtherArtistAlbums
            artistName={artistName}
            albums={otherAlbums.map((a) => ({
              ...a,
              imageUrl: albumImages.get(a.albumId) ?? a.imageUrl,
            }))}
          />
        ) : null}
      </main>
    );
  }

  // --- MODE RÉEL : DB only ---
  const [albumRow] = await db
    .select()
    .from(albums)
    .where(eq(albums.id, id))
    .limit(1);
  if (!albumRow) notFound();

  // Fetch primary artist for this album (position 0 or first).
  const albumArtistRows = await db
    .select({ artistId: albumArtists.artistId, name: artists.name })
    .from(albumArtists)
    .innerJoin(artists, eq(albumArtists.artistId, artists.id))
    .where(eq(albumArtists.albumId, id))
    .limit(5);

  const primaryArtistId = albumArtistRows[0]?.artistId ?? null;
  const primaryArtistName = albumArtistRows[0]?.name ?? "";
  const artistNames = albumArtistRows.map((r) => r.name).join(", ");

  if (albumRow.imageUrl === null) {
    // Try inline Deezer enrich with a tight timeout — cover loads on first
    // visit instead of after a refresh. Falls back to background queue if
    // Deezer is slow.
    try {
      await Promise.race([
        enrichAlbumImageByDeezer({
          albumId: albumRow.id,
          albumName: albumRow.name,
          artistName: primaryArtistName,
        }),
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error("deezer-timeout")), 500),
        ),
      ]);
      // Re-fetch the album row to pick up the just-written image_url
      const [refreshed] = await db
        .select()
        .from(albums)
        .where(eq(albums.id, albumRow.id))
        .limit(1);
      if (refreshed?.imageUrl) albumRow.imageUrl = refreshed.imageUrl;
    } catch {
      // Inline failed (timeout or Deezer error) — enqueue background fallback
      void triggerSingleEnrich("album", albumRow.id);
    }
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

  const image = albumRow.imageUrl;
  const hasPlays = stats.count > 0;

  // Build tracklist from DB track plays (ordered by name in the query).
  // trackNumber is null in the new schema — use index as fallback display order.
  const orderedTracks: AlbumTrack[] = trackPlays.map((t, idx) => ({
    trackId: t.trackId,
    name: t.name,
    trackNumber: t.trackNumber ?? idx + 1,
    plays: t.plays,
  }));

  // Top track: ligne avec plays max. null si 0 plays globaux OU 1 seul track
  // joué OU 1 seul track total dans l'album.
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
            {albumRow.releaseDate ? ` · ${albumRow.releaseDate}` : ""}
            {albumRow.totalTracks != null
              ? ` · ${albumRow.totalTracks} titre${albumRow.totalTracks > 1 ? "s" : ""}`
              : ""}
          </p>
          <h1 className="text-3xl font-semibold">{albumRow.name}</h1>
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
          artistName={artistNames}
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
      {primaryArtistId && otherAlbums.length > 0 ? (
        <OtherArtistAlbums
          artistName={albumArtistRows[0]?.name ?? ""}
          albums={otherAlbums}
        />
      ) : null}
    </main>
  );
}
