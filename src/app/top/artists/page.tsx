import { Suspense } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { RankedList, RankedRow } from "@/components/stats/ranked-list";
import { PeriodSelector } from "@/components/stats/period-selector";
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
    <main className="flex-1 flex flex-col px-6 py-12 max-w-5xl mx-auto w-full">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Top artistes</h1>
        <Suspense
          fallback={
            <div className="h-10 w-[232px] rounded-full border bg-card" />
          }
        >
          <PeriodSelector current={period} />
        </Suspense>
      </header>

      {artists.length === 0 ? (
        <p className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
          Aucun artiste pour cette période.
        </p>
      ) : (
        <RankedList>
          {artists.map((artist, index) => {
            const count = playCounts.get(artist.id) ?? 0;
            const genres = artist.genres?.slice(0, 3).join(" · ");
            return (
              <RankedRow
                key={artist.id}
                rank={index + 1}
                title={artist.name}
                href={`/artist/${artist.id}`}
                subtitle={genres || undefined}
                imageUrl={artist.images?.[0]?.url}
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
