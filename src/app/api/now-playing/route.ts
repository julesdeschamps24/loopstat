import { auth } from "@/auth";
import { log } from "@/lib/log";
import { spotifyFetch } from "@/lib/spotify/client";
import type { SpotifyCurrentlyPlaying } from "@/lib/spotify/types";

// Reads the session cookie and live Spotify playback state — never cached.
export const dynamic = "force-dynamic";

type NowPlayingResponse = {
  isPlaying: boolean;
  track?: {
    name: string;
    artists: string[];
    albumImageUrl: string | null;
  };
  progressMs?: number;
  durationMs?: number;
};

export async function GET(): Promise<Response> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const wlog = log.child({ route: "api/now-playing", userId });

  try {
    // /me/player/currently-playing returns HTTP 204 (no body) when nothing is
    // playing — spotifyFetch yields `undefined` in that case.
    const data = await spotifyFetch<SpotifyCurrentlyPlaying>(
      userId,
      "/me/player/currently-playing",
    );

    if (!data || !data.is_playing || !data.item) {
      return Response.json({ isPlaying: false } satisfies NowPlayingResponse);
    }

    const payload: NowPlayingResponse = {
      isPlaying: true,
      track: {
        name: data.item.name,
        artists: data.item.artists.map((a) => a.name),
        albumImageUrl: data.item.album?.images?.[0]?.url ?? null,
      },
      progressMs: data.progress_ms ?? 0,
      durationMs: data.item.duration_ms,
    };

    return Response.json(payload);
  } catch (err) {
    // A now-playing widget failing should degrade silently, never 500.
    wlog.error({ err }, "failed to fetch now-playing");
    return Response.json({ isPlaying: false } satisfies NowPlayingResponse);
  }
}
