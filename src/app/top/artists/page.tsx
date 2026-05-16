import { Suspense } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { RankedRow } from "@/components/stats/ranked-list";
import { PeriodSelector } from "@/components/stats/period-selector";
import { STREAM_PERIODS } from "@/lib/stats/period";
import { StaggerItem, StaggerList } from "@/components/ui/motion";
import { fetchTopArtists, isTopPeriod, type TopPeriod } from "@/lib/spotify/top";
import { getPlayCountsForArtists } from "@/db/queries/stats";
import { formatNumber } from "@/lib/utils";

// Re-fetch the Spotify Top Read data at most once an hour; repeated navigation
// between periods reuses the cached RSC payload instead of re-hitting Spotify.
export const revalidate = 3600;

export default async function TopArtistsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const { period: rawPeriod } = await searchParams;
  const period: TopPeriod = isTopPeriod(rawPeriod) ? rawPeriod : "4w";

  const artists = await fetchTopArtists(userId, period);
  const playCounts = await getPlayCountsForArtists(
    userId,
    artists.map((a) => a.id),
  );

  return (
    <main id="main" className="flex-1 flex flex-col px-6 py-12 max-w-5xl mx-auto w-full">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Top artistes</h1>
        <Suspense
          fallback={
            <div className="h-10 w-[232px] rounded-full border bg-card" />
          }
        >
          <PeriodSelector
            current={period}
            periods={STREAM_PERIODS.filter((p) => p.value !== "all")}
          />
        </Suspense>
      </header>

      {artists.length === 0 ? (
        <p className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
          Aucun artiste pour cette période.
        </p>
      ) : (
        <StaggerList key={period} className="flex flex-col gap-1">
          {artists.map((artist, index) => {
            const count = playCounts.get(artist.id) ?? 0;
            return (
              <StaggerItem key={artist.id}>
                <RankedRow
                  rank={index + 1}
                  title={artist.name}
                  href={`/artist/${artist.id}`}
                  imageUrl={artist.images?.[0]?.url}
                  metric={
                    count > 0 ? `${formatNumber(count)} écoutes` : undefined
                  }
                />
              </StaggerItem>
            );
          })}
        </StaggerList>
      )}
    </main>
  );
}
