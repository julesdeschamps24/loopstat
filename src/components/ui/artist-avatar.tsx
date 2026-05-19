import { avatarGradient } from "@/lib/ui/avatar-color";

interface Props {
  name: string;
  imageUrl?: string | null;
  size?: number;
  className?: string;
}

/**
 * Avatar for an artist. Shows the real photo if `imageUrl` is provided,
 * otherwise falls back to a deterministic gradient circle with the artist's
 * initial. The gradient palette stays on-brand (violet/mauve nébuleuse).
 */
export function ArtistAvatar({ name, imageUrl, size = 48, className = "" }: Props) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt=""
        loading="lazy"
        decoding="async"
        className={`shrink-0 rounded-full object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  const initial = (name.trim()[0] ?? "?").toUpperCase();
  const bg = avatarGradient(name);
  const fontSize = Math.round(size * 0.42);

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full text-white font-semibold ${className}`}
      style={{
        width: size,
        height: size,
        background: bg,
        fontSize,
      }}
      aria-hidden="true"
    >
      {initial}
    </div>
  );
}
