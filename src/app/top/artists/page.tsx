import { Suspense } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { RankedRow } from "@/components/stats/ranked-list";
import { PeriodSelector } from "@/components/stats/period-selector";
import { StaggerItem, StaggerList } from "@/components/ui/motion";
import { getTopArtistsFromStreams } from "@/db/queries/stats";
import { hasCompletedImport } from "@/db/queries/imports";
import {
  isStreamPeriod,
  periodSince,
  type StreamPeriod,
} from "@/lib/stats/period";
import { formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TOP_LIMIT = 100;

export default async function TopArtistsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const { period: rawPeriod } = await searchParams;
  const period: StreamPeriod = isStreamPeriod(rawPeriod) ? rawPeriod : "4w";

  const [artists, imported] = await Promise.all([
    getTopArtistsFromStreams(userId, periodSince(period), TOP_LIMIT),
    hasCompletedImport(userId),
  ]);

  const emptyMessage =
    period === "all" && !imported
      ? "Aucune écoute lifetime enregistrée. Importe ton historique Spotify pour débloquer tes tops all-time."
      : "Aucun artiste pour cette période.";

  return (
    <main id="main" className="flex-1 flex flex-col px-6 py-12 max-w-5xl mx-auto w-full">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Top artistes</h1>
        <Suspense
          fallback={
            <div className="h-10 w-75 rounded-full border bg-card" />
          }
        >
          <PeriodSelector current={period} />
        </Suspense>
      </header>

      {artists.length === 0 ? (
        <p className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </p>
      ) : (
        <StaggerList key={period} className="flex flex-col gap-1">
          {artists.map((artist, index) => (
            <StaggerItem key={artist.artistId}>
              <RankedRow
                rank={index + 1}
                title={artist.name}
                href={`/artist/${artist.artistId}`}
                imageUrl={artist.imageUrl ?? undefined}
                metric={`${formatNumber(artist.plays)} écoutes`}
              />
            </StaggerItem>
          ))}
        </StaggerList>
      )}
    </main>
  );
}
