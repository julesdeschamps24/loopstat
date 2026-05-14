"use client";

import { useEffect, useState } from "react";
import { Loader2, Music2 } from "lucide-react";

import { cn } from "@/lib/utils";

const POLL_INTERVAL_MS = 15_000;

type NowPlaying = {
  isPlaying: boolean;
  track?: {
    name: string;
    artists: string[];
    albumImageUrl: string | null;
  };
  progressMs?: number;
  durationMs?: number;
};

type State =
  | { kind: "loading" }
  | { kind: "idle" }
  | { kind: "playing"; data: NowPlaying };

export function CurrentlyPlaying({ className }: { className?: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch("/api/now-playing");
        if (cancelled) return;
        if (!res.ok) {
          setState({ kind: "idle" });
          return;
        }
        const body = (await res.json()) as NowPlaying;
        if (cancelled) return;
        if (body.isPlaying && body.track) {
          setState({ kind: "playing", data: body });
        } else {
          setState({ kind: "idle" });
        }
      } catch (err) {
        if (cancelled) return;
        console.error("[currently-playing] poll error", err);
        setState({ kind: "idle" });
      }
    }

    void poll();
    const timer = setInterval(() => void poll(), POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  if (state.kind === "loading") {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-2xl border bg-card p-6 text-muted-foreground",
          className,
        )}
      >
        <Loader2 className="size-4 animate-spin" />
        <span className="text-sm">Lecture en cours…</span>
      </div>
    );
  }

  if (state.kind === "idle") {
    return (
      <div
        className={cn(
          "flex items-center gap-3 rounded-2xl border bg-card p-6 text-muted-foreground",
          className,
        )}
      >
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-muted">
          <Music2 className="size-5" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Lecture en cours</p>
          <p className="mt-0.5 text-sm">Rien en lecture</p>
        </div>
      </div>
    );
  }

  const { track, progressMs, durationMs } = state.data;
  const progress =
    durationMs && durationMs > 0
      ? Math.min(100, Math.max(0, ((progressMs ?? 0) / durationMs) * 100))
      : 0;

  return (
    <div className={cn("rounded-2xl border bg-card p-6", className)}>
      <div className="flex items-center gap-4">
        {track?.albumImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={track.albumImageUrl}
            alt=""
            className="size-14 shrink-0 rounded-xl object-cover"
          />
        ) : (
          <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-muted">
            <Music2 className="size-5 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">Lecture en cours</p>
          <p className="mt-0.5 truncate font-medium">{track?.name}</p>
          <p className="truncate text-sm text-muted-foreground">
            {track?.artists.join(", ")}
          </p>
        </div>
      </div>
      {durationMs && durationMs > 0 ? (
        <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}
