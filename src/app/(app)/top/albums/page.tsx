import { Suspense } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { RankedRow } from "@/components/stats/ranked-list";
import { PeriodSelector } from "@/components/stats/period-selector";
import { ShareButton } from "@/components/share-button";
import { EmptyState } from "@/components/stats/empty-state";
import { StaggerItem, StaggerList } from "@/components/ui/motion";
import { getTopAlbumsFromStreams, getUserLatestPlayedAt } from "@/db/queries/stats";
import { hasCompletedImport } from "@/db/queries/imports";
import { getProfile } from "@/db/queries/users";
import { DemoModeBanner } from "@/components/onboarding/demo-mode-banner";
import { getEnrichedDemoTopAlbums } from "@/lib/demo/enrich";
import {
  isStreamPeriod,
  periodSince,
  type StreamPeriod,
} from "@/lib/stats/period";
import { formatNumber } from "@/lib/utils";
import { isPremium } from "@/db/queries/billing";
import { TopListUpsell } from "@/components/stats/top-list-upsell";
import {
  defaultPeriod,
  lockedPeriods,
  resolvePeriod,
  topLimit,
} from "@/lib/stats/access";

export const dynamic = "force-dynamic";

export default async function TopAlbumsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/connexion");
  const userId = session.user.id;

  const [hasImport, premium] = await Promise.all([
    hasCompletedImport(userId),
    isPremium(userId),
  ]);

  const { period: rawPeriod } = await searchParams;
  const requested: StreamPeriod = isStreamPeriod(rawPeriod)
    ? rawPeriod
    : defaultPeriod(premium);
  const period: StreamPeriod = resolvePeriod(requested, premium);
  const locked = lockedPeriods(premium);
  const limit = topLimit(premium);

  if (!hasImport) {
    const [albumsData] = await Promise.all([
      getEnrichedDemoTopAlbums(),
    ]);
    return (
      <>
        <DemoModeBanner />
        <main
          id="main"
          className="flex-1 flex flex-col px-6 py-12 max-w-5xl mx-auto w-full"
        >
          <header className="mb-2 flex flex-wrap items-center justify-between gap-4">
            <h1 className="text-2xl font-semibold">Top albums</h1>
            <Suspense fallback={<div className="h-10 w-75 rounded-full border bg-card" />}>
              <PeriodSelector current={period} lockedValues={locked} />
            </Suspense>
          </header>
          <p className="mb-8 text-sm text-muted-foreground">
            Ces données sont fictives — importe ton historique pour voir les tiennes.
          </p>
          <StaggerList className="flex flex-col gap-1">
            {albumsData.map((album, index) => (
              <StaggerItem key={album.albumId}>
                <RankedRow
                  rank={index + 1}
                  title={album.name}
                  href={`/album/${album.albumId}`}
                  subtitle={album.artistNames.join(", ")}
                  imageUrl={album.imageUrl ?? undefined}
                  metric={`${formatNumber(album.plays)} écoutes`}
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
  const [albums, profile] = await Promise.all([
    getTopAlbumsFromStreams(userId, periodSince(period, refDate), limit),
    getProfile(userId),
  ]);
  const imported = hasImport;
  const shareUsername =
    profile?.isPublic && profile.username ? profile.username : undefined;

  const emptyDescription =
    period === "all" && !imported
      ? "Importe ton historique Spotify pour débloquer tes tops albums lifetime."
      : "Écoute quelques titres puis reviens — les tops se construisent automatiquement.";

  return (
    <main id="main" className="flex-1 flex flex-col px-6 py-12 max-w-5xl mx-auto w-full">
      <header className="mb-2 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Top albums</h1>
        <div className="flex flex-wrap items-center gap-2">
          {shareUsername ? <ShareButton username={shareUsername} context="albums" /> : null}
          <Suspense
            fallback={
              <div className="h-10 w-75 rounded-full border bg-card" />
            }
          >
            <PeriodSelector current={period} lockedValues={locked} />
          </Suspense>
        </div>
      </header>

      <p className="mb-8 text-sm text-muted-foreground">
        Agrégé depuis tes écoutes locales — un album compte chaque fois
        qu&apos;un de ses titres a été joué.
      </p>

      {albums.length === 0 ? (
        <EmptyState
          title="Aucun album pour cette période"
          description={emptyDescription}
        />
      ) : (
        <StaggerList key={period} className="flex flex-col gap-1">
          {albums.map((album, index) => (
            <StaggerItem key={album.albumId}>
              <RankedRow
                rank={index + 1}
                title={album.name}
                href={`/album/${album.albumId}`}
                subtitle={album.artistNames.join(", ")}
                imageUrl={album.imageUrl ?? undefined}
                metric={`${formatNumber(album.plays)} écoutes`}
              />
            </StaggerItem>
          ))}
        </StaggerList>
      )}

      {!premium && albums.length > 0 ? <TopListUpsell noun="albums" /> : null}
    </main>
  );
}
