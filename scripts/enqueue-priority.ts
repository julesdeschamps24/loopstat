import { enrichCatalogHotQueue } from "../worker/queue";
import {
  getOrderedTopAlbumIdsForUser,
  getOrderedTopArtistIdsForUser,
  getOrderedTopTrackAlbumIdsForUser,
} from "../src/db/queries/enrich";
import { getUserLatestPlayedAt } from "../src/db/queries/stats";

async function main() {
  const userId = "606faa26-da96-4e7c-935d-2a803eaefc01";
  const refDate = (await getUserLatestPlayedAt(userId)) ?? new Date();
  const [orderedAlbumIds, orderedTrackAlbumIds, orderedArtistIds] = await Promise.all([
    getOrderedTopAlbumIdsForUser(userId, refDate),
    getOrderedTopTrackAlbumIdsForUser(userId, refDate),
    getOrderedTopArtistIdsForUser(userId, refDate),
  ]);
  const albumIds = Array.from(new Set([...orderedAlbumIds, ...orderedTrackAlbumIds]));
  console.log(
    `Ordered ${orderedAlbumIds.length} albums + ${orderedTrackAlbumIds.length} track-albums (union=${albumIds.length}) + ${orderedArtistIds.length} artists [refDate=${refDate.toISOString()}]`,
  );
  await enrichCatalogHotQueue.add(
    "enrich-priority",
    { userId, albumIds, artistIds: orderedArtistIds },
    { jobId: `enrich-priority:${userId}:manual-${Date.now()}` },
  );
  console.log("Enqueued enrich-priority (window-ordered)");
  process.exit(0);
}

main().catch((err) => {
  console.error("FAILED:", err);
  process.exit(1);
});
