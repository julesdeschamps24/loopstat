import { cn } from "@/lib/utils";

/**
 * A skeleton row matching RankedRow layout exactly.
 *
 * Renders pulsing placeholders for rank, artwork, title, subtitle, and optional metric.
 * Uses pure Tailwind animate-pulse — no animation libraries.
 */
export function SkeletonRow({ showMetric = true }: { showMetric?: boolean }) {
  return (
    <div className={cn("flex items-center gap-3 rounded-xl px-3 py-2")}>
      {/* Rank placeholder: w-6 shrink-0 text-right */}
      <div className="w-6 shrink-0">
        <div className="h-4 w-4 rounded bg-muted animate-pulse" />
      </div>

      {/* Artwork placeholder: size-12 shrink-0 rounded-lg */}
      <div className="size-12 shrink-0 rounded-lg bg-muted animate-pulse" />

      {/* Text block: title + optional subtitle */}
      <div className="min-w-0 flex-1 space-y-1">
        <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
        <div className="h-3 w-1/2 rounded bg-muted animate-pulse" />
      </div>

      {/* Optional metric placeholder on the right */}
      {showMetric ? (
        <div className="shrink-0">
          <div className="h-3 w-20 rounded bg-muted animate-pulse" />
        </div>
      ) : null}
    </div>
  );
}
