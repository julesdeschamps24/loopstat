import { readdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { imports, tracks, type NewStream } from "@/db/schema";
import { insertStreams } from "@/db/queries/streams";

// Temp dir layout written by POST /api/import: <projectRoot>/.import-tmp/<importId>/<file>.
// The route saves files here so we never push file buffers through Redis.
const IMPORT_TMP_DIR = path.join(process.cwd(), ".import-tmp");

const ERROR_MESSAGE_MAX = 1000;

export interface ImportHistoryResult {
  rowsImported: number;
}

// One entry of a Spotify "Extended Streaming History" Streaming_History_Audio_*.json file.
// Only the fields we use are typed; everything else is ignored.
interface RawStreamEntry {
  ts?: unknown;
  ms_played?: unknown;
  master_metadata_track_name?: unknown;
  spotify_track_uri?: unknown;
}

const TRACK_URI_PREFIX = "spotify:track:";

export async function importHistory(
  importId: string,
): Promise<ImportHistoryResult> {
  const importRow = await db.query.imports.findFirst({
    where: eq(imports.id, importId),
    columns: { id: true, userId: true },
  });
  if (!importRow) throw new Error(`No import ${importId}`);
  const { userId } = importRow;

  const dir = path.join(IMPORT_TMP_DIR, importId);

  try {
    await db
      .update(imports)
      .set({ status: "processing" })
      .where(eq(imports.id, importId));

    const fileNames = await readdir(dir);

    // Dedup track id -> name across all files, and accumulate kept stream rows.
    const trackNames = new Map<string, string>();
    const streamRows: NewStream[] = [];

    for (const fileName of fileNames) {
      const raw = await readFile(path.join(dir, fileName), "utf8");
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        throw new Error(`File ${fileName} is not a JSON array`);
      }

      for (const item of parsed as RawStreamEntry[]) {
        const uri = item.spotify_track_uri;
        const name = item.master_metadata_track_name;

        // Skip podcast episodes / local files: no track URI or no track name.
        if (typeof uri !== "string" || !uri.startsWith(TRACK_URI_PREFIX)) {
          continue;
        }
        if (typeof name !== "string" || name.length === 0) {
          continue;
        }
        if (typeof item.ts !== "string") continue;

        const trackId = uri.slice(TRACK_URI_PREFIX.length);
        if (!trackId) continue;

        trackNames.set(trackId, name);

        streamRows.push({
          userId,
          trackId,
          playedAt: new Date(item.ts),
          msPlayed:
            typeof item.ms_played === "number" ? item.ms_played : null,
          source: "import",
        });
      }
    }

    // Insert minimal track rows (id + name only) to satisfy the streams.track_id
    // FK. onConflictDoNothing preserves any already-enriched track rows; the
    // separate enrichMetadata job fills album/duration/popularity later.
    const trackRows = Array.from(trackNames, ([id, name]) => ({ id, name }));
    const CHUNK = 1000;
    for (let i = 0; i < trackRows.length; i += CHUNK) {
      await db
        .insert(tracks)
        .values(trackRows.slice(i, i + CHUNK))
        .onConflictDoNothing();
    }

    // insertStreams chunks by 1000 and onConflictDoNothing against the unique
    // index (user_id, played_at, track_id) — dedup vs DB and within the dump.
    const rowsImported = await insertStreams(streamRows);

    await db
      .update(imports)
      .set({
        status: "completed",
        rowsImported,
        completedAt: new Date(),
      })
      .where(eq(imports.id, importId));

    await rm(dir, { recursive: true, force: true });

    return { rowsImported };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(imports)
      .set({
        status: "failed",
        errorMessage: message.slice(0, ERROR_MESSAGE_MAX),
      })
      .where(eq(imports.id, importId));

    // Best-effort cleanup; don't mask the original error.
    await rm(dir, { recursive: true, force: true }).catch(() => {});

    throw err;
  }
}
