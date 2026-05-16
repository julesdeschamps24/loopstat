import { sql } from "drizzle-orm";
import { db, type DB } from "@/db/client";
import { streams, type NewStream } from "@/db/schema";

type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
type DbOrTx = DB | Tx;

export async function insertStreams(
  rows: NewStream[],
  tx: DbOrTx = db,
): Promise<number> {
  if (rows.length === 0) return 0;

  let inserted = 0;
  const CHUNK = 1000;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const result = await tx.insert(streams).values(chunk).onConflictDoNothing();
    inserted += result.count ?? 0;
  }
  return inserted;
}

/**
 * Supprime les streams `api` qui sont des doublons d'un stream `import`
 * pour le même user + track, dans une fenêtre de ±30 s.
 *
 * Pourquoi : l'import (Extended Streaming History) a une précision à la
 * seconde alors que le polling `/me/player/recently-played` a une
 * précision à la ms ET un drift de 1-3 s côté API. La contrainte UNIQUE
 * `(user_id, played_at, track_id)` ne les déduplique donc pas.
 *
 * Restreint à `[since, until]` pour éviter un full table scan : on ne
 * regarde que la fenêtre couverte par les nouveaux streams importés.
 *
 * L'import est gardé (autoritatif), c'est l'api qui dégage.
 */
export async function pruneOverlappingApiStreams(
  userId: string,
  since: Date,
  until: Date,
  tx: DbOrTx = db,
): Promise<number> {
  // postgres-js .execute() exposes affected rows via `.count` for DELETE/
  // UPDATE/INSERT statements (same shape that insertStreams relies on).
  const result = (await tx.execute(sql`
    DELETE FROM streams
    WHERE id IN (
      SELECT s_api.id FROM streams s_api
      JOIN streams s_imp
        ON s_imp.user_id = s_api.user_id
       AND s_imp.track_id = s_api.track_id
       AND s_imp.source = 'import'
       AND ABS(EXTRACT(EPOCH FROM (s_api.played_at - s_imp.played_at))) < 30
      WHERE s_api.source = 'api'
        AND s_api.user_id = ${userId}
        AND s_api.played_at >= ${since}
        AND s_api.played_at <= ${until}
    )
  `)) as unknown as { count?: number };
  return Number(result.count ?? 0);
}
