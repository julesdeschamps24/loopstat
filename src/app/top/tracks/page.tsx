import { Suspense } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { RankedRow } from "@/components/stats/ranked-list";
import { PeriodSelector } from "@/components/stats/period-selector";
import { StaggerItem, StaggerList } from "@/components/ui/motion";
import { getTopTracksFromStreams } from "@/db/queries/stats";
import {
  isStreamPeriod,
  periodSince,
  type StreamPeriod,
} from "@/lib/stats/period";
import { formatNumber } from "@/lib/utils";

// User-scoped local DB aggregation — always dynamic, no static caching.
export const dynamic = "force-dynamic";

const TOP_LIMIT = 100;

export default async function TopTracksPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const { period: rawPeriod } = await searchParams;
  const period: StreamPeriod = isStreamPeriod(rawPeriod) ? rawPeriod : "4w";

  const tracks = await getTopTracksFromStreams(
    userId,
    periodSince(period),
    TOP_LIMIT,
  );

  const emptyMessage =
    period === "all"
      ? "Aucune écoute enregistrée. Importe ton historique pour voir tes tops lifetime."
      : "Aucun titre pour cette période.";

  return (
    <main id="main" className="flex-1 flex flex-col px-6 py-12 max-w-5xl mx-auto w-full">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Top titres</h1>
        <Suspense
          fallback={
            <div className="h-10 w-75 rounded-full border bg-card" />
          }
        >
          <PeriodSelector current={period} />
        </Suspense>
      </header>

      {tracks.length === 0 ? (
        <p className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </p>
      ) : (
        <StaggerList key={period} className="flex flex-col gap-1">
          {tracks.map((track, index) => (
            <StaggerItem key={track.trackId}>
              <RankedRow
                rank={index + 1}
                title={track.name}
                href={`/track/${track.trackId}`}
                subtitle={track.artistNames.join(", ")}
                imageUrl={track.albumImageUrl ?? undefined}
                metric={`${formatNumber(track.plays)} écoutes`}
              />
            </StaggerItem>
          ))}
        </StaggerList>
      )}
    </main>
  );
}
