import { auth } from "@/auth";
import { AlbumWall } from "@/components/album-wall";
import { getUserLatestPlayedAt } from "@/db/queries/stats";
import { getPaddedWallCovers } from "@/db/queries/wall-covers";
import { periodSince } from "@/lib/stats/period";

const WALL_CELLS = 60;

// User-scoped DB aggregation for the background - always dynamic.
export const dynamic = "force-dynamic";

/**
 * Layout du groupe applicatif (pages connectées). Rend le mur d'albums de
 * fond UNE SEULE FOIS, ici, plutôt que dans chaque page.
 *
 * En App Router, les layouts ne se re-rendent pas lors d'une navigation
 * entre leurs routes (ils sont mis en cache côté client). Conséquence :
 * la requête de covers ci-dessous s'exécute une seule fois en entrant dans
 * l'app et le fond reste monté en permanence - plus de « décharge/recharge »
 * du gradient violet en passant de track → artist → album, et une seule
 * requête DB pour toute la session (au lieu d'une par page).
 *
 * Fond = top albums de l'utilisateur sur 1 an (avec padding catalog si le
 * worker n'a pas encore tout enrichi). Les pages publiques (/, /u/[username],
 * /connexion, légal) sont hors de ce groupe et gardent leur propre fond.
 */
export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  const userId = session?.user?.id;

  // Connecté : top albums de l'utilisateur sur 1 an. Visiteur déconnecté
  // (mode démo - les pages enfants rendent le compte démo plutôt que de
  // rediriger) : on remplit le mur avec les favoris du catalog global.
  const wallCovers = userId
    ? await getPaddedWallCovers(
        userId,
        periodSince("1y", (await getUserLatestPlayedAt(userId)) ?? undefined),
        WALL_CELLS,
      )
    : await getPaddedWallCovers(null, null, WALL_CELLS);

  return (
    <>
      <AlbumWall covers={wallCovers} />
      {children}
    </>
  );
}
