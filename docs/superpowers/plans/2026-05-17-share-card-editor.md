# Share Card Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a `/share` page where authenticated public-profile users can preview + customize a downloadable card (mode focus or recap, 3 formats, 4 periods, 2 backgrounds) and a `/api/share-card` route that generates the PNG via `next/og`.

**Architecture:** URL-driven editor (no DB persistence at MVP — query params are the source of truth). Server renders the page, a client component handles controls + `history.replaceState` URL sync + re-fetches a single `<img>` whose `src` points to `/api/share-card?...`. The API parses Zod-validated params, fetches stats (existing helpers in `src/db/queries/stats.ts`), and returns a PNG built with format-specific JSX templates that share a small helpers module.

**Tech Stack:** Next.js 16.2.4 (App Router), React 19.2.4, TypeScript, Drizzle ORM + Postgres, `next/og` + Satori, Zod 4, Vitest.

**Spec:** [docs/superpowers/specs/2026-05-17-share-card-editor-design.md](docs/superpowers/specs/2026-05-17-share-card-editor-design.md)

**Branch:** `feat/phase-a-viral` (continuation of the in-progress Phase A viral work).

---

## Critical context for the engineer

1. **Satori (`next/og`) requires `display: "flex"` on every `<div>` that has children — even text-only ones.** Without it, the response throws "failed to pipe response" with no Satori-side error in the Next dev log. We hit this when building the auto OG image; do not regress.

2. **`<img>` inside `ImageResponse` JSX fetches the URL server-side and embeds the bytes.** Spotify CDN (`i.scdn.co`) URLs work fine — confirmed in [src/app/u/[username]/opengraph-image.tsx](src/app/u/[username]/opengraph-image.tsx).

3. **Postgres pool already cached on `globalThis`** in [src/db/client.ts](src/db/client.ts). Adding new queries does not require additional plumbing.

4. **Existing stats queries to reuse, not reimplement** ([src/db/queries/stats.ts](src/db/queries/stats.ts)):
   - `getTopTracksFromStreams(userId, since, limit)` → `{ trackId, name, albumImageUrl, artistNames[], plays }[]`
   - `getTopArtistsFromStreams(userId, since, limit)` → `{ artistId, name, imageUrl, plays }[]`
   - `getTopAlbumsFromStreams(userId, since, limit)` → `{ albumId, name, imageUrl, artistNames[], plays }[]`

5. **Period helper:** `periodSince(period)` in [src/lib/stats/period.ts](src/lib/stats/period.ts) returns `Date | null` (null = "all").

6. **Profile lookup:** `getPublicProfileByUsername(username)` in [src/db/queries/users.ts](src/db/queries/users.ts) returns `null` if not found OR not public — caller treats both as 404.

7. **Dev server caveat:** the user keeps a `pnpm dev` running on port 3000 (PID was 57422 earlier — may have changed). Run smoke-test curls against `http://127.0.0.1:3000`. Do NOT start a second dev server; it will conflict.

8. **Test data state (verified 2026-05-17):** one user in DB — `username=judescha`, `is_public=true`. Use `judescha` for all curl smoke tests.

9. **CSS palette tokens reused across cards:**
   - Background mesh: 3 radial gradients (violet `#7c3aed`, magenta `#ec4899`, cyan `#38bdf8`) over `#070710`.
   - Text: `#f4f0ff` (main), `rgba(244,240,255,0.55)` (muted), `rgba(244,240,255,0.35)` (faint).
   - Accent fill: `#7c3aed`.

---

## File structure

**Create:**

| Path | Responsibility |
|---|---|
| `src/lib/share/card-config.ts` | Zod schema, defaults, format/N matrix, parse helpers — pure functions |
| `src/lib/share/card-config.test.ts` | Vitest unit tests for the helpers |
| `src/db/queries/wall-covers.ts` | Single query that returns N unique album cover URLs for a user over a period |
| `src/app/api/share-card/templates/shared.tsx` | JSX building blocks: `<Stack>`, `<HStack>`, `<Header>`, `<Watermark>`, `<BgMesh>`, `<BgWall>`, `<RankRow>` |
| `src/app/api/share-card/templates/story.tsx` | 1080×1920 template (focus + recap) |
| `src/app/api/share-card/templates/post.tsx` | 1080×1080 template (focus + recap) |
| `src/app/api/share-card/templates/twitter.tsx` | 1200×630 template (focus + recap) |
| `src/app/api/share-card/route.tsx` | GET handler: parse → fetch data → dispatch to template → return `ImageResponse` |
| `src/components/share/preview.tsx` | Client `<img>` that swaps `src` when config changes |
| `src/components/share/share-editor.tsx` | Client editor: state + URL sync + controls + actions |
| `src/app/share/page.tsx` | Server component: auth guards, parse params, render `<ShareEditor>` |

**Modify:**

| Path | Change |
|---|---|
| `src/components/share-button.tsx` | Add "Personnaliser ma carte…" as first menu item; accept `context?: ShareContext` prop |
| `src/components/app-header.tsx` | Accept + forward `shareContext` prop |
| `src/app/dashboard/page.tsx` | Pass `shareContext="dashboard"` to `<AppHeader>` |
| `src/app/top/tracks/page.tsx` | Pass `context="tracks"` to `<ShareButton>` |
| `src/app/top/artists/page.tsx` | Pass `context="artists"` to `<ShareButton>` |
| `src/app/top/albums/page.tsx` | Pass `context="albums"` to `<ShareButton>` |

---

## Task 1: Card config types, schema, defaults, and matrix helpers

**Files:**
- Create: `src/lib/share/card-config.ts`
- Create: `src/lib/share/card-config.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/share/card-config.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  CONTEXT_PRESETS,
  FORMAT_N_OPTIONS,
  RECAP_N_BY_FORMAT,
  SHARE_CARD_DEFAULTS,
  buildShareCardUrl,
  clampNForFormat,
  parseShareCardParams,
  validForFormat,
} from "./card-config";

describe("parseShareCardParams", () => {
  it("returns defaults on empty input", () => {
    expect(parseShareCardParams({})).toEqual(SHARE_CARD_DEFAULTS);
  });

  it("accepts a complete URLSearchParams", () => {
    const sp = new URLSearchParams(
      "mode=focus&type=artists&n=7&period=6m&format=post&bg=wall",
    );
    expect(parseShareCardParams(sp)).toEqual({
      mode: "focus",
      type: "artists",
      n: 7,
      period: "6m",
      format: "post",
      bg: "wall",
    });
  });

  it("falls back to defaults on garbage inputs (never throws)", () => {
    expect(
      parseShareCardParams({
        mode: "lolwat",
        type: "songs",
        n: "abc",
        period: "1y",
        format: "story",
        bg: "mesh",
      }),
    ).toEqual({
      ...SHARE_CARD_DEFAULTS,
      period: "1y",
      format: "story",
      bg: "mesh",
    });
  });

  it("clamps n to a valid value for the chosen format", () => {
    const out = parseShareCardParams({ format: "twitter", n: "10" });
    expect(out.format).toBe("twitter");
    expect(out.n).toBe(5);
  });
});

describe("validForFormat", () => {
  it("matches the matrix from the spec", () => {
    expect(validForFormat("twitter", 3)).toBe(true);
    expect(validForFormat("twitter", 5)).toBe(true);
    expect(validForFormat("twitter", 7)).toBe(false);
    expect(validForFormat("twitter", 10)).toBe(false);

    expect(validForFormat("post", 3)).toBe(true);
    expect(validForFormat("post", 7)).toBe(true);
    expect(validForFormat("post", 10)).toBe(false);

    expect(validForFormat("story", 10)).toBe(true);
    expect(validForFormat("story", 11)).toBe(false);
  });
});

describe("clampNForFormat", () => {
  it("returns n if already valid", () => {
    expect(clampNForFormat("post", 5)).toBe(5);
  });

  it("returns the max valid value when n is too big", () => {
    expect(clampNForFormat("twitter", 10)).toBe(5);
    expect(clampNForFormat("post", 12)).toBe(7);
  });

  it("returns the min valid value when n is too small", () => {
    expect(clampNForFormat("story", 1)).toBe(3);
  });
});

describe("FORMAT_N_OPTIONS", () => {
  it("matches the matrix exactly", () => {
    expect(FORMAT_N_OPTIONS).toEqual({
      twitter: [3, 5],
      post: [3, 5, 7],
      story: [3, 5, 7, 10],
    });
  });
});

describe("RECAP_N_BY_FORMAT", () => {
  it("is 3 for twitter/post, 5 for story", () => {
    expect(RECAP_N_BY_FORMAT).toEqual({
      twitter: 3,
      post: 3,
      story: 5,
    });
  });
});

describe("CONTEXT_PRESETS", () => {
  it("dashboard preset is recap+story", () => {
    expect(CONTEXT_PRESETS.dashboard).toEqual({
      mode: "recap",
      format: "story",
    });
  });

  it("/top/* presets target the matching category in story format", () => {
    expect(CONTEXT_PRESETS.tracks).toEqual({
      mode: "focus",
      type: "tracks",
      format: "story",
    });
    expect(CONTEXT_PRESETS.artists).toMatchObject({ type: "artists" });
    expect(CONTEXT_PRESETS.albums).toMatchObject({ type: "albums" });
  });
});

describe("buildShareCardUrl", () => {
  it("includes username + all config fields", () => {
    const url = buildShareCardUrl(SHARE_CARD_DEFAULTS, "judescha");
    expect(url).toMatch(/^\/api\/share-card\?/);
    expect(url).toContain("username=judescha");
    expect(url).toContain("mode=focus");
    expect(url).toContain("type=tracks");
    expect(url).toContain("n=5");
    expect(url).toContain("period=4w");
    expect(url).toContain("format=story");
    expect(url).toContain("bg=mesh");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/lib/share/card-config.test.ts`
Expected: FAIL with "Cannot find module './card-config'".

- [ ] **Step 3: Implement card-config.ts**

Create `src/lib/share/card-config.ts`:

```ts
import { z } from "zod";

export const SHARE_MODES = ["focus", "recap"] as const;
export const SHARE_TYPES = ["tracks", "artists", "albums"] as const;
export const SHARE_PERIODS = ["4w", "6m", "1y", "all"] as const;
export const SHARE_FORMATS = ["twitter", "post", "story"] as const;
export const SHARE_BACKGROUNDS = ["mesh", "wall"] as const;

export type ShareMode = (typeof SHARE_MODES)[number];
export type ShareType = (typeof SHARE_TYPES)[number];
export type SharePeriod = (typeof SHARE_PERIODS)[number];
export type ShareFormat = (typeof SHARE_FORMATS)[number];
export type ShareBackground = (typeof SHARE_BACKGROUNDS)[number];

export type ShareCardConfig = {
  mode: ShareMode;
  type: ShareType;
  n: number;
  period: SharePeriod;
  format: ShareFormat;
  bg: ShareBackground;
};

export const SHARE_CARD_DEFAULTS: ShareCardConfig = {
  mode: "focus",
  type: "tracks",
  n: 5,
  period: "4w",
  format: "story",
  bg: "mesh",
};

// Matrice formats × N. Doit rester aligné avec la Section 2 du spec.
export const FORMAT_N_OPTIONS: Record<ShareFormat, readonly number[]> = {
  twitter: [3, 5],
  post: [3, 5, 7],
  story: [3, 5, 7, 10],
};

// Mode recap : N fixé par format (le contrôle utilisateur N est ignoré).
export const RECAP_N_BY_FORMAT: Record<ShareFormat, number> = {
  twitter: 3,
  post: 3,
  story: 5,
};

export type ShareContext = "dashboard" | "tracks" | "artists" | "albums";

export const CONTEXT_PRESETS: Record<ShareContext, Partial<ShareCardConfig>> = {
  dashboard: { mode: "recap", format: "story" },
  tracks: { mode: "focus", type: "tracks", format: "story" },
  artists: { mode: "focus", type: "artists", format: "story" },
  albums: { mode: "focus", type: "albums", format: "story" },
};

export function validForFormat(format: ShareFormat, n: number): boolean {
  return FORMAT_N_OPTIONS[format].includes(n);
}

export function clampNForFormat(format: ShareFormat, n: number): number {
  const options = FORMAT_N_OPTIONS[format];
  if (options.includes(n)) return n;
  if (n < options[0]) return options[0];
  return options[options.length - 1];
}

// Schema tolérant : applique les defaults sur chaque champ invalide
// plutôt que de throw. La page /share et la route API n'ont jamais à
// gérer d'exception ici — l'URL est toujours acceptée.
const fieldSchema = z.object({
  mode: z.enum(SHARE_MODES).catch(SHARE_CARD_DEFAULTS.mode),
  type: z.enum(SHARE_TYPES).catch(SHARE_CARD_DEFAULTS.type),
  n: z.coerce.number().int().positive().catch(SHARE_CARD_DEFAULTS.n),
  period: z.enum(SHARE_PERIODS).catch(SHARE_CARD_DEFAULTS.period),
  format: z.enum(SHARE_FORMATS).catch(SHARE_CARD_DEFAULTS.format),
  bg: z.enum(SHARE_BACKGROUNDS).catch(SHARE_CARD_DEFAULTS.bg),
});

type RawInput =
  | URLSearchParams
  | Record<string, string | string[] | undefined>;

function get(input: RawInput, key: string): string | undefined {
  if (input instanceof URLSearchParams) return input.get(key) ?? undefined;
  const v = input[key];
  if (Array.isArray(v)) return v[0];
  return v ?? undefined;
}

export function parseShareCardParams(input: RawInput): ShareCardConfig {
  const parsed = fieldSchema.parse({
    mode: get(input, "mode") ?? SHARE_CARD_DEFAULTS.mode,
    type: get(input, "type") ?? SHARE_CARD_DEFAULTS.type,
    n: get(input, "n") ?? SHARE_CARD_DEFAULTS.n,
    period: get(input, "period") ?? SHARE_CARD_DEFAULTS.period,
    format: get(input, "format") ?? SHARE_CARD_DEFAULTS.format,
    bg: get(input, "bg") ?? SHARE_CARD_DEFAULTS.bg,
  });
  return { ...parsed, n: clampNForFormat(parsed.format, parsed.n) };
}

export function buildShareCardUrl(
  cfg: ShareCardConfig,
  username: string,
): string {
  const sp = new URLSearchParams({
    username,
    mode: cfg.mode,
    type: cfg.type,
    n: String(cfg.n),
    period: cfg.period,
    format: cfg.format,
    bg: cfg.bg,
  });
  return `/api/share-card?${sp.toString()}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/lib/share/card-config.test.ts`
Expected: PASS — all describe blocks green.

- [ ] **Step 5: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/share/card-config.ts src/lib/share/card-config.test.ts
git commit -m "$(cat <<'EOF'
feat(share): card config schema, defaults, format×N matrix

Tolerant Zod parsing (never throws — falls back to defaults per field),
matrix constraints from spec Section 2, context-to-preset mapping for
the ShareButton "Customize…" entry point.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Wall covers DB query

**Files:**
- Create: `src/db/queries/wall-covers.ts`

Used by the `bg=wall` background to render a faded collage of the user's actual album covers.

- [ ] **Step 1: Implement the query**

Create `src/db/queries/wall-covers.ts`:

```ts
import { and, desc, eq, gte, isNotNull, or, sql } from "drizzle-orm";

import { db } from "@/db/client";
import { albums, streams, tracks } from "@/db/schema";

const QUALIFYING_PLAY = or(
  gte(streams.msPlayed, 30000),
  sql`${streams.msPlayed} is null`,
);

/**
 * Top N album cover URLs for a user over a period, deduped by album_id.
 * Used as the `bg=wall` collage on share cards (echoes the dashboard
 * album wall pattern from src/components/album-wall.tsx).
 *
 * Returns absolute Spotify CDN URLs only (skips albums without artwork).
 */
export async function getWallCovers(
  userId: string,
  since: Date | null,
  limit: number,
): Promise<string[]> {
  const where = since
    ? and(
        eq(streams.userId, userId),
        gte(streams.playedAt, since),
        isNotNull(albums.imageUrl),
        QUALIFYING_PLAY,
      )
    : and(
        eq(streams.userId, userId),
        isNotNull(albums.imageUrl),
        QUALIFYING_PLAY,
      );

  const rows = await db
    .select({
      albumId: albums.id,
      imageUrl: albums.imageUrl,
      plays: sql<number>`count(*)::int`,
    })
    .from(streams)
    .innerJoin(tracks, eq(tracks.id, streams.trackId))
    .innerJoin(albums, eq(albums.id, tracks.albumId))
    .where(where)
    .groupBy(albums.id, albums.imageUrl)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);

  return rows
    .map((r) => r.imageUrl)
    .filter((url): url is string => url !== null);
}
```

- [ ] **Step 2: Smoke test against the local DB**

Run:

```bash
docker exec loopstat_postgres psql -U loopstat -d loopstat -c "
  SELECT a.image_url, count(*) AS plays
  FROM streams s
  JOIN tracks t ON t.id = s.track_id
  JOIN albums a ON a.id = t.album_id
  WHERE s.user_id = '606faa26-da96-4e7c-935d-2a803eaefc01'
    AND a.image_url IS NOT NULL
  GROUP BY a.id, a.image_url
  ORDER BY plays DESC LIMIT 5;
"
```

Expected: 5 rows with `image_url` starting with `https://i.scdn.co/image/`.

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/db/queries/wall-covers.ts
git commit -m "$(cat <<'EOF'
feat(db): wall-covers query for share-card backgrounds

Top N unique album cover URLs for a user, deduped by album_id and
sorted by play count over a window. Mirrors the QUALIFYING_PLAY
filter used in src/db/queries/stats.ts (>=30s OR null).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Template shared helpers

**Files:**
- Create: `src/app/api/share-card/templates/shared.tsx`

JSX building blocks. ALL of them apply `display: "flex"` defensively to keep Satori happy.

- [ ] **Step 1: Implement shared.tsx**

Create `src/app/api/share-card/templates/shared.tsx`:

```tsx
import type { ReactNode } from "react";

import type { ShareBackground, SharePeriod } from "@/lib/share/card-config";

export const COLORS = {
  bg: "#070710",
  accent: "#7c3aed",
  text: "#f4f0ff",
  textMuted: "rgba(244,240,255,0.55)",
  textFaint: "rgba(244,240,255,0.35)",
  card: "rgba(124,58,237,0.3)",
};

export const PERIOD_LABEL: Record<SharePeriod, string> = {
  "4w": "4 dernières semaines",
  "6m": "6 derniers mois",
  "1y": "12 derniers mois",
  all: "Tout l'historique",
};

type CommonStyle = {
  display: "flex";
  flexDirection?: "row" | "column";
  alignItems?: "flex-start" | "center" | "flex-end" | "stretch";
  justifyContent?:
    | "flex-start"
    | "center"
    | "flex-end"
    | "space-between"
    | "space-around";
  gap?: number;
  margin?: number;
  marginTop?: number | "auto";
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;
  padding?: number;
  paddingTop?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  paddingRight?: number;
  width?: number | string;
  height?: number | string;
  flex?: number;
  color?: string;
  fontSize?: number;
  fontWeight?: number;
  letterSpacing?: number;
  background?: string;
  borderRadius?: number;
};

/** Vertical flex container (always display:flex per Satori). */
export function Stack({
  children,
  style,
}: {
  children: ReactNode;
  style?: CommonStyle;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", ...style }}>
      {children}
    </div>
  );
}

/** Horizontal flex container. */
export function HStack({
  children,
  style,
}: {
  children: ReactNode;
  style?: CommonStyle;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Avatar + display name + @username header. */
export function CardHeader({
  displayName,
  username,
  avatarUrl,
  scale = 1,
}: {
  displayName: string;
  username: string;
  avatarUrl: string | null;
  scale?: number;
}) {
  const size = Math.round(96 * scale);
  return (
    <HStack style={{ gap: Math.round(20 * scale) }}>
      {avatarUrl ? (
        <img
          src={avatarUrl}
          width={size}
          height={size}
          alt=""
          style={{ borderRadius: size, objectFit: "cover" }}
        />
      ) : (
        <div
          style={{
            width: size,
            height: size,
            borderRadius: size,
            background: COLORS.accent,
            color: COLORS.text,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: Math.round(48 * scale),
            fontWeight: 700,
          }}
        >
          {displayName.charAt(0).toUpperCase()}
        </div>
      )}
      <Stack>
        <div
          style={{
            display: "flex",
            fontSize: Math.round(48 * scale),
            fontWeight: 700,
            lineHeight: 1,
            color: COLORS.text,
          }}
        >
          {displayName}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: Math.round(22 * scale),
            color: COLORS.textMuted,
            marginTop: Math.round(6 * scale),
          }}
        >
          @{username}
        </div>
      </Stack>
    </HStack>
  );
}

/** Section label like "TOP TITRES · 4 SEMAINES". */
export function SectionLabel({
  text,
  scale = 1,
}: {
  text: string;
  scale?: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        fontSize: Math.round(16 * scale),
        color: COLORS.textMuted,
        letterSpacing: Math.round(3 * scale),
      }}
    >
      {text}
    </div>
  );
}

/** Numbered row with optional cover + title + subtitle. */
export function RankRow({
  rank,
  title,
  subtitle,
  imageUrl,
  scale = 1,
}: {
  rank: number;
  title: string;
  subtitle?: string;
  imageUrl?: string | null;
  scale?: number;
}) {
  const coverSize = Math.round(64 * scale);
  return (
    <HStack style={{ gap: Math.round(16 * scale), marginTop: Math.round(14 * scale) }}>
      <div
        style={{
          display: "flex",
          width: Math.round(44 * scale),
          fontSize: Math.round(32 * scale),
          color: COLORS.textFaint,
        }}
      >
        {String(rank)}
      </div>
      {imageUrl ? (
        <img
          src={imageUrl}
          width={coverSize}
          height={coverSize}
          alt=""
          style={{ borderRadius: Math.round(6 * scale) }}
        />
      ) : (
        <div
          style={{
            width: coverSize,
            height: coverSize,
            borderRadius: Math.round(6 * scale),
            background: COLORS.card,
            display: "flex",
          }}
        />
      )}
      <Stack style={{ flex: 1 }}>
        <div
          style={{
            display: "flex",
            fontSize: Math.round(26 * scale),
            fontWeight: 600,
            color: COLORS.text,
          }}
        >
          {title.length > 40 ? `${title.slice(0, 39)}…` : title}
        </div>
        {subtitle ? (
          <div
            style={{
              display: "flex",
              fontSize: Math.round(20 * scale),
              color: COLORS.textMuted,
              marginTop: Math.round(2 * scale),
            }}
          >
            {subtitle.length > 50 ? `${subtitle.slice(0, 49)}…` : subtitle}
          </div>
        ) : null}
      </Stack>
    </HStack>
  );
}

export function Watermark({
  username,
  scale = 1,
}: {
  username: string;
  scale?: number;
}) {
  return (
    <div
      style={{
        marginTop: "auto",
        display: "flex",
        justifyContent: "flex-end",
        fontSize: Math.round(20 * scale),
        color: COLORS.textMuted,
      }}
    >
      loopstat.tech/u/{username}
    </div>
  );
}

/**
 * Background layer absolutely positioned over the whole card. Both
 * variants render edge-to-edge — content sits on top via a sibling
 * positioned container.
 */
export function Background({
  variant,
  width,
  height,
  covers,
}: {
  variant: ShareBackground;
  width: number;
  height: number;
  covers: string[];
}) {
  if (variant === "wall") {
    return <WallBackground width={width} height={height} covers={covers} />;
  }
  return <MeshBackground width={width} height={height} />;
}

function MeshBackground({ width, height }: { width: number; height: number }) {
  return (
    <div
      style={{
        display: "flex",
        position: "absolute",
        top: 0,
        left: 0,
        width,
        height,
        background: `
          radial-gradient(circle at 20% 20%, rgba(124,58,237,0.55), transparent 50%),
          radial-gradient(circle at 80% 30%, rgba(236,72,153,0.45), transparent 55%),
          radial-gradient(circle at 50% 80%, rgba(56,189,248,0.4), transparent 55%),
          ${COLORS.bg}
        `,
      }}
    />
  );
}

function WallBackground({
  width,
  height,
  covers,
}: {
  width: number;
  height: number;
  covers: string[];
}) {
  // 6 columns × ceil(N/6) rows, no gap, slight scale + opacity so the
  // covers tile feels like an ambient texture not a photo grid.
  const cols = 6;
  const tileSize = Math.ceil(width / cols);
  return (
    <div
      style={{
        display: "flex",
        position: "absolute",
        top: 0,
        left: 0,
        width,
        height,
        background: COLORS.bg,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          width,
          opacity: 0.22,
        }}
      >
        {covers.slice(0, cols * Math.ceil(height / tileSize)).map((url, i) => (
          <img
            key={`${i}-${url}`}
            src={url}
            width={tileSize}
            height={tileSize}
            alt=""
            style={{ objectFit: "cover" }}
          />
        ))}
      </div>
      <div
        style={{
          display: "flex",
          position: "absolute",
          top: 0,
          left: 0,
          width,
          height,
          background: `linear-gradient(180deg, rgba(124,58,237,0.18), rgba(7,7,16,0.78))`,
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/share-card/templates/shared.tsx
git commit -m "$(cat <<'EOF'
feat(share): shared JSX helpers for card templates

Stack/HStack/CardHeader/RankRow/Watermark/Background components.
Every wrapper sets display:flex defensively to avoid the "failed to
pipe response" trap Satori throws on text-only divs. Scale prop on
each component so templates can tune sizes per format (1200x630 vs
1080x1920) without forks.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Story template (1080×1920) — focus + recap

**Files:**
- Create: `src/app/api/share-card/templates/story.tsx`

This is the most-used format (default in defaults + most context presets). Build it first to validate the layout system.

- [ ] **Step 1: Implement story.tsx**

Create `src/app/api/share-card/templates/story.tsx`:

```tsx
import type { ReactNode } from "react";

import type {
  ShareBackground,
  ShareCardConfig,
} from "@/lib/share/card-config";

import {
  Background,
  CardHeader,
  COLORS,
  PERIOD_LABEL,
  RankRow,
  SectionLabel,
  Stack,
  Watermark,
} from "./shared";

export const STORY_SIZE = { width: 1080, height: 1920 };

export type FocusItem = {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string | null;
};

export type RecapData = {
  tracks: FocusItem[];
  artists: FocusItem[];
  albums: FocusItem[];
};

export type StoryProps = {
  config: Pick<ShareCardConfig, "mode" | "type" | "period" | "bg">;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  covers: string[];
  data: FocusItem[] | RecapData;
};

const LABEL_BY_TYPE: Record<"tracks" | "artists" | "albums", string> = {
  tracks: "Top titres",
  artists: "Top artistes",
  albums: "Top albums",
};

export function StoryTemplate({
  config,
  username,
  displayName,
  avatarUrl,
  covers,
  data,
}: StoryProps): ReactNode {
  return (
    <div
      style={{
        position: "relative",
        width: STORY_SIZE.width,
        height: STORY_SIZE.height,
        display: "flex",
        color: COLORS.text,
      }}
    >
      <Background
        variant={config.bg as ShareBackground}
        width={STORY_SIZE.width}
        height={STORY_SIZE.height}
        covers={covers}
      />
      <Stack
        style={{
          padding: 80,
          width: STORY_SIZE.width,
          height: STORY_SIZE.height,
        }}
      >
        <CardHeader
          displayName={displayName}
          username={username}
          avatarUrl={avatarUrl}
          scale={1.4}
        />
        {config.mode === "focus" ? (
          <FocusSection
            label={`${LABEL_BY_TYPE[config.type].toUpperCase()} · ${PERIOD_LABEL[config.period].toUpperCase()}`}
            items={data as FocusItem[]}
          />
        ) : (
          <RecapSection
            data={data as RecapData}
            periodLabel={PERIOD_LABEL[config.period]}
          />
        )}
        <Watermark username={username} scale={1.2} />
      </Stack>
    </div>
  );
}

function FocusSection({ label, items }: { label: string; items: FocusItem[] }) {
  return (
    <Stack style={{ marginTop: 70 }}>
      <SectionLabel text={label} scale={1.3} />
      <Stack style={{ marginTop: 20 }}>
        {items.map((item, i) => (
          <RankRow
            key={item.id}
            rank={i + 1}
            title={item.title}
            subtitle={item.subtitle}
            imageUrl={item.imageUrl}
            scale={1.4}
          />
        ))}
      </Stack>
    </Stack>
  );
}

function RecapSection({
  data,
  periodLabel,
}: {
  data: RecapData;
  periodLabel: string;
}) {
  return (
    <Stack style={{ marginTop: 60, gap: 50 }}>
      <RecapBlock
        label={`TOP TITRES · ${periodLabel.toUpperCase()}`}
        items={data.tracks}
      />
      <RecapBlock label="TOP ARTISTES" items={data.artists} />
      <RecapBlock label="TOP ALBUMS" items={data.albums} />
    </Stack>
  );
}

function RecapBlock({
  label,
  items,
}: {
  label: string;
  items: FocusItem[];
}) {
  return (
    <Stack>
      <SectionLabel text={label} scale={1.1} />
      <Stack style={{ marginTop: 12 }}>
        {items.map((item, i) => (
          <RankRow
            key={item.id}
            rank={i + 1}
            title={item.title}
            subtitle={item.subtitle}
            imageUrl={item.imageUrl}
            scale={1.0}
          />
        ))}
      </Stack>
    </Stack>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: no errors. (Smoke test happens in Task 7 once the route wires it up.)

- [ ] **Step 3: Commit**

```bash
git add src/app/api/share-card/templates/story.tsx
git commit -m "$(cat <<'EOF'
feat(share): story template (1080x1920) for focus + recap

Pure-presentational: takes the shape it expects from the route and
renders. FocusSection lists N items with rank/cover/title/subtitle;
RecapSection stacks 3 blocks of 5 items (tracks/artists/albums).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Twitter template (1200×630) and Post template (1080×1080)

**Files:**
- Create: `src/app/api/share-card/templates/twitter.tsx`
- Create: `src/app/api/share-card/templates/post.tsx`

Twitter is wide-horizontal (3 items vertical or 3 columns recap). Post is square (5-7 items vertical or 3-col recap).

- [ ] **Step 1: Implement twitter.tsx**

Create `src/app/api/share-card/templates/twitter.tsx`:

```tsx
import type { ReactNode } from "react";

import type {
  ShareBackground,
  ShareCardConfig,
} from "@/lib/share/card-config";

import {
  Background,
  CardHeader,
  COLORS,
  HStack,
  PERIOD_LABEL,
  RankRow,
  SectionLabel,
  Stack,
  Watermark,
} from "./shared";
import type { FocusItem, RecapData } from "./story";

export const TWITTER_SIZE = { width: 1200, height: 630 };

export type TwitterProps = {
  config: Pick<ShareCardConfig, "mode" | "type" | "period" | "bg">;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  covers: string[];
  data: FocusItem[] | RecapData;
};

const LABEL_BY_TYPE: Record<"tracks" | "artists" | "albums", string> = {
  tracks: "Top titres",
  artists: "Top artistes",
  albums: "Top albums",
};

export function TwitterTemplate({
  config,
  username,
  displayName,
  avatarUrl,
  covers,
  data,
}: TwitterProps): ReactNode {
  return (
    <div
      style={{
        position: "relative",
        width: TWITTER_SIZE.width,
        height: TWITTER_SIZE.height,
        display: "flex",
        color: COLORS.text,
      }}
    >
      <Background
        variant={config.bg as ShareBackground}
        width={TWITTER_SIZE.width}
        height={TWITTER_SIZE.height}
        covers={covers}
      />
      <Stack
        style={{
          padding: 50,
          width: TWITTER_SIZE.width,
          height: TWITTER_SIZE.height,
        }}
      >
        <CardHeader
          displayName={displayName}
          username={username}
          avatarUrl={avatarUrl}
          scale={1.0}
        />
        {config.mode === "focus" ? (
          <Stack style={{ marginTop: 30 }}>
            <SectionLabel
              text={`${LABEL_BY_TYPE[config.type].toUpperCase()} · ${PERIOD_LABEL[config.period].toUpperCase()}`}
              scale={1.0}
            />
            <Stack style={{ marginTop: 10 }}>
              {(data as FocusItem[]).map((item, i) => (
                <RankRow
                  key={item.id}
                  rank={i + 1}
                  title={item.title}
                  subtitle={item.subtitle}
                  imageUrl={item.imageUrl}
                  scale={1.0}
                />
              ))}
            </Stack>
          </Stack>
        ) : (
          <RecapColumns
            data={data as RecapData}
            periodLabel={PERIOD_LABEL[config.period]}
          />
        )}
        <Watermark username={username} scale={1.0} />
      </Stack>
    </div>
  );
}

function RecapColumns({
  data,
  periodLabel,
}: {
  data: RecapData;
  periodLabel: string;
}) {
  return (
    <HStack style={{ marginTop: 24, gap: 40, alignItems: "flex-start" }}>
      <RecapColumn label={`TITRES · ${periodLabel.toUpperCase()}`} items={data.tracks} />
      <RecapColumn label="ARTISTES" items={data.artists} />
      <RecapColumn label="ALBUMS" items={data.albums} />
    </HStack>
  );
}

function RecapColumn({
  label,
  items,
}: {
  label: string;
  items: FocusItem[];
}) {
  return (
    <Stack style={{ flex: 1 }}>
      <SectionLabel text={label} scale={0.8} />
      <Stack style={{ marginTop: 6 }}>
        {items.map((item, i) => (
          <RankRow
            key={item.id}
            rank={i + 1}
            title={item.title}
            subtitle={item.subtitle}
            imageUrl={item.imageUrl}
            scale={0.7}
          />
        ))}
      </Stack>
    </Stack>
  );
}
```

- [ ] **Step 2: Implement post.tsx**

Create `src/app/api/share-card/templates/post.tsx`:

```tsx
import type { ReactNode } from "react";

import type {
  ShareBackground,
  ShareCardConfig,
} from "@/lib/share/card-config";

import {
  Background,
  CardHeader,
  COLORS,
  HStack,
  PERIOD_LABEL,
  RankRow,
  SectionLabel,
  Stack,
  Watermark,
} from "./shared";
import type { FocusItem, RecapData } from "./story";

export const POST_SIZE = { width: 1080, height: 1080 };

export type PostProps = {
  config: Pick<ShareCardConfig, "mode" | "type" | "period" | "bg">;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  covers: string[];
  data: FocusItem[] | RecapData;
};

const LABEL_BY_TYPE: Record<"tracks" | "artists" | "albums", string> = {
  tracks: "Top titres",
  artists: "Top artistes",
  albums: "Top albums",
};

export function PostTemplate({
  config,
  username,
  displayName,
  avatarUrl,
  covers,
  data,
}: PostProps): ReactNode {
  return (
    <div
      style={{
        position: "relative",
        width: POST_SIZE.width,
        height: POST_SIZE.height,
        display: "flex",
        color: COLORS.text,
      }}
    >
      <Background
        variant={config.bg as ShareBackground}
        width={POST_SIZE.width}
        height={POST_SIZE.height}
        covers={covers}
      />
      <Stack
        style={{
          padding: 60,
          width: POST_SIZE.width,
          height: POST_SIZE.height,
        }}
      >
        <CardHeader
          displayName={displayName}
          username={username}
          avatarUrl={avatarUrl}
          scale={1.1}
        />
        {config.mode === "focus" ? (
          <Stack style={{ marginTop: 40 }}>
            <SectionLabel
              text={`${LABEL_BY_TYPE[config.type].toUpperCase()} · ${PERIOD_LABEL[config.period].toUpperCase()}`}
              scale={1.0}
            />
            <Stack style={{ marginTop: 12 }}>
              {(data as FocusItem[]).map((item, i) => (
                <RankRow
                  key={item.id}
                  rank={i + 1}
                  title={item.title}
                  subtitle={item.subtitle}
                  imageUrl={item.imageUrl}
                  scale={1.05}
                />
              ))}
            </Stack>
          </Stack>
        ) : (
          <RecapColumns
            data={data as RecapData}
            periodLabel={PERIOD_LABEL[config.period]}
          />
        )}
        <Watermark username={username} scale={1.0} />
      </Stack>
    </div>
  );
}

function RecapColumns({
  data,
  periodLabel,
}: {
  data: RecapData;
  periodLabel: string;
}) {
  return (
    <HStack style={{ marginTop: 30, gap: 28, alignItems: "flex-start" }}>
      <RecapColumn label={`TITRES · ${periodLabel.toUpperCase()}`} items={data.tracks} />
      <RecapColumn label="ARTISTES" items={data.artists} />
      <RecapColumn label="ALBUMS" items={data.albums} />
    </HStack>
  );
}

function RecapColumn({
  label,
  items,
}: {
  label: string;
  items: FocusItem[];
}) {
  return (
    <Stack style={{ flex: 1 }}>
      <SectionLabel text={label} scale={0.85} />
      <Stack style={{ marginTop: 8 }}>
        {items.map((item, i) => (
          <RankRow
            key={item.id}
            rank={i + 1}
            title={item.title}
            subtitle={item.subtitle}
            imageUrl={item.imageUrl}
            scale={0.8}
          />
        ))}
      </Stack>
    </Stack>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/share-card/templates/twitter.tsx src/app/api/share-card/templates/post.tsx
git commit -m "$(cat <<'EOF'
feat(share): twitter (1200x630) and post (1080x1080) templates

Both formats: focus mode = single vertical list, recap mode = 3
columns (titres / artistes / albums) using the shared RankRow helper.
Twitter scales row content down (0.7) since horizontal real estate
is tight; post sits between twitter and story.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Route handler `/api/share-card`

**Files:**
- Create: `src/app/api/share-card/route.tsx`

Parses Zod params, fetches stats + covers, dispatches to the right template, returns `ImageResponse`.

- [ ] **Step 1: Implement route.tsx**

Create `src/app/api/share-card/route.tsx`:

```tsx
import { ImageResponse } from "next/og";

import {
  getTopAlbumsFromStreams,
  getTopArtistsFromStreams,
  getTopTracksFromStreams,
} from "@/db/queries/stats";
import { getPublicProfileByUsername } from "@/db/queries/users";
import { getWallCovers } from "@/db/queries/wall-covers";
import {
  RECAP_N_BY_FORMAT,
  parseShareCardParams,
  type ShareCardConfig,
} from "@/lib/share/card-config";
import { periodSince } from "@/lib/stats/period";

import {
  POST_SIZE,
  PostTemplate,
} from "./templates/post";
import {
  STORY_SIZE,
  StoryTemplate,
  type FocusItem,
  type RecapData,
} from "./templates/story";
import {
  TWITTER_SIZE,
  TwitterTemplate,
} from "./templates/twitter";

export const dynamic = "force-dynamic";

const SIZE_BY_FORMAT = {
  twitter: TWITTER_SIZE,
  post: POST_SIZE,
  story: STORY_SIZE,
} as const;

const WALL_COVER_LIMIT = 36;

function trackToItem(t: {
  trackId: string;
  name: string;
  albumImageUrl: string | null;
  artistNames: string[];
}): FocusItem {
  return {
    id: t.trackId,
    title: t.name,
    subtitle: t.artistNames.join(", ") || undefined,
    imageUrl: t.albumImageUrl,
  };
}

function artistToItem(a: {
  artistId: string;
  name: string;
  imageUrl: string | null;
}): FocusItem {
  return {
    id: a.artistId,
    title: a.name,
    imageUrl: a.imageUrl,
  };
}

function albumToItem(a: {
  albumId: string;
  name: string;
  imageUrl: string | null;
  artistNames: string[];
}): FocusItem {
  return {
    id: a.albumId,
    title: a.name,
    subtitle: a.artistNames.join(", ") || undefined,
    imageUrl: a.imageUrl,
  };
}

async function fetchFocus(
  userId: string,
  config: ShareCardConfig,
): Promise<FocusItem[]> {
  const since = periodSince(config.period);
  if (config.type === "tracks") {
    const rows = await getTopTracksFromStreams(userId, since, config.n);
    return rows.map(trackToItem);
  }
  if (config.type === "artists") {
    const rows = await getTopArtistsFromStreams(userId, since, config.n);
    return rows.map(artistToItem);
  }
  const rows = await getTopAlbumsFromStreams(userId, since, config.n);
  return rows.map(albumToItem);
}

async function fetchRecap(
  userId: string,
  config: ShareCardConfig,
): Promise<RecapData> {
  const since = periodSince(config.period);
  const limit = RECAP_N_BY_FORMAT[config.format];
  const [tracks, artists, albums] = await Promise.all([
    getTopTracksFromStreams(userId, since, limit),
    getTopArtistsFromStreams(userId, since, limit),
    getTopAlbumsFromStreams(userId, since, limit),
  ]);
  return {
    tracks: tracks.map(trackToItem),
    artists: artists.map(artistToItem),
    albums: albums.map(albumToItem),
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const username = url.searchParams.get("username");
  if (!username) {
    return new Response(JSON.stringify({ error: "username required" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const profile = await getPublicProfileByUsername(username);
  if (!profile) {
    return new Response(JSON.stringify({ error: "not found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  const config = parseShareCardParams(url.searchParams);
  const size = SIZE_BY_FORMAT[config.format];

  const [data, covers] = await Promise.all([
    config.mode === "focus"
      ? fetchFocus(profile.id, config)
      : fetchRecap(profile.id, config),
    config.bg === "wall"
      ? getWallCovers(profile.id, periodSince(config.period), WALL_COVER_LIMIT)
      : Promise.resolve([] as string[]),
  ]);

  const displayName = profile.displayName ?? profile.username;
  const props = {
    config,
    username: profile.username,
    displayName,
    avatarUrl: profile.avatarUrl,
    covers,
    data,
  };

  try {
    const element =
      config.format === "twitter" ? (
        <TwitterTemplate {...props} />
      ) : config.format === "post" ? (
        <PostTemplate {...props} />
      ) : (
        <StoryTemplate {...props} />
      );

    return new ImageResponse(element, {
      ...size,
      headers: {
        "cache-control": "public, max-age=60, s-maxage=60",
      },
    });
  } catch (err) {
    console.error("[share-card] render failed", err);
    return new Response(JSON.stringify({ error: "render failed" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 3: Smoke test — defaults (story focus tracks 4w mesh)**

Run:

```bash
curl -s -o /tmp/share-defaults.png \
  -w "HTTP %{http_code} | %{size_download} bytes\n" \
  "http://127.0.0.1:3000/api/share-card?username=judescha" \
  && file /tmp/share-defaults.png
```

Expected: `HTTP 200`, several KB, `PNG image data, 1080 x 1920`.

- [ ] **Step 4: Smoke test — twitter focus tracks N=3 mesh**

Run:

```bash
curl -s -o /tmp/share-tw.png \
  -w "HTTP %{http_code}\n" \
  "http://127.0.0.1:3000/api/share-card?username=judescha&format=twitter&n=3&bg=mesh" \
  && file /tmp/share-tw.png
```

Expected: `HTTP 200`, `PNG image data, 1200 x 630`.

- [ ] **Step 5: Smoke test — post recap 6m mesh**

Run:

```bash
curl -s -o /tmp/share-post-recap.png \
  -w "HTTP %{http_code}\n" \
  "http://127.0.0.1:3000/api/share-card?username=judescha&mode=recap&format=post&period=6m&bg=mesh" \
  && file /tmp/share-post-recap.png
```

Expected: `HTTP 200`, `PNG image data, 1080 x 1080`.

- [ ] **Step 6: Smoke test — story focus albums N=10 1y wall**

Run:

```bash
curl -s -o /tmp/share-wall.png \
  -w "HTTP %{http_code}\n" \
  "http://127.0.0.1:3000/api/share-card?username=judescha&mode=focus&type=albums&n=10&period=1y&format=story&bg=wall" \
  && file /tmp/share-wall.png
```

Expected: `HTTP 200`, `PNG image data, 1080 x 1920`. Visually inspect via `open /tmp/share-wall.png` (macOS) to confirm the wall background renders.

- [ ] **Step 7: Smoke test — 404 on unknown username**

Run:

```bash
curl -s -o /dev/null -w "HTTP %{http_code}\n" \
  "http://127.0.0.1:3000/api/share-card?username=doesnotexist"
```

Expected: `HTTP 404`.

- [ ] **Step 8: Smoke test — 400 on missing username**

Run:

```bash
curl -s -o /dev/null -w "HTTP %{http_code}\n" \
  "http://127.0.0.1:3000/api/share-card"
```

Expected: `HTTP 400`.

- [ ] **Step 9: Commit**

```bash
git add src/app/api/share-card/route.tsx
git commit -m "$(cat <<'EOF'
feat(share): GET /api/share-card route handler

Parses Zod-validated params (defaults applied tolerantly), fetches
top tracks/artists/albums + optional wall covers in parallel,
dispatches to the format-specific template, returns PNG with a 60s
cache-control. 404 on unknown/private profile, 400 on missing
username, 500 on Satori failure with server-side log.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Preview client component

**Files:**
- Create: `src/components/share/preview.tsx`

A thin client `<img>` wrapper. Job: swap `src` smoothly when config changes (keep previous image visible while next one loads, show a subtle loading state).

- [ ] **Step 1: Implement preview.tsx**

Create `src/components/share/preview.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

import type { ShareFormat } from "@/lib/share/card-config";

const ASPECT: Record<ShareFormat, string> = {
  twitter: "1200 / 630",
  post: "1 / 1",
  story: "9 / 16",
};

export function Preview({
  src,
  format,
}: {
  src: string;
  format: ShareFormat;
}) {
  // Display previous src while next one loads, so the editor never
  // shows a blank box mid-tweak.
  const [displaySrc, setDisplaySrc] = useState(src);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (src === displaySrc) return;
    setLoading(true);
    const img = new Image();
    img.onload = () => {
      setDisplaySrc(src);
      setLoading(false);
    };
    img.onerror = () => {
      setLoading(false);
    };
    img.src = src;
  }, [src, displaySrc]);

  return (
    <div
      style={{ aspectRatio: ASPECT[format] }}
      className="relative w-full max-w-[480px] max-h-[640px] overflow-hidden rounded-xl shadow-[0_30px_80px_rgba(124,58,237,0.25)]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={displaySrc}
        alt="Aperçu de la carte"
        className="h-full w-full object-cover"
      />
      {loading ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/share/preview.tsx
git commit -m "$(cat <<'EOF'
feat(share): Preview client component with smooth src swap

Pre-loads the next image off-screen via new Image() before swapping
the visible src. Old image stays put with a subtle spinner overlay
while the new one is fetched, so live editing never flashes a blank
box. Aspect ratio per format keeps the layout stable across switches.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Share editor client component

**Files:**
- Create: `src/components/share/share-editor.tsx`

The controls, URL sync, and action buttons.

- [ ] **Step 1: Implement share-editor.tsx**

Create `src/components/share/share-editor.tsx`:

```tsx
"use client";

import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { Check, Download, Link as LinkIcon, Share2 } from "lucide-react";

import { Preview } from "@/components/share/preview";
import {
  FORMAT_N_OPTIONS,
  SHARE_BACKGROUNDS,
  SHARE_FORMATS,
  SHARE_MODES,
  SHARE_PERIODS,
  SHARE_TYPES,
  buildShareCardUrl,
  clampNForFormat,
  type ShareCardConfig,
  type ShareFormat,
  type SharePeriod,
} from "@/lib/share/card-config";
import { cn } from "@/lib/utils";

const PERIOD_LABEL: Record<SharePeriod, string> = {
  "4w": "4 sem",
  "6m": "6 mois",
  "1y": "1 an",
  all: "Tout",
};

const FORMAT_LABEL: Record<ShareFormat, string> = {
  twitter: "Twitter",
  post: "Post",
  story: "Story",
};

const TYPE_LABEL = {
  tracks: "Titres",
  artists: "Artistes",
  albums: "Albums",
} as const;

const MODE_LABEL = {
  focus: "Focus",
  recap: "Recap",
} as const;

const BG_LABEL = {
  mesh: "Mesh",
  wall: "Pochettes",
} as const;

function useIsClient(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function ShareEditor({
  initialConfig,
  username,
}: {
  initialConfig: ShareCardConfig;
  username: string;
}) {
  const [config, setConfig] = useState<ShareCardConfig>(initialConfig);
  const [copied, setCopied] = useState(false);
  const isClient = useIsClient();

  // Mirror config → URL (no full nav).
  useEffect(() => {
    if (!isClient) return;
    const sp = new URLSearchParams({
      mode: config.mode,
      type: config.type,
      n: String(config.n),
      period: config.period,
      format: config.format,
      bg: config.bg,
    });
    window.history.replaceState(null, "", `?${sp.toString()}`);
  }, [config, isClient]);

  const cardUrl = useMemo(
    () => buildShareCardUrl(config, username),
    [config, username],
  );

  function patch(p: Partial<ShareCardConfig>) {
    setConfig((cur) => {
      const next = { ...cur, ...p };
      // If format changes, clamp n into the new format's options.
      if (p.format && p.format !== cur.format) {
        next.n = clampNForFormat(p.format, cur.n);
      }
      return next;
    });
  }

  async function copyEditorLink() {
    if (!isClient) return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable on non-HTTPS context */
    }
  }

  const canNativeShare = isClient && "share" in navigator;
  async function nativeShare() {
    if (!("share" in navigator)) return;
    try {
      const res = await fetch(cardUrl);
      const blob = await res.blob();
      const file = new File([blob], `loopstat-${username}-${config.format}.png`, {
        type: "image/png",
      });
      if ("canShare" in navigator && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] });
        return;
      }
      await navigator.share({
        url: `${window.location.origin}/u/${username}`,
        title: `Mes stats Spotify sur loopstat`,
      });
    } catch {
      /* user cancelled or share unsupported */
    }
  }

  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-[1fr_340px]">
      <div className="flex items-center justify-center rounded-2xl border border-white/8 bg-[linear-gradient(135deg,rgba(124,58,237,0.06),transparent_60%),repeating-linear-gradient(45deg,rgba(255,255,255,0.02)_0_8px,transparent_8px_16px)] p-6 min-h-[460px]">
        <Preview src={cardUrl} format={config.format} />
      </div>

      <div className="flex flex-col gap-5">
        <Group label="Mode">
          <Segmented
            options={SHARE_MODES.map((m) => ({ value: m, label: MODE_LABEL[m] }))}
            value={config.mode}
            onChange={(mode) => patch({ mode })}
          />
        </Group>

        {config.mode === "focus" ? (
          <Group label="Catégorie">
            <Segmented
              options={SHARE_TYPES.map((t) => ({ value: t, label: TYPE_LABEL[t] }))}
              value={config.type}
              onChange={(type) => patch({ type })}
            />
          </Group>
        ) : null}

        {config.mode === "focus" ? (
          <Group label="Top N">
            <Chips
              options={[3, 5, 7, 10].map((n) => ({
                value: n,
                label: String(n),
                disabled: !FORMAT_N_OPTIONS[config.format].includes(n),
              }))}
              value={config.n}
              onChange={(n) => patch({ n })}
            />
          </Group>
        ) : null}

        <Group label="Période">
          <Chips
            options={SHARE_PERIODS.map((p) => ({
              value: p,
              label: PERIOD_LABEL[p],
            }))}
            value={config.period}
            onChange={(period) => patch({ period })}
          />
        </Group>

        <Group label="Format">
          <Segmented
            options={SHARE_FORMATS.map((f) => ({
              value: f,
              label: FORMAT_LABEL[f],
            }))}
            value={config.format}
            onChange={(format) => patch({ format })}
          />
        </Group>

        <Group label="Background">
          <Segmented
            options={SHARE_BACKGROUNDS.map((b) => ({
              value: b,
              label: BG_LABEL[b],
            }))}
            value={config.bg}
            onChange={(bg) => patch({ bg })}
          />
        </Group>

        <div className="flex flex-col gap-2 border-t border-white/8 pt-4">
          <a
            href={cardUrl}
            download={`loopstat-${username}-${config.format}.png`}
            className="flex items-center justify-center gap-2 rounded-xl bg-[#7c3aed] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#6d28d9]"
          >
            <Download className="size-4" /> Télécharger PNG
          </a>
          {canNativeShare ? (
            <button
              type="button"
              onClick={nativeShare}
              className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm transition hover:bg-white/10"
            >
              <Share2 className="size-4" /> Partager via mon appareil
            </button>
          ) : null}
          <button
            type="button"
            onClick={copyEditorLink}
            className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm transition hover:bg-white/10"
          >
            {copied ? (
              <Check className="size-4 text-emerald-500" />
            ) : (
              <LinkIcon className="size-4" />
            )}
            {copied ? "Lien copié !" : "Copier le lien de l'éditeur"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-lg border border-white/8 bg-white/5 p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "flex-1 rounded-md px-3 py-2 text-sm transition",
            opt.value === value
              ? "bg-[#7c3aed] text-white font-medium"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function Chips<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; disabled?: boolean }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          type="button"
          disabled={opt.disabled}
          onClick={() => onChange(opt.value)}
          className={cn(
            "rounded-full border px-3 py-1.5 text-sm transition",
            opt.value === value
              ? "border-[#7c3aed] bg-[#7c3aed] text-white"
              : "border-white/8 bg-white/5 text-muted-foreground hover:text-foreground",
            opt.disabled && "cursor-not-allowed opacity-30 hover:text-muted-foreground",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors. (If lint complains about hook-rules or set-state-in-effect, fix per the existing pattern in `share-button.tsx`: `useSyncExternalStore` for client-only flags.)

- [ ] **Step 3: Commit**

```bash
git add src/components/share/share-editor.tsx
git commit -m "$(cat <<'EOF'
feat(share): ShareEditor client component (controls + URL sync)

State held locally and mirrored to the URL via history.replaceState
(deep-linkable, no full nav). Format change clamps N into the new
format's options. Actions: download PNG (native <a download>),
native share with files when supported (falls back to URL share),
copy editor URL with visual feedback.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Share page (server component with auth guards)

**Files:**
- Create: `src/app/share/page.tsx`

- [ ] **Step 1: Implement page.tsx**

Create `src/app/share/page.tsx`:

```tsx
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { ShareEditor } from "@/components/share/share-editor";
import { getProfile } from "@/db/queries/users";
import {
  CONTEXT_PRESETS,
  parseShareCardParams,
  type ShareCardConfig,
  type ShareContext,
} from "@/lib/share/card-config";

export const dynamic = "force-dynamic";

const KNOWN_CONTEXTS: ShareContext[] = [
  "dashboard",
  "tracks",
  "artists",
  "albums",
];

function isKnownContext(v: string | undefined): v is ShareContext {
  return v !== undefined && (KNOWN_CONTEXTS as string[]).includes(v);
}

export default async function SharePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const profile = await getProfile(session.user.id);
  if (!profile?.username || !profile.isPublic) {
    redirect("/settings?from=share");
  }

  const params = await searchParams;
  let config: ShareCardConfig = parseShareCardParams(params);

  // Apply context preset only when no explicit fields are set (i.e. the
  // user just clicked "Customize…" from a page — we don't override their
  // hand-edited URL on subsequent reloads).
  const contextRaw = params.context;
  const contextValue = Array.isArray(contextRaw) ? contextRaw[0] : contextRaw;
  if (
    isKnownContext(contextValue) &&
    !params.mode &&
    !params.type &&
    !params.format
  ) {
    const preset = CONTEXT_PRESETS[contextValue];
    config = { ...config, ...preset };
  }

  return (
    <main
      id="main"
      className="flex-1 flex flex-col px-6 py-10 max-w-6xl mx-auto w-full"
    >
      <header className="mb-8 flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold">Personnaliser ma carte</h1>
        <p className="text-sm text-muted-foreground">
          Profil public : <span className="font-mono">@{profile.username}</span>
        </p>
      </header>
      <ShareEditor
        initialConfig={config}
        username={profile.username}
      />
    </main>
  );
}
```

- [ ] **Step 2: Smoke test — auth redirect**

Run:

```bash
curl -s -o /dev/null -w "HTTP %{http_code}\n" -L --max-redirs 0 \
  "http://127.0.0.1:3000/share"
```

Expected: `HTTP 307` (redirect to `/login`). (Without a session cookie.)

- [ ] **Step 3: Smoke test — page renders with session**

(Manual, in browser): log in → visit `http://127.0.0.1:3000/share` → expect the editor UI with default config (story focus tracks N=5 4w mesh) and a live preview image.

- [ ] **Step 4: Smoke test — context preset**

(Manual, in browser): visit `http://127.0.0.1:3000/share?context=dashboard` → expect `mode=recap, format=story` applied.

- [ ] **Step 5: Smoke test — settings redirect for private profile**

(Manual, in DB): set `is_public=false` for the test user, visit `/share`, expect redirect to `/settings?from=share`. Restore `is_public=true` afterwards:

```bash
docker exec loopstat_postgres psql -U loopstat -d loopstat -c \
  "UPDATE users SET is_public=true WHERE username='judescha';"
```

- [ ] **Step 6: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/share/page.tsx
git commit -m "$(cat <<'EOF'
feat(share): /share page with auth + public-profile guards

Server component: redirects to /login when unauth, to
/settings?from=share when the user has not enabled their public
profile. Applies context presets only when the URL has no
hand-edited config fields, so refreshing on /share?mode=focus&...
doesn't get clobbered by ?context=.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: ShareButton entry point + context propagation

**Files:**
- Modify: `src/components/share-button.tsx`
- Modify: `src/components/app-header.tsx`
- Modify: `src/app/dashboard/page.tsx`
- Modify: `src/app/top/tracks/page.tsx`
- Modify: `src/app/top/artists/page.tsx`
- Modify: `src/app/top/albums/page.tsx`

- [ ] **Step 1: Add ShareContext type + Personnaliser menu item**

Edit `src/components/share-button.tsx`:

Replace the `Props` type:

```ts
import type { ShareContext } from "@/lib/share/card-config";

type Props = {
  username: string;
  context?: ShareContext;
};
```

Add a `Sparkles` import alongside the existing lucide imports:

```ts
import { Check, Download, Link as LinkIcon, Share2, Sparkles } from "lucide-react";
```

Inside the function signature, accept `context`:

```ts
export function ShareButton({ username, context }: Props) {
```

In the `<div role="menu">` block, insert as the FIRST child (before the existing "Copier le lien" button):

```tsx
<a
  href={`/share${context ? `?context=${context}` : ""}`}
  role="menuitem"
  onClick={() => setOpen(false)}
  className="flex items-center gap-3 rounded-lg bg-[#7c3aed]/10 px-3 py-2 text-left text-sm text-[#c4b5fd] transition hover:bg-[#7c3aed]/20"
>
  <Sparkles className="size-4" />
  <span className="flex flex-col">
    <span className="font-medium">Personnaliser ma carte…</span>
    <span className="text-xs opacity-70">
      Choisis le format, la période, les items
    </span>
  </span>
</a>
<div className="my-1 border-t border-white/8" />
```

- [ ] **Step 2: Propagate context through AppHeader**

Edit `src/components/app-header.tsx`:

Replace the function signature to add `shareContext`:

```ts
import type { ShareContext } from "@/lib/share/card-config";

export function AppHeader({
  session,
  shareUsername,
  shareContext,
}: {
  session: Session;
  shareUsername?: string;
  shareContext?: ShareContext;
}) {
```

And pass it to ShareButton:

```tsx
{shareUsername ? (
  <ShareButton username={shareUsername} context={shareContext} />
) : null}
```

- [ ] **Step 3: Pass context from dashboard**

Edit `src/app/dashboard/page.tsx`, change the `AppHeader` call:

```tsx
<AppHeader session={session} shareUsername={shareUsername} shareContext="dashboard" />
```

- [ ] **Step 4: Pass context from /top/tracks**

Edit `src/app/top/tracks/page.tsx`, change the existing `<ShareButton ...>` line in the header to:

```tsx
{shareUsername ? <ShareButton username={shareUsername} context="tracks" /> : null}
```

- [ ] **Step 5: Pass context from /top/artists**

Edit `src/app/top/artists/page.tsx`, same change with `context="artists"`.

- [ ] **Step 6: Pass context from /top/albums**

Edit `src/app/top/albums/page.tsx`, same change with `context="albums"`.

- [ ] **Step 7: Typecheck + lint + tests**

Run:

```bash
pnpm typecheck && pnpm lint && pnpm test
```

Expected: no errors, all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/components/share-button.tsx src/components/app-header.tsx \
        src/app/dashboard/page.tsx src/app/top/
git commit -m "$(cat <<'EOF'
feat(share): "Personnaliser ma carte…" entry point + context wiring

ShareButton menu gains a violet-tinted primary item that navigates to
/share with the appropriate context preset (?context=dashboard for
the dashboard, ?context=<type> for /top/*). The existing quick actions
(copy link, download OG-fixed image, native share) remain underneath
for users who don't need to customize.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: End-to-end manual verification

No new files. Walk through the spec's verification section in the browser as `judescha` (already set up: `username='judescha'`, `is_public=true`).

- [ ] **Step 1: Auth + public profile guards**

- Log out → visit `/share` → expect redirect to `/login`. ✅
- Log in but flip `is_public` to false in DB → visit `/share` → expect redirect to `/settings?from=share`. ✅
- Restore `is_public=true`.

- [ ] **Step 2: Defaults round-trip**

Visit `/share` → expect URL becomes `/share?mode=focus&type=tracks&n=5&period=4w&format=story&bg=mesh` and preview renders the story card.

- [ ] **Step 3: Live editing**

Change each control once (mode → recap, period → 1y, format → twitter, bg → wall, etc.). Each change updates the URL and re-fetches the preview within ~1s. Verify N chips disabled correctly when switching format.

- [ ] **Step 4: Download**

Click "Télécharger PNG" → file `loopstat-judescha-<format>.png` lands in Downloads. Open it: PNG dimensions match the format.

- [ ] **Step 5: Copy editor link**

Click "Copier le lien de l'éditeur" → text replaces with "Lien copié !" for 2s. Paste in a new tab → re-opens the exact same config.

- [ ] **Step 6: Native share (mobile)**

Open Chrome DevTools, switch to mobile emulation, reload `/share` → "Partager via mon appareil" button appears. Click → native share sheet opens (file or URL). On desktop without `navigator.share`, the button is hidden.

- [ ] **Step 7: Full flow from dashboard**

Visit `/dashboard` → click "Partager" → click "Personnaliser ma carte…" → land on `/share?context=dashboard` → URL resolves to `mode=recap&format=story`. Same flow from `/top/tracks` lands on `/share?context=tracks` with the tracks preset.

- [ ] **Step 8: Cleanup**

If everything passes, the branch is ready for merge. No changes to commit at this step.

```bash
git status   # → clean
git log --oneline feat/phase-a-viral ^main   # → review the 9 commits from this plan
```

---

## Out-of-scope (do NOT add)

Reminder: the following are explicitly deferred to other issues — do not sneak them in.

- DB persistence of share config (issue #15).
- Custom fonts, colors, watermark removal.
- Background image upload.
- Narrative stats ("X hours listened in 2026").
- Long-vertical format (top 50).
- Plausible analytics events.
