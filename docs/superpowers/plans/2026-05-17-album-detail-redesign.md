# Album Detail Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refondre `src/app/album/[id]/page.tsx` selon la spec [2026-05-17-album-detail-redesign-design.md](../specs/2026-05-17-album-detail-redesign-design.md) - 8 sections (hero, top track card, tracklist avec barres, sparkline mensuelle, period breakdown, hours heatmap, qualité, autres albums de l'artiste).

**Architecture:** 6 nouvelles queries SQL parallèles aux `getTrack*` existantes + extension de `getAlbumPlayStats`. Extraction de 2 composants visuels (`HourHeatmap`, `PeriodBreakdownGrid`) depuis `/track/[id]` pour mutualisation. 3 nouveaux composants page-spécifiques sous `src/components/album/`. Helper de formatage de date extrait dans `src/lib/format/date.ts`.

**Tech Stack:** Next.js 16 (App Router, RSC), Drizzle ORM, Postgres, React 19, Tailwind v4, vitest (env `node`, pas de jsdom ni DB de test).

**Note testing :** Le projet n'a pas d'infra de tests pour les queries SQL (pas de DB de test, pas de fixtures). TDD strict uniquement sur les fonctions pures (helpers de format). Pour les queries SQL et composants UI, vérification par `tsc --noEmit` + `pnpm vitest run` (suite existante reste verte) + vérification visuelle manuelle dans la phase finale.

---

## File Structure

| Path | Action | Responsabilité |
|---|---|---|
| `src/lib/format/date.ts` | Create | `formatDate(date)` + `formatRelativeDate(date)` |
| `src/lib/format/date.test.ts` | Create | Tests purs des 2 helpers |
| `src/components/stats/hour-heatmap.tsx` | Create | Heatmap 24h réutilisable |
| `src/components/stats/period-breakdown-grid.tsx` | Create | Grille 4w/6m/1y/all réutilisable |
| `src/app/track/[id]/page.tsx` | Modify | Utilise les 2 composants extraits + nouveau helper date |
| `src/db/queries/stats.ts` | Modify | Extension `getAlbumPlayStats` + 6 nouvelles queries `getAlbum*` |
| `src/components/album/album-tracklist.tsx` | Create | Tracklist avec barres de proportion |
| `src/components/album/top-track-card.tsx` | Create | Highlight du top track de l'album |
| `src/components/album/other-artist-albums.tsx` | Create | Carousel horizontal des autres albums |
| `src/app/album/[id]/page.tsx` | Modify | Refactor complet selon spec |

---

## Task 1 : Helpers de format de date (TDD)

**Files:**
- Create: `src/lib/format/date.ts`
- Create: `src/lib/format/date.test.ts`

- [ ] **Step 1 : Créer le dossier**

```bash
mkdir -p src/lib/format
```

- [ ] **Step 2 : Écrire les tests qui échouent**

Crée `src/lib/format/date.test.ts` :

```ts
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { formatDate, formatRelativeDate } from "./date";

describe("formatDate", () => {
  it("formats a date in French long form", () => {
    // 22 novembre 2024
    expect(formatDate(new Date("2024-11-22T10:00:00Z"))).toBe("22 novembre 2024");
  });

  it("uses lowercase month name and no leading zero on day", () => {
    expect(formatDate(new Date("2025-01-05T00:00:00Z"))).toBe("5 janvier 2025");
  });
});

describe("formatRelativeDate", () => {
  beforeEach(() => {
    // Freeze "now" to 2026-05-17 12:00 UTC
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-17T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'aujourd'hui' for today", () => {
    expect(formatRelativeDate(new Date("2026-05-17T03:00:00Z"))).toBe(
      "aujourd’hui",
    );
  });

  it("returns 'hier' for yesterday", () => {
    expect(formatRelativeDate(new Date("2026-05-16T03:00:00Z"))).toBe("hier");
  });

  it("returns 'il y a N jours' for less than 30 days ago", () => {
    expect(formatRelativeDate(new Date("2026-05-10T12:00:00Z"))).toBe(
      "il y a 7 jours",
    );
  });

  it("delegates to formatDate for dates older than 30 days", () => {
    expect(formatRelativeDate(new Date("2024-11-22T10:00:00Z"))).toBe(
      "22 novembre 2024",
    );
  });
});
```

- [ ] **Step 3 : Lancer les tests, confirmer l'échec**

```bash
pnpm vitest run src/lib/format/date.test.ts
```

Attendu : `Error: Cannot find module './date'`.

- [ ] **Step 4 : Implémenter les helpers**

Crée `src/lib/format/date.ts` :

```ts
/**
 * Formate une date en français long, par ex "22 novembre 2024".
 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Formate une date en relatif si elle est récente ("hier", "il y a 7 jours"),
 * sinon délègue à `formatDate`. Seuil : 30 jours.
 *
 * `Intl.RelativeTimeFormat` avec `numeric: "auto"` produit "hier" / "aujourd’hui"
 * automatiquement pour -1 et 0 jours.
 */
export function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (Math.abs(diffDays) > 30) return formatDate(date);

  const rtf = new Intl.RelativeTimeFormat("fr-FR", { numeric: "auto" });
  return rtf.format(diffDays, "day");
}
```

- [ ] **Step 5 : Relancer les tests, vérifier qu'ils passent**

```bash
pnpm vitest run src/lib/format/date.test.ts
```

Attendu : `6 passed`.

- [ ] **Step 6 : Lancer la suite complète + tsc**

```bash
pnpm vitest run
pnpm tsc --noEmit
```

Attendu : tous tests verts (77 + 6 = 83), tsc clean.

- [ ] **Step 7 : Commit**

```bash
git add src/lib/format/date.ts src/lib/format/date.test.ts
git commit -m "$(cat <<'EOF'
feat(format): add formatDate + formatRelativeDate helpers

Extracted from /track/[id]/page.tsx (was inline) and supplemented with
a relative variant ("il y a N jours") for use in the upcoming album
detail page redesign. Pure functions, fully unit-tested with frozen time.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2 : Extraire `<HourHeatmap />`

**Files:**
- Create: `src/components/stats/hour-heatmap.tsx`
- Modify: `src/app/track/[id]/page.tsx`

- [ ] **Step 1 : Créer le composant**

Crée `src/components/stats/hour-heatmap.tsx` :

```tsx
import { formatNumber } from "@/lib/utils";

export type HourHeatmapData = { hour: number; count: number }[];

/**
 * Heatmap 24 barres verticales. La hauteur de chaque barre est proportionnelle
 * au max de la série ; l'opacité aussi (les heures jamais écoutées sont presque
 * invisibles). Layout : 12 colonnes sur mobile, 24 sur desktop.
 */
export function HourHeatmap({ data }: { data: HourHeatmapData }) {
  const maxHour = Math.max(...data.map((h) => h.count), 1);

  return (
    <div className="mt-4 grid grid-cols-12 gap-1 sm:grid-cols-24">
      {data.map(({ hour, count }) => {
        const intensity = count / maxHour;
        return (
          <div
            key={hour}
            className="flex flex-col items-center gap-1"
            title={`${hour}h - ${formatNumber(count)} écoute${count > 1 ? "s" : ""}`}
          >
            <div className="flex h-16 w-full items-end">
              <div
                className="w-full rounded-md bg-[#7c3aed]"
                style={{
                  height: `${Math.max(intensity * 100, count > 0 ? 6 : 2)}%`,
                  opacity: count > 0 ? 0.3 + intensity * 0.7 : 0.12,
                }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground">{hour}</span>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2 : Mettre à jour `/track/[id]/page.tsx`**

Dans `src/app/track/[id]/page.tsx`, fais 2 changements :

(a) Ajoute en haut, à côté des autres imports :
```tsx
import { HourHeatmap } from "@/components/stats/hour-heatmap";
```

(b) Supprime la variable locale `maxHour` (ligne 69) :
```tsx
// Avant :
const maxHour = Math.max(...hours.map((h) => h.count), 1);

// Après : (supprimer la ligne, le composant calcule en interne)
```

(c) Remplace tout le bloc JSX de la section "Heure préférée" (lignes ~153-184 dans le fichier actuel) - depuis `<div className="mt-4 grid grid-cols-12 gap-1 sm:grid-cols-24">` jusqu'au `</div>` de fermeture de ce grid - par :

```tsx
            <HourHeatmap data={hours} />
```

La structure conserve la section englobante (titre h2 + description), seule la heatmap elle-même est remplacée. Le bloc final ressemble à :

```tsx
          <section className={cn(glassCard, "p-6")}>
            <h2 className="text-lg font-semibold">Heure préférée</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Répartition des écoutes selon l&apos;heure de la journée.
            </p>
            <HourHeatmap data={hours} />
          </section>
```

- [ ] **Step 3 : Vérifier type-check + tests**

```bash
pnpm tsc --noEmit
pnpm vitest run
```

Attendu : clean + 83 passed.

- [ ] **Step 4 : Commit**

```bash
git add src/components/stats/hour-heatmap.tsx src/app/track/[id]/page.tsx
git commit -m "$(cat <<'EOF'
refactor(stats): extract HourHeatmap component from /track/[id]

Sortie de la heatmap 24h hors de la page track vers
src/components/stats/hour-heatmap.tsx pour réutilisation sur la nouvelle
page /album/[id]. Aucun changement de comportement visuel.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3 : Extraire `<PeriodBreakdownGrid />`

**Files:**
- Create: `src/components/stats/period-breakdown-grid.tsx`
- Modify: `src/app/track/[id]/page.tsx`

- [ ] **Step 1 : Créer le composant**

Crée `src/components/stats/period-breakdown-grid.tsx` :

```tsx
import { STREAM_PERIODS, type StreamPeriod } from "@/lib/stats/period";
import { formatNumber } from "@/lib/utils";

/**
 * Grille 4 cards (4 sem / 6 mois / 1 an / All) affichant les nombres de
 * plays par fenêtre temporelle. Pattern de typographie : Instrument Serif
 * italique pour les chiffres, label uppercase tracking-wider en muted.
 */
export function PeriodBreakdownGrid({
  data,
}: {
  data: Record<StreamPeriod, number>;
}) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
      {STREAM_PERIODS.map(({ value, label }) => (
        <div key={value} className="rounded-xl bg-white/5 p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 font-display italic text-2xl leading-none tabular-nums">
            {formatNumber(data[value])}
          </p>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2 : Mettre à jour `/track/[id]/page.tsx`**

(a) Ajoute l'import :
```tsx
import { PeriodBreakdownGrid } from "@/components/stats/period-breakdown-grid";
```

(b) Supprime l'import devenu inutile (sera réimporté par le composant) - vérifier après que `STREAM_PERIODS` n'est plus utilisé directement dans page.tsx. Si seul `PeriodBreakdownGrid` l'utilise, retirer `STREAM_PERIODS` de l'import sur la ligne :
```tsx
import { STREAM_PERIODS } from "@/lib/stats/period";
```

(c) Remplace tout le bloc JSX de la section "Par période" (lignes ~128-142 actuelles) - depuis `<div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">` jusqu'à son `</div>` de fermeture - par :

```tsx
            <PeriodBreakdownGrid data={breakdown} />
```

La section englobante (h2, etc.) reste :

```tsx
          <section className={cn(glassCard, "p-6")}>
            <h2 className="text-lg font-semibold">Par période</h2>
            <PeriodBreakdownGrid data={breakdown} />
          </section>
```

- [ ] **Step 3 : Vérifier type-check + tests**

```bash
pnpm tsc --noEmit
pnpm vitest run
```

- [ ] **Step 4 : Commit**

```bash
git add src/components/stats/period-breakdown-grid.tsx src/app/track/[id]/page.tsx
git commit -m "$(cat <<'EOF'
refactor(stats): extract PeriodBreakdownGrid from /track/[id]

Mutualise la grille 4 cards (4 sem / 6 mois / 1 an / All) entre /track/[id]
et la future page /album/[id]. Aucun changement visuel.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4 : Étendre `getAlbumPlayStats` + nouvelle `getAlbumTrackPlays`

**Files:**
- Modify: `src/db/queries/stats.ts` (function `getAlbumPlayStats` lines 188-205)
- Modify: `src/db/queries/stats.ts` (add `getAlbumTrackPlays`)
- Modify: `src/app/album/[id]/page.tsx` (pour ne pas casser le type-check avec l'ancien shape - il sera réécrit en Task 10 mais doit type-checker entre-temps)

- [ ] **Step 1 : Étendre `getAlbumPlayStats`**

Dans `src/db/queries/stats.ts`, remplace la fonction `getAlbumPlayStats` actuelle (lignes 188-205) par :

```ts
export async function getAlbumPlayStats(
  userId: string,
  albumId: string,
): Promise<{
  count: number;
  firstPlayedAt: Date | null;
  lastPlayedAt: Date | null;
  totalMsPlayed: number;
}> {
  const [row] = await db
    .select({
      count: sql<number>`count(*)::int`,
      firstPlayedAt: sql<string | null>`min(${streams.playedAt})`,
      lastPlayedAt: sql<string | null>`max(${streams.playedAt})`,
      totalMsPlayed: sql<string | null>`coalesce(sum(${streams.msPlayed}), 0)`,
    })
    .from(streams)
    .innerJoin(tracks, eq(tracks.id, streams.trackId))
    .where(
      and(
        eq(streams.userId, userId),
        eq(tracks.albumId, albumId),
        QUALIFYING_PLAY,
      ),
    );

  return {
    count: Number(row?.count ?? 0),
    firstPlayedAt: row?.firstPlayedAt ? new Date(row.firstPlayedAt) : null,
    lastPlayedAt: row?.lastPlayedAt ? new Date(row.lastPlayedAt) : null,
    totalMsPlayed: Number(row?.totalMsPlayed ?? 0),
  };
}
```

- [ ] **Step 2 : Ajouter `getAlbumTrackPlays`**

Dans le même fichier, ajoute juste après `getAlbumPlayStats` :

```ts
/**
 * Pour chaque track de l'album, son nombre de plays par l'utilisateur (incluant
 * les tracks à 0 plays via LEFT JOIN streams). Tri par `track_number` ASC
 * (ordre album). Utilisé par la tracklist avec barres de proportion.
 */
export async function getAlbumTrackPlays(
  userId: string,
  albumId: string,
): Promise<
  { trackId: string; name: string; trackNumber: number | null; plays: number }[]
> {
  const rows = await db
    .select({
      trackId: tracks.id,
      name: tracks.name,
      trackNumber: tracks.trackNumber,
      plays: sql<number>`coalesce(count(${streams.id}) filter (where ${streams.userId} = ${userId} and ${QUALIFYING_PLAY}), 0)::int`,
    })
    .from(tracks)
    .leftJoin(streams, eq(streams.trackId, tracks.id))
    .where(eq(tracks.albumId, albumId))
    .groupBy(tracks.id, tracks.name, tracks.trackNumber)
    .orderBy(asc(tracks.trackNumber), asc(tracks.name));

  return rows.map((r) => ({
    trackId: r.trackId,
    name: r.name,
    trackNumber: r.trackNumber,
    plays: Number(r.plays),
  }));
}
```

- [ ] **Step 3 : Patch temporaire de `/album/[id]/page.tsx`**

Le shape de `getAlbumPlayStats` a changé. La page courante consomme `stats.count`. Le reste du nouveau shape sera utilisé en Task 10 - pour l'instant, vérifier que le type-check passe (rien à modifier si le code n'utilise que `stats.count`).

- [ ] **Step 4 : Vérifier type-check + tests**

```bash
pnpm tsc --noEmit
pnpm vitest run
```

Attendu : clean + 83 passed (pas de nouveau test à ce stade, on bénéficie de la suite existante pour les non-régressions).

- [ ] **Step 5 : Commit**

```bash
git add src/db/queries/stats.ts
git commit -m "$(cat <<'EOF'
feat(stats): extend getAlbumPlayStats + add getAlbumTrackPlays

getAlbumPlayStats retourne maintenant firstPlayedAt, lastPlayedAt et
totalMsPlayed en plus du count, pour alimenter le hero du redesign album.

getAlbumTrackPlays renvoie tous les tracks d'un album avec leurs plays
(LEFT JOIN streams pour inclure les tracks à 0 play). Sert à la tracklist
avec barres de proportion + dérivation du top track.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5 : Nouvelles queries parité /track (Breakdown + Monthly + Hours + Quality)

**Files:**
- Modify: `src/db/queries/stats.ts` (ajout de 4 fonctions)

- [ ] **Step 1 : Ajouter les 4 queries**

Dans `src/db/queries/stats.ts`, ajoute en fin de fichier (avant la dernière `}` ou fonction existante - à un emplacement cohérent, par ex après `getAlbumTrackPlays`) :

```ts
/**
 * Nombre de plays sur l'album, ventilé par fenêtre (4w / 6m / 1y / all).
 * Pattern identique à getTrackBreakdownByWindow avec tracks.albumId = ?.
 */
export async function getAlbumBreakdownByWindow(
  userId: string,
  albumId: string,
): Promise<Record<StreamPeriod, number>> {
  const windows: StreamPeriod[] = ["4w", "6m", "1y", "all"];

  const results = await Promise.all(
    windows.map(async (window) => {
      const since = periodSince(window);
      const where = since
        ? and(
            eq(streams.userId, userId),
            eq(tracks.albumId, albumId),
            gte(streams.playedAt, since),
            QUALIFYING_PLAY,
          )
        : and(
            eq(streams.userId, userId),
            eq(tracks.albumId, albumId),
            QUALIFYING_PLAY,
          );

      const [row] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(streams)
        .innerJoin(tracks, eq(tracks.id, streams.trackId))
        .where(where);

      return [window, Number(row?.count ?? 0)] as const;
    }),
  );

  return Object.fromEntries(results) as Record<StreamPeriod, number>;
}

/**
 * Plays mensuels agrégés au niveau album, ordre chronologique. Mois à 0 plays
 * NON retournés.
 */
export async function getAlbumMonthlyPlays(
  userId: string,
  albumId: string,
): Promise<{ month: Date; plays: number }[]> {
  const rows = await db
    .select({
      month: sql<string>`date_trunc('month', ${streams.playedAt})::text`,
      plays: sql<number>`count(*)::int`,
    })
    .from(streams)
    .innerJoin(tracks, eq(tracks.id, streams.trackId))
    .where(
      and(
        eq(streams.userId, userId),
        eq(tracks.albumId, albumId),
        QUALIFYING_PLAY,
      ),
    )
    .groupBy(sql`date_trunc('month', ${streams.playedAt})`)
    .orderBy(asc(sql`date_trunc('month', ${streams.playedAt})`));

  return rows.map((r) => ({
    month: new Date(r.month),
    plays: Number(r.plays),
  }));
}

/**
 * Distribution des écoutes de l'album par heure de la journée (0-23). Retourne
 * toujours 24 entrées (heures sans écoute = count 0).
 */
export async function getAlbumListeningHours(
  userId: string,
  albumId: string,
): Promise<{ hour: number; count: number }[]> {
  const rows = await db
    .select({
      hour: sql<number>`extract(hour from ${streams.playedAt})::int`,
      count: sql<number>`count(*)::int`,
    })
    .from(streams)
    .innerJoin(tracks, eq(tracks.id, streams.trackId))
    .where(
      and(
        eq(streams.userId, userId),
        eq(tracks.albumId, albumId),
        QUALIFYING_PLAY,
      ),
    )
    .groupBy(sql`extract(hour from ${streams.playedAt})`);

  const counts = new Map(rows.map((r) => [Number(r.hour), Number(r.count)]));
  return Array.from({ length: 24 }, (_, hour) => ({
    hour,
    count: counts.get(hour) ?? 0,
  }));
}

/**
 * "Qualité" d'écoute de l'album : durée moyenne + taux de skip (< 30s).
 * NULL si aucun stream n'a de ms_played enregistré.
 */
export async function getAlbumPlayQuality(
  userId: string,
  albumId: string,
): Promise<{ avgMs: number | null; skipRate: number | null }> {
  const [row] = await db
    .select({
      avgMs: sql<string | null>`avg(${streams.msPlayed}) filter (where ${streams.msPlayed} is not null)`,
      skipRate: sql<string | null>`
        (sum(case when ${streams.msPlayed} < 30000 then 1 else 0 end)::float
         / nullif(count(*) filter (where ${streams.msPlayed} is not null), 0))
      `,
    })
    .from(streams)
    .innerJoin(tracks, eq(tracks.id, streams.trackId))
    .where(and(eq(streams.userId, userId), eq(tracks.albumId, albumId)));

  return {
    avgMs: row?.avgMs != null ? Number(row.avgMs) : null,
    skipRate: row?.skipRate != null ? Number(row.skipRate) : null,
  };
}
```

- [ ] **Step 2 : Vérifier type-check + tests**

```bash
pnpm tsc --noEmit
pnpm vitest run
```

- [ ] **Step 3 : Commit**

```bash
git add src/db/queries/stats.ts
git commit -m "$(cat <<'EOF'
feat(stats): add 4 album-scoped time-series queries

Parité avec les queries getTrack* existantes mais agrégées au niveau album
(JOIN sur tracks.album_id) :
- getAlbumBreakdownByWindow (4w/6m/1y/all)
- getAlbumMonthlyPlays (sparkline mensuelle)
- getAlbumListeningHours (heatmap 24h)
- getAlbumPlayQuality (durée moy + skip rate)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6 : Query `getOtherAlbumsByArtist`

**Files:**
- Modify: `src/db/queries/stats.ts` (ajout d'1 fonction)

- [ ] **Step 1 : Ajouter la query**

Dans `src/db/queries/stats.ts`, ajoute en fin de fichier :

```ts
/**
 * Autres albums d'un artiste donné qu'a écouté l'utilisateur, triés par plays
 * desc. Exclut l'album fourni en paramètre. Utilisé par le carousel "Autres
 * albums de [artiste]" sur la page detail album.
 */
export async function getOtherAlbumsByArtist(
  userId: string,
  artistId: string,
  excludeAlbumId: string,
  limit = 10,
): Promise<
  { albumId: string; name: string; imageUrl: string | null; plays: number }[]
> {
  const rows = await db
    .select({
      albumId: albums.id,
      name: albums.name,
      imageUrl: albums.imageUrl,
      plays: sql<number>`count(${streams.id})::int`,
    })
    .from(streams)
    .innerJoin(tracks, eq(tracks.id, streams.trackId))
    .innerJoin(albums, eq(albums.id, tracks.albumId))
    .innerJoin(trackArtists, eq(trackArtists.trackId, tracks.id))
    .where(
      and(
        eq(streams.userId, userId),
        eq(trackArtists.artistId, artistId),
        ne(albums.id, excludeAlbumId),
        QUALIFYING_PLAY,
      ),
    )
    .groupBy(albums.id, albums.name, albums.imageUrl)
    .orderBy(desc(sql`count(${streams.id})`))
    .limit(limit);

  return rows.map((r) => ({
    albumId: r.albumId,
    name: r.name,
    imageUrl: r.imageUrl,
    plays: Number(r.plays),
  }));
}
```

- [ ] **Step 2 : Vérifier les imports**

Le helper `ne` (not-equal) vient de `drizzle-orm`. Si l'import du fichier n'inclut pas déjà `ne`, l'ajouter :

```ts
// Au début de src/db/queries/stats.ts, dans l'import drizzle-orm existant
import { and, asc, desc, eq, gte, inArray, ne, sql } from "drizzle-orm";
```

(Adapter selon le contenu actuel de l'import - ajouter `ne` à la liste si absent.)

- [ ] **Step 3 : Vérifier type-check + tests**

```bash
pnpm tsc --noEmit
pnpm vitest run
```

- [ ] **Step 4 : Commit**

```bash
git add src/db/queries/stats.ts
git commit -m "$(cat <<'EOF'
feat(stats): add getOtherAlbumsByArtist for related-albums carousel

Triple-join streams → tracks → albums → track_artists pour trouver tous
les autres albums d'un artiste donné présents dans l'historique user.
Exclut l'album courant. Trié par plays desc, limit configurable (défaut 10).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7 : Composant `<AlbumTracklist />`

**Files:**
- Create: `src/components/album/album-tracklist.tsx`

- [ ] **Step 1 : Créer le dossier**

```bash
mkdir -p src/components/album
```

- [ ] **Step 2 : Créer le composant**

Crée `src/components/album/album-tracklist.tsx` :

```tsx
import Link from "next/link";

import { formatNumber } from "@/lib/utils";

export type AlbumTrack = {
  trackId: string;
  name: string;
  trackNumber: number | null;
  plays: number;
};

/**
 * Tracklist d'un album avec barre de proportion par track. Le top track (plays
 * max) est mis en exergue : fond lavande léger, texte lavande, barre pleine.
 *
 * Si tous les tracks ont 0 plays, aucune mise en exergue.
 */
export function AlbumTracklist({ tracks }: { tracks: AlbumTrack[] }) {
  const maxPlays = Math.max(...tracks.map((t) => t.plays), 0);
  const topTrackId = maxPlays > 0 ? tracks.find((t) => t.plays === maxPlays)?.trackId ?? null : null;

  return (
    <div className="flex flex-col gap-1">
      {tracks.map((t, index) => {
        const isTop = t.trackId === topTrackId;
        const pct = maxPlays > 0 ? (t.plays / maxPlays) * 100 : 0;
        const dimmed = t.plays === 0;

        return (
          <Link
            key={t.trackId}
            href={`/track/${t.trackId}`}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 transition hover:bg-accent ${
              isTop ? "bg-[#7c3aed]/8" : ""
            } ${dimmed ? "opacity-45" : ""}`}
          >
            <span className="w-6 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
              {t.trackNumber ?? index + 1}
            </span>
            <span
              className={`min-w-0 flex-1 truncate text-sm ${
                isTop ? "font-semibold text-[#c4b5fd]" : ""
              }`}
            >
              {t.name}
            </span>
            <div className="hidden h-1.5 w-32 shrink-0 overflow-hidden rounded-full bg-white/5 sm:block">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${pct}%`,
                  background: isTop ? "#c4b5fd" : "#7c3aed",
                }}
              />
            </div>
            <span
              className={`w-10 shrink-0 text-right text-sm tabular-nums ${
                isTop ? "font-semibold text-[#c4b5fd]" : "text-muted-foreground"
              }`}
            >
              {formatNumber(t.plays)}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3 : Vérifier type-check**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 4 : Commit**

```bash
git add src/components/album/album-tracklist.tsx
git commit -m "$(cat <<'EOF'
feat(album): add AlbumTracklist with per-track plays + proportion bars

Tracklist ordonnée par track_number, chaque ligne avec sa barre de plays
proportionnelle au max de l'album. Top track mis en exergue (fond lavande,
texte gras, barre pleine). Tracks à 0 plays dimmed (opacity 45 %).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8 : Composant `<TopTrackCard />`

**Files:**
- Create: `src/components/album/top-track-card.tsx`

- [ ] **Step 1 : Créer le composant**

Crée `src/components/album/top-track-card.tsx` :

```tsx
import Link from "next/link";

import { formatNumber } from "@/lib/utils";

export type TopTrackCardProps = {
  trackId: string;
  trackName: string;
  artistName: string;
  /** Cover du track (= cover de l'album typiquement). */
  imageUrl: string | null;
  plays: number;
  /** % du total écoutes de l'album, ex 0.31 pour 31 %. */
  shareOfAlbum: number;
};

/**
 * Carte highlight du top track d'un album. Affichée sur la page detail album
 * sous le hero. Lien vers /track/[id].
 */
export function TopTrackCard({
  trackId,
  trackName,
  artistName,
  imageUrl,
  plays,
  shareOfAlbum,
}: TopTrackCardProps) {
  return (
    <Link
      href={`/track/${trackId}`}
      className="flex items-center gap-4 rounded-2xl p-5 transition hover:opacity-90"
      style={{
        background:
          "linear-gradient(135deg, rgba(124,58,237,0.18), rgba(124,58,237,0.04))",
      }}
    >
      <span
        className="shrink-0 text-[10px] font-semibold uppercase tracking-widest"
        style={{ color: "#c4b5fd" }}
      >
        Ton favori
      </span>
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="size-14 shrink-0 rounded-md object-cover"
        />
      ) : (
        <div className="size-14 shrink-0 rounded-md bg-muted" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{trackName}</p>
        <p className="truncate text-xs text-muted-foreground">{artistName}</p>
      </div>
      <div className="text-right">
        <p className="font-display text-2xl italic leading-none tabular-nums">
          {formatNumber(plays)}
        </p>
        <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
          écoutes · {Math.round(shareOfAlbum * 100)} %
        </p>
      </div>
    </Link>
  );
}
```

- [ ] **Step 2 : Vérifier type-check**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 3 : Commit**

```bash
git add src/components/album/top-track-card.tsx
git commit -m "$(cat <<'EOF'
feat(album): add TopTrackCard highlight component

Carte horizontale "Ton favori" affichant le track le plus écouté de l'album
avec sa cover, son nom, son artiste, plays et % du total album. Cliquable
vers /track/[id].

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9 : Composant `<OtherArtistAlbums />`

**Files:**
- Create: `src/components/album/other-artist-albums.tsx`

- [ ] **Step 1 : Créer le composant**

Crée `src/components/album/other-artist-albums.tsx` :

```tsx
import Link from "next/link";

import { formatNumber } from "@/lib/utils";

export type OtherArtistAlbum = {
  albumId: string;
  name: string;
  imageUrl: string | null;
  plays: number;
};

/**
 * Carousel horizontal des autres albums du même artiste présents dans
 * l'historique user. Cards de 96 px de largeur, scroll horizontal.
 */
export function OtherArtistAlbums({
  artistName,
  albums,
}: {
  artistName: string;
  albums: OtherArtistAlbum[];
}) {
  return (
    <section>
      <h2 className="text-lg font-semibold">Autres albums de {artistName}</h2>
      <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
        {albums.map((a) => (
          <Link
            key={a.albumId}
            href={`/album/${a.albumId}`}
            className="group flex w-24 shrink-0 flex-col gap-2"
          >
            {a.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={a.imageUrl}
                alt=""
                loading="lazy"
                decoding="async"
                className="size-24 rounded-lg object-cover transition group-hover:opacity-85"
              />
            ) : (
              <div className="size-24 rounded-lg bg-muted" />
            )}
            <p className="truncate text-xs font-medium">{a.name}</p>
            <p className="text-[10px] text-muted-foreground">
              {formatNumber(a.plays)} écoute{a.plays > 1 ? "s" : ""}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2 : Vérifier type-check**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 3 : Commit**

```bash
git add src/components/album/other-artist-albums.tsx
git commit -m "$(cat <<'EOF'
feat(album): add OtherArtistAlbums horizontal carousel

Carousel des autres albums du même artiste présents dans l'historique user,
cards 96 px cliquables vers /album/[id]. Scroll horizontal natif.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10 : Refactor de `src/app/album/[id]/page.tsx`

**Files:**
- Modify: `src/app/album/[id]/page.tsx` (réécriture complète)

- [ ] **Step 1 : Remplacer intégralement le contenu**

Réécris `src/app/album/[id]/page.tsx` :

```tsx
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { AlbumTracklist } from "@/components/album/album-tracklist";
import { OtherArtistAlbums } from "@/components/album/other-artist-albums";
import { TopTrackCard } from "@/components/album/top-track-card";
import { HourHeatmap } from "@/components/stats/hour-heatmap";
import { PeriodBreakdownGrid } from "@/components/stats/period-breakdown-grid";
import { SparklineMonthly } from "@/components/stats/sparkline-monthly";
import { formatDate, formatRelativeDate } from "@/lib/format/date";
import { spotifyFetch } from "@/lib/spotify/client";
import type { SpotifyAlbum } from "@/lib/spotify/types";
import {
  getAlbumBreakdownByWindow,
  getAlbumListeningHours,
  getAlbumMonthlyPlays,
  getAlbumPlayQuality,
  getAlbumPlayStats,
  getAlbumTrackPlays,
  getOtherAlbumsByArtist,
} from "@/db/queries/stats";
import { cn, formatMs, formatNumber, glassCard } from "@/lib/utils";

// Spotify metadata is stable - re-fetch at most once an hour.
export const revalidate = 3600;

function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)} %`;
}

export default async function AlbumDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const { id } = await params;

  let album: SpotifyAlbum;
  try {
    album = await spotifyFetch<SpotifyAlbum>(userId, `/albums/${id}`);
  } catch {
    notFound();
  }

  const primaryArtist = album.artists?.[0];
  const primaryArtistId = primaryArtist?.id ?? null;

  const [stats, trackPlays, breakdown, monthly, hours, quality, otherAlbums] =
    await Promise.all([
      getAlbumPlayStats(userId, id),
      getAlbumTrackPlays(userId, id),
      getAlbumBreakdownByWindow(userId, id),
      getAlbumMonthlyPlays(userId, id),
      getAlbumListeningHours(userId, id),
      getAlbumPlayQuality(userId, id),
      primaryArtistId
        ? getOtherAlbumsByArtist(userId, primaryArtistId, id, 10)
        : Promise.resolve([]),
    ]);

  const image = album.images?.[0]?.url;
  const artistNames = album.artists?.map((a) => a.name).join(", ");
  const hasPlays = stats.count > 0;

  // Top track : ligne avec plays max. null si 0 plays OU 1 seul track joué
  // OU 1 seul track total (single → redondant avec la tracklist).
  const playedTracks = trackPlays.filter((t) => t.plays > 0);
  const topTrack =
    trackPlays.length > 1 && playedTracks.length > 1
      ? trackPlays.reduce((a, b) => (a.plays >= b.plays ? a : b))
      : null;

  const totalHours = stats.totalMsPlayed / (1000 * 60 * 60);
  const totalMinutesRemainder = Math.floor(
    (stats.totalMsPlayed / (1000 * 60)) % 60,
  );
  const totalDurationStr =
    stats.totalMsPlayed > 0
      ? totalHours >= 1
        ? `${Math.floor(totalHours)} h ${totalMinutesRemainder} m`
        : `${Math.floor(stats.totalMsPlayed / (1000 * 60))} m`
      : null;

  return (
    <main
      id="main"
      className="flex-1 flex flex-col gap-8 px-6 py-12 max-w-3xl mx-auto w-full"
    >
      {/* 1. Hero */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt=""
            decoding="async"
            fetchPriority="high"
            className="size-48 shrink-0 rounded-2xl object-cover shadow-lg"
          />
        ) : (
          <div className="size-48 shrink-0 rounded-2xl bg-muted" />
        )}
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">
            Album
            {album.release_date ? ` · ${album.release_date}` : ""}
            {album.total_tracks != null
              ? ` · ${album.total_tracks} titre${album.total_tracks > 1 ? "s" : ""}`
              : ""}
          </p>
          <h1 className="text-3xl font-semibold">{album.name}</h1>
          {artistNames ? (
            <p className="mt-1 text-lg text-muted-foreground">{artistNames}</p>
          ) : null}
          {hasPlays ? (
            <>
              <p className="mt-3 text-sm text-muted-foreground">
                {formatNumber(stats.count)} écoute{stats.count > 1 ? "s" : ""}
                {totalDurationStr ? ` · ${totalDurationStr} d'écoute` : ""}
              </p>
              {stats.firstPlayedAt && stats.lastPlayedAt ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Première : {formatDate(stats.firstPlayedAt)} · Dernière :{" "}
                  {formatRelativeDate(stats.lastPlayedAt)}
                </p>
              ) : null}
            </>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              Pas encore d&apos;écoute enregistrée.
            </p>
          )}
        </div>
      </div>

      {/* 2. Top track card (album-specific) */}
      {topTrack ? (
        <TopTrackCard
          trackId={topTrack.trackId}
          trackName={topTrack.name}
          artistName={artistNames ?? ""}
          imageUrl={image ?? null}
          plays={topTrack.plays}
          shareOfAlbum={topTrack.plays / stats.count}
        />
      ) : null}

      {/* 3. Tracklist with bars */}
      {trackPlays.length > 0 ? (
        <section className={cn(glassCard, "p-6")}>
          <h2 className="text-lg font-semibold">Tracklist</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Plays par titre - la barre montre la part au sein de l&apos;album.
          </p>
          <div className="mt-4">
            <AlbumTracklist tracks={trackPlays} />
          </div>
        </section>
      ) : null}

      {hasPlays ? (
        <>
          {/* 4. Évolution mensuelle */}
          {monthly.length >= 2 ? (
            <section className={cn(glassCard, "p-6")}>
              <h2 className="text-lg font-semibold">Évolution mensuelle</h2>
              <div className="mt-4">
                <SparklineMonthly data={monthly} />
              </div>
            </section>
          ) : null}

          {/* 5. Par période */}
          <section className={cn(glassCard, "p-6")}>
            <h2 className="text-lg font-semibold">Par période</h2>
            <PeriodBreakdownGrid data={breakdown} />
          </section>

          {/* 6. Heure préférée */}
          <section className={cn(glassCard, "p-6")}>
            <h2 className="text-lg font-semibold">Heure préférée</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Répartition des écoutes selon l&apos;heure de la journée.
            </p>
            <HourHeatmap data={hours} />
          </section>

          {/* 7. Qualité d'écoute */}
          <section className={cn(glassCard, "p-6")}>
            <h2 className="text-lg font-semibold">Qualité d&apos;écoute</h2>
            {quality.avgMs == null || quality.skipRate == null ? (
              <p className="mt-4 text-sm text-muted-foreground">
                Donnée indisponible pour cette source d&apos;écoute.
              </p>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="rounded-xl bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">
                    Durée moyenne
                  </p>
                  <p className="mt-2 font-display italic text-2xl leading-none tabular-nums">
                    {formatMs(quality.avgMs)}
                  </p>
                </div>
                <div className="rounded-xl bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">
                    Taux de skip
                  </p>
                  <p className="mt-2 font-display italic text-2xl leading-none tabular-nums">
                    {formatPercent(quality.skipRate)}
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Écoute &lt; 30 s
                  </p>
                </div>
              </div>
            )}
          </section>
        </>
      ) : null}

      {/* 8. Autres albums de l'artiste */}
      {primaryArtist && otherAlbums.length > 0 ? (
        <OtherArtistAlbums
          artistName={primaryArtist.name}
          albums={otherAlbums}
        />
      ) : null}
    </main>
  );
}
```

- [ ] **Step 2 : Vérifier type-check**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 3 : Lancer la suite de tests**

```bash
pnpm vitest run
```

Attendu : 83 passed, pas de régression.

- [ ] **Step 4 : Lancer le dev server pour vérif visuelle**

```bash
pnpm dev
```

(Si port 3000 déjà pris, fermer l'autre instance avant.)

- [ ] **Step 5 : Vérif visuelle desktop (1280×800)**

Ouvre `http://127.0.0.1:3000/album/4hiArqU343m8BUT0lymyLO` (Ipséité). Vérifie :

- [ ] Hero : cover gauche, titre + artiste + date + nb titres, total écoutes + durée en heures, première date absolue + dernière date relative
- [ ] Top track card visible avec gradient lavande, cover album, nom du track, plays, %
- [ ] Tracklist avec ligne du top en exergue (fond lavande léger, texte lavande, barre 100 %)
- [ ] Sparkline mensuelle (si l'album a ≥2 mois de plays)
- [ ] Grille 4 cards période
- [ ] Heatmap 24h
- [ ] Qualité d'écoute (durée moy + skip rate)
- [ ] Carousel "Autres albums de Damso" en bas

- [ ] **Step 6 : Vérif edge case - album avec 0 plays**

Trouve l'ID d'un album avec 0 plays (via la query SQL - un album peu écouté), ou utilise un ID arbitraire d'album Spotify. Vérifie :

- [ ] Hero : "Pas encore d'écoute enregistrée"
- [ ] Pas de top track card
- [ ] Tracklist visible mais toutes les lignes dimmed (opacity 45 %)
- [ ] Pas de sparkline, période, heatmap, qualité
- [ ] Carousel "Autres albums de [artiste]" visible si l'artiste a d'autres albums joués

- [ ] **Step 7 : Vérif /track/[id] non-régression**

Ouvre `http://127.0.0.1:3000/track/<un track id>`. La page doit s'afficher exactement comme avant (mêmes sections, mêmes layouts) - les composants HourHeatmap et PeriodBreakdownGrid sont maintenant extraits mais rendent identique.

- [ ] **Step 8 : Vérif mobile (375×812)**

Sur l'album test, en mobile :
- [ ] Hero passe en flex column (cover au-dessus, infos en-dessous)
- [ ] Tracklist : barres de proportion **cachées** (classe `sm:block`), seuls numéro + nom + plays restent
- [ ] Heatmap : grid 12 cols (et non 24)
- [ ] Period grid : 2 colonnes (et non 4)
- [ ] Pas de scroll horizontal sauf carousel albums

- [ ] **Step 9 : Commit**

```bash
git add src/app/album/[id]/page.tsx
git commit -m "$(cat <<'EOF'
feat(album): redesign /album/[id] with 8-section deep-dive layout

Refonte selon docs/superpowers/specs/2026-05-17-album-detail-redesign-design.md.

Hero enrichi (durée totale + first/last play, dernière en relatif), top track
highlight, tracklist avec barres de proportion (top en exergue), sparkline
mensuelle, period breakdown, heatmap heures, qualité d'écoute, carousel des
autres albums de l'artiste. Page la plus riche du site.

Réutilise <HourHeatmap />, <PeriodBreakdownGrid />, <SparklineMonthly /> et
les nouveaux composants album-* (AlbumTracklist, TopTrackCard, OtherArtistAlbums).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11 : Push final

- [ ] **Step 1 : Vérification finale**

```bash
git status
git log --oneline -12
pnpm vitest run
pnpm tsc --noEmit
```

Attendu : working tree clean (modulo les fichiers pré-existants Dockerfile / `.superpowers/` / `scripts/`), 10 nouveaux commits depuis le début du plan, suite verte, tsc clean.

- [ ] **Step 2 : Push**

Sur la branche courante (worktree ou main selon le mode d'exécution choisi) :

```bash
git push
```

---

## Self-Review

**Spec coverage :**
- ✅ Hero sober + durée totale + first/last : Task 4 (extension stats) + Task 10 (page render)
- ✅ Top track card highlight : Task 8 + Task 10 (gating sur 0 plays / 1 track joué / single)
- ✅ Tracklist avec barres + top en exergue + tracks dimmed : Task 4 (query) + Task 7 (composant) + Task 10 (wiring)
- ✅ Sparkline mensuelle : Task 5 (query) + Task 10 (réutilise SparklineMonthly existant)
- ✅ Par période 4w/6m/1y/all : Task 5 (query) + Task 3 (composant extrait) + Task 10
- ✅ Heatmap 24h : Task 5 (query) + Task 2 (composant extrait) + Task 10
- ✅ Qualité (avg + skip) : Task 5 (query) + Task 10
- ✅ Autres albums de l'artiste : Task 6 (query) + Task 9 (carousel) + Task 10
- ✅ Helpers formatDate / formatRelativeDate : Task 1 (TDD)
- ✅ Extraction HourHeatmap, PeriodBreakdownGrid + refactor /track : Tasks 2 & 3
- ✅ Non-régression /track : vérifiée Task 10 step 7

**Cohérence des types :**
- `AlbumTrack` (Task 7) match le retour de `getAlbumTrackPlays` (Task 4) - mêmes champs trackId, name, trackNumber, plays. ✅
- `OtherArtistAlbum` (Task 9) match `getOtherAlbumsByArtist` (Task 6). ✅
- `HourHeatmapData` (Task 2) match `getAlbumListeningHours` retour. ✅
- `Record<StreamPeriod, number>` cohérent entre Task 5 et Task 3. ✅
- `TopTrackCardProps` (Task 8) consommé en Task 10 avec les bons champs (trackId, trackName, artistName, imageUrl, plays, shareOfAlbum). ✅

**Pas de placeholder :** scan effectué, aucun "TBD", "implement later", ou code incomplet. ✅

**Scope :** 11 tasks, tient en une session d'exécution (~60-90 min). Décomposé proprement par responsabilité (helpers → composants partagés → queries → composants page → wiring). ✅
