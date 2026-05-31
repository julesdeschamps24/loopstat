import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { OtherArtistAlbums } from "@/components/album/other-artist-albums";
import { RelatedArtists } from "@/components/artist/related-artists";
import { EmptyState } from "@/components/stats/empty-state";
import { RankedList, RankedRow } from "@/components/stats/ranked-list";
import { SparklineMonthly } from "@/components/stats/sparkline-monthly";
import { ArtistAvatar } from "@/components/ui/artist-avatar";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { db } from "@/db/client";
import {
  getArtistMonthlyPlays,
  getArtistPlayStats,
  getCoListenedArtists,
  getUserTopAlbumsByArtist,
  getUserTopTracksByArtist,
  getUserTotalMsPlayed,
} from "@/db/queries/stats";
import { artists } from "@/db/schema";
import { getDemoArtist, isDemoId } from "@/lib/demo/data";
import { enrichDemoFixtures } from "@/lib/demo/enrich";
import { formatRelativeDate } from "@/lib/format/date";
import { cn, formatNumber, glassCard } from "@/lib/utils";
import { triggerSingleEnrich } from "@/lib/enrich/trigger";
import { enrichArtistImageByDeezer } from "@/lib/deezer/catalog";

function PercentDisplay({ percent }: { percent: number }) {
  // 2-decimal precision with French comma separator. "0.005" still rounds to
  // "0,01" so we'd never show a misleading "0,00%" — but for a true 0 we want
  // to suppress the section's value entirely (handled by the caller).
  const display =
    percent < 0.01
      ? "< 0,01"
      : percent.toFixed(2).replace(".", ",");
  return (
    <div className="text-right">
      <p
        className="font-display italic leading-none"
        style={{
          fontSize: "64px",
          fontWeight: 400,
          letterSpacing: "-0.03em",
          background: "linear-gradient(135deg, #c4b5fd, #ec4899)",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: "transparent",
        }}
      >
        {display}%
      </p>
      <p className="mt-1 text-[10px] uppercase tracking-[1.5px] text-muted-foreground">
        de ton temps
      </p>
    </div>
  );
}

function ArtistHero({
  name,
  imageUrl,
  firstPlayedAt,
  lastPlayedAt,
  totalPercent,
}: {
  name: string;
  imageUrl: string | null;
  firstPlayedAt: Date | null;
  lastPlayedAt: Date | null;
  totalPercent: number;
}) {
  return (
    <section
      className="grid items-center gap-6 rounded-[20px] border p-6"
      style={{
        gridTemplateColumns: "144px 1fr auto",
        background: "rgba(124, 58, 237, 0.06)",
        borderColor: "rgba(124, 58, 237, 0.2)",
      }}
    >
      <ArtistAvatar name={name} imageUrl={imageUrl} size={144} />
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-[1.5px] text-muted-foreground">
          Artiste
        </p>
        <h1
          className="font-display italic"
          style={{ fontSize: "32px", lineHeight: 1, marginTop: 4 }}
        >
          {name}
        </h1>
        <div className="mt-3 space-y-1 text-sm text-muted-foreground">
          {firstPlayedAt ? (
            <p>
              Découvert{" "}
              <strong className="text-foreground">
                {formatRelativeDate(firstPlayedAt)}
              </strong>
            </p>
          ) : null}
          {lastPlayedAt ? (
            <p>
              Dernière écoute{" "}
              <strong className="text-foreground">
                {formatRelativeDate(lastPlayedAt)}
              </strong>
            </p>
          ) : null}
        </div>
      </div>
      <PercentDisplay percent={totalPercent} />
    </section>
  );
}

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

  // ===== DEMO MODE =====
  if (isDemoId(id)) {
    const demo = getDemoArtist(id);
    if (!demo) notFound();
    const { artist, stats, topTracks, topAlbums, monthly, related, totalPercent } = demo;

    const { artistImages, trackImages } = await enrichDemoFixtures();
    const artistImage = artistImages.get(artist.artistId) ?? artist.imageUrl;

    return (
      <main id="main" className="flex-1 flex flex-col gap-8 px-6 py-12 max-w-3xl mx-auto w-full">
          <ArtistHero
            name={artist.name}
            imageUrl={artistImage}
            firstPlayedAt={stats.firstPlayedAt}
            lastPlayedAt={stats.lastPlayedAt}
            totalPercent={totalPercent}
          />

          <section>
            <h2 className="mb-4 text-lg font-semibold">Tes titres les plus écoutés</h2>
            {topTracks.length === 0 ? (
              <EmptyState
                title="Pas encore d'écoute enregistrée"
                description="Tes titres les plus écoutés de cet artiste apparaîtront ici."
              />
            ) : (
              <RankedList>
                {topTracks.map((t, i) => (
                  <RankedRow
                    key={t.trackId}
                    rank={i + 1}
                    title={t.trackName}
                    href={`/track/${t.trackId}`}
                    imageUrl={trackImages.get(t.trackId) ?? undefined}
                    metric={`${formatNumber(t.playCount)} écoutes`}
                  />
                ))}
              </RankedList>
            )}
          </section>

          {topAlbums.length > 0 ? (
            <OtherArtistAlbums
              artistName={artist.name}
              albums={topAlbums.map((a) => ({
                albumId: a.albumId,
                name: a.name,
                imageUrl: a.imageUrl,
                plays: a.playCount,
              }))}
            />
          ) : null}

          {monthly.length >= 3 ? (
            <section className={cn(glassCard, "p-6")}>
              <h2 className="text-lg font-semibold">Évolution mensuelle</h2>
              <div className="mt-4">
                <SparklineMonthly data={monthly} />
              </div>
            </section>
          ) : null}

          {related.length > 0 ? (
            <section>
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
                Artistes connexes
                <HelpTooltip>
                  Les artistes que tu écoutes souvent dans la même session (±30 min) que celui-ci. Plus le nombre de co-écoutes est élevé, plus la connexion est forte.
                </HelpTooltip>
              </h2>
              <RelatedArtists
                artists={related.map((r) => ({
                  ...r,
                  imageUrl: artistImages.get(r.artistId) ?? r.imageUrl,
                }))}
              />
            </section>
          ) : null}
      </main>
    );
  }

  // ===== REAL MODE =====
  const [artist] = await db.select().from(artists).where(eq(artists.id, id)).limit(1);
  if (!artist) notFound();

  if (artist.imageUrl === null) {
    // Try inline Deezer enrich with a tight timeout — image loads on first
    // visit instead of after a refresh. Falls back to background queue if
    // Deezer is slow.
    try {
      await Promise.race([
        enrichArtistImageByDeezer({
          artistId: artist.id,
          name: artist.name,
        }),
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error("deezer-timeout")), 500),
        ),
      ]);
      // Re-fetch the artist row to pick up the just-written image_url
      const [refreshed] = await db
        .select()
        .from(artists)
        .where(eq(artists.id, artist.id))
        .limit(1);
      if (refreshed?.imageUrl) artist.imageUrl = refreshed.imageUrl;
    } catch {
      // Inline failed (timeout or Deezer error) — enqueue background fallback
      void triggerSingleEnrich("artist", artist.id);
    }
  }

  const [stats, topTracks, topAlbums, monthly, related, totalMs] =
    await Promise.all([
      getArtistPlayStats(userId, id),
      getUserTopTracksByArtist(userId, id, 20),
      getUserTopAlbumsByArtist(userId, id, 10),
      getArtistMonthlyPlays(userId, id),
      getCoListenedArtists(userId, id, 5),
      getUserTotalMsPlayed(userId),
    ]);

  // % du temps d'écoute total — basé sur ms_played lifetime.
  const totalPercent = totalMs > 0 ? (stats.msPlayed / totalMs) * 100 : 0;

  return (
    <main id="main" className="flex-1 flex flex-col gap-8 px-6 py-12 max-w-3xl mx-auto w-full">
        <ArtistHero
          name={artist.name}
          imageUrl={artist.imageUrl}
          firstPlayedAt={stats.firstPlayedAt}
          lastPlayedAt={stats.lastPlayedAt}
          totalPercent={totalPercent}
        />

        <section>
          <h2 className="mb-4 text-lg font-semibold">Tes titres les plus écoutés</h2>
          {topTracks.length === 0 ? (
            <EmptyState
              title="Pas encore d'écoute enregistrée"
              description="Tes titres les plus écoutés de cet artiste apparaîtront ici."
            />
          ) : (
            <RankedList>
              {topTracks.map((t, i) => (
                <RankedRow
                  key={t.trackId}
                  rank={i + 1}
                  title={t.trackName}
                  href={`/track/${t.trackId}`}
                  metric={`${formatNumber(t.playCount)} écoutes`}
                />
              ))}
            </RankedList>
          )}
        </section>

        {topAlbums.length > 0 ? (
          <OtherArtistAlbums
            artistName={artist.name}
            albums={topAlbums.map((a) => ({
              albumId: a.albumId,
              name: a.name,
              imageUrl: a.imageUrl,
              plays: a.playCount,
            }))}
          />
        ) : null}

        {monthly.length >= 3 ? (
          <section className={cn(glassCard, "p-6")}>
            <h2 className="text-lg font-semibold">Évolution mensuelle</h2>
            <div className="mt-4">
              <SparklineMonthly data={monthly} />
            </div>
          </section>
        ) : null}

        {related.length > 0 ? (
          <section>
            <h2 className="mb-4 text-lg font-semibold">Artistes connexes</h2>
            <RelatedArtists artists={related} />
          </section>
        ) : null}
    </main>
  );
}
