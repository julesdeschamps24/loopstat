import { deezerFetch } from "./client";

interface RawAlbumDetails {
  release_date?: unknown;
}

export interface DeezerAlbumDetails {
  releaseDate: string | null;
}

export async function fetchAlbumDetails({
  deezerAlbumId,
}: {
  deezerAlbumId: number;
}): Promise<DeezerAlbumDetails | null> {
  const data = await deezerFetch<RawAlbumDetails>(`/album/${deezerAlbumId}`);
  if (!data || typeof data !== "object") return null;
  const releaseDate =
    typeof data.release_date === "string" && data.release_date.length > 0
      ? data.release_date
      : null;
  return { releaseDate };
}
