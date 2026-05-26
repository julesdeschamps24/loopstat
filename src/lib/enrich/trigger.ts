import { enrichCatalogSingleQueue } from "../../../worker/queue";
import { getRedis } from "@/lib/redis";

const THROTTLE_TTL_SECONDS = 600;

/**
 * Server-side fire-and-forget enrich trigger. Called from page handlers
 * when a row's image_url is null. Honours the same Redis NX guard as the
 * /api/enrich-single endpoint to avoid thundering-herd on hot items.
 *
 * Errors are swallowed — this is best-effort, the render must not block.
 */
export async function triggerSingleEnrich(
  type: "album" | "artist",
  id: string,
): Promise<void> {
  try {
    const guard = await getRedis().set(
      `enrich:${type}:${id}`,
      "1",
      "EX",
      THROTTLE_TTL_SECONDS,
      "NX",
    );
    if (guard !== "OK") return;
    await enrichCatalogSingleQueue.add(
      "enrich-single",
      { type, id },
      { jobId: `enrich-single:${type}:${id}` },
    );
  } catch {
    // ignore — caller must not block on this
  }
}
