# Freemium Tier-Gating Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate stat depth behind Premium - free users get only the `1y` + `all` periods, top-10 lists, and a locked listening clock; Premium unlocks all 5 periods, top-100, and the full clock.

**Architecture:** A single pure policy module (`src/lib/stats/access.ts`) is the source of truth for what a tier can access (allowed periods, default period, clamped period, locked periods, top limit). Server components fetch `isPremium(userId)` (already exists, `cache()`-wrapped), pass the boolean into the pure helpers to decide what to fetch, and pass `lockedValues` into the existing `PeriodSelector` so locked periods render as upsell links. The listening clock reuses the existing `PremiumGate` overlay. **Period access is enforced server-side** (the URL `?period=` is clamped) so a free user can't bypass gating by editing the URL.

**Tech Stack:** Next.js 16 App Router (server components), React 19, Drizzle, Vitest, Tailwind 4, lucide-react.

---

## Scope

In scope (chantier 🅰 - gating existing surfaces): periods, top-list depth, listening clock, plus a dashboard-preview consistency fix.

Out of scope (separate epics 🅑): net-new Premium features **deep-dives** and **comparaison entre amis** - they don't exist yet and are their own plans.

## Testing strategy (read before starting)

- `vitest.config.ts` runs in the **`node`** environment with **no jsdom** and there is no E2E harness. So **only the pure policy module (Task 1) gets unit tests (full TDD).** Client/server-component tasks (Tasks 2-8) are verified by `pnpm typecheck` + **manual browser checks** against the already-running dev server (`http://127.0.0.1:3000`).
- **Toggle a test account between tiers** for manual verification (the logged-in dev account is `julesdeschamps24@gmail.com`):

```bash
# Make the account PREMIUM:
docker exec -i loopstat_postgres psql -U loopstat -d loopstat -c \
  "UPDATE users SET premium_status='active', premium_until = now() + interval '1 year' WHERE email='julesdeschamps24@gmail.com';"

# Revert the account to FREE:
docker exec -i loopstat_postgres psql -U loopstat -d loopstat -c \
  "UPDATE users SET premium_status=NULL, premium_until=NULL WHERE email='julesdeschamps24@gmail.com';"
```

> `isPremium` is `cache()`-wrapped per request, so after flipping the DB just reload the page (each request re-reads).

---

## File Structure

- **Create** `src/lib/stats/access.ts` - pure tier-access policy (no DB, no React). One responsibility: "given a premium boolean, what can this user see?".
- **Create** `src/lib/stats/access.test.ts` - unit tests for the policy.
- **Create** `src/components/stats/top-list-upsell.tsx` - server component: a CTA shown below a free user's top-10 list.
- **Modify** `src/components/stats/period-selector.tsx` - add `lockedValues` prop; render locked pills as `/pricing` links; never restore/mirror a locked period.
- **Modify** `src/app/(app)/top/tracks/page.tsx`, `.../top/artists/page.tsx`, `.../top/albums/page.tsx` - fetch `isPremium`, clamp period, use tier top-limit, pass `lockedValues`, show upsell for free.
- **Modify** `src/app/(app)/listening-clock/page.tsx` - wrap the populated heatmap in `PremiumGate`.
- **Modify** `src/app/(app)/dashboard/page.tsx` - free users' top-5 preview uses lifetime instead of the 4-week window (which is Premium-only).

---

## Task 1: Tier-access policy module (TDD)

**Files:**
- Create: `src/lib/stats/access.ts`
- Test: `src/lib/stats/access.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/stats/access.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  FREE_PERIODS,
  FREE_TOP_LIMIT,
  PREMIUM_TOP_LIMIT,
  defaultPeriod,
  isPeriodAllowed,
  lockedPeriods,
  resolvePeriod,
  topLimit,
} from "./access";

describe("tier access policy", () => {
  it("free tier is limited to 1y + all", () => {
    expect([...FREE_PERIODS].sort()).toEqual(["1y", "all"]);
  });

  it("isPeriodAllowed: premium can access everything", () => {
    for (const p of ["1w", "4w", "6m", "1y", "all"] as const) {
      expect(isPeriodAllowed(p, true)).toBe(true);
    }
  });

  it("isPeriodAllowed: free can only access 1y + all", () => {
    expect(isPeriodAllowed("1y", false)).toBe(true);
    expect(isPeriodAllowed("all", false)).toBe(true);
    expect(isPeriodAllowed("1w", false)).toBe(false);
    expect(isPeriodAllowed("4w", false)).toBe(false);
    expect(isPeriodAllowed("6m", false)).toBe(false);
  });

  it("defaultPeriod: premium -> 1w (recent), free -> all (lifetime hook)", () => {
    expect(defaultPeriod(true)).toBe("1w");
    expect(defaultPeriod(false)).toBe("all");
  });

  it("resolvePeriod: clamps a disallowed period to 'all' for free", () => {
    expect(resolvePeriod("1w", false)).toBe("all");
    expect(resolvePeriod("6m", false)).toBe("all");
    expect(resolvePeriod("1y", false)).toBe("1y");
    expect(resolvePeriod("all", false)).toBe("all");
  });

  it("resolvePeriod: premium keeps whatever was requested", () => {
    expect(resolvePeriod("1w", true)).toBe("1w");
    expect(resolvePeriod("6m", true)).toBe("6m");
  });

  it("lockedPeriods: none for premium, the short ones for free", () => {
    expect(lockedPeriods(true)).toEqual([]);
    expect(lockedPeriods(false)).toEqual(["1w", "4w", "6m"]);
  });

  it("topLimit: 10 free, 100 premium", () => {
    expect(topLimit(false)).toBe(FREE_TOP_LIMIT);
    expect(topLimit(true)).toBe(PREMIUM_TOP_LIMIT);
    expect(FREE_TOP_LIMIT).toBe(10);
    expect(PREMIUM_TOP_LIMIT).toBe(100);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- src/lib/stats/access.test.ts`
Expected: FAIL - `Failed to resolve import "./access"` (module doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `src/lib/stats/access.ts`:

```ts
import { STREAM_PERIOD_VALUES, type StreamPeriod } from "./period";

/**
 * Freemium tier-access policy. Pure functions only (no DB, no React) so they
 * are trivially testable and usable from any server component. Callers fetch
 * `isPremium(userId)` (src/db/queries/billing.ts) and pass the boolean here.
 *
 * Product rule (locked 2026-06-01): monetise depth/breadth, never basic access
 * to one's own data. Free keeps the impressive lifetime view (the viral hook);
 * Premium unlocks the shorter granularities + full lists.
 */

/** Periods a free (non-premium) user can access. Premium unlocks the rest. */
export const FREE_PERIODS = ["1y", "all"] as const satisfies readonly StreamPeriod[];

export const FREE_TOP_LIMIT = 10;
export const PREMIUM_TOP_LIMIT = 100;

export function isPeriodAllowed(period: StreamPeriod, premium: boolean): boolean {
  return premium || (FREE_PERIODS as readonly StreamPeriod[]).includes(period);
}

/**
 * Default period when the URL specifies none. Premium defaults to the most
 * recent window (1w); free defaults to lifetime ("all") - both the only
 * sensible default for free AND the most shareable view.
 */
export function defaultPeriod(premium: boolean): StreamPeriod {
  return premium ? "1w" : "all";
}

/** Clamp a requested period to one the user may access. Disallowed -> "all". */
export function resolvePeriod(requested: StreamPeriod, premium: boolean): StreamPeriod {
  return isPeriodAllowed(requested, premium) ? requested : "all";
}

/** Periods that exist but are locked for this user (premium -> none). */
export function lockedPeriods(premium: boolean): StreamPeriod[] {
  if (premium) return [];
  return STREAM_PERIOD_VALUES.filter((p) => !isPeriodAllowed(p, false));
}

/** How many rows a top list shows for this tier. */
export function topLimit(premium: boolean): number {
  return premium ? PREMIUM_TOP_LIMIT : FREE_TOP_LIMIT;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- src/lib/stats/access.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/stats/access.ts src/lib/stats/access.test.ts
git commit -m "feat(gating): tier-access policy module (free=1y+all, top10)"
```

---

## Task 2: PeriodSelector - render & guard locked periods

**Files:**
- Modify: `src/components/stats/period-selector.tsx`

- [ ] **Step 1: Add the `Crown` import**

Add to the existing import block at the top (after the `next/navigation` import):

```ts
import { Crown } from "lucide-react";
```

- [ ] **Step 2: Add the `lockedValues` prop**

Replace the component signature:

```ts
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
```

with:

```ts
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
```

- [ ] **Step 3: Guard the URL→storage mirror against locked periods**

Replace this block inside the `useEffect`:

```ts
    const urlPeriod = searchParams.get("period");
    if (urlPeriod !== null && isStreamPeriod(urlPeriod)) {
      // Mirror what the URL says into storage so the next category picks it up.
      sessionStorage.setItem(STORAGE_KEY, urlPeriod);
      return;
    }
```

with:

```ts
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
```

- [ ] **Step 4: Never restore a locked period from storage**

Replace:

```ts
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored && isStreamPeriod(stored) && stored !== current) {
```

with:

```ts
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored && isStreamPeriod(stored) && !locked.has(stored) && stored !== current) {
```

- [ ] **Step 5: Render locked pills as upsell links**

Replace the `periods.map(...)` body:

```tsx
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
```

with:

```tsx
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
```

- [ ] **Step 6: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/stats/period-selector.tsx
git commit -m "feat(gating): PeriodSelector renders & guards locked periods"
```

---

## Task 3: TopListUpsell component

**Files:**
- Create: `src/components/stats/top-list-upsell.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/stats/top-list-upsell.tsx`:

```tsx
import Link from "next/link";
import { Crown } from "lucide-react";

/**
 * CTA shown below a free user's top-10 list. `noun` is the plural lowercased
 * thing being listed ("titres" | "artistes" | "albums").
 */
export function TopListUpsell({ noun }: { noun: string }) {
  return (
    <Link
      href="/pricing"
      className="mt-4 flex items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 bg-card px-5 py-4 text-center text-sm font-medium text-muted-foreground transition hover:text-foreground"
    >
      <Crown className="size-4 text-[#7c3aed]" />
      Tu vois ton top 10 {noun}. Débloque le top 100 et toutes les périodes avec
      Premium.
    </Link>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/stats/top-list-upsell.tsx
git commit -m "feat(gating): TopListUpsell CTA component"
```

---

## Task 4: Gate `/top/tracks`

**Files:**
- Modify: `src/app/(app)/top/tracks/page.tsx`

- [ ] **Step 1: Add imports**

After the existing `import { formatNumber } from "@/lib/utils";` line, add:

```ts
import { isPremium } from "@/db/queries/billing";
import { TopListUpsell } from "@/components/stats/top-list-upsell";
import {
  defaultPeriod,
  lockedPeriods,
  resolvePeriod,
  topLimit,
} from "@/lib/stats/access";
```

- [ ] **Step 2: Remove the hardcoded limit**

Delete this line:

```ts
const TOP_LIMIT = 100;
```

- [ ] **Step 3: Fetch premium + clamp the period**

Replace:

```ts
  const hasImport = await hasCompletedImport(userId);

  const { period: rawPeriod } = await searchParams;
  const period: StreamPeriod = isStreamPeriod(rawPeriod) ? rawPeriod : "1w";
```

with:

```ts
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
```

- [ ] **Step 4: Pass `lockedValues` to the demo-branch selector**

In the `if (!hasImport)` block, replace:

```tsx
              <PeriodSelector current={period} />
```

with:

```tsx
              <PeriodSelector current={period} lockedValues={locked} />
```

- [ ] **Step 5: Use the tier limit in the fetch**

Replace:

```ts
    getTopTracksFromStreams(userId, periodSince(period, refDate), TOP_LIMIT),
```

with:

```ts
    getTopTracksFromStreams(userId, periodSince(period, refDate), limit),
```

- [ ] **Step 6: Pass `lockedValues` to the real-branch selector**

Replace the second occurrence:

```tsx
            <PeriodSelector current={period} />
```

with:

```tsx
            <PeriodSelector current={period} lockedValues={locked} />
```

- [ ] **Step 7: Show the upsell below the list for free users**

Replace the closing of the list ternary + `</main>`:

```tsx
        </StaggerList>
      )}
    </main>
  );
}
```

with:

```tsx
        </StaggerList>
      )}

      {!premium && tracks.length > 0 ? <TopListUpsell noun="titres" /> : null}
    </main>
  );
}
```

- [ ] **Step 8: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 9: Manual verification**

With the dev server running (`http://127.0.0.1:3000`), logged in as the test account that **has an import**:
- Set the account FREE (see Testing strategy). Visit `/top/tracks`: period defaults to **Tout**; only **1 an** + **Tout** are clickable; **1 semaine / 4 semaines / 6 mois** show a crown at 50% opacity and route to `/pricing` on click. List shows **10 rows**; the upsell CTA appears below.
- Try `http://127.0.0.1:3000/top/tracks?period=1w` directly: the data is **lifetime** (clamped), and the `?period=1w` param is stripped from the URL.
- Set the account PREMIUM, reload: all 5 periods clickable, no crowns, **100 rows**, no upsell.

- [ ] **Step 10: Commit**

```bash
git add "src/app/(app)/top/tracks/page.tsx"
git commit -m "feat(gating): gate /top/tracks periods + top-10 for free"
```

---

## Task 5: Gate `/top/artists`

**Files:**
- Modify: `src/app/(app)/top/artists/page.tsx`

- [ ] **Step 1: Add imports**

After `import { formatNumber } from "@/lib/utils";`, add:

```ts
import { isPremium } from "@/db/queries/billing";
import { TopListUpsell } from "@/components/stats/top-list-upsell";
import {
  defaultPeriod,
  lockedPeriods,
  resolvePeriod,
  topLimit,
} from "@/lib/stats/access";
```

- [ ] **Step 2: Remove the hardcoded limit**

Delete:

```ts
const TOP_LIMIT = 100;
```

- [ ] **Step 3: Fetch premium + clamp the period**

Replace:

```ts
  const hasImport = await hasCompletedImport(userId);

  const { period: rawPeriod } = await searchParams;
  const period: StreamPeriod = isStreamPeriod(rawPeriod) ? rawPeriod : "1w";
```

with:

```ts
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
```

- [ ] **Step 4: Pass `lockedValues` to the demo-branch selector**

Replace (inside `if (!hasImport)`):

```tsx
              <PeriodSelector current={period} />
```

with:

```tsx
              <PeriodSelector current={period} lockedValues={locked} />
```

- [ ] **Step 5: Use the tier limit in the fetch**

Replace:

```ts
    getTopArtistsFromStreams(userId, periodSince(period, refDate), TOP_LIMIT),
```

with:

```ts
    getTopArtistsFromStreams(userId, periodSince(period, refDate), limit),
```

- [ ] **Step 6: Pass `lockedValues` to the real-branch selector**

Replace the second occurrence:

```tsx
            <PeriodSelector current={period} />
```

with:

```tsx
            <PeriodSelector current={period} lockedValues={locked} />
```

- [ ] **Step 7: Show the upsell for free users**

Replace:

```tsx
        </StaggerList>
      )}
    </main>
  );
}
```

with:

```tsx
        </StaggerList>
      )}

      {!premium && artists.length > 0 ? <TopListUpsell noun="artistes" /> : null}
    </main>
  );
}
```

- [ ] **Step 8: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 9: Manual verification**

Visit `/top/artists` as FREE then PREMIUM (toggle per Testing strategy). Same expectations as Task 4 Step 9, with "artistes".

- [ ] **Step 10: Commit**

```bash
git add "src/app/(app)/top/artists/page.tsx"
git commit -m "feat(gating): gate /top/artists periods + top-10 for free"
```

---

## Task 6: Gate `/top/albums`

**Files:**
- Modify: `src/app/(app)/top/albums/page.tsx`

- [ ] **Step 1: Add imports**

After `import { formatNumber } from "@/lib/utils";`, add:

```ts
import { isPremium } from "@/db/queries/billing";
import { TopListUpsell } from "@/components/stats/top-list-upsell";
import {
  defaultPeriod,
  lockedPeriods,
  resolvePeriod,
  topLimit,
} from "@/lib/stats/access";
```

- [ ] **Step 2: Remove the hardcoded limit**

Delete:

```ts
const TOP_LIMIT = 100;
```

- [ ] **Step 3: Fetch premium + clamp the period**

Replace:

```ts
  const hasImport = await hasCompletedImport(userId);

  const { period: rawPeriod } = await searchParams;
  const period: StreamPeriod = isStreamPeriod(rawPeriod) ? rawPeriod : "1w";
```

with:

```ts
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
```

- [ ] **Step 4: Pass `lockedValues` to the demo-branch selector**

Replace (inside `if (!hasImport)`):

```tsx
              <PeriodSelector current={period} />
```

with:

```tsx
              <PeriodSelector current={period} lockedValues={locked} />
```

- [ ] **Step 5: Use the tier limit in the fetch**

Replace:

```ts
    getTopAlbumsFromStreams(userId, periodSince(period, refDate), TOP_LIMIT),
```

with:

```ts
    getTopAlbumsFromStreams(userId, periodSince(period, refDate), limit),
```

- [ ] **Step 6: Pass `lockedValues` to the real-branch selector**

Replace the second occurrence:

```tsx
            <PeriodSelector current={period} />
```

with:

```tsx
            <PeriodSelector current={period} lockedValues={locked} />
```

- [ ] **Step 7: Show the upsell for free users**

Replace:

```tsx
        </StaggerList>
      )}
    </main>
  );
}
```

with:

```tsx
        </StaggerList>
      )}

      {!premium && albums.length > 0 ? <TopListUpsell noun="albums" /> : null}
    </main>
  );
}
```

- [ ] **Step 8: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 9: Manual verification**

Visit `/top/albums` as FREE then PREMIUM. Same expectations as Task 4 Step 9, with "albums".

- [ ] **Step 10: Commit**

```bash
git add "src/app/(app)/top/albums/page.tsx"
git commit -m "feat(gating): gate /top/albums periods + top-10 for free"
```

---

## Task 7: Gate the listening clock

**Files:**
- Modify: `src/app/(app)/listening-clock/page.tsx`

- [ ] **Step 1: Add imports**

After `import { DEMO_LISTENING_HOURS } from "@/lib/demo/data";`, add:

```ts
import { isPremium } from "@/db/queries/billing";
import { PremiumGate } from "@/components/premium-gate";
```

- [ ] **Step 2: Fetch premium alongside the real-data queries**

Replace:

```ts
  const [clock, totals] = await Promise.all([
    getListeningClock(userId),
    getListeningTotals(userId),
  ]);
```

with:

```ts
  const [clock, totals, premium] = await Promise.all([
    getListeningClock(userId),
    getListeningTotals(userId),
    isPremium(userId),
  ]);
```

- [ ] **Step 3: Wrap the populated heatmap in `PremiumGate`**

Replace the populated branch of the ternary (the whole `<section>...</section>` that starts with `<section className="rounded-2xl border bg-card p-6">` and ends at its closing `</section>`):

```tsx
      ) : (
        <section className="rounded-2xl border bg-card p-6">
```

with:

```tsx
      ) : (
        <PremiumGate isPremium={premium}>
        <section className="rounded-2xl border bg-card p-6">
```

and replace the section's closing tag + the ternary close:

```tsx
          </p>
        </section>
      )}
    </main>
  );
}
```

with:

```tsx
          </p>
        </section>
        </PremiumGate>
      )}
    </main>
  );
}
```

> The `EmptyState` branch (`totalStreams === 0`) stays ungated - there's nothing to blur. The demo branch (`!hasImport`) stays ungated - it's the pre-import teaser.

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 5: Manual verification**

Visit `/listening-clock` (account with an import):
- FREE → the heatmap is blurred at 30% with a centered "Débloquer Premium" → `/pricing` button.
- PREMIUM → the heatmap renders fully.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/listening-clock/page.tsx"
git commit -m "feat(gating): gate full listening clock behind Premium"
```

---

## Task 8: Dashboard preview consistency (free shouldn't see 4w data)

**Files:**
- Modify: `src/app/(app)/dashboard/page.tsx`

The dashboard top-5 preview uses a hardcoded 4-week window. `4w` is a Premium-only period, so a free user would see 4-week-derived data on the dashboard. Switch free users to their lifetime top-5 (on-brand: the lifetime view is the hook). `isPremium` is already imported in this file.

- [ ] **Step 1: Hoist premium and pick the preview window by tier**

Replace:

```ts
  const since4w = new Date(refDate.getTime() - 28 * 24 * 60 * 60 * 1000);

  const [totals, topTracks, topArtists, profile, premium] =
    await Promise.all([
      getListeningTotals(userId, refDate),
      getTopTracksFromStreams(userId, since4w, 5),
      getTopArtistsFromStreams(userId, since4w, 5),
      getProfile(userId),
      isPremium(userId),
    ]);
```

with:

```ts
  const premium = await isPremium(userId);
  // 4w is a Premium-only period - free users get their lifetime top 5 instead
  // (the impressive, on-brand hook). Premium keeps the recent 28-day snapshot.
  const previewSince = premium
    ? new Date(refDate.getTime() - 28 * 24 * 60 * 60 * 1000)
    : null;

  const [totals, topTracks, topArtists, profile] = await Promise.all([
    getListeningTotals(userId, refDate),
    getTopTracksFromStreams(userId, previewSince, 5),
    getTopArtistsFromStreams(userId, previewSince, 5),
    getProfile(userId),
  ]);
```

- [ ] **Step 2: Fix any hardcoded "4 semaines" label on the preview**

Run: `grep -n "4 semaines\|4 dernières semaines\|28 jours\|quatre semaines" "src/app/(app)/dashboard/page.tsx"`

If a label is rendered above/around the top-5 preview (`top5Tracks` / `top5Artists`), make it tier-aware so free users don't see "4 semaines" over lifetime data. Replace the label string with:

```tsx
{premium ? "4 dernières semaines" : "Tout temps"}
```

If the grep returns nothing, no change needed - skip this step.

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 4: Manual verification**

Visit `/dashboard`:
- FREE → top-5 tracks/artists reflect **lifetime**; any preview label reads "Tout temps".
- PREMIUM → top-5 reflect the **last 4 weeks**; label reads "4 dernières semaines".

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/dashboard/page.tsx"
git commit -m "feat(gating): dashboard preview uses lifetime for free users"
```

---

## Final verification

- [ ] **Step 1: Full typecheck + test suite**

```bash
pnpm typecheck
pnpm test
```

Expected: typecheck clean; all tests pass (existing 147 + 8 new in `access.test.ts` = 155).

- [ ] **Step 2: End-to-end tier matrix (manual, dev server)**

Toggle the test account FREE, then PREMIUM (Testing strategy SQL), and confirm:

| Surface | FREE | PREMIUM |
|---|---|---|
| `/top/tracks`,`/artists`,`/albums` periods | only **1 an** + **Tout** clickable; others crowned → `/pricing` | all 5 clickable |
| `?period=1w` URL tamper (free) | data clamped to lifetime, param stripped | honoured |
| Top list length | 10 rows + upsell CTA | 100 rows, no CTA |
| `/listening-clock` | blurred + "Débloquer Premium" | full heatmap |
| `/dashboard` top-5 | lifetime | last 4 weeks |

- [ ] **Step 3: Final commit (if any verification fixups were made)**

```bash
git add -A
git commit -m "chore(gating): verification fixups"
```

---

## Self-review notes (author)

- **Spec coverage:** periods ✅ (Tasks 1,2,4-6), top-10 ✅ (Tasks 1,4-6), partial/locked listening clock ✅ (Task 7), customization (already shipped - no task). Dashboard leak closed (Task 8). Deep-dives + friend comparison explicitly out of scope.
- **Server-side enforcement:** period clamping happens in the page server component via `resolvePeriod` before any fetch - URL tampering can't bypass it. List length is enforced by the SQL `limit`. (Listening-clock gating is client-side blur via `PremiumGate`, acceptable: hourly counts are low-sensitivity, consistent with the existing customization gate.)
- **Type consistency:** `lockedPeriods`/`resolvePeriod`/`defaultPeriod`/`topLimit` signatures are used identically across Tasks 4-6; `TopListUpsell` takes `noun: string` everywhere; `PeriodSelector` gains `lockedValues?: StreamPeriod[]` used by all callers.
- **Known minor / not addressed here:** the stale "le polling synchronise automatiquement" empty-message in `top/tracks/page.tsx` (no polling anymore) - unrelated to gating, leave for a docs/copy pass.
