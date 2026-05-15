"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { TopPeriod } from "@/lib/spotify/top";
import { cn, gradientCta } from "@/lib/utils";

const PERIODS: { value: TopPeriod; label: string }[] = [
  { value: "4w", label: "4 semaines" },
  { value: "6m", label: "6 mois" },
  { value: "1y", label: "1 an" },
];

/**
 * Period pills (4w / 6m / 1y) that sync the active period to the `?period=`
 * query param via a client-side navigation. Other query params are preserved.
 *
 * The current period is owned by the parent (read from `searchParams`) and
 * passed down — this component is not the source of truth.
 */
export function PeriodSelector({ current }: { current: TopPeriod }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function selectPeriod(period: TopPeriod) {
    if (period === current) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", period);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="inline-flex gap-1 rounded-full border bg-card p-1">
      {PERIODS.map(({ value, label }) => {
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
