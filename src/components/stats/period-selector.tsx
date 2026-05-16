"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { STREAM_PERIODS, type StreamPeriod } from "@/lib/stats/period";
import { cn, gradientCta } from "@/lib/utils";

/**
 * Period pills (4w / 6m / 1y / all) that sync the active period to the
 * `?period=` query param via a client-side navigation. Other query params
 * are preserved.
 *
 * Pages that don't yet support "all" (artists, albums — still on the
 * Spotify-API path) can pass a subset via `periods`.
 *
 * The current period is owned by the parent (read from `searchParams`) and
 * passed down — this component is not the source of truth.
 */
export function PeriodSelector({
  current,
  periods = STREAM_PERIODS,
}: {
  current: StreamPeriod;
  periods?: { value: StreamPeriod; label: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function selectPeriod(period: StreamPeriod) {
    if (period === current) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", period);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="inline-flex gap-1 rounded-full border bg-card p-1">
      {periods.map(({ value, label }) => {
        const active = value === current;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            onClick={() => selectPeriod(value)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium transition",
              active
                ? gradientCta
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
