import { Suspense } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { RankedList, RankedRow } from "@/components/stats/ranked-list";
import { PeriodSelector } from "@/components/stats/period-selector";
import { EmptyState } from "@/components/stats/empty-state";
import { fetchTopArtists, isTopPeriod, type TopPeriod } from "@/lib/spotify/top";
import type { SpotifyArtist } from "@/lib/spotify/types";

// Re-fetch the Spotify Top Read data at most once an hour; repeated navigation
// between periods reuses the cached RSC payload instead of re-hitting Spotify.
export const revalidate = 3600;

type DerivedGenre = {
  name: string;
  /** Sum of inverse-rank weights of artists tagged with this genre. */
  weight: number;
  /** How many of the user's top artists are tagged with this genre. */
  artistCount: number;
};

/** Spotify genres come back lowercase ("french hip hop"); title-case them. */
function titleCase(genre: string): string {
  return genre.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Spotify has no /me/top/genres endpoint, so we derive a ranking in-memory
 * from the top-artists payload: flat-map each artist's genres, weighting each
 * occurrence by inverse artist rank (`artists.length - index`, so the #1
 * artist contributes the most). Artists with no genres are skipped.
 */
function deriveTopGenres(artists: SpotifyArtist[]): DerivedGenre[] {
  const byName = new Map<string, DerivedGenre>();

  artists.forEach((artist, index) => {
    const weight = artists.length - index;
    for (const genre of artist.genres ?? []) {
      const existing = byName.get(genre);
      if (existing) {
        existing.weight += weight;
        existing.artistCount += 1;
      } else {
        byName.set(genre, { name: genre, weight, artistCount: 1 });
      }
    }
  });

  return [...byName.values()].sort((a, b) => b.weight - a.weight);
}

export default async function TopGenresPage({
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
  const genres = deriveTopGenres(artists);

  return (
    <main className="flex-1 flex flex-col px-6 py-12 max-w-5xl mx-auto w-full">
      <header className="mb-2 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Top genres</h1>
        <Suspense
          fallback={
            <div className="h-10 w-[232px] rounded-full border bg-card" />
          }
        >
          <PeriodSelector current={period} />
        </Suspense>
      </header>

      <p className="mb-8 text-sm text-muted-foreground">
        Classement dérivé de tes top artistes — Spotify ne fournit pas de
        palmarès de genres.
      </p>

      {genres.length === 0 ? (
        <EmptyState
          title="Aucun genre pour cette période."
          description="Tes top artistes ne sont pas encore associés à des genres."
        />
      ) : (
        <RankedList>
          {genres.map((genre, index) => (
            <RankedRow
              key={genre.name}
              rank={index + 1}
              title={titleCase(genre.name)}
              subtitle={`${genre.artistCount} ${
                genre.artistCount > 1 ? "artistes" : "artiste"
              }`}
            />
          ))}
        </RankedList>
      )}
    </main>
  );
}
