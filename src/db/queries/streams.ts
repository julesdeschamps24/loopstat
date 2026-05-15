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
