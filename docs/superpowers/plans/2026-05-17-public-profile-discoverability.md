# Public Profile Discoverability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make public profiles discoverable from inside the app — both the owner's own (dashboard card, sidebar handle, settings link, self-visit banner) and other users' (new `/find` page with debounced username/displayName search).

**Architecture:** New server action `searchUsersAction` wraps a DB helper `searchPublicProfiles` that ILIKEs `username` OR `display_name` on `is_public=true` rows (with SQL wildcard escaping). Client component `<FindEditor>` debounces input 250ms, fires the action on >= 2 chars, renders result cards. Owner-side polish: a new `<OwnProfileCard>` server component on `/dashboard`, a `@handle` link in the sidebar footer (props sourced from root layout), a "Voir mon profil public →" link in settings, and a "tu visites ton propre profil" banner on `/u/<username>` when the visitor is the owner.

**Tech Stack:** Next.js 16 (App Router, server actions), React 19, TypeScript, Drizzle ORM + Postgres, Tailwind, lucide-react, Vitest.

**Spec:** [docs/superpowers/specs/2026-05-17-public-profile-discoverability-design.md](docs/superpowers/specs/2026-05-17-public-profile-discoverability-design.md)

**Branch:** create `feat/profile-discoverability` from `main` (Phase A viral already merged at `9afc0e1`).

---

## Critical context for the engineer

1. **Project conventions**: Next.js 16, host `http://127.0.0.1:3000` (NEVER localhost — Spotify OAuth quirk). User runs `pnpm dev` themselves on port 3000; do NOT start a second dev server. `pnpm typecheck && pnpm lint && pnpm test` must stay clean.

2. **Existing helpers to reuse, do NOT reimplement**:
   - `auth()` from `@/auth` returns `Session | null`. Session has `session.user.id` (uuid) and `session.user.name`.
   - `getProfile(userId)` in `src/db/queries/users.ts` returns `ProfileRow | null` with `{ username, isPublic, displayName, spotifyId }`. Already wrapped in `React.cache`.
   - `getPublicProfileByUsername(username)` returns `PublicProfile | null` — null on either "not found" or "is_public=false". Already cached.
   - `hasCompletedImport(userId)` in `src/db/queries/imports.ts` is the existing pattern for layout-level user data, wrapped in `React.cache`.
   - `cn`, `glassCard` from `@/lib/utils`.

3. **React 19 strict eslint** bans `setState` in `useEffect` body. Use the project's `useIsClient` pattern (`useSyncExternalStore` wrapper, see `src/components/share-button.tsx:21-27`) when you need to gate browser APIs. **However**, setting state from a real external sync like `setTimeout` + DOM events IS allowed if the action has a real subscription (Image preload, search debounce). When in doubt, add `// eslint-disable-next-line react-hooks/set-state-in-effect` with a 1-line comment.

4. **Database state (verified 2026-05-17)**: 1 user with `username='judescha'`, `is_public=true`, `id='606faa26-da96-4e7c-935d-2a803eaefc01'`. Use this for smoke tests. Postgres pool cached on `globalThis` (see `src/db/client.ts`).

5. **Sidebar guard**: sidebar is masked on `/`, `/login`, `/api/*`, `/u/*`. Don't add `/find` to the masked set (it's an authenticated app page).

6. **AppHeader, dashboard, top pages**: existing wiring passes `shareUsername` + `shareContext` props. Don't break it. The OwnProfileCard work is orthogonal.

7. **Image rule**: `<img>` is fine in this codebase (see `src/components/share-button.tsx`, the OG card). The `@next/next/no-img-element` warning is suppressed in `src/app/api/share-card/templates/shared.tsx` for Satori; elsewhere we use inline disables when needed.

8. **Avoid scope creep**: don't migrate `opengraph-image.tsx` to shared templates here (that's issue #19). Don't add taste-based discovery (that's issue #21). Don't add follow/friend (out of scope per spec).

---

## File structure

**Create:**

| Path | Responsibility |
|---|---|
| `src/db/queries/users.test.ts` | Vitest unit tests for `escapeLikePattern` (~5 cases) |
| `src/app/find/page.tsx` | Server component, auth guard, renders `<FindEditor>` |
| `src/app/find/actions.ts` | Server action `searchUsersAction` (validate + auth + delegate) |
| `src/components/find/find-editor.tsx` | Client: search input + debounce + result list + states |
| `src/components/find/result-card.tsx` | Pure presentational `<Link>` for one result |
| `src/components/profile/own-profile-card.tsx` | Server component dispatching on profile state (public / private / not-yet-configured) |
| `src/components/profile/own-profile-card-actions.tsx` | Client: copy-link button with visual feedback |

**Modify:**

| Path | Change |
|---|---|
| `src/db/queries/users.ts` | Add `escapeLikePattern` (exported, pure), `searchPublicProfiles`, `PublicProfileSummary` type |
| `src/components/sidebar.tsx` | Accept `username?`, `isPublic?` props; insert nav item "Trouver des amis" after Top albums; append `@username` footer link |
| `src/app/layout.tsx` | Fetch `getProfile(userId)` in parallel with `hasCompletedImport`; forward `username`, `isPublic` to `<Sidebar>` |
| `src/app/dashboard/page.tsx` | Render `<OwnProfileCard profile={profile} />` after `<AppHeader>` |
| `src/components/settings/profile-form.tsx` | Add "Voir mon profil public →" link below the toggle when toggle on + username known |
| `src/app/u/[username]/page.tsx` | Fetch session, compare with `profile.id`, render banner when match |

---

## Task 1: Search query helper + escape utility

**Files:**
- Modify: `src/db/queries/users.ts`
- Create: `src/db/queries/users.test.ts`

Adds `escapeLikePattern`, `PublicProfileSummary`, and `searchPublicProfiles`. Test only the pure escape helper — the DB query is validated via smoke test in Task 3.

- [ ] **Step 1: Create the test file**

Create `src/db/queries/users.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { escapeLikePattern } from "./users";

describe("escapeLikePattern", () => {
  it("returns plain text unchanged", () => {
    expect(escapeLikePattern("jules")).toBe("jules");
  });

  it("escapes Postgres LIKE wildcard %", () => {
    expect(escapeLikePattern("100%")).toBe("100\\%");
    expect(escapeLikePattern("%foo%")).toBe("\\%foo\\%");
  });

  it("escapes Postgres LIKE wildcard _", () => {
    expect(escapeLikePattern("a_b")).toBe("a\\_b");
  });

  it("escapes the escape char itself", () => {
    expect(escapeLikePattern("a\\b")).toBe("a\\\\b");
  });

  it("handles empty string", () => {
    expect(escapeLikePattern("")).toBe("");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/db/queries/users.test.ts`
Expected: FAIL with "escapeLikePattern is not exported".

- [ ] **Step 3: Update imports + add new code in `src/db/queries/users.ts`**

In `src/db/queries/users.ts`, replace the existing drizzle-orm import line:

```ts
import { eq } from "drizzle-orm";
```

with:

```ts
import { and, asc, eq, ilike, isNotNull, or } from "drizzle-orm";
```

Then APPEND the following at the end of the file:

```ts
export type PublicProfileSummary = {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
};

/**
 * Escape Postgres LIKE wildcards (% and _) and the escape char itself
 * so user input is treated as literal text. Without this, typing "_"
 * or "%" would match anything.
 */
export function escapeLikePattern(raw: string): string {
  return raw.replace(/[\\%_]/g, "\\$&");
}

/**
 * Search public profiles by username OR displayName, case-insensitive.
 * Returns up to `limit` rows ordered by username.
 *
 * Caller MUST pre-trim/lowercase the query and enforce min length.
 * `is_public=true` is enforced server-side so private accounts are
 * never enumerated.
 */
export async function searchPublicProfiles(
  query: string,
  limit: number,
): Promise<PublicProfileSummary[]> {
  const pattern = `%${escapeLikePattern(query)}%`;
  const rows = await db
    .select({
      username: users.username,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(
      and(
        eq(users.isPublic, true),
        isNotNull(users.username),
        or(ilike(users.username, pattern), ilike(users.displayName, pattern)),
      ),
    )
    .orderBy(asc(users.username))
    .limit(limit);
  return rows.filter((r): r is PublicProfileSummary => r.username !== null);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/db/queries/users.test.ts`
Expected: 5/5 PASS.

- [ ] **Step 5: Run typecheck + lint + full test suite**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: clean, all tests still pass (no regression on the existing 68).

- [ ] **Step 6: Commit**

```bash
git checkout -b feat/profile-discoverability
git add src/db/queries/users.ts src/db/queries/users.test.ts
git commit -m "$(cat <<'EOF'
feat(db): searchPublicProfiles + escapeLikePattern

Adds the search query for /find page: ILIKE on username OR
display_name, filtered by is_public=true, ordered by username,
capped at the caller's limit. The pure helper escapeLikePattern
escapes Postgres LIKE metacharacters (% and _ and \) so user
input is matched literally. Unit-tested for the escape; the DB
query is validated by smoke test from the /find page.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Server action `searchUsersAction`

**Files:**
- Create: `src/app/find/actions.ts`

Wraps the DB helper with auth + input validation. Re-exports `PublicProfileSummary` for consumers.

- [ ] **Step 1: Create the action file**

Create `src/app/find/actions.ts`:

```ts
"use server";

import { auth } from "@/auth";
import {
  searchPublicProfiles,
  type PublicProfileSummary,
} from "@/db/queries/users";

const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 30;
const MAX_RESULTS = 20;

export type SearchResult =
  | { ok: true; results: PublicProfileSummary[] }
  | { ok: false; error: "unauthenticated" | "invalid_query" };

export async function searchUsersAction(
  query: string,
): Promise<SearchResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "unauthenticated" };

  const q = query.trim().toLowerCase();
  if (q.length < MIN_QUERY_LENGTH || q.length > MAX_QUERY_LENGTH) {
    return { ok: false, error: "invalid_query" };
  }

  const results = await searchPublicProfiles(q, MAX_RESULTS);
  return { ok: true, results };
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/find/actions.ts
git commit -m "$(cat <<'EOF'
feat(find): searchUsersAction server action

Validates session + trims/lowercases query + enforces 2..30 char
length before delegating to searchPublicProfiles with a 20-result
cap. Returns a typed SearchResult discriminated union so callers
handle unauthenticated and invalid_query explicitly.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `/find` page + UI components

**Files:**
- Create: `src/components/find/result-card.tsx`
- Create: `src/components/find/find-editor.tsx`
- Create: `src/app/find/page.tsx`

Three files because the responsibilities are distinct (presentational card, state owner, server-side auth guard).

- [ ] **Step 1: Create `result-card.tsx`**

Create `src/components/find/result-card.tsx`:

```tsx
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import type { PublicProfileSummary } from "@/db/queries/users";

export function ResultCard({ result }: { result: PublicProfileSummary }) {
  const name = result.displayName ?? result.username;
  return (
    <Link
      href={`/u/${result.username}`}
      className="flex items-center gap-4 rounded-2xl border bg-card p-4 transition hover:bg-accent"
    >
      {result.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={result.avatarUrl}
          alt=""
          width={48}
          height={48}
          className="size-12 rounded-full object-cover"
        />
      ) : (
        <div className="flex size-12 items-center justify-center rounded-full bg-[#7c3aed]/20 text-lg font-semibold text-[#c4b5fd]">
          {name.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{name}</p>
        <p className="truncate font-mono text-sm text-muted-foreground">
          @{result.username}
        </p>
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
```

- [ ] **Step 2: Create `find-editor.tsx`**

Create `src/components/find/find-editor.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";

import { searchUsersAction } from "@/app/find/actions";
import { ResultCard } from "@/components/find/result-card";
import type { PublicProfileSummary } from "@/db/queries/users";

const MIN_QUERY = 2;
const DEBOUNCE_MS = 250;
const MAX_INPUT = 30;

export function FindEditor() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PublicProfileSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Search debounce is genuine external sync via setTimeout (the effect
  // sets up a real subscription; setState happens when the timer fires).
  // The early-return synchronous resets and the leading isLoading=true
  // are control state for the same subscription — disable the rule for
  // the whole hook rather than peppering each line.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY) {
      setResults([]);
      setHasSearched(false);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    const handle = setTimeout(async () => {
      const result = await searchUsersAction(trimmed);
      if (cancelled) return;
      setResults(result.ok ? result.results : []);
      setHasSearched(true);
      setIsLoading(false);
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query]);

  const trimmed = query.trim();

  return (
    <div className="flex flex-col gap-8">
      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          placeholder="Pseudo ou nom…"
          maxLength={MAX_INPUT}
          className="w-full rounded-2xl border bg-card py-3 pl-12 pr-4 text-base outline-none focus:border-[#7c3aed]/60 focus:ring-2 focus:ring-[#7c3aed]/20"
        />
      </div>

      {trimmed.length < MIN_QUERY ? (
        <p className="text-sm text-muted-foreground">
          Tape un pseudo (min {MIN_QUERY} caractères) pour rechercher.
        </p>
      ) : isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-20 rounded-2xl border bg-card/40 animate-pulse"
            />
          ))}
        </div>
      ) : hasSearched && results.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucun profil trouvé pour «&nbsp;{trimmed}&nbsp;». Vérifie
          l&apos;orthographe ou demande son pseudo à ton pote.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {results.map((r) => (
            <ResultCard key={r.username} result={r} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create `src/app/find/page.tsx`**

Create `src/app/find/page.tsx`:

```tsx
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { FindEditor } from "@/components/find/find-editor";

export const dynamic = "force-dynamic";

export default async function FindPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <main
      id="main"
      className="flex-1 flex flex-col px-6 py-10 max-w-5xl mx-auto w-full"
    >
      <header className="mb-8">
        <h1 className="text-2xl font-semibold">Trouver des amis</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tape un pseudo ou un nom pour retrouver tes potes sur loopstat.
        </p>
      </header>
      <FindEditor />
    </main>
  );
}
```

- [ ] **Step 4: Typecheck + lint + tests**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: clean. If lint complains on `useEffect` setState pattern, add a 1-line `// eslint-disable-next-line react-hooks/set-state-in-effect` with comment: "search debounce is genuine external sync via setTimeout".

- [ ] **Step 5: Smoke test — unauth redirect**

Run:

```bash
curl -s -o /dev/null -w "HTTP %{http_code}\n" "http://127.0.0.1:3000/find"
```

Expected: `HTTP 307` (redirect to `/login`).

- [ ] **Step 6: Commit**

```bash
git add src/app/find src/components/find
git commit -m "$(cat <<'EOF'
feat(find): /find page + ResultCard + FindEditor client

Server-rendered /find page with auth guard (redirects to /login).
FindEditor is a client component: debounce 250ms, min 2 chars,
fires searchUsersAction, renders states (empty input prompt,
loading skeletons, no results, results grid). ResultCard is a
pure <Link> per profile with avatar fallback to initial.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Sidebar — nav item "Trouver des amis"

**Files:**
- Modify: `src/components/sidebar.tsx`

Insert the nav entry. The footer `@username` work happens in Task 5 (needs the layout to forward props first).

- [ ] **Step 1: Add `UserSearch` import + nav entry**

Edit `src/components/sidebar.tsx`. Modify the lucide-react import line so `UserSearch` is included alphabetically:

```ts
import {
  Album,
  Clock,
  Download,
  Home,
  Music2,
  Settings,
  Users,
  UserSearch,
} from "lucide-react";
```

In the `NAV_ITEMS` array, insert this entry between "Top albums" and "Horloge d'écoute":

```ts
  { href: "/find", label: "Trouver des amis", icon: UserSearch },
```

So the final array reads:

```ts
const NAV_ITEMS = [
  { href: "/dashboard", label: "Tableau de bord", icon: Home },
  { href: "/top/tracks", label: "Top titres", icon: Music2 },
  { href: "/top/artists", label: "Top artistes", icon: Users },
  { href: "/top/albums", label: "Top albums", icon: Album },
  { href: "/find", label: "Trouver des amis", icon: UserSearch },
  { href: "/listening-clock", label: "Horloge d'écoute", icon: Clock },
  { href: "/import", label: "Importer", icon: Download },
  { href: "/settings", label: "Réglages", icon: Settings },
] as const;
```

- [ ] **Step 2: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/sidebar.tsx
git commit -m "$(cat <<'EOF'
feat(sidebar): nav item "Trouver des amis" → /find

Inserted between "Top albums" and "Horloge d'écoute", using
lucide-react's UserSearch icon. Active-page highlighting already
works thanks to the existing pathname comparison logic.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Layout fetches profile + sidebar footer `@username`

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/components/sidebar.tsx`

Mirrors the `hasImported` pattern: root layout fetches the data once via Promise.all and forwards to Sidebar.

- [ ] **Step 1: Update root layout to fetch profile**

Edit `src/app/layout.tsx`. Add `getProfile` to the imports next to `hasCompletedImport`:

```ts
import { hasCompletedImport } from "@/db/queries/imports";
import { getProfile } from "@/db/queries/users";
```

In `RootLayout`, replace the `hasImported` computation:

```ts
const session = await auth();
const hasImported = session?.user?.id
  ? await hasCompletedImport(session.user.id)
  : false;
```

with:

```ts
const session = await auth();
const userId = session?.user?.id;
const [hasImported, profile] = userId
  ? await Promise.all([hasCompletedImport(userId), getProfile(userId)])
  : ([false, null] as const);
```

Then update the `<Sidebar>` call to forward the new props:

```tsx
<Sidebar
  hasImported={hasImported}
  username={profile?.username ?? undefined}
  isPublic={profile?.isPublic ?? false}
/>
```

- [ ] **Step 2: Accept the new props in Sidebar + render the footer link**

Edit `src/components/sidebar.tsx`. Replace the function signature:

```ts
export function Sidebar({ hasImported }: { hasImported: boolean }) {
```

with:

```ts
export function Sidebar({
  hasImported,
  username,
  isPublic,
}: {
  hasImported: boolean;
  username?: string;
  isPublic?: boolean;
}) {
```

Find the legal links block (the `<div>` with "Mentions légales / Confidentialité / CGU"). Immediately AFTER that closing `</div>`, insert:

```tsx
{username ? (
  <Link
    href={isPublic ? `/u/${username}` : "/settings"}
    className={cn(
      "mt-2 px-3 text-[11px] font-mono text-muted-foreground/50 transition hover:text-foreground",
      !isPublic && "italic",
    )}
    title={
      isPublic
        ? "Ouvre ton profil public"
        : "Profil privé — clique pour activer"
    }
  >
    @{username}
  </Link>
) : null}
```

- [ ] **Step 3: Typecheck + lint + tests**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx src/components/sidebar.tsx
git commit -m "$(cat <<'EOF'
feat(sidebar): @username footer link sourced from root layout

RootLayout now fetches getProfile in parallel with hasCompletedImport
and forwards username + isPublic to Sidebar. Sidebar renders a
faint mono @username at the bottom, linking to /u/<username> when
public or /settings when private (with italic hint). Hidden when
the user has no username set.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: OwnProfileCard component (dashboard card)

**Files:**
- Create: `src/components/profile/own-profile-card.tsx`
- Create: `src/components/profile/own-profile-card-actions.tsx`

Server component that dispatches on profile state. Client subcomponent only for the "Copier" button (needs `navigator.clipboard`).

- [ ] **Step 1: Create the client copy-link button**

Create `src/components/profile/own-profile-card-actions.tsx`:

```tsx
"use client";

import { useState, useSyncExternalStore } from "react";
import { Check, Link as LinkIcon } from "lucide-react";

function useIsClient(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function CopyProfileLinkButton({ username }: { username: string }) {
  const isClient = useIsClient();
  const [copied, setCopied] = useState(false);
  const origin = isClient ? window.location.origin : "https://loopstat.tech";
  const url = `${origin}/u/${username}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable on non-HTTPS — fail silently */
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-2 rounded-full bg-[#7c3aed] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#6d28d9]"
    >
      {copied ? (
        <Check className="size-4" />
      ) : (
        <LinkIcon className="size-4" />
      )}
      {copied ? "Lien copié !" : "Copier le lien"}
    </button>
  );
}
```

- [ ] **Step 2: Create the server card component**

Create `src/components/profile/own-profile-card.tsx`:

```tsx
import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { CopyProfileLinkButton } from "@/components/profile/own-profile-card-actions";
import type { ProfileRow } from "@/db/queries/users";
import { cn, glassCard } from "@/lib/utils";

export function OwnProfileCard({ profile }: { profile: ProfileRow | null }) {
  if (!profile?.username) return null;

  if (!profile.isPublic) {
    return (
      <section
        className={cn(
          glassCard,
          "flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between",
        )}
      >
        <div>
          <p className="text-sm font-medium">Ton profil est privé</p>
          <p className="text-xs text-muted-foreground">
            Active-le pour partager tes stats sur{" "}
            <span className="font-mono">
              loopstat.tech/u/{profile.username}
            </span>
            .
          </p>
        </div>
        <Link
          href="/settings"
          className="inline-flex items-center justify-center rounded-full bg-[#7c3aed] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#6d28d9]"
        >
          Activer mon profil public →
        </Link>
      </section>
    );
  }

  const url = `loopstat.tech/u/${profile.username}`;
  return (
    <section className={cn(glassCard, "flex flex-col gap-4 p-5")}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Mon profil public</p>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
          <span className="size-1.5 rounded-full bg-emerald-400" />
          Public
        </span>
      </div>
      <p className="font-mono text-sm text-muted-foreground">{url}</p>
      <div className="flex flex-wrap gap-2">
        <CopyProfileLinkButton username={profile.username} />
        <Link
          href={`/u/${profile.username}`}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-2 rounded-full border bg-white/5 px-4 py-2 text-sm transition hover:bg-white/10"
        >
          <ExternalLink className="size-4" /> Voir mon profil
        </Link>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/profile
git commit -m "$(cat <<'EOF'
feat(profile): OwnProfileCard + copy-link client subcomponent

OwnProfileCard is a server component that dispatches on the
caller's ProfileRow: returns null when no username yet, a violet
CTA when private, the full card (URL + copy + view) when public.
CopyProfileLinkButton is a 30-line client component using the
project's useIsClient pattern to stay React 19 strict-eslint
clean.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Render OwnProfileCard on the dashboard

**Files:**
- Modify: `src/app/dashboard/page.tsx`

`profile` is already fetched by `dashboard/page.tsx` (added in the earlier ShareButton wiring). Just import + render.

- [ ] **Step 1: Add import**

Edit `src/app/dashboard/page.tsx`. After the existing `import { ImportBanner } from "@/components/import-banner";` line, add:

```ts
import { OwnProfileCard } from "@/components/profile/own-profile-card";
```

- [ ] **Step 2: Render the card after AppHeader, before ImportBanner**

In the JSX, find the block that contains `<ImportBanner />`. Right BEFORE it (inside the same parent `<div className="flex flex-col gap-12">`), insert:

```tsx
<OwnProfileCard profile={profile} />
```

Final shape of that container (excerpt):

```tsx
<div className="flex flex-col gap-12">
  <OwnProfileCard profile={profile} />
  <ImportBanner />
  …
</div>
```

- [ ] **Step 3: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "$(cat <<'EOF'
feat(dashboard): render OwnProfileCard at the top

Reuses the profile already fetched by the dashboard page for the
ShareButton, so no extra DB round-trip.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Settings — "Voir mon profil public →" link

**Files:**
- Modify: `src/components/settings/profile-form.tsx`

The link only appears when the toggle is on AND a username exists. Tracks the form's local `isPublic` state so the user sees it appear right after they enable + save (no full reload required).

- [ ] **Step 1: Add the link after the toggle**

Edit `src/components/settings/profile-form.tsx`. Locate the `<label>` that wraps the "Rendre mon profil public" checkbox (the one with `<input name="isPublic" ...>`). Immediately AFTER that `</label>` (still inside the form), insert:

```tsx
{isPublic && displayUsername ? (
  <a
    href={`/u/${displayUsername}`}
    target="_blank"
    rel="noopener"
    className="self-start text-sm text-[#c4b5fd] hover:underline"
  >
    Voir mon profil public →
  </a>
) : null}
```

(`displayUsername` is the existing variable in this component that reflects the current username — the one the user is about to commit.)

- [ ] **Step 2: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/settings/profile-form.tsx
git commit -m "$(cat <<'EOF'
feat(settings): "Voir mon profil public →" link below toggle

Appears only when the toggle is checked AND a username is known
(both client-side, so it appears immediately after the user saves
the form with isPublic=true). Opens in a new tab so the editing
context is preserved.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Self-visit banner on `/u/[username]`

**Files:**
- Modify: `src/app/u/[username]/page.tsx`

When the visitor is logged in and is the profile's owner, show a contextual banner above the profile content.

- [ ] **Step 1: Add auth + self-detection at the top of the page**

Edit `src/app/u/[username]/page.tsx`. Add the auth import at the top:

```ts
import { auth } from "@/auth";
```

In `PublicProfilePage` (the default export), AFTER the `if (!profile) notFound();` line, add:

```ts
const session = await auth();
const isOwnProfile = session?.user?.id === profile.id;
```

- [ ] **Step 2: Render the banner above the profile header**

In the JSX, find the opening of the `<main>` block. Right at the very top of the `<main>` (BEFORE the existing `<header>` with avatar + display name), insert:

```tsx
{isOwnProfile ? (
  <aside
    role="status"
    className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#7c3aed]/30 bg-[#7c3aed]/10 px-4 py-3 text-sm"
  >
    <span>
      👤 Tu visites ton propre profil — c&apos;est ce que voient les
      autres.
    </span>
    <Link
      href="/settings"
      className="font-medium text-[#c4b5fd] hover:underline"
    >
      Modifier mes réglages →
    </Link>
  </aside>
) : null}
```

(The file already imports `Link` from `next/link`; no new imports needed beyond `auth`.)

- [ ] **Step 3: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add 'src/app/u/[username]/page.tsx'
git commit -m "$(cat <<'EOF'
feat(profile): "tu visites ton propre profil" banner on /u/<self>

Compares session.user.id with profile.id; when they match, renders
a violet-tinted banner at the top of /u/<username> with a quick
shortcut to /settings. Anonymous visitors and other users see
nothing extra.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: End-to-end manual verification

No new files. Walk through the spec's verification section in the browser as `judescha` (DB state: `username='judescha'`, `is_public=true`).

- [ ] **Step 1: Sidebar**

- Visit `/dashboard` → sidebar item "Trouver des amis" visible between "Top albums" and "Horloge d'écoute" with the UserSearch icon.
- Sidebar footer shows `@judescha` (faint mono).
- Click `@judescha` → opens `/u/judescha`. ✅
- In another terminal, flip `is_public` to false:
  ```bash
  docker exec loopstat_postgres psql -U loopstat -d loopstat -c "UPDATE users SET is_public=false WHERE username='judescha';"
  ```
- Refresh `/dashboard`. Sidebar footer `@judescha` should be italicized; clicking it should now go to `/settings`. ✅
- Restore:
  ```bash
  docker exec loopstat_postgres psql -U loopstat -d loopstat -c "UPDATE users SET is_public=true WHERE username='judescha';"
  ```

- [ ] **Step 2: OwnProfileCard (3 states)**

- `/dashboard` (public) → card "Mon profil public" with green Public pill, URL `loopstat.tech/u/judescha`, copy button + "Voir mon profil" button. Click Copier → "Lien copié !" for 2s. ✅
- Set private again, reload `/dashboard` → card swaps to "Ton profil est privé" with CTA "Activer mon profil public →". Click → lands on `/settings`. ✅
- Restore public.

- [ ] **Step 3: Settings link**

- `/settings` with isPublic on → "Voir mon profil public →" link visible below the toggle. Click → opens `/u/judescha` in new tab. ✅
- Toggle off and Enregistrer → link disappears immediately. Re-enable.

- [ ] **Step 4: Self-visit banner**

- Logged in, visit `/u/judescha` → top banner "👤 Tu visites ton propre profil…" with "Modifier mes réglages →" link. ✅
- Open `/u/judescha` in private window (no session) → no banner. ✅

- [ ] **Step 5: /find search**

- Unauth: `curl -s -o /dev/null -w "HTTP %{http_code}\n" "http://127.0.0.1:3000/find"` → 307. ✅
- Auth: visit `/find` → input visible, autofocused, empty prompt "Tape un pseudo (min 2 caractères) pour rechercher."
- Type "j" (1 char) → no fire, prompt remains.
- Type "ju" → after ~250ms, see judescha's result card.
- Click the result → navigates to `/u/judescha`. ✅
- Type "xyz" → "Aucun profil trouvé pour « xyz »…" empty state.
- Type "JUL" (uppercase) → still finds judescha (ILIKE is case-insensitive). ✅
- Type "%" → searches literally for percent sign in usernames/displayName → no results (escape working). ✅

- [ ] **Step 6: Anti-enumeration**

- Set `is_public=false` for judescha (psql), then on `/find` type "jud" → 0 results.
- Restore `is_public=true`.

- [ ] **Step 7: Branch hygiene**

Run a final clean-state check:

```bash
git status                                      # working tree clean (apart from unrelated Dockerfile/.superpowers/scripts)
pnpm typecheck && pnpm lint && pnpm test        # all green
git log --oneline main..feat/profile-discoverability   # 9 commits
```

Branch is ready for merge once all checks above pass.

---

## Out-of-scope (do NOT add)

Reminder: the following are explicitly deferred — do not sneak them in.

- Taste-based discovery algorithm (issue #21).
- OG image custom from /share config (issue #15).
- Follow/friend concept, notifications, feed.
- Pagination of search results.
- Server-side cache of search results.
- Public API endpoint for search (server action only).
- Full-text search (trigram, FTS) — overkill at MVP user counts.
- Index on `display_name` — add later if production telemetry shows ILIKE on display_name as a hotspot.
