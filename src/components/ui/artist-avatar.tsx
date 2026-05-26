import { User } from "lucide-react";

interface Props {
  name: string;
  imageUrl?: string | null;
  size?: number;
  className?: string;
}

/**
 * Avatar for an artist. Shows the real photo when `imageUrl` is provided,
 * otherwise a neutral User icon centered in a muted circle — same visual
 * treatment as the music-note placeholder used for tracks/albums without
 * cover (see RankedRow).
 */
export function ArtistAvatar({ name, imageUrl, size = 48, className = "" }: Props) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={name}
        loading="lazy"
        decoding="async"
        className={`shrink-0 rounded-full object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  // Icon scales with the container — same 42% ratio as the Music icon
  // inside the track placeholder (size-5 inside size-12).
  const iconSize = Math.round(size * 0.42);

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <User style={{ width: iconSize, height: iconSize }} />
    </div>
  );
}
