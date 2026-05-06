import { db } from "@/db/client";
import { streams, type NewStream } from "@/db/schema";

export async function insertStreams(rows: NewStream[]): Promise<number> {
  if (rows.length === 0) return 0;

  let inserted = 0;
  const CHUNK = 1000;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const result = await db.insert(streams).values(chunk).onConflictDoNothing();
    inserted += result.count ?? 0;
  }
  return inserted;
}
