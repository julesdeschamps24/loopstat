import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { HourHeatmap } from "@/components/stats/hour-heatmap";
import { PeriodBreakdownGrid } from "@/components/stats/period-breakdown-grid";
import { SparklineMonthly } from "@/components/stats/sparkline-monthly";
import { getDemoTrack, isDemoId } from "@/lib/demo/data";
import { enrichDemoFixtures } from "@/lib/demo/enrich";
import { db } from "@/db/client";
import { tracks, albums, trackArtists, artists } from "@/db/schema";
import {
  getTrackBreakdownByWindow,
  getTrackListeningHours,
  getTrackMonthlyPlays,
  getTrackPlayQuality,
  getTrackPlayStats,
} from "@/db/queries/stats";
import { cn, formatMs, formatNumber, glassCard } from "@/lib/utils";
import { formatDate } from "@/lib/format/date";
import { triggerSingleEnrich } from "@/lib/enrich/trigger";
import { enrichAlbumImageByDeezer } from "@/lib/deezer/catalog";

function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)} %`;
}

export default async function TrackDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/connexion");
  const userId = session.user.id;

  const { id: rawId } = await params;
  // Next.js 16 passes the param URL-encoded (e.g. "demo%3Aespresso"), but our
  // demo fixtures use a literal ":" prefix — decode so lookups match.
  const id = decodeURIComponent(rawId);

  if (isDemoId(id)) {
    const demo = getDemoTrack(id);
    if (!demo) notFound();
    const { track, stats, breakdown, monthly, hours, quality } = demo;
    const artistNames = track.artistNames.join(", ");
    const { trackImages } = await enrichDemoFixtures();
    const cover = trackImages.get(track.trackId) ?? null;

    return (
      <main id="main" className="flex-1 flex flex-col gap-8 px-6 py-12 max-w-3xl mx-auto w-full">
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
            <p className="text-sm text-muted-foreground">Titre</p>
            <h1 className="text-3xl font-semibold">{track.name}</h1>
            <p className="mt-1 text-lg text-muted-foreground">{artistNames}</p>
          </div>
        </div>

        <section className={cn(glassCard, "p-6")}>
          <h2 className="text-lg font-semibold">Tes écoutes</h2>
          <div className="mt-4 flex flex-col gap-2 text-sm">
            <p className="font-display italic text-4xl leading-none tabular-nums">
              {formatNumber(stats.count)}{" "}
              <span className="font-sans not-italic text-base text-muted-foreground">
                écoutes au total
              </span>
            </p>
            <p className="mt-2 text-muted-foreground">
              Première écoute : {formatDate(stats.firstPlayedAt)}
            </p>
            <p className="text-muted-foreground">
              Dernière écoute : {formatDate(stats.lastPlayedAt)}
            </p>
          </div>
        </section>

        <section className={cn(glassCard, "p-6")}>
          <h2 className="text-lg font-semibold">Par période</h2>
          <PeriodBreakdownGrid data={breakdown} />
        </section>

        <section className={cn(glassCard, "p-6")}>
          <h2 className="text-lg font-semibold">Évolution mensuelle</h2>
          <div className="mt-4">
            <SparklineMonthly data={monthly} />
          </div>
        </section>

        <section className={cn(glassCard, "p-6")}>
          <h2 className="text-lg font-semibold">Heure préférée</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Répartition des écoutes selon l&apos;heure de la journée.
          </p>
          <HourHeatmap data={hours} />
        </section>

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
      </main>
    );
  }

  // --- MODE RÉEL : DB only ---
  const [track] = await db
    .select({ id: tracks.id, name: tracks.name, albumId: tracks.albumId })
    .from(tracks)
    .where(eq(tracks.id, id))
    .limit(1);
  if (!track) notFound();

  // Fetch album for cover image.
  const album = track.albumId
    ? (
        await db
          .select()
          .from(albums)
          .where(eq(albums.id, track.albumId))
          .limit(1)
      )[0] ?? null
    : null;

  // Fetch artist names via trackArtists join.
  const trackArtistRows = await db
    .select({ name: artists.name })
    .from(trackArtists)
    .innerJoin(artists, eq(trackArtists.artistId, artists.id))
    .where(eq(trackArtists.trackId, id))
    .orderBy(trackArtists.position);
  const artistNames = trackArtistRows.map((r) => r.name).join(", ");

  const [stats, breakdown, monthly, hours, quality] = await Promise.all([
    getTrackPlayStats(userId, id),
    getTrackBreakdownByWindow(userId, id),
    getTrackMonthlyPlays(userId, id),
    getTrackListeningHours(userId, id),
    getTrackPlayQuality(userId, id),
  ]);

  if (album && album.imageUrl === null) {
    // Try inline Deezer enrich with a tight timeout — cover loads on first
    // visit instead of after a refresh. Falls back to background queue if
    // Deezer is slow.
    const primaryArtistName = trackArtistRows[0]?.name ?? "";
    try {
      await Promise.race([
        enrichAlbumImageByDeezer({
          albumId: album.id,
          albumName: album.name,
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
        .where(eq(albums.id, album.id))
        .limit(1);
      if (refreshed?.imageUrl) album.imageUrl = refreshed.imageUrl;
    } catch {
      // Inline failed (timeout or Deezer error) — enqueue background fallback
      void triggerSingleEnrich("album", album.id);
    }
  }

  const albumImage = album?.imageUrl ?? null;
  const hasPlays = stats.count > 0;

  return (
    <main id="main" className="flex-1 flex flex-col gap-8 px-6 py-12 max-w-3xl mx-auto w-full">
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
          {artistNames ? (
            <p className="mt-1 text-lg text-muted-foreground">{artistNames}</p>
          ) : null}
          {album?.name ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {album.name}
            </p>
          ) : null}
        </div>
      </div>

      <section className={cn(glassCard, "p-6")}>
        <h2 className="text-lg font-semibold">Tes écoutes</h2>
        {hasPlays ? (
          <div className="mt-4 flex flex-col gap-2 text-sm">
            <p className="font-display italic text-4xl leading-none tabular-nums">
              {formatNumber(stats.count)}{" "}
              <span className="font-sans not-italic text-base text-muted-foreground">
                écoutes au total
              </span>
            </p>
            {stats.firstPlayedAt ? (
              <p className="mt-2 text-muted-foreground">
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

      {hasPlays ? (
        <>
          <section className={cn(glassCard, "p-6")}>
            <h2 className="text-lg font-semibold">Par période</h2>
            <PeriodBreakdownGrid data={breakdown} />
          </section>

          {monthly.length > 0 ? (
            <section className={cn(glassCard, "p-6")}>
              <h2 className="text-lg font-semibold">Évolution mensuelle</h2>
              <div className="mt-4">
                <SparklineMonthly data={monthly} />
              </div>
            </section>
          ) : null}

          <section className={cn(glassCard, "p-6")}>
            <h2 className="text-lg font-semibold">Heure préférée</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Répartition des écoutes selon l&apos;heure de la journée.
            </p>
            <HourHeatmap data={hours} />
          </section>

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
    </main>
  );
}
