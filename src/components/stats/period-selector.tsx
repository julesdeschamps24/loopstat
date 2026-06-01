"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Crown } from "lucide-react";
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

/**
 * Returns true if this is the very first effect run after a hard refresh
 * (F5 / Ctrl-R). Always returns false on subsequent calls within the same
 * tab lifecycle. Side effect : clears sessionStorage on the reload case.
 */
function consumeInitialReload(): boolean {
  if (initialReloadChecked) return false;
  initialReloadChecked = true;
  if (typeof window === "undefined") return false;
  const navEntry = performance.getEntriesByType(
    "navigation",
  )[0] as PerformanceNavigationTiming | undefined;
  if (navEntry?.type !== "reload") return false;
  sessionStorage.removeItem(STORAGE_KEY);
  return true;
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
  lockedValues = [],
}: {
  current: StreamPeriod;
  periods?: { value: StreamPeriod; label: string }[];
  lockedValues?: StreamPeriod[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locked = new Set(lockedValues);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Hard refresh (F5 / Ctrl-R) : clear storage AND strip `?period=` from
    // the URL so the page falls back to its default period. Without the
    // URL strip the next render's URL→storage sync would re-populate the
    // storage with the stale value and defeat the reset.
    if (consumeInitialReload()) {
      if (searchParams.get("period") !== null) {
        const params = new URLSearchParams(searchParams.toString());
        params.delete("period");
        const qs = params.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      }
      return;
    }

    const urlPeriod = searchParams.get("period");
    if (urlPeriod !== null && isStreamPeriod(urlPeriod)) {
      if (locked.has(urlPeriod)) {
        // Free user hit a Premium-only period via the URL. The server already
        // clamped the data to an allowed period; strip the stale param so the
        // URL stops lying and we don't mirror a locked value into storage.
        const params = new URLSearchParams(searchParams.toString());
        params.delete("period");
        const qs = params.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
        return;
      }
      // Mirror what the URL says into storage so the next category picks it up.
      sessionStorage.setItem(STORAGE_KEY, urlPeriod);
      return;
    }

    // URL didn't specify a period — try to restore the user's last choice.
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored && isStreamPeriod(stored) && !locked.has(stored) && stored !== current) {
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
        if (locked.has(value)) {
          return (
            <button
              key={value}
              type="button"
              title="Disponible en Premium"
              onClick={() => router.push("/pricing")}
              className="flex items-center gap-1 rounded-full px-4 py-1.5 text-sm font-medium text-muted-foreground opacity-50 transition hover:opacity-100"
            >
              <Crown className="size-3" />
              {label}
            </button>
          );
        }
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
