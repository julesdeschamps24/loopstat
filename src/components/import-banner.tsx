import Link from "next/link";

import { auth } from "@/auth";
import { hasCompletedImport } from "@/db/queries/imports";

/**
 * Bannière "Importer ton historique" affichée en haut du dashboard
 * tant que l'utilisateur n'a pas effectué d'import. Server component :
 * fait sa propre query DB, retourne null si l'user a déjà importé (=>
 * le composant peut être mounté inconditionnellement dans le dashboard,
 * il gère sa propre visibilité).
 *
 * Pas de bouton de fermeture : la bannière disparaît uniquement quand
 * l'import est réellement effectué.
 */
export async function ImportBanner() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const alreadyImported = await hasCompletedImport(session.user.id);
  if (alreadyImported) return null;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-[#7c3aed]/35 bg-[#7c3aed]/12 px-4 py-3 text-sm">
      <span className="size-2 shrink-0 rounded-full bg-[#7c3aed] ring-4 ring-[#7c3aed]/20" />
      <p className="flex-1 text-foreground">
        <strong>Tes stats sont limitées aux 30 derniers jours.</strong>{" "}
        <span className="text-muted-foreground">
          Importe ton historique Spotify (gratuit, ~30 min) pour débloquer
          tes vraies stats lifetime.
        </span>
      </p>
      <Link
        href="/import"
        className="shrink-0 rounded-full bg-[#7c3aed] px-4 py-1.5 text-xs font-medium text-white transition hover:opacity-90"
      >
        Importer →
      </Link>
    </div>
  );
}
