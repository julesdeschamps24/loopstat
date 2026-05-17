import Link from "next/link";

import { formatNumber } from "@/lib/utils";

export type AlbumTrack = {
  trackId: string;
  name: string;
  trackNumber: number | null;
  plays: number;
};

/**
 * Tracklist d'un album avec barre de proportion par track. Le top track (plays
 * max) est mis en exergue : fond lavande léger, texte lavande, barre pleine.
 *
 * Si tous les tracks ont 0 plays, aucune mise en exergue.
 */
export function AlbumTracklist({ tracks }: { tracks: AlbumTrack[] }) {
  const maxPlays = Math.max(...tracks.map((t) => t.plays), 0);
  const topTrackId = maxPlays > 0 ? tracks.find((t) => t.plays === maxPlays)?.trackId ?? null : null;

  return (
    <div className="flex flex-col gap-1">
      {tracks.map((t, index) => {
        const isTop = t.trackId === topTrackId;
        const pct = maxPlays > 0 ? (t.plays / maxPlays) * 100 : 0;
        const dimmed = t.plays === 0;

        return (
          <Link
            key={t.trackId}
            href={`/track/${t.trackId}`}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 transition hover:bg-accent ${
              isTop ? "bg-[#7c3aed]/8" : ""
            } ${dimmed ? "opacity-45" : ""}`}
          >
            <span className="w-6 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
              {t.trackNumber ?? index + 1}
            </span>
            <span
              className={`min-w-0 flex-1 truncate text-sm ${
                isTop ? "font-semibold text-[#c4b5fd]" : ""
              }`}
            >
              {t.name}
            </span>
            <div className="hidden h-1.5 w-32 shrink-0 overflow-hidden rounded-full bg-white/5 sm:block">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${pct}%`,
                  background: isTop ? "#c4b5fd" : "#7c3aed",
                }}
              />
            </div>
            <span
              className={`w-10 shrink-0 text-right text-sm tabular-nums ${
                isTop ? "font-semibold text-[#c4b5fd]" : "text-muted-foreground"
              }`}
            >
              {formatNumber(t.plays)}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
