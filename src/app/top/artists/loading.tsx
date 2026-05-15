import { RankedList } from "@/components/stats/ranked-list";
import { SkeletonRow } from "@/components/stats/skeleton-row";

export default function TopArtistsLoading() {
  return (
    <main className="flex-1 flex flex-col px-6 py-12 max-w-5xl mx-auto w-full">
      {/* Header with title and period selector placeholder */}
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="h-8 w-48 rounded bg-muted animate-pulse" />
        <div className="h-10 w-[232px] rounded-full bg-muted animate-pulse" />
      </header>

      {/* Skeleton rows */}
      <RankedList>
        {Array.from({ length: 10 }).map((_, i) => (
          <SkeletonRow key={i} showMetric={true} />
        ))}
      </RankedList>
    </main>
  );
}
