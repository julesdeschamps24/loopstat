import { Suspense } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { RankedRow } from "@/components/stats/ranked-list";
import { PeriodSelector } from "@/components/stats/period-selector";
import { ShareButton } from "@/components/share-button";
import { StaggerItem, StaggerList } from "@/components/ui/motion";
import { getTopArtistsFromStreams } from "@/db/queries/stats";
import { hasCompletedImport } from "@/db/queries/imports";
import { getProfile } from "@/db/queries/users";
import { DemoModeBanner } from "@/components/onboarding/demo-mode-banner";
import { DEMO_TOP_ARTISTS } from "@/lib/demo/data";
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

  const hasImport = await hasCompletedImport(userId);

  if (!hasImport) {
    return (
      <>
        <DemoModeBanner />
        <main
          id="main"
          className="flex-1 flex flex-col px-6 py-12 max-w-5xl mx-auto w-full"
        >
          <header className="mb-2 flex flex-wrap items-center justify-between gap-4">
            <h1 className="text-2xl font-semibold">Top artistes</h1>
          </header>
          <p className="mb-8 text-sm text-muted-foreground">
            Ces données sont fictives — importe ton historique pour voir les tiennes.
          </p>
          <StaggerList className="flex flex-col gap-1">
            {DEMO_TOP_ARTISTS.map((artist, index) => (
              <StaggerItem key={artist.artistId}>
                <RankedRow
                  rank={index + 1}
                  title={artist.name}
                  metric={`${formatNumber(artist.plays)} écoutes`}
                />
              </StaggerItem>
            ))}
          </StaggerList>
        </main>
      </>
    );
  }

  const { period: rawPeriod } = await searchParams;
  const period: StreamPeriod = isStreamPeriod(rawPeriod) ? rawPeriod : "4w";

  const [artists, profile] = await Promise.all([
    getTopArtistsFromStreams(userId, periodSince(period), TOP_LIMIT),
    getProfile(userId),
  ]);
  const imported = hasImport;
  const shareUsername =
    profile?.isPublic && profile.username ? profile.username : undefined;

  const emptyMessage =
    period === "all" && !imported
      ? "Aucune écoute lifetime enregistrée. Importe ton historique Spotify pour débloquer tes tops all-time."
      : "Aucun artiste pour cette période.";

  return (
    <main id="main" className="flex-1 flex flex-col px-6 py-12 max-w-5xl mx-auto w-full">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Top artistes</h1>
        <div className="flex flex-wrap items-center gap-2">
          {shareUsername ? <ShareButton username={shareUsername} context="artists" /> : null}
          <Suspense
            fallback={
              <div className="h-10 w-75 rounded-full border bg-card" />
            }
          >
            <PeriodSelector current={period} />
          </Suspense>
        </div>
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
