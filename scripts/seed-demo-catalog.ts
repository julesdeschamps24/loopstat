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
import { eq } from "drizzle-orm";

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
} from "../src/lib/demo/data";
import { synthesizeAlbumId, synthesizeArtistId } from "../src/lib/ids/synthesize";
import { enrichAlbumImageByDeezer, enrichArtistImageByDeezer } from "../src/lib/deezer/catalog";

const RATE_MS = 1100;
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function main() {
  console.log("=== Seed demo catalog ===");

  // 1) Insert minimal artist rows from demo artists + demo album/track primary artists.
  const artistNamesSet = new Set<string>();
  for (const a of DEMO_TOP_ARTISTS) artistNamesSet.add(a.name);
  for (const a of DEMO_TOP_ALBUMS) for (const n of a.artistNames) artistNamesSet.add(n);
  for (const t of DEMO_TOP_TRACKS) for (const n of t.artistNames) artistNamesSet.add(n);

  const artistRows = Array.from(artistNamesSet).map((name) => ({
    id: synthesizeArtistId(name),
    name,
  }));
  if (artistRows.length > 0) {
    await db.insert(artists).values(artistRows).onConflictDoNothing();
  }
  console.log(`Inserted ${artistRows.length} artist rows (idempotent)`);

  // 2) Insert minimal album rows + album_artists junctions.
  const albumRows = DEMO_TOP_ALBUMS.map((a) => ({
    id: synthesizeAlbumId(a.artistNames[0], a.name),
    name: a.name,
  }));
  if (albumRows.length > 0) {
    await db.insert(albums).values(albumRows).onConflictDoNothing();
  }
  const albumArtistRows = DEMO_TOP_ALBUMS.map((a) => ({
    albumId: synthesizeAlbumId(a.artistNames[0], a.name),
    artistId: synthesizeArtistId(a.artistNames[0]),
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
    const albumId = albumFromTrack
      ? synthesizeAlbumId(albumFromTrack.artistNames[0], albumFromTrack.name)
      : null;
    return { id: t.trackId, name: t.name, albumId };
  });
  if (trackRows.length > 0) {
    await db.insert(tracks).values(trackRows).onConflictDoNothing();
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
  for (const a of DEMO_TOP_ALBUMS) {
    if (i > 0) await sleep(RATE_MS);
    const albumId = synthesizeAlbumId(a.artistNames[0], a.name);
    const [row] = await db.select({ deezerId: albums.deezerId }).from(albums).where(eq(albums.id, albumId)).limit(1);
    if (row?.deezerId != null) {
      console.log(`  [${++i}/${DEMO_TOP_ALBUMS.length}] ${a.artistNames[0]} — ${a.name}: already enriched`);
      continue;
    }
    try {
      await enrichAlbumImageByDeezer({
        albumId,
        artistName: a.artistNames[0],
        albumName: a.name,
      });
      console.log(`  [${++i}/${DEMO_TOP_ALBUMS.length}] ${a.artistNames[0]} — ${a.name}: enriched`);
    } catch (err) {
      console.error(`  [${++i}/${DEMO_TOP_ALBUMS.length}] ${a.artistNames[0]} — ${a.name}: FAILED`, (err as Error).message);
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
