import { sql } from "drizzle-orm";
import { db, type DB } from "@/db/client";
import { albumArtists, albums, artists, trackArtists, tracks } from "@/db/schema";

type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
type DbOrTx = DB | Tx;
import type {
  SpotifyAlbumSimple,
  SpotifyArtistSimple,
  SpotifyArtist,
  SpotifyTrack,
} from "./types";

export function pickImage(images: { url: string }[] | undefined): string | null {
  if (!images || images.length === 0) return null;
  return images[0]?.url ?? null;
}

export function normalizeReleaseDate(
  date: string | undefined,
  precision: SpotifyAlbumSimple["release_date_precision"],
): string | null {
  if (!date) return null;
  if (precision === "year") return `${date}-01-01`;
  if (precision === "month") return `${date}-01`;
  return date;
}

export function uniqById<T extends { id: string }>(items: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of items) map.set(item.id, item);
  return Array.from(map.values());
}

export async function upsertCatalogFromTracks(
  spotifyTracks: SpotifyTrack[],
  tx: DbOrTx = db,
) {
  if (spotifyTracks.length === 0) return;

  const CHUNK = 500;

  const rawArtists: SpotifyArtistSimple[] = [];
  const rawAlbums: SpotifyAlbumSimple[] = [];
  for (const t of spotifyTracks) {
    rawArtists.push(...t.artists);
    if (t.album) {
      rawAlbums.push(t.album);
      if (t.album.artists) rawArtists.push(...t.album.artists);
    }
  }

  const artistRows = uniqById(rawArtists).map((a) => ({
    id: a.id,
    name: a.name,
  }));

  const albumRows = uniqById(rawAlbums).map((a) => ({
    id: a.id,
    name: a.name,
    releaseDate: normalizeReleaseDate(a.release_date, a.release_date_precision),
    imageUrl: pickImage(a.images),
    totalTracks: a.total_tracks ?? null,
    albumType: a.album_type ?? null,
  }));

  const trackRows = uniqById(spotifyTracks).map((t) => ({
    id: t.id,
    name: t.name,
    albumId: t.album?.id ?? null,
    durationMs: t.duration_ms,
    popularity: t.popularity ?? null,
    explicit: t.explicit ?? null,
    previewUrl: t.preview_url ?? null,
    isrc: t.external_ids?.isrc ?? null,
  }));

  if (artistRows.length > 0) {
    for (let i = 0; i < artistRows.length; i += CHUNK) {
      const slice = artistRows.slice(i, i + CHUNK);
      await tx
        .insert(artists)
        .values(slice)
        .onConflictDoUpdate({
          target: artists.id,
          set: {
            name: sql`excluded.name`,
            updatedAt: sql`now()`,
          },
        });
    }
  }

  if (albumRows.length > 0) {
    for (let i = 0; i < albumRows.length; i += CHUNK) {
      const slice = albumRows.slice(i, i + CHUNK);
      await tx
        .insert(albums)
        .values(slice)
        .onConflictDoUpdate({
          target: albums.id,
          set: {
            name: sql`excluded.name`,
            releaseDate: sql`excluded.release_date`,
            imageUrl: sql`coalesce(excluded.image_url, ${albums.imageUrl})`,
            totalTracks: sql`excluded.total_tracks`,
            albumType: sql`excluded.album_type`,
            updatedAt: sql`now()`,
          },
        });
    }
  }

  if (trackRows.length > 0) {
    for (let i = 0; i < trackRows.length; i += CHUNK) {
      const slice = trackRows.slice(i, i + CHUNK);
      await tx
        .insert(tracks)
        .values(slice)
        .onConflictDoUpdate({
          target: tracks.id,
          set: {
            name: sql`excluded.name`,
            albumId: sql`coalesce(excluded.album_id, ${tracks.albumId})`,
            durationMs: sql`excluded.duration_ms`,
            popularity: sql`coalesce(excluded.popularity, ${tracks.popularity})`,
            explicit: sql`coalesce(excluded.explicit, ${tracks.explicit})`,
            previewUrl: sql`coalesce(excluded.preview_url, ${tracks.previewUrl})`,
            isrc: sql`coalesce(excluded.isrc, ${tracks.isrc})`,
            updatedAt: sql`now()`,
          },
        });
    }
  }

  const trackArtistRows = spotifyTracks.flatMap((t) =>
    t.artists.map((a, i) => ({ trackId: t.id, artistId: a.id, position: i })),
  );
  if (trackArtistRows.length > 0) {
    for (let i = 0; i < trackArtistRows.length; i += CHUNK) {
      const slice = trackArtistRows.slice(i, i + CHUNK);
      await tx.insert(trackArtists).values(slice).onConflictDoNothing();
    }
  }

  const albumArtistRows = rawAlbums.flatMap((al) =>
    (al.artists ?? []).map((a) => ({ albumId: al.id, artistId: a.id })),
  );
  if (albumArtistRows.length > 0) {
    for (let i = 0; i < albumArtistRows.length; i += CHUNK) {
      const slice = albumArtistRows.slice(i, i + CHUNK);
      await tx.insert(albumArtists).values(slice).onConflictDoNothing();
    }
  }
}

export async function upsertArtistDetails(detailedArtists: SpotifyArtist[]) {
  if (detailedArtists.length === 0) return;
  await db
    .insert(artists)
    .values(
      detailedArtists.map((a) => ({
        id: a.id,
        name: a.name,
        imageUrl: pickImage(a.images),
        genres: a.genres ?? [],
        popularity: a.popularity ?? null,
      })),
    )
    .onConflictDoUpdate({
      target: artists.id,
      set: {
        name: sql`excluded.name`,
        imageUrl: sql`coalesce(excluded.image_url, ${artists.imageUrl})`,
        genres: sql`excluded.genres`,
        popularity: sql`excluded.popularity`,
        updatedAt: sql`now()`,
      },
    });
}
