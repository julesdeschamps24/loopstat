import type { CSSProperties } from "react";

import { avatarGradient } from "@/lib/ui/avatar-color";

export interface WallCell {
  name: string;
  imageUrl: string | null;
}

/**
 * Mur d'albums : fond fixe pour /dashboard rendant une grille des
 * pochettes des top tracks de l'utilisateur, en `mix-blend-mode:
 * luminosity` avec un overlay teinte cyan→magenta. Server component pur
 * (statique, aucune interactivité). Visible uniquement en dark mode
 * (gating via le sélecteur `.dark .ls-album-wall` dans globals.css).
 *
 * Si une cell n'a pas encore d'imageUrl (album pas enrichi par MBz/CAA),
 * on render un gradient déterministe dérivé du nom — cohérent avec
 * ArtistAvatar. Au fur et à mesure que le worker enrichit le catalog,
 * chaque reload du dashboard remplace progressivement les gradients par
 * les vraies covers.
 */
export function AlbumWall({ covers }: { covers: WallCell[] }) {
  return (
    <div className="ls-album-wall" aria-hidden="true">
      <div className="grid">
        {covers.map((cell, i) =>
          cell.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={cell.imageUrl}
              alt=""
              loading="lazy"
              decoding="async"
              className="cell"
            />
          ) : (
            <div
              key={i}
              className="cell"
              style={
                {
                  background: avatarGradient(cell.name),
                  "--cell-angle": `${90 + ((i * 7) % 180)}deg`,
                } as CSSProperties
              }
            />
          ),
        )}
      </div>
      <div className="darken" />
    </div>
  );
}
