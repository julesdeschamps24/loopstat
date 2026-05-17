import { Suspense } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { RankedRow } from "@/components/stats/ranked-list";
import { PeriodSelector } from "@/components/stats/period-selector";
import { ShareButton } from "@/components/share-button";
import { EmptyState } from "@/components/stats/empty-state";
import { StaggerItem, StaggerList } from "@/components/ui/motion";
import { getTopAlbumsFromStreams } from "@/db/queries/stats";
import { hasCompletedImport } from "@/db/queries/imports";
import { getProfile } from "@/db/queries/users";
import {
  isStreamPeriod,
  periodSince,
  type StreamPeriod,
} from "@/lib/stats/period";
import { formatNumber } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TOP_LIMIT = 100;

export default async function TopAlbumsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const { period: rawPeriod } = await searchParams;
  const period: StreamPeriod = isStreamPeriod(rawPeriod) ? rawPeriod : "4w";

  const [albums, imported, profile] = await Promise.all([
    getTopAlbumsFromStreams(userId, periodSince(period), TOP_LIMIT),
    hasCompletedImport(userId),
    getProfile(userId),
  ]);
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
          {shareUsername ? <ShareButton username={shareUsername} /> : null}
          <Suspense
            fallback={
              <div className="h-10 w-75 rounded-full border bg-card" />
            }
          >
            <PeriodSelector current={period} />
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
    </main>
  );
}
