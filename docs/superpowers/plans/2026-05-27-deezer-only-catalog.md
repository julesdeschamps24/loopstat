# Deezer-only catalog enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Supprimer toute dépendance à MusicBrainz et Cover Art Archive ; le catalogue (albums + artists) est enrichi exclusivement via Deezer.

**Architecture:** Sweep symétrique albums/artists filtré par `isNull(deezer_id)` ; sentinel `0` pour les miss. Module `src/lib/deezer/album.ts` ajoute `fetchAlbumDetails` pour récupérer `release_date` via `/album/{id}`. Module `src/lib/musicbrainz/` supprimé entièrement.

**Tech Stack:** Drizzle ORM (Postgres), BullMQ, Vitest, Deezer Open API.

**Spec:** [docs/superpowers/specs/2026-05-27-deezer-only-catalog-design.md](../specs/2026-05-27-deezer-only-catalog-design.md)

---

## Task 1: Module Deezer - `fetchAlbumDetails`

**Files:**
- Create: `src/lib/deezer/album.ts`
- Create: `src/lib/deezer/album.test.ts`

Récupère `release_date` (et seulement ça) via `/album/{id}`. Best-effort : retourne `null` si le shape est invalide ou si l'appel échoue.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/deezer/album.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchAlbumDetails } from "./album";

vi.mock("./client", () => ({
  deezerFetch: vi.fn(),
}));

import { deezerFetch } from "./client";

describe("fetchAlbumDetails", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns release_date on hit", async () => {
    vi.mocked(deezerFetch).mockResolvedValue({ release_date: "2023-05-12" });
    const res = await fetchAlbumDetails({ deezerAlbumId: 12345 });
    expect(res).toEqual({ releaseDate: "2023-05-12" });
    expect(deezerFetch).toHaveBeenCalledWith("/album/12345");
  });

  it("returns null releaseDate when field missing", async () => {
    vi.mocked(deezerFetch).mockResolvedValue({});
    const res = await fetchAlbumDetails({ deezerAlbumId: 12345 });
    expect(res).toEqual({ releaseDate: null });
  });

  it("returns null when shape invalid", async () => {
    vi.mocked(deezerFetch).mockResolvedValue(null);
    const res = await fetchAlbumDetails({ deezerAlbumId: 12345 });
    expect(res).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/deezer/album.test.ts`
Expected: FAIL (module doesn't exist).

- [ ] **Step 3: Create the module**

```ts
// src/lib/deezer/album.ts
import { deezerFetch } from "./client";

interface RawAlbumDetails {
  release_date?: unknown;
}

export interface DeezerAlbumDetails {
  releaseDate: string | null;
}

/**
 * Fetch full album details via `/album/{id}`. We only consume `release_date`
 * here - `searchAlbumByName` already returned id + cover. Returns null on
 * shape mismatch so the caller can skip cleanly.
 */
export async function fetchAlbumDetails({
  deezerAlbumId,
}: {
  deezerAlbumId: number;
}): Promise<DeezerAlbumDetails | null> {
  const data = await deezerFetch<RawAlbumDetails>(`/album/${deezerAlbumId}`);
  if (!data || typeof data !== "object") return null;
  const releaseDate =
    typeof data.release_date === "string" && data.release_date.length > 0
      ? data.release_date
      : null;
  return { releaseDate };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/lib/deezer/album.test.ts`
Expected: PASS (3/3).

- [ ] **Step 5: Commit**

```bash
git add src/lib/deezer/album.ts src/lib/deezer/album.test.ts
git commit -m "feat(deezer): fetchAlbumDetails for release_date

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: Migration N - add `albums.deezer_id`

**Files:**
- Create: `drizzle/<N>_albums_deezer_id.sql` (Drizzle générera le nom exact)
- Modify: `src/db/schema.ts:58-70` (table albums)

Ajoute la colonne + index sentinel-style miroir de `artists.deezer_id`.

- [ ] **Step 1: Add column to schema**

Modifier `src/db/schema.ts`, table `albums` (entre `imageUrl` et `releaseDate`) :

```ts
export const albums = pgTable("albums", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  // ... existant ...
  imageUrl: text("image_url"),
  deezerId: integer("deezer_id"),                  // <-- NEW
  mbid: text("mbid"),                              // (sera dropped en Task 9)
  releaseDate: date("release_date"),
  albumType: text("album_type"),                   // (sera dropped en Task 9)
  // ...
}, (t) => ({
  mbidIdx: index("albums_mbid_idx").on(t.mbid),
  deezerIdIdx: index("albums_deezer_id_idx").on(t.deezerId),  // <-- NEW
}));
```

(Import `integer` depuis `drizzle-orm/pg-core` si pas déjà présent.)

- [ ] **Step 2: Generate migration**

Run: `pnpm drizzle:generate`
Expected: nouveau fichier dans `drizzle/` contenant `ALTER TABLE albums ADD COLUMN deezer_id integer` + `CREATE INDEX ...`.

- [ ] **Step 3: Inspect migration**

Lire le SQL généré. Doit contenir uniquement l'ajout colonne + index (pas de DROP).

- [ ] **Step 4: Apply migration**

Run: `pnpm drizzle:push`
Expected: success, colonne créée. Vérifier via : `psql -c "\d albums"` que `deezer_id` apparaît.

- [ ] **Step 5: Commit**

```bash
git add drizzle/<filename> src/db/schema.ts drizzle/meta/
git commit -m "feat(db): add albums.deezer_id (sentinel-style miss tracking)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: Refactor `enrichAlbumImageByDeezer` - sentinel + release_date

**Files:**
- Modify: `src/lib/deezer/catalog.ts`
- Modify: `src/lib/deezer/catalog.test.ts` (créer si absent)

`enrichAlbumImageByDeezer` doit maintenant : (a) écrire le sentinel sur miss, (b) appeler `fetchAlbumDetails` pour récupérer release_date sur hit.

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/deezer/catalog.test.ts (ajouter ou créer)
import { describe, it, expect, vi, beforeEach } from "vitest";
import { enrichAlbumImageByDeezer } from "./catalog";

vi.mock("./search");
vi.mock("./album");
vi.mock("@/db/client", () => ({
  db: { update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })) },
}));

import { searchAlbumByName } from "./search";
import { fetchAlbumDetails } from "./album";
import { db } from "@/db/client";

describe("enrichAlbumImageByDeezer", () => {
  beforeEach(() => vi.resetAllMocks());

  it("writes sentinel deezer_id=0 on miss", async () => {
    vi.mocked(searchAlbumByName).mockResolvedValue(null);
    const set = vi.fn(() => ({ where: vi.fn() }));
    vi.mocked(db.update).mockReturnValue({ set } as never);
    await enrichAlbumImageByDeezer({
      albumId: "a1", artistName: "x", albumName: "y",
    });
    expect(set).toHaveBeenCalledWith({ deezerId: 0 });
  });

  it("writes deezerId, imageUrl, releaseDate on hit", async () => {
    vi.mocked(searchAlbumByName).mockResolvedValue({
      deezerAlbumId: 1234, coverUrl: "https://cdn/x.jpg",
    });
    vi.mocked(fetchAlbumDetails).mockResolvedValue({ releaseDate: "2024-01-15" });
    const set = vi.fn(() => ({ where: vi.fn() }));
    vi.mocked(db.update).mockReturnValue({ set } as never);
    await enrichAlbumImageByDeezer({
      albumId: "a1", artistName: "x", albumName: "y",
    });
    expect(set).toHaveBeenCalledWith({
      deezerId: 1234,
      imageUrl: "https://cdn/x.jpg",
      releaseDate: "2024-01-15",
    });
  });

  it("hit with no release_date still persists rest", async () => {
    vi.mocked(searchAlbumByName).mockResolvedValue({
      deezerAlbumId: 1234, coverUrl: "https://cdn/x.jpg",
    });
    vi.mocked(fetchAlbumDetails).mockResolvedValue({ releaseDate: null });
    const set = vi.fn(() => ({ where: vi.fn() }));
    vi.mocked(db.update).mockReturnValue({ set } as never);
    await enrichAlbumImageByDeezer({
      albumId: "a1", artistName: "x", albumName: "y",
    });
    expect(set).toHaveBeenCalledWith({
      deezerId: 1234,
      imageUrl: "https://cdn/x.jpg",
      releaseDate: null,
    });
  });

  it("swallows fetchAlbumDetails errors", async () => {
    vi.mocked(searchAlbumByName).mockResolvedValue({
      deezerAlbumId: 1234, coverUrl: "https://cdn/x.jpg",
    });
    vi.mocked(fetchAlbumDetails).mockRejectedValue(new Error("network"));
    const set = vi.fn(() => ({ where: vi.fn() }));
    vi.mocked(db.update).mockReturnValue({ set } as never);
    await enrichAlbumImageByDeezer({
      albumId: "a1", artistName: "x", albumName: "y",
    });
    expect(set).toHaveBeenCalledWith({
      deezerId: 1234,
      imageUrl: "https://cdn/x.jpg",
      releaseDate: null,
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/lib/deezer/catalog.test.ts`
Expected: FAIL (sentinel + release_date pas encore écrits).

- [ ] **Step 3: Refactor `enrichAlbumImageByDeezer`**

Remplacer la fonction dans `src/lib/deezer/catalog.ts` :

```ts
import { fetchAlbumDetails } from "./album";

const SENTINEL_DEEZER_ID = 0;

export async function enrichAlbumImageByDeezer({
  albumId,
  artistName,
  albumName,
}: {
  albumId: string;
  artistName: string;
  albumName: string;
}): Promise<void> {
  const match = await searchAlbumByName({ artistName, albumName });
  if (!match) {
    await db
      .update(albums)
      .set({ deezerId: SENTINEL_DEEZER_ID })
      .where(eq(albums.id, albumId));
    return;
  }

  let releaseDate: string | null = null;
  try {
    const details = await fetchAlbumDetails({ deezerAlbumId: match.deezerAlbumId });
    releaseDate = details?.releaseDate ?? null;
  } catch {
    // best-effort, miss = null
  }

  await db
    .update(albums)
    .set({
      deezerId: match.deezerAlbumId,
      imageUrl: match.coverUrl,
      releaseDate,
    })
    .where(eq(albums.id, albumId));
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/lib/deezer/catalog.test.ts`
Expected: PASS (4/4).

- [ ] **Step 5: Commit**

```bash
git add src/lib/deezer/catalog.ts src/lib/deezer/catalog.test.ts
git commit -m "refactor(deezer): album enrich writes sentinel + release_date

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4: Refactor `enrichCatalog.ts` - Deezer-only sweep symétrique

**Files:**
- Modify: `worker/jobs/enrichCatalog.ts`
- Modify: `worker/jobs/enrichCatalog.test.ts`

Le sweep MBz + sweep Deezer image fusionnent en un seul sweep Deezer pour albums et un seul pour artists. Tout filtre `isNull(albums.mbid)` ou `isNull(artists.mbid)` devient `isNull(albums.deezerId)` / `isNull(artists.deezerId)`. Plus de `withMbzRetry`, plus de `sleep(RATE_DELAY_MS)`.

- [ ] **Step 1: Update tests first**

Modifier `worker/jobs/enrichCatalog.test.ts` :
- Remplacer les assertions sur `enrichAlbumByNames` / `enrichArtistByName` par `enrichAlbumImageByDeezer` / `enrichArtistImageByDeezer`
- Remplacer les filtres mock `isNull(mbid)` par `isNull(deezerId)`
- Vérifier qu'aucun appel `sleep` n'est fait (ou seulement un délai léger configuré)
- `selfHealEnrichCatalog` : filtre `isNull(albums.deezerId)` au lieu de `mbid`

Exemple snippet :

```ts
// Sweep test
it("calls enrichAlbumImageByDeezer for each unenriched album", async () => {
  // ... seed albums with deezerId NULL
  await enrichCatalog();
  expect(enrichAlbumImageByDeezer).toHaveBeenCalledTimes(N);
});

// Self-heal test
it("counts albums with deezerId NULL", async () => {
  const res = await selfHealEnrichCatalog();
  expect(res.unenrichedAlbums).toBe(/* expected */);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run worker/jobs/enrichCatalog.test.ts`
Expected: FAIL.

- [ ] **Step 3: Refactor the sweep**

Remplacer la fonction `enrichCatalog` :

```ts
import { enrichAlbumImageByDeezer, enrichArtistImageByDeezer } from "@/lib/deezer/catalog";

const CHUNK_SIZE = 100;
const DEEZER_DELAY_MS = 50;  // soft throttle, Deezer tolère ~50 req/s

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function enrichCatalog(): Promise<EnrichCatalogResult> {
  const wlog = log.child({ job: "enrich-catalog" });

  const unenrichedAlbums = await db
    .select({
      albumId: albums.id,
      albumName: albums.name,
      artistName: artists.name,
    })
    .from(albums)
    .innerJoin(albumArtists, eq(albumArtists.albumId, albums.id))
    .innerJoin(artists, eq(artists.id, albumArtists.artistId))
    .where(isNull(albums.deezerId));

  wlog.info({ albums: unenrichedAlbums.length }, "album sweep starting");

  let albumsEnriched = 0;
  for (let i = 0; i < unenrichedAlbums.length; i++) {
    if (i > 0) await sleep(DEEZER_DELAY_MS);
    const row = unenrichedAlbums[i];
    try {
      await enrichAlbumImageByDeezer({
        albumId: row.albumId,
        artistName: row.artistName,
        albumName: row.albumName,
      });
      albumsEnriched++;
      if (albumsEnriched % CHUNK_SIZE === 0) {
        wlog.info(
          { albumsEnriched, total: unenrichedAlbums.length },
          "chunk persisted",
        );
      }
    } catch (err) {
      wlog.error(
        { err, msg: (err as Error)?.message, albumId: row.albumId },
        "enrich album failed",
      );
      throw err;
    }
  }

  const unenrichedArtists = await db
    .select({ artistId: artists.id, name: artists.name })
    .from(artists)
    .where(isNull(artists.deezerId));

  wlog.info({ artists: unenrichedArtists.length }, "artist sweep starting");

  let artistsEnriched = 0;
  for (let i = 0; i < unenrichedArtists.length; i++) {
    if (i > 0 || unenrichedAlbums.length > 0) await sleep(DEEZER_DELAY_MS);
    const row = unenrichedArtists[i];
    try {
      await enrichArtistImageByDeezer({ artistId: row.artistId, name: row.name });
      artistsEnriched++;
    } catch (err) {
      wlog.error(
        { err, msg: (err as Error)?.message, artistId: row.artistId },
        "enrich artist failed",
      );
      throw err;
    }
  }

  wlog.info({ albumsEnriched, artistsEnriched }, "enrich complete");
  return { albumsEnriched, artistsEnriched };
}
```

Et `selfHealEnrichCatalog` :

```ts
export async function selfHealEnrichCatalog(): Promise<SelfHealResult> {
  const slog = log.child({ job: "enrich-catalog-self-heal" });

  const [albCount] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(albums)
    .where(isNull(albums.deezerId));
  const [artCount] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(artists)
    .where(isNull(artists.deezerId));

  const unenrichedAlbums = Number(albCount?.n ?? 0);
  const unenrichedArtists = Number(artCount?.n ?? 0);

  if (unenrichedAlbums === 0 && unenrichedArtists === 0) {
    slog.info({}, "catalog fully enriched, no action");
    return { unenrichedAlbums, unenrichedArtists, enqueued: false };
  }

  const existing = await enrichCatalogQueue.getJob("enrich-catalog-global");
  if (existing) {
    const state = await existing.getState();
    if (state === "failed") {
      slog.info({ state }, "removing stale failed job");
      await existing.remove();
    } else {
      slog.info({ state }, "enrich already pending - no re-enqueue");
      return { unenrichedAlbums, unenrichedArtists, enqueued: false };
    }
  }

  await enrichCatalogQueue.add("enrich-catalog", {}, { jobId: "enrich-catalog-global" });
  slog.info({ unenrichedAlbums, unenrichedArtists }, "self-heal enqueued enrich-catalog");
  return { unenrichedAlbums, unenrichedArtists, enqueued: true };
}
```

Aussi mettre à jour le type `EnrichCatalogResult` et `SelfHealResult` (drop `artistsEnriched` séparé de `imagesEnriched`, drop `unenrichedImages`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run worker/jobs/enrichCatalog.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add worker/jobs/enrichCatalog.ts worker/jobs/enrichCatalog.test.ts
git commit -m "refactor(worker): Deezer-only sweep + selfHeal (drop MBz)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 5: Refactor `enrichCatalogPriority.ts` - filtre deezer_id

**Files:**
- Modify: `worker/jobs/enrichCatalogPriority.ts`
- Modify: `worker/jobs/enrichCatalogPriority.test.ts`

Le sweep ordonné par window remplace `isNull(albums.mbid)` par `isNull(albums.deezerId)`. Tous les appels `enrichAlbumByNames` / `enrichArtistByName` deviennent `enrichAlbumImageByDeezer` / `enrichArtistImageByDeezer`. Plus de `withMbzRetry`, plus de délai 1.1s.

- [ ] **Step 1: Update tests**

Modifier `worker/jobs/enrichCatalogPriority.test.ts` :
- Remplacer `isNull(albums.mbid)` par `isNull(albums.deezerId)` dans les setups
- Mock `enrichAlbumImageByDeezer` au lieu de `enrichAlbumByNames`
- Mock `enrichArtistImageByDeezer` au lieu de `enrichArtistByName`
- Vérifier que l'ordre window-priority est préservé

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run worker/jobs/enrichCatalogPriority.test.ts`
Expected: FAIL.

- [ ] **Step 3: Refactor**

Dans `enrichCatalogPriority` :

```ts
// Albums pass
const unenrichedAlbumRows = await db
  .select({
    albumId: albums.id,
    albumName: albums.name,
    artistName: artists.name,
  })
  .from(albums)
  .innerJoin(albumArtists, eq(albumArtists.albumId, albums.id))
  .innerJoin(artists, eq(artists.id, albumArtists.artistId))
  .where(and(inArray(albums.id, albumIds), isNull(albums.deezerId)));

const albumMap = new Map(unenrichedAlbumRows.map((a) => [a.albumId, a]));
let albumsEnriched = 0;
for (let i = 0; i < albumIds.length; i++) {
  const id = albumIds[i];
  const row = albumMap.get(id);
  if (!row) continue;
  if (i > 0) await sleep(DEEZER_DELAY_MS);
  await enrichAlbumImageByDeezer({
    albumId: row.albumId,
    artistName: row.artistName,
    albumName: row.albumName,
  });
  albumsEnriched++;
}

// Artists pass - pareil avec isNull(artists.deezerId)
```

L'ultra-priority pass (Promise.allSettled sur les 20 premiers) est conservé tel quel.

Supprimer tous les imports MBz (`enrichAlbumByNames`, `enrichArtistByName`, `withMbzRetry`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run worker/jobs/enrichCatalogPriority.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add worker/jobs/enrichCatalogPriority.ts worker/jobs/enrichCatalogPriority.test.ts
git commit -m "refactor(worker): priority sweep Deezer-only (drop MBz chain)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 6: Simplifier `enrichArtistImage.ts`

**Files:**
- Modify: `worker/jobs/enrichArtistImage.ts`
- Modify: `worker/jobs/enrichArtistImage.test.ts`

La fonction `enrichArtistImageWithFallback` n'a plus de "fallback" - c'est juste Deezer. Renommer en `enrichArtistImage` (ou inline dans single-enrich) et garder la pré-check `imageUrl !== null || deezerId !== null`.

- [ ] **Step 1: Update tests**

Renommer toutes les références `enrichArtistImageWithFallback` → `enrichArtistImage` dans le fichier de test.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run worker/jobs/enrichArtistImage.test.ts`
Expected: FAIL.

- [ ] **Step 3: Refactor**

```ts
// worker/jobs/enrichArtistImage.ts
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { artists } from "@/db/schema";
import { enrichArtistImageByDeezer } from "@/lib/deezer/catalog";

export async function enrichArtistImage({
  artistId,
  name,
}: { artistId: string; name: string }): Promise<void> {
  const [pre] = await db
    .select({ imageUrl: artists.imageUrl, deezerId: artists.deezerId })
    .from(artists)
    .where(eq(artists.id, artistId))
    .limit(1);
  if (!pre) return;
  if (pre.imageUrl !== null) return;
  if (pre.deezerId !== null) return;  // déjà tenté (sentinel ou hit avec image null)
  await enrichArtistImageByDeezer({ artistId, name });
}
```

- [ ] **Step 4: Update all call-sites**

Cherche-remplace : `enrichArtistImageWithFallback` → `enrichArtistImage` dans `worker/jobs/enrichCatalogSingle.ts` et partout ailleurs.

Run: `grep -rn enrichArtistImageWithFallback src/ worker/ | grep -v "\.test\."`
Expected: aucune occurrence après remplacement.

- [ ] **Step 5: Run all worker tests**

Run: `pnpm vitest run worker/jobs/`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add worker/jobs/enrichArtistImage.ts worker/jobs/enrichArtistImage.test.ts worker/jobs/enrichCatalogSingle.ts
git commit -m "refactor(worker): rename enrichArtistImageWithFallback → enrichArtistImage

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 7: Supprimer `src/lib/musicbrainz/` + env var

**Files:**
- Delete: `src/lib/musicbrainz/` (entier)
- Modify: `.env.production.example` (clean section header)
- Modify: tout import résiduel

Avant de delete, vérifier qu'aucun fichier source ne consomme plus MBz.

- [ ] **Step 1: Vérifier qu'aucun consommateur n'existe**

Run: `grep -rn "@/lib/musicbrainz\|from.*musicbrainz\|enrichAlbumByNames\|enrichArtistByName\|withMbzRetry\|MUSICBRAINZ_USER_AGENT" src/ worker/ --include="*.ts" --include="*.tsx" | grep -v "\.test\."`
Expected: aucune occurrence (sauf tests, qu'on supprime à l'étape 3).

- [ ] **Step 2: Supprimer le module et ses tests**

```bash
rm -rf src/lib/musicbrainz/
```

- [ ] **Step 3: Nettoyer `.env.production.example`**

Modifier section "Catalog enrichment" :

```
# ----------------------------------------------------------------------------
# Catalog enrichment (Deezer)
# ----------------------------------------------------------------------------
# Deezer Open API ne nécessite pas de clé pour le scope qu'on utilise
# (/search/artist, /search/album, /album/{id}). Aucune variable requise.
```

Supprimer la ligne `TADB_API_KEY=` si elle traîne encore.

Run: `grep -n "MUSICBRAINZ\|TADB\|MBZ" .env.production.example`
Expected: aucune occurrence.

- [ ] **Step 4: Vérifier que tsc passe**

Run: `pnpm tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 5: Vérifier les tests passent**

Run: `pnpm test`
Expected: tous les tests passent.

- [ ] **Step 6: Commit**

```bash
git add -u  # capture deletions
git add .env.production.example
git commit -m "chore(catalog): drop src/lib/musicbrainz + env var

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 8: Update README + AGENTS docs

**Files:**
- Modify: `README.md` (si des refs MBz/CAA subsistent - vérifier)
- Modify: `docs/test-scenarios.md` (vérifier)

- [ ] **Step 1: Cherche les références**

Run: `grep -n -i "musicbrainz\|mbz\|cover.art\|\bcaa\b\|tadb\|theaudiodb" README.md docs/test-scenarios.md docs/google-auth-setup.md docs/stripe-setup.md`

- [ ] **Step 2: Mettre à jour les passages trouvés**

Pour chaque match : remplacer la mention de MBz/CAA/TADB par "Deezer Open API" en gardant le contexte. Le README mentionne "enrichissement métadonnées" de manière générique → vérifier qu'aucune section "Variables d'environnement" ne mentionne MUSICBRAINZ_USER_AGENT ou TADB_API_KEY.

- [ ] **Step 3: Commit (si modifications)**

```bash
git add README.md docs/
git commit -m "docs: refresh enrichment refs to Deezer-only

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

(Si rien à modifier, skip cette task.)

---

## Task 9: Migration N+1 - drop colonnes mortes

**Files:**
- Create: `drizzle/<N+1>_drop_mbid_album_type.sql`
- Modify: `src/db/schema.ts:58-70` (retirer mbid, album_type, et index correspondants)

À faire en dernier (après que toutes les écritures vers mbid/album_type ont disparu du code).

- [ ] **Step 1: Vérifier qu'aucun code n'écrit mbid/album_type**

Run: `grep -rn "albums\.mbid\|albums\.albumType\|artists\.mbid\|mbid:\s*[^?]\|albumType:" src/ worker/ --include="*.ts" --include="*.tsx" | grep -v "\.test\." | grep -v schema.ts`
Expected: aucune occurrence (sauf si quelque chose lit encore - c'est un signal qu'on a oublié un consommateur).

- [ ] **Step 2: Remove from schema**

Modifier `src/db/schema.ts` :
- Retirer `mbid: text("mbid")` de `albums`
- Retirer `albumType: text("album_type")` de `albums`
- Retirer `mbid: text("mbid")` de `artists`
- Retirer `mbidIdx` de `albums` indices
- Retirer `mbidIdx` de `artists` indices (si présent)

- [ ] **Step 3: Generate migration**

Run: `pnpm drizzle:generate`
Expected: SQL généré contient `DROP INDEX` + `ALTER TABLE ... DROP COLUMN`.

- [ ] **Step 4: Inspect migration**

Vérifier que le SQL ne fait QUE des DROP (pas d'ADD imprévu).

- [ ] **Step 5: Apply migration**

Run: `pnpm drizzle:push`
Expected: success.

- [ ] **Step 6: Vérifier le schema**

Run: `psql $DATABASE_URL -c "\d albums" | grep -E "mbid|album_type"`
Expected: aucune ligne (colonnes parties).

- [ ] **Step 7: Final type-check + tests**

Run: `pnpm tsc --noEmit && pnpm test`
Expected: 0 errors, tous tests passent.

- [ ] **Step 8: Commit**

```bash
git add drizzle/<filename> src/db/schema.ts drizzle/meta/
git commit -m "feat(db): drop albums.mbid, albums.album_type, artists.mbid

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 10: Verification manuelle

**Files:** aucun (run-time verification)

- [ ] **Step 1: Restart le worker**

Run: `pkill -f "worker/index.ts" || true` puis `pnpm worker` en background.

- [ ] **Step 2: Enqueue un sweep manuel**

```bash
pnpm tsx scripts/enqueue-self-heal.ts  # ou équivalent existant
```

Ou attendre le cron self-heal. Observer les logs : "album sweep starting" → "chunk persisted 100" → "enrich complete albumsEnriched=N artistsEnriched=M".

- [ ] **Step 3: Vérifier en DB**

```sql
SELECT
  COUNT(*) FILTER (WHERE deezer_id IS NULL) AS pending,
  COUNT(*) FILTER (WHERE deezer_id = 0) AS sentinel_miss,
  COUNT(*) FILTER (WHERE deezer_id > 0) AS hits,
  COUNT(*) FILTER (WHERE image_url IS NOT NULL) AS with_cover
FROM albums;
```

Expected : `pending = 0`, `hits + sentinel_miss = total`, `with_cover ≈ hits`.

- [ ] **Step 4: Vérifier visuellement**

- `/top/albums?period=1w` → toutes les pochettes affichées (ou fallback propre pour les miss Deezer rares)
- `/album/[id]` (album avec hit) → release_date affiché
- `/album/[id]` (album avec sentinel) → fallback propre, pas de crash

- [ ] **Step 5: Final commit + push**

Si tout est vert, rien à commit (déjà fait par task). Push :

```bash
git push origin worktree-feat-priority-enrich
```

Puis merge sur main (via interface ou commande locale selon habitude).

---

## Notes pour le worker / executor

- **Parallélisme** : pas de subagents en parallèle, chaque task touche des fichiers qui peuvent dépendre des précédents (en particulier Task 4 ↔ Task 6).
- **Si une task échoue** : ne pas skip - rapporter le blocage. Les migrations DB en particulier ne sont pas trivialement réversibles.
- **Si `pnpm drizzle:push` produit un diff inattendu** : inspecter le `meta/` Drizzle avant d'appliquer. Une drift de schema masquée pourrait causer une perte de données.
- **Re-sweep coût** : à la première execution post-migration, le sweep va traiter ~N albums. C'est normal et attendu (cf spec section "Re-sweep complet"). Ne pas paniquer si ça prend quelques minutes.
