import Link from "next/link";

import { formatNumber } from "@/lib/utils";

export type TopTrackCardProps = {
  trackId: string;
  trackName: string;
  artistName: string;
  /** Cover du track (= cover de l'album typiquement). */
  imageUrl: string | null;
  plays: number;
  /** % du total écoutes de l'album, ex 0.31 pour 31 %. */
  shareOfAlbum: number;
};

/**
 * Carte highlight du top track d'un album. Affichée sur la page detail album
 * sous le hero. Lien vers /track/[id].
 */
export function TopTrackCard({
  trackId,
  trackName,
  artistName,
  imageUrl,
  plays,
  shareOfAlbum,
}: TopTrackCardProps) {
  return (
    <Link
      href={`/track/${trackId}`}
      className="flex items-center gap-4 rounded-2xl p-5 transition hover:opacity-90"
      style={{
        background:
          "linear-gradient(135deg, rgba(124,58,237,0.18), rgba(124,58,237,0.04))",
      }}
    >
      <span
        className="shrink-0 text-[10px] font-semibold uppercase tracking-widest"
        style={{ color: "#c4b5fd" }}
      >
        Ton favori
      </span>
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="size-14 shrink-0 rounded-md object-cover"
        />
      ) : (
        <div className="size-14 shrink-0 rounded-md bg-muted" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{trackName}</p>
        <p className="truncate text-xs text-muted-foreground">{artistName}</p>
      </div>
      <div className="text-right">
        <p className="font-display text-2xl italic leading-none tabular-nums">
          {formatNumber(plays)}
        </p>
        <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
          écoutes · {Math.round(shareOfAlbum * 100)} %
        </p>
      </div>
    </Link>
  );
}
