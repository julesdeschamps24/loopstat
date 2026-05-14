import { Suspense } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { RankedList, RankedRow } from "@/components/stats/ranked-list";
import { PeriodSelector } from "@/components/stats/period-selector";
import { fetchTopTracks, isTopPeriod, type TopPeriod } from "@/lib/spotify/top";
import { getPlayCountsForTracks } from "@/db/queries/stats";
import { formatNumber } from "@/lib/utils";

// Re-fetch the Spotify Top Read data at most once an hour; repeated navigation
// between periods reuses the cached RSC payload instead of re-hitting Spotify.
export const revalidate = 3600;

export default async function TopTracksPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const { period: rawPeriod } = await searchParams;
  const period: TopPeriod = isTopPeriod(rawPeriod) ? rawPeriod : "4w";

  const tracks = await fetchTopTracks(userId, period);
  const playCounts = await getPlayCountsForTracks(
    userId,
    tracks.map((t) => t.id),
  );

  return (
    <main className="flex-1 flex flex-col px-6 py-12 max-w-5xl mx-auto w-full">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Top titres</h1>
        <Suspense
          fallback={
            <div className="h-10 w-[232px] rounded-full border bg-card" />
          }
        >
          <PeriodSelector current={period} />
        </Suspense>
      </header>

      {tracks.length === 0 ? (
        <p className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
          Aucun titre pour cette période.
        </p>
      ) : (
        <RankedList>
          {tracks.map((track, index) => {
            const count = playCounts.get(track.id) ?? 0;
            return (
              <RankedRow
                key={track.id}
                rank={index + 1}
                title={track.name}
                subtitle={track.artists.map((a) => a.name).join(", ")}
                imageUrl={track.album?.images?.[0]?.url}
                metric={
                  count > 0 ? `${formatNumber(count)} écoutes` : undefined
                }
              />
            );
          })}
        </RankedList>
      )}
    </main>
  );
}
