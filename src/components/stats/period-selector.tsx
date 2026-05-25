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

// Module-level flag : the reload check must run EXACTLY once per browser tab
// lifecycle. `performance.getEntriesByType("navigation")[0].type` is set at
// document load and stays "reload" forever even after soft navigations — if
// we re-checked on every mount, the storage would be wiped on each cross-
// page nav after a refresh.
let initialReloadChecked = false;

function maybeClearOnInitialReload(): void {
  if (initialReloadChecked) return;
  initialReloadChecked = true;
  if (typeof window === "undefined") return;
  const navEntry = performance.getEntriesByType(
    "navigation",
  )[0] as PerformanceNavigationTiming | undefined;
  if (navEntry?.type === "reload") {
    sessionStorage.removeItem(STORAGE_KEY);
  }
}

/**
 * Period pills (1w / 4w / 6m / 1y / all) that sync the active period to the
 * `?period=` query param via a client-side navigation. Other query params
 * are preserved.
 *
 * Cross-page persistence : the active period is mirrored to sessionStorage
 * on each selection AND on each land. When the user navigates to a /top/*
 * page that has no `?period=` in its URL but has a stored value, the URL
 * is auto-rehydrated. A hard refresh (detected once on mount via
 * `performance.navigation.type === "reload"`) clears the storage so the
 * page's default period kicks in.
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Once-per-tab reload check.
    maybeClearOnInitialReload();

    const urlPeriod = searchParams.get("period");
    if (urlPeriod !== null && isStreamPeriod(urlPeriod)) {
      // Mirror what the URL says into storage so the next category picks it up.
      sessionStorage.setItem(STORAGE_KEY, urlPeriod);
      return;
    }

    // URL didn't specify a period — try to restore the user's last choice.
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored && isStreamPeriod(stored) && stored !== current) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("period", stored);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }
    // Re-run on cross-page nav (pathname change). Don't add searchParams to
    // avoid re-running on every URL tick — the click handler already stores
    // the new value directly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

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
