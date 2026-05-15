"use client";

import { useEffect, useState } from "react";
import { Music2 } from "lucide-react";

import { FadeSwap } from "@/components/ui/motion";
import { cn, glassCard } from "@/lib/utils";

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

  // Design choice: a single <FadeSwap> wraps the whole card body, keyed on a
  // state-identifying string. This gives one uniform 200ms cross-fade contract
  // across every transition (loading → idle, loading → playing, playing →
  // playing on track change, playing → idle, …) rather than wrapping only the
  // playing branch and leaving loading/idle swaps abrupt. The key changes only
  // when the *displayed* content changes: a "playing" tick that keeps the same
  // track keeps the same key and won't re-trigger the fade (progress bar still
  // updates in place via its CSS transition).
  const motionKey = motionKeyFor(state);

  return (
    <FadeSwap motionKey={motionKey} className={className}>
      {renderBody(state)}
    </FadeSwap>
  );
}

function motionKeyFor(state: State): string {
  if (state.kind === "loading") return "loading";
  if (state.kind === "idle") return "idle";
  const { track } = state.data;
  return `playing:${track?.name ?? ""}|${track?.artists.join(",") ?? ""}`;
}

function renderBody(state: State) {
  if (state.kind === "loading") {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-label="Chargement de la lecture en cours"
        className={cn(glassCard, "animate-pulse p-6")}
      >
        <div className="flex items-center gap-4">
          <div className="size-14 shrink-0 rounded-xl bg-muted" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3 w-24 rounded bg-muted" />
            <div className="h-4 w-3/4 rounded bg-muted" />
            <div className="h-3 w-1/2 rounded bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  if (state.kind === "idle") {
    return (
      <div
        className={cn(
          glassCard,
          "flex items-center gap-3 p-6 text-muted-foreground",
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
    <div className={cn(glassCard, "p-6")}>
      <div className="flex items-center gap-4">
        {track?.albumImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={track.albumImageUrl}
            alt=""
            loading="lazy"
            decoding="async"
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
            className="h-full rounded-full bg-linear-to-r from-[#5dd9ff] to-[#ff5dc8] transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}
