import { enrichCatalogHotQueue, enrichCatalogSingleQueue } from "../../../worker/queue";
import { getRedis } from "@/lib/redis";

const THROTTLE_TTL_SECONDS = 600;

/**
 * Server-side fire-and-forget enrich trigger. Called from page handlers
 * when a row's image_url is null. Honours the same Redis NX guard as the
 * /api/enrich-single endpoint to avoid thundering-herd on hot items.
 *
 * Errors are swallowed — this is best-effort, the render must not block.
 */
export interface VisibleItem {
  type: "album" | "artist";
  id: string;
}

/**
 * Enrichissement prioritaire de CE QUE LA PAGE AFFICHE. Appelé par les pages
 * de listes (tops, dashboard, profil public) avec les items rendus sans
 * cover, dans l'ordre d'affichage. Un seul job "enrich-priority" est posé
 * sur la hot queue — le sweep global se met en pause tant qu'elle n'est pas
 * vide, donc l'écran courant passe toujours devant.
 *
 * Même garde Redis que le single (TTL 10 min, clés partagées) : un reload
 * de page ne ré-enqueue pas ce qui est déjà en cours.
 * Best-effort : toute erreur est avalée, le render ne bloque jamais.
 */
export async function triggerVisibleEnrich(items: VisibleItem[]): Promise<void> {
  try {
    if (items.length === 0) return;
    const redis = getRedis();
    const albumIds: string[] = [];
    const artistIds: string[] = [];
    for (const it of items) {
      const guard = await redis.set(
        `enrich:${it.type}:${it.id}`,
        "1",
        "EX",
        THROTTLE_TTL_SECONDS,
        "NX",
      );
      if (guard !== "OK") continue;
      (it.type === "album" ? albumIds : artistIds).push(it.id);
    }
    if (albumIds.length === 0 && artistIds.length === 0) return;
    await enrichCatalogHotQueue.add(
      "enrich-priority",
      { userId: "on-view", albumIds, artistIds },
      { jobId: `enrich-visible:${Date.now()}:${Math.random().toString(36).slice(2, 8)}` },
    );
  } catch {
    // ignore — caller must not block on this
  }
}

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
