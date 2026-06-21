/**
 * Seed the public "demo" showcase profile used by the landing's
 * "Voir un exemple" link (/u/demo). Creates a public user `demo` and gives it
 * listens over the demo catalog (run scripts/seed-demo-catalog.ts first) so the
 * public profile shows real top tracks / artists / albums with covers.
 *
 * Idempotent: re-runs wipe the demo user's streams and re-seed.
 * Run via: pnpm exec dotenv -e .env.local -- tsx scripts/seed-demo-profile.ts
 */
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";

import { db } from "../src/db/client";
import { albums, artists, streams, trackArtists, tracks, users } from "../src/db/schema";

const DEMO_ARTISTS = [
  "sabrina carpenter", "taylor swift", "billie eilish", "benson boone", "beyoncé",
  "eminem", "dua lipa", "post malone", "noah kahan", "doja cat",
];

async function main() {
  console.log("=== Seed demo profile (/u/demo) ===");

  const [u] = await db
    .insert(users)
    .values({ email: "demo@loopstat.tech", username: "demo", displayName: "Démo", isPublic: true })
    .onConflictDoUpdate({
      target: users.email,
      set: { username: "demo", displayName: "Démo", isPublic: true, deletedAt: null },
    })
    .returning({ id: users.id });
  console.log("demo user:", u.id);

  await db.delete(streams).where(eq(streams.userId, u.id));

  const rows = await db
    .selectDistinct({ trackId: tracks.id })
    .from(tracks)
    .innerJoin(trackArtists, eq(trackArtists.trackId, tracks.id))
    .innerJoin(artists, eq(artists.id, trackArtists.artistId))
    .innerJoin(albums, eq(albums.id, tracks.albumId))
    .where(and(isNotNull(albums.imageUrl), inArray(sql`lower(${artists.name})`, DEMO_ARTISTS)))
    .limit(40);
  console.log("demo tracks picked:", rows.length);

  const values: (typeof streams.$inferInsert)[] = [];
  let step = 0;
  rows.forEach((r, i) => {
    const plays = Math.max(3, 58 - Math.round(i * 1.4)); // descending → clear top tracks
    for (let p = 0; p < plays; p++) {
      step += 1;
      values.push({
        userId: u.id,
        trackId: r.trackId,
        playedAt: new Date(Date.now() - step * 500 * 60 * 1000), // spread over ~the past year
        msPlayed: 180000,
        source: "import",
      });
    }
  });

  for (let i = 0; i < values.length; i += 500) {
    await db.insert(streams).values(values.slice(i, i + 500));
  }
  console.log(`inserted ${values.length} streams. Done.`);
  process.exit(0);
}

main();
