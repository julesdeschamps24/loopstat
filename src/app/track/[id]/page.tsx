import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { HourHeatmap } from "@/components/stats/hour-heatmap";
import { PeriodBreakdownGrid } from "@/components/stats/period-breakdown-grid";
import { SparklineMonthly } from "@/components/stats/sparkline-monthly";
import { getDemoTrack, isDemoId } from "@/lib/demo/data";
import { spotifyFetch } from "@/lib/spotify/client";
import { upsertCatalogFromTracks } from "@/lib/spotify/catalog";
import type { SpotifyTrack } from "@/lib/spotify/types";
import {
  getTrackBreakdownByWindow,
  getTrackListeningHours,
  getTrackMonthlyPlays,
  getTrackPlayQuality,
  getTrackPlayStats,
} from "@/db/queries/stats";
import { cn, formatMs, formatNumber, glassCard } from "@/lib/utils";
import { formatDate } from "@/lib/format/date";

// Spotify metadata is stable — re-fetch at most once an hour.
export const revalidate = 3600;

function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)} %`;
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

  if (isDemoId(id)) {
    const demo = getDemoTrack(id);
    if (!demo) notFound();
    const { track, stats, breakdown, monthly, hours, quality } = demo;
    const artistNames = track.artistNames.join(", ");
    const hasPlays = stats.count > 0;

    return (
      <main id="main" className="flex-1 flex flex-col gap-8 px-6 py-12 max-w-3xl mx-auto w-full">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
          <div className="size-48 shrink-0 rounded-2xl bg-muted" />
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

  let track: SpotifyTrack;
  try {
    track = await spotifyFetch<SpotifyTrack>(userId, `/tracks/${id}`);
  } catch {
    notFound();
  }

  const [stats, breakdown, monthly, hours, quality] = await Promise.all([
    getTrackPlayStats(userId, id),
    getTrackBreakdownByWindow(userId, id),
    getTrackMonthlyPlays(userId, id),
    getTrackListeningHours(userId, id),
    getTrackPlayQuality(userId, id),
  ]);

  // Keep the catalog warm — best-effort, never block the render on it.
  try {
    await upsertCatalogFromTracks([track]);
  } catch {
    // ignore — purely a cache-warming side effect
  }

  const albumImage = track.album?.images?.[0]?.url;
  const artistNames = track.artists.map((a) => a.name).join(", ");
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
          <p className="mt-1 text-lg text-muted-foreground">{artistNames}</p>
          {track.album?.name ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {track.album.name}
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
