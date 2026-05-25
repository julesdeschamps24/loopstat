import Link from "next/link";
import { ArtistAvatar } from "@/components/ui/artist-avatar";

interface Props {
  artists: {
    artistId: string;
    name: string;
    imageUrl: string | null;
    coCount: number;
  }[];
}

/**
 * Grid of artists frequently co-listened with the focal artist. Each tile
 * links to its `/artist/[id]` page. Renders nothing if the list is empty.
 */
export function RelatedArtists({ artists }: Props) {
  if (artists.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 sm:gap-4">
      {artists.map((a) => (
        <Link
          key={a.artistId}
          href={`/artist/${a.artistId}`}
          className="group flex flex-col items-center gap-2 rounded-2xl p-3 transition hover:bg-white/5"
        >
          <ArtistAvatar name={a.name} imageUrl={a.imageUrl} size={72} />
          <p className="text-center text-sm font-medium line-clamp-2 group-hover:text-foreground">
            {a.name}
          </p>
          <p className="text-xs text-muted-foreground">{a.coCount} co-écoutes</p>
        </Link>
      ))}
    </div>
  );
}
