import { readdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { imports, tracks, type NewStream } from "@/db/schema";
import { insertStreams, pruneOverlappingApiStreams } from "@/db/queries/streams";
import { log } from "@/lib/log";
import { enrichCatalogQueue } from "../queue";
import { albumArtists, albums, artists, trackArtists } from "@/db/schema";
import { synthesizeAlbumId, synthesizeArtistId } from "@/lib/ids/synthesize";

// Temp dir layout written by POST /api/import: <projectRoot>/.import-tmp/<importId>/<file>.
// The route saves files here so we never push file buffers through Redis.
const IMPORT_TMP_DIR = path.join(process.cwd(), ".import-tmp");

const ERROR_MESSAGE_MAX = 1000;

// Hardening au parse : défense en profondeur contre des JSONs forgés ou
// corrompus qui satureraient la RAM ou pollueraient la DB avec des
// valeurs aberrantes.
const MAX_NAME_LEN = 500;
const MAX_ARRAY_ENTRIES = 1_000_000;
// Spotify a été lancé le 7 octobre 2008. Toute écoute datée avant ça est
// forcément corrompue.
const SPOTIFY_LAUNCH = new Date("2008-10-07T00:00:00Z");
// On accepte un léger drift d'horloge entre le client Spotify et notre
// serveur (max 24 h dans le futur). Au-delà, c'est forcément corrompu.
const MAX_FUTURE_MS = 24 * 60 * 60 * 1000;

export interface ImportHistoryResult {
  rowsImported: number;
}

// One entry of a Spotify "Extended Streaming History" Streaming_History_Audio_*.json file.
// Only the fields we use are typed; everything else is ignored.
interface RawStreamEntry {
  ts?: unknown;
  ms_played?: unknown;
  master_metadata_track_name?: unknown;
  master_metadata_album_artist_name?: unknown;
  master_metadata_album_album_name?: unknown;
  spotify_track_uri?: unknown;
}

const TRACK_URI_PREFIX = "spotify:track:";

export async function importHistory(
  importId: string,
): Promise<ImportHistoryResult> {
  const wlog = log.child({ job: "import-history", importId });
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

    // readdir throws ENOENT if the temp dir is missing — an expected condition
    // (route crashed before mkdir, or a stale job) distinct from a parse
    // failure. The outer try/catch intentionally catches it and marks failed.
    const fileNames = await readdir(dir);

    // Dedup catalog entities and accumulate kept stream rows.
    const artistRows = new Map<string, { name: string }>();
    const albumRows = new Map<string, { name: string; artistId: string }>();
    const trackRows = new Map<
      string,
      { name: string; albumId: string | null }
    >();
    const trackArtistLinks = new Map<string, string>();  // trackId -> artistId
    const streamRows: NewStream[] = [];

    const nowMs = Date.now();

    for (const fileName of fileNames) {
      const raw = await readFile(path.join(dir, fileName), "utf8");
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        // Not a Spotify history array (e.g. a JSON object) — skip, don't fail.
        wlog.warn({ fileName }, "skipping file: not a JSON array");
        continue;
      }
      if (parsed.length > MAX_ARRAY_ENTRIES) {
        // Bombe array : un export Spotify normal max 100k entries par
        // fichier. Au-delà du million, c'est forgé. Skip plutôt que
        // potentiellement saturer la RAM en parcourant chaque entry.
        wlog.warn(
          { fileName, entries: parsed.length },
          `skipping file: array too large (> ${MAX_ARRAY_ENTRIES})`,
        );
        continue;
      }

      for (const item of parsed as RawStreamEntry[]) {
        // Skip non-object array items (null, numbers, strings) — field access
        // would otherwise throw and fail the whole import.
        if (typeof item !== "object" || item === null) continue;

        const uri = item.spotify_track_uri;
        const name = item.master_metadata_track_name;

        // Skip podcast episodes / local files: no track URI or no track name.
        if (typeof uri !== "string" || !uri.startsWith(TRACK_URI_PREFIX)) {
          continue;
        }
        if (typeof name !== "string" || name.length === 0) {
          continue;
        }
        // Bombe RAM via noms démesurés (Spotify limite déjà côté API ;
        // cap défensif pour un JSON forgé).
        if (name.length > MAX_NAME_LEN) continue;
        if (typeof item.ts !== "string") continue;

        const trackId = uri.slice(TRACK_URI_PREFIX.length);
        if (!trackId) continue;

        const playedAt = new Date(item.ts);
        const playedAtMs = playedAt.getTime();
        if (Number.isNaN(playedAtMs)) continue;
        if (
          playedAt < SPOTIFY_LAUNCH ||
          playedAtMs > nowMs + MAX_FUTURE_MS
        ) {
          continue;
        }

        let msPlayed: number | null = null;
        if (typeof item.ms_played === "number") {
          if (
            Number.isFinite(item.ms_played) &&
            item.ms_played >= 0 &&
            item.ms_played <= Number.MAX_SAFE_INTEGER
          ) {
            msPlayed = item.ms_played;
          }
        }

        // Capture artist + album names from the JSON (no API call needed).
        const artistName = item.master_metadata_album_artist_name;
        if (typeof artistName !== "string" || artistName.length === 0) continue;
        if (artistName.length > MAX_NAME_LEN) continue;

        const albumName = item.master_metadata_album_album_name;
        const hasAlbum =
          typeof albumName === "string" &&
          albumName.length > 0 &&
          albumName.length <= MAX_NAME_LEN;

        const artistId = synthesizeArtistId(artistName);
        const albumId = hasAlbum
          ? synthesizeAlbumId(artistName, albumName as string)
          : null;

        artistRows.set(artistId, { name: artistName });
        if (albumId && hasAlbum) {
          albumRows.set(albumId, {
            name: albumName as string,
            artistId,
          });
        }
        trackRows.set(trackId, { name, albumId });
        trackArtistLinks.set(trackId, artistId);

        streamRows.push({
          userId,
          trackId,
          playedAt,
          msPlayed,
          source: "import",
        });
      }
    }

    // Insert catalog entities in FK-safe order : artists → albums → tracks →
    // join tables. All ON CONFLICT DO NOTHING for idempotent re-import.
    // The enrichCatalog job fills mbid / image_url / release_date later.
    const CHUNK = 1000;

    const artistInserts = Array.from(artistRows, ([id, { name }]) => ({ id, name }));
    for (let i = 0; i < artistInserts.length; i += CHUNK) {
      await db.insert(artists).values(artistInserts.slice(i, i + CHUNK)).onConflictDoNothing();
    }

    const albumInserts = Array.from(albumRows, ([id, { name }]) => ({ id, name }));
    for (let i = 0; i < albumInserts.length; i += CHUNK) {
      await db.insert(albums).values(albumInserts.slice(i, i + CHUNK)).onConflictDoNothing();
    }

    const trackInserts = Array.from(trackRows, ([id, { name, albumId }]) => ({
      id,
      name,
      albumId,
    }));
    for (let i = 0; i < trackInserts.length; i += CHUNK) {
      await db.insert(tracks).values(trackInserts.slice(i, i + CHUNK)).onConflictDoNothing();
    }

    const trackArtistInserts = Array.from(
      trackArtistLinks,
      ([trackId, artistId]) => ({ trackId, artistId, position: 0 }),
    );
    for (let i = 0; i < trackArtistInserts.length; i += CHUNK) {
      await db
        .insert(trackArtists)
        .values(trackArtistInserts.slice(i, i + CHUNK))
        .onConflictDoNothing();
    }

    const albumArtistInserts = Array.from(
      albumRows,
      ([albumId, { artistId }]) => ({ albumId, artistId, position: 0 }),
    );
    for (let i = 0; i < albumArtistInserts.length; i += CHUNK) {
      await db
        .insert(albumArtists)
        .values(albumArtistInserts.slice(i, i + CHUNK))
        .onConflictDoNothing();
    }

    // insertStreams chunks by 1000 and onConflictDoNothing against the unique
    // index (user_id, played_at, track_id) — dedup vs DB and within the dump.
    const rowsImported = await insertStreams(streamRows);

    // Nettoie les streams `api` (worker polling) qui chevauchent la fenêtre
    // qu'on vient d'importer. La UNIQUE constraint ne les attrape pas à cause
    // du drift de timestamp seconde-vs-ms entre les deux sources. Voir
    // pruneOverlappingApiStreams() pour le détail.
    if (streamRows.length > 0) {
      // Loop instead of Math.min(...arr) — with 100k+ stream rows the spread
      // hits V8's max-arg limit and throws "Maximum call stack size exceeded".
      let minMs = Number.POSITIVE_INFINITY;
      let maxMs = Number.NEGATIVE_INFINITY;
      for (const row of streamRows) {
        const t = row.playedAt.getTime();
        if (t < minMs) minMs = t;
        if (t > maxMs) maxMs = t;
      }
      const pruned = await pruneOverlappingApiStreams(
        userId,
        new Date(minMs),
        new Date(maxMs),
      );
      if (pruned > 0) {
        wlog.info({ userId, pruned }, "pruned overlapping api streams");
      }
    }

    await db
      .update(imports)
      .set({
        status: "completed",
        rowsImported,
        completedAt: new Date(),
      })
      .where(eq(imports.id, importId));

    await rm(dir, { recursive: true, force: true });

    // Chain the import → enrich pipeline: backfill full metadata for the
    // minimal track rows just inserted. The import already succeeded, so an
    // enqueue failure must not fail it — enrichment can be retried later.
    // Use jobId to dedup concurrent enqueues: if an enrich job is already
    // queued or in-flight, this add() returns the existing job ref.
    try {
      await enrichCatalogQueue.add("enrich-catalog", { userId }, { jobId: "enrich-catalog-global" });
    } catch (enqueueErr) {
      wlog.error(
        { userId, err: enqueueErr },
        "failed to enqueue enrich job after import",
      );
    }

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
