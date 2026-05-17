import Link from "next/link";

import { formatNumber } from "@/lib/utils";

export type OtherArtistAlbum = {
  albumId: string;
  name: string;
  imageUrl: string | null;
  plays: number;
};

/**
 * Carousel horizontal des autres albums du même artiste présents dans
 * l'historique user. Cards de 96 px de largeur, scroll horizontal.
 */
export function OtherArtistAlbums({
  artistName,
  albums,
}: {
  artistName: string;
  albums: OtherArtistAlbum[];
}) {
  return (
    <section>
      <h2 className="text-lg font-semibold">Autres albums de {artistName}</h2>
      <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
        {albums.map((a) => (
          <Link
            key={a.albumId}
            href={`/album/${a.albumId}`}
            className="group flex w-24 shrink-0 flex-col gap-2"
          >
            {a.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={a.imageUrl}
                alt=""
                loading="lazy"
                decoding="async"
                className="size-24 rounded-lg object-cover transition group-hover:opacity-85"
              />
            ) : (
              <div className="size-24 rounded-lg bg-muted" />
            )}
            <p className="truncate text-xs font-medium">{a.name}</p>
            <p className="text-[10px] text-muted-foreground">
              {formatNumber(a.plays)} écoute{a.plays > 1 ? "s" : ""}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
