import { avatarGradient } from "@/lib/ui/avatar-color";

interface Props {
  name: string;
  size?: number;
  className?: string;
}

/**
 * Placeholder avatar pour un artiste sans image (MusicBrainz n'a pas de
 * photos d'artistes ; TheAudioDB sera intégré plus tard). Cercle gradient
 * dérivé du nom + initiale.
 */
export function ArtistAvatar({ name, size = 48, className = "" }: Props) {
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
