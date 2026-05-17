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
import { periodSince } from "@/lib/stats/period";

import {
  POST_SIZE,
  PostTemplate,
} from "./templates/post";
import {
  STORY_SIZE,
  StoryTemplate,
  type FocusItem,
  type RecapData,
} from "./templates/story";
import {
  TWITTER_SIZE,
  TwitterTemplate,
} from "./templates/twitter";

export const dynamic = "force-dynamic";

const SIZE_BY_FORMAT = {
  twitter: TWITTER_SIZE,
  post: POST_SIZE,
  story: STORY_SIZE,
} as const;

// Wall background tiles: 6 cols × ceil(height/180) rows. Story is
// 1080x1920 → 11 rows = 66 tiles. Post is 1080x1080 → 6 rows = 36.
// Twitter is 1200x630 → 4 rows = 24. Closes follow-up issue #16
// (story wall was leaving the bottom half empty at the previous
// flat WALL_COVER_LIMIT=36).
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

  const [data, covers] = await Promise.all([
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

  const displayName = profile.displayName ?? profile.username;
  const props = {
    config,
    username: profile.username,
    displayName,
    avatarUrl: profile.avatarUrl,
    covers,
    data,
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
