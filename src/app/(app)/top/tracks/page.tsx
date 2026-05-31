import { Suspense } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { RankedRow } from "@/components/stats/ranked-list";
import { PeriodSelector } from "@/components/stats/period-selector";
import { ShareButton } from "@/components/share-button";
import { StaggerItem, StaggerList } from "@/components/ui/motion";
import { getTopTracksFromStreams, getUserLatestPlayedAt } from "@/db/queries/stats";
import { hasCompletedImport } from "@/db/queries/imports";
import { getProfile } from "@/db/queries/users";
import { DemoModeBanner } from "@/components/onboarding/demo-mode-banner";
import { getEnrichedDemoTopTracks } from "@/lib/demo/enrich";
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

  const hasImport = await hasCompletedImport(userId);

  const { period: rawPeriod } = await searchParams;
  const period: StreamPeriod = isStreamPeriod(rawPeriod) ? rawPeriod : "1w";

  if (!hasImport) {
    const tracks = await getEnrichedDemoTopTracks();
    return (
      <>
        <DemoModeBanner />
        <main
          id="main"
          className="flex-1 flex flex-col px-6 py-12 max-w-5xl mx-auto w-full"
        >
          <header className="mb-2 flex flex-wrap items-center justify-between gap-4">
            <h1 className="text-2xl font-semibold">Top titres</h1>
            <Suspense fallback={<div className="h-10 w-75 rounded-full border bg-card" />}>
              <PeriodSelector current={period} />
            </Suspense>
          </header>
          <p className="mb-8 text-sm text-muted-foreground">
            Ces données sont fictives — importe ton historique pour voir les tiennes.
          </p>
          <StaggerList className="flex flex-col gap-1">
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
        </main>
      </>
    );
  }

  const latestPlayedAt = await getUserLatestPlayedAt(userId);
  const refDate = latestPlayedAt ?? new Date();
  const [tracks, profile] = await Promise.all([
    getTopTracksFromStreams(userId, periodSince(period, refDate), TOP_LIMIT),
    getProfile(userId),
  ]);
  const imported = hasImport;
  const shareUsername =
    profile?.isPublic && profile.username ? profile.username : undefined;

  const emptyMessage =
    period === "all" && !imported
      ? "Aucune écoute lifetime enregistrée. Importe ton historique Spotify pour débloquer tes tops all-time."
      : "Aucun titre pour cette période — écoute quelques sons puis reviens dans ~30 min (le polling synchronise automatiquement).";

  return (
    <main id="main" className="flex-1 flex flex-col px-6 py-12 max-w-5xl mx-auto w-full">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Top titres</h1>
        <div className="flex flex-wrap items-center gap-2">
          {shareUsername ? <ShareButton username={shareUsername} context="tracks" /> : null}
          <Suspense
            fallback={
              <div className="h-10 w-75 rounded-full border bg-card" />
            }
          >
            <PeriodSelector current={period} />
          </Suspense>
        </div>
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
