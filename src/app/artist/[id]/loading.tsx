import { RankedList } from "@/components/stats/ranked-list";
import { SkeletonRow } from "@/components/stats/skeleton-row";

export default function ArtistDetailLoading() {
  return (
    <main
      role="status"
      aria-busy="true"
      aria-label="Chargement"
      className="flex-1 flex flex-col px-6 py-12 max-w-3xl mx-auto w-full"
    >
      {/* Hero section: artwork placeholder (rounded-full for artist) + text stack */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
        {/* Artwork placeholder: size-48 rounded-full */}
        <div className="size-48 shrink-0 rounded-full bg-muted animate-pulse shadow-lg" />

        {/* Text block: label, title, playcount */}
        <div className="min-w-0 space-y-3">
          <div className="h-3 w-12 rounded bg-muted animate-pulse" />
          <div className="h-8 w-64 rounded bg-muted animate-pulse" />
          <div className="h-4 w-40 rounded bg-muted animate-pulse" />
        </div>
      </div>

      {/* Top tracks section */}
      <section className="mt-10">
        <div className="mb-4 h-5 w-48 rounded bg-muted animate-pulse" />
        <RankedList>
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonRow key={i} showMetric={true} />
          ))}
        </RankedList>
      </section>
    </main>
  );
}
