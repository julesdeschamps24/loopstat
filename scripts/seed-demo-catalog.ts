/**
 * Pre-seed the catalog with the demo fixtures (top tracks, artists, albums).
 *
 * Why : the demo dashboard shows top Sabrina Carpenter / Taylor Swift / etc.
 * If no real user has imported these albums, the catalog doesn't have them
 * and enrichDemoFixtures can't substitute real covers. This script ensures
 * the catalog has minimal rows + real Deezer covers for every demo fixture.
 *
 * Idempotent : re-runs are safe (ON CONFLICT DO NOTHING / DO UPDATE).
 *
 * Run via : pnpm exec dotenv -e .env.local -- tsx scripts/seed-demo-catalog.ts
 */
import { eq, sql } from "drizzle-orm";

import { db } from "../src/db/client";
import {
  albumArtists,
  albums,
  artists,
  trackArtists,
  tracks,
} from "../src/db/schema";
import {
  DEMO_TOP_ALBUMS,
  DEMO_TOP_ARTISTS,
  DEMO_TOP_TRACKS,
  DEMO_WALL_ALBUMS,
} from "../src/lib/demo/data";
import { synthesizeAlbumId, synthesizeArtistId } from "../src/lib/ids/synthesize";
import { enrichAlbumImageByDeezer, enrichArtistImageByDeezer } from "../src/lib/deezer/catalog";

const RATE_MS = 1100;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Album réel (ou single éponyme) pour les tracks démo dont l'artiste n'a
 * AUCUN album dans DEMO_TOP_ALBUMS. Sans ça, ces tracks restent avec
 * album_id NULL → aucune cover possible dans les tops démo.
 */
const TRACK_FALLBACK_ALBUMS: Record<string, { artistName: string; albumName: string }> = {
  "demo:flowers": { artistName: "Miley Cyrus", albumName: "Endless Summer Vacation" },
  "demo:water": { artistName: "Tyla", albumName: "TYLA" },
  "demo:greedy": { artistName: "Tate McRae", albumName: "THINK LATER" },
  "demo:lovin-on-me": { artistName: "Jack Harlow", albumName: "Lovin On Me" },
  "demo:million-dollar-baby": { artistName: "Tommy Richman", albumName: "MILLION DOLLAR BABY" },
  "demo:end-of-beginning": { artistName: "Djo", albumName: "DECIDE" },
  "demo:di-mi-nombre": { artistName: "Rosalía", albumName: "El Mal Querer" },
  "demo:gata-only": { artistName: "FloyyMenor", albumName: "GATA ONLY" },
  "demo:si-no-estas": { artistName: "iñigo quintero", albumName: "Si No Estás" },
  "demo:vampire": { artistName: "Olivia Rodrigo", albumName: "GUTS" },
};

async function main() {
  console.log("=== Seed demo catalog ===");

  // 1) Insert minimal artist rows from demo artists + demo album/track primary artists.
  const artistNamesSet = new Set<string>();
  for (const a of DEMO_TOP_ARTISTS) artistNamesSet.add(a.name);
  for (const a of DEMO_TOP_ALBUMS) for (const n of a.artistNames) artistNamesSet.add(n);
  for (const t of DEMO_TOP_TRACKS) for (const n of t.artistNames) artistNamesSet.add(n);
  for (const a of DEMO_WALL_ALBUMS) artistNamesSet.add(a.artistName);

  const artistRows = Array.from(artistNamesSet).map((name) => ({
    id: synthesizeArtistId(name),
    name,
  }));
  if (artistRows.length > 0) {
    await db.insert(artists).values(artistRows).onConflictDoNothing();
  }
  console.log(`Inserted ${artistRows.length} artist rows (idempotent)`);

  // 2) Insert minimal album rows + album_artists junctions.
  //    Demo tops + wall-only albums (fond <AlbumWall>) — même pipeline.
  const allAlbums: { artistName: string; name: string }[] = [
    ...DEMO_TOP_ALBUMS.map((a) => ({ artistName: a.artistNames[0], name: a.name })),
    ...DEMO_WALL_ALBUMS,
    ...Object.values(TRACK_FALLBACK_ALBUMS).map((f) => ({
      artistName: f.artistName,
      name: f.albumName,
    })),
  ];
  const albumRows = allAlbums.map((a) => ({
    id: synthesizeAlbumId(a.artistName, a.name),
    name: a.name,
  }));
  if (albumRows.length > 0) {
    await db.insert(albums).values(albumRows).onConflictDoNothing();
  }
  const albumArtistRows = allAlbums.map((a) => ({
    albumId: synthesizeAlbumId(a.artistName, a.name),
    artistId: synthesizeArtistId(a.artistName),
  }));
  if (albumArtistRows.length > 0) {
    await db.insert(albumArtists).values(albumArtistRows).onConflictDoNothing();
  }
  console.log(`Inserted ${albumRows.length} album rows + ${albumArtistRows.length} album_artists junctions`);

  // 3) Insert minimal track rows + track_artists junctions.
  //    Track IDs use the demo fixture's trackId (e.g. "demo:espresso") so detail
  //    pages /track/[id] keep working without lookup magic.
  const trackRows = DEMO_TOP_TRACKS.map((t) => {
    const albumFromTrack = DEMO_TOP_ALBUMS.find((a) =>
      a.artistNames.includes(t.artistNames[0]),
    );
    const fallback = TRACK_FALLBACK_ALBUMS[t.trackId];
    const albumId = albumFromTrack
      ? synthesizeAlbumId(albumFromTrack.artistNames[0], albumFromTrack.name)
      : fallback
        ? synthesizeAlbumId(fallback.artistName, fallback.albumName)
        : null;
    return { id: t.trackId, name: t.name, albumId };
  });
  if (trackRows.length > 0) {
    // onConflictDoUpdate (et pas DoNothing) : les runs précédents ont pu
    // laisser album_id NULL sur des rows existantes — on répare sans jamais
    // écraser un lien existant par NULL (COALESCE).
    await db
      .insert(tracks)
      .values(trackRows)
      .onConflictDoUpdate({
        target: tracks.id,
        set: {
          albumId: sql`COALESCE(excluded.album_id, ${tracks.albumId})`,
        },
      });
  }
  const trackArtistRows = DEMO_TOP_TRACKS.map((t) => ({
    trackId: t.trackId,
    artistId: synthesizeArtistId(t.artistNames[0]),
    position: 0,
  }));
  if (trackArtistRows.length > 0) {
    await db.insert(trackArtists).values(trackArtistRows).onConflictDoNothing();
  }
  console.log(`Inserted ${trackRows.length} track rows + ${trackArtistRows.length} track_artists junctions`);

  // 4) Enrich each album via Deezer (skip ones already enriched).
  console.log("\n=== Enriching albums via Deezer ===");
  let i = 0;
  for (const a of allAlbums) {
    if (i > 0) await sleep(RATE_MS);
    const albumId = synthesizeAlbumId(a.artistName, a.name);
    const [row] = await db.select({ deezerId: albums.deezerId }).from(albums).where(eq(albums.id, albumId)).limit(1);
    if (row?.deezerId != null) {
      console.log(`  [${++i}/${allAlbums.length}] ${a.artistName} — ${a.name}: already enriched`);
      continue;
    }
    try {
      await enrichAlbumImageByDeezer({
        albumId,
        artistName: a.artistName,
        albumName: a.name,
      });
      console.log(`  [${++i}/${allAlbums.length}] ${a.artistName} — ${a.name}: enriched`);
    } catch (err) {
      console.error(`  [${++i}/${allAlbums.length}] ${a.artistName} — ${a.name}: FAILED`, (err as Error).message);
    }
  }

  // 5) Enrich each artist via Deezer.
  console.log("\n=== Enriching artists via Deezer ===");
  i = 0;
  for (const a of DEMO_TOP_ARTISTS) {
    if (i > 0) await sleep(RATE_MS);
    const artistId = synthesizeArtistId(a.name);
    const [row] = await db.select({ deezerId: artists.deezerId }).from(artists).where(eq(artists.id, artistId)).limit(1);

    if (row?.deezerId == null) {
      try {
        await enrichArtistImageByDeezer({ artistId, name: a.name });
      } catch (err) {
        console.error(`  [Deezer] ${a.name}: FAILED`, (err as Error).message);
      }
    }
    console.log(`  [${++i}/${DEMO_TOP_ARTISTS.length}] ${a.name}: enriched`);
  }

  console.log("\n=== Done ===");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
