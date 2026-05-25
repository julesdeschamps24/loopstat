"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import {
  isStreamPeriod,
  STREAM_PERIODS,
  type StreamPeriod,
} from "@/lib/stats/period";
import { cn, gradientCta } from "@/lib/utils";

const STORAGE_KEY = "loopstat-period";

/**
 * Period pills (1w / 4w / 6m / 1y / all) that sync the active period to the
 * `?period=` query param via a client-side navigation. Other query params
 * are preserved.
 *
 * Cross-page persistence: the active period is mirrored to sessionStorage on
 * each selection. When the user lands on a /top/* page without `?period=` in
 * the URL but with a stored value, the URL is auto-rehydrated. Detection of
 * a hard refresh (`performance.navigation.type === "reload"`) clears the
 * stored value first, so refreshing resets the period to the page's default.
 *
 * The current period is owned by the parent (read from `searchParams`) and
 * passed down — this component is not the source of truth at render time,
 * only at click time.
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

  // Hydration : on mount, restore from sessionStorage if URL lacks `?period`,
  // unless this is a hard refresh (then reset).
  useEffect(() => {
    if (typeof window === "undefined") return;

    const navEntry = performance.getEntriesByType(
      "navigation",
    )[0] as PerformanceNavigationTiming | undefined;
    if (navEntry?.type === "reload") {
      sessionStorage.removeItem(STORAGE_KEY);
      return;
    }

    // Only restore when the URL didn't specify a period (i.e. parent used
    // its default). If the URL had a period, that's what the user navigated
    // with and we don't override it.
    if (searchParams.get("period") !== null) return;

    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored && isStreamPeriod(stored) && stored !== current) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("period", stored);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }
    // Only run on mount — restore is a one-shot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectPeriod(period: StreamPeriod) {
    if (period === current) return;
    if (typeof window !== "undefined") {
      sessionStorage.setItem(STORAGE_KEY, period);
    }
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
