import { enrichCatalogHotQueue } from "../worker/queue";
import {
  getTopAlbumIdsForUser,
  getTopArtistIdsForUser,
  getTopTrackAlbumIdsForUser,
} from "../src/db/queries/enrich";

async function main() {
  const userId = "606faa26-da96-4e7c-935d-2a803eaefc01";
  const [topAlbumIds, topTrackAlbumIds, artistIds] = await Promise.all([
    getTopAlbumIdsForUser(userId, 100),
    getTopTrackAlbumIdsForUser(userId, 100),
    getTopArtistIdsForUser(userId, 100),
  ]);
  const albumIds = Array.from(new Set([...topAlbumIds, ...topTrackAlbumIds]));
  console.log(
    `Top ${topAlbumIds.length} albums + ${topTrackAlbumIds.length} track-albums (union=${albumIds.length}) + ${artistIds.length} artists`,
  );
  await enrichCatalogHotQueue.add(
    "enrich-priority",
    { userId, albumIds, artistIds },
    { jobId: `enrich-priority:${userId}:manual-${Date.now()}` },
  );
  console.log("Enqueued enrich-priority");
  process.exit(0);
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
