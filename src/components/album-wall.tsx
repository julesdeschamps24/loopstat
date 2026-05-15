import type { CSSProperties } from "react";

/**
 * Mur d'albums : fond fixe pour /dashboard rendant une grille des
 * pochettes des top tracks de l'utilisateur, en `mix-blend-mode:
 * luminosity` avec un overlay teinte cyan→magenta. Server component pur
 * (statique, aucune interactivité). Visible uniquement en dark mode
 * (gating via le sélecteur `.dark .ls-album-wall` dans globals.css).
 */
export function AlbumWall({ covers }: { covers: (string | null)[] }) {
  return (
    <div className="ls-album-wall" aria-hidden="true">
      <div className="grid">
        {covers.map((url, i) =>
          url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={url}
              alt=""
              loading="lazy"
              decoding="async"
              className="cell"
            />
          ) : (
            <div
              key={i}
              className="cell fallback"
              style={
                {
                  // Angle déterministe par index pour une variété visuelle
                  // discrète sur les cellules placeholder.
                  "--cell-angle": `${90 + ((i * 7) % 180)}deg`,
                } as CSSProperties
              }
            />
          ),
        )}
      </div>
      <div className="tint" />
      <div className="darken" />
    </div>
  );
}
