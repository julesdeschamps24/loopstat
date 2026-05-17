import { ImageResponse } from "next/og";

import {
  getTopAlbumsFromStreams,
  getTopArtistsFromStreams,
  getTopTracksFromStreams,
} from "@/db/queries/stats";
import { getPublicProfileByUsername } from "@/db/queries/users";
import { getWallCovers } from "@/db/queries/wall-covers";
import {
  RECAP_N_BY_FORMAT,
  parseShareCardParams,
  type ShareCardConfig,
  type ShareFormat,
} from "@/lib/share/card-config";
import { prefetchImages } from "@/lib/share/prefetch-images";
import { periodSince } from "@/lib/stats/period";
import { shrinkAlbumCoverUrl } from "@/lib/spotify/image-url";

import { POST_SIZE, PostTemplate } from "./templates/post";
import {
  STORY_SIZE,
  StoryTemplate,
  type FocusItem,
  type RecapData,
} from "./templates/story";
import { TWITTER_SIZE, TwitterTemplate } from "./templates/twitter";

export const dynamic = "force-dynamic";

const SIZE_BY_FORMAT = {
  twitter: TWITTER_SIZE,
  post: POST_SIZE,
  story: STORY_SIZE,
} as const;

// Wall background tiles: 6 cols × ceil(height/180) rows. Story is
// 1080x1920 → 11 rows = 66 tiles. Post is 1080x1080 → 6 rows = 36.
// Twitter is 1200x630 → 4 rows = 24.
const WALL_COVER_LIMITS: Record<ShareFormat, number> = {
  twitter: 24,
  post: 36,
  story: 72,
};

function trackToItem(t: {
  trackId: string;
  name: string;
  albumImageUrl: string | null;
  artistNames: string[];
}): FocusItem {
  return {
    id: t.trackId,
    title: t.name,
    subtitle: t.artistNames.join(", ") || undefined,
    imageUrl: t.albumImageUrl,
  };
}

function artistToItem(a: {
  artistId: string;
  name: string;
  imageUrl: string | null;
}): FocusItem {
  return {
    id: a.artistId,
    title: a.name,
    imageUrl: a.imageUrl,
  };
}

function albumToItem(a: {
  albumId: string;
  name: string;
  imageUrl: string | null;
  artistNames: string[];
}): FocusItem {
  return {
    id: a.albumId,
    title: a.name,
    subtitle: a.artistNames.join(", ") || undefined,
    imageUrl: a.imageUrl,
  };
}

async function fetchFocus(
  userId: string,
  config: ShareCardConfig,
): Promise<FocusItem[]> {
  const since = periodSince(config.period);
  if (config.type === "tracks") {
    const rows = await getTopTracksFromStreams(userId, since, config.n);
    return rows.map(trackToItem);
  }
  if (config.type === "artists") {
    const rows = await getTopArtistsFromStreams(userId, since, config.n);
    return rows.map(artistToItem);
  }
  const rows = await getTopAlbumsFromStreams(userId, since, config.n);
  return rows.map(albumToItem);
}

async function fetchRecap(
  userId: string,
  config: ShareCardConfig,
): Promise<RecapData> {
  const since = periodSince(config.period);
  const limit = RECAP_N_BY_FORMAT[config.format];
  const [tracks, artists, albums] = await Promise.all([
    getTopTracksFromStreams(userId, since, limit),
    getTopArtistsFromStreams(userId, since, limit),
    getTopAlbumsFromStreams(userId, since, limit),
  ]);
  return {
    tracks: tracks.map(trackToItem),
    artists: artists.map(artistToItem),
    albums: albums.map(albumToItem),
  };
}

// Apply Spotify CDN size shrinking + inline as data URL using the
// prefetch cache. Returns the original URL if no cached version is
// available (Satori will fall back to its own network fetch).
function inline(
  raw: string | null | undefined,
  size: "medium" | "small",
  cache: Map<string, string>,
): string | null {
  if (!raw) return null;
  const shrunk = shrinkAlbumCoverUrl(raw, size) ?? raw;
  return cache.get(shrunk) ?? shrunk;
}

function inlineItems(
  items: FocusItem[],
  cache: Map<string, string>,
): FocusItem[] {
  return items.map((it) => ({ ...it, imageUrl: inline(it.imageUrl, "medium", cache) }));
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const username = url.searchParams.get("username");
  if (!username) {
    return new Response(JSON.stringify({ error: "username required" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const profile = await getPublicProfileByUsername(username);
  if (!profile) {
    return new Response(JSON.stringify({ error: "not found" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  const config = parseShareCardParams(url.searchParams);
  const size = SIZE_BY_FORMAT[config.format];

  const [data, rawCovers] = await Promise.all([
    config.mode === "focus"
      ? fetchFocus(profile.id, config)
      : fetchRecap(profile.id, config),
    config.bg === "wall"
      ? getWallCovers(
          profile.id,
          periodSince(config.period),
          WALL_COVER_LIMITS[config.format],
        )
      : Promise.resolve([] as string[]),
  ]);

  // Collect every URL that needs to land in the PNG, shrink them to
  // the right CDN size, then prefetch in parallel into data URLs.
  // Bypasses Satori's serial image loader (the wall background alone
  // was ~70 sequential fetches = ~5s per render).
  const wallShrunk = rawCovers
    .map((u) => shrinkAlbumCoverUrl(u, "small"))
    .filter((u): u is string => u !== null);
  const itemsForUrls: FocusItem[] =
    config.mode === "focus"
      ? (data as FocusItem[])
      : [
          ...(data as RecapData).tracks,
          ...(data as RecapData).artists,
          ...(data as RecapData).albums,
        ];
  const itemShrunk = itemsForUrls
    .map((it) => (it.imageUrl ? shrinkAlbumCoverUrl(it.imageUrl, "medium") : null))
    .filter((u): u is string => u !== null);
  const allUrls = [
    ...(profile.avatarUrl ? [profile.avatarUrl] : []),
    ...itemShrunk,
    ...wallShrunk,
  ];
  const cache = await prefetchImages(allUrls);

  const displayName = profile.displayName ?? profile.username;
  const inlinedAvatar = profile.avatarUrl
    ? cache.get(profile.avatarUrl) ?? profile.avatarUrl
    : null;
  const inlinedCovers = wallShrunk.map((u) => cache.get(u) ?? u);
  const inlinedData =
    config.mode === "focus"
      ? inlineItems(data as FocusItem[], cache)
      : {
          tracks: inlineItems((data as RecapData).tracks, cache),
          artists: inlineItems((data as RecapData).artists, cache),
          albums: inlineItems((data as RecapData).albums, cache),
        };

  const props = {
    config,
    username: profile.username,
    displayName,
    avatarUrl: inlinedAvatar,
    covers: inlinedCovers,
    data: inlinedData,
  };

  try {
    const element =
      config.format === "twitter" ? (
        <TwitterTemplate {...props} />
      ) : config.format === "post" ? (
        <PostTemplate {...props} />
      ) : (
        <StoryTemplate {...props} />
      );

    return new ImageResponse(element, {
      ...size,
      headers: {
        "cache-control": "public, max-age=60, s-maxage=60",
      },
    });
  } catch (err) {
    console.error("[share-card] render failed", err);
    return new Response(JSON.stringify({ error: "render failed" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
