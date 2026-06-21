import type { Metadata } from "next";
import Link from "next/link";

import { AlbumWall } from "@/components/album-wall";
import { DemoShowcase } from "@/components/demo/demo-showcase";
import { LandingFooter } from "@/components/landing/landing-footer";
import { getPaddedWallCovers } from "@/db/queries/wall-covers";
import {
  getEnrichedDemoTopArtists,
  getEnrichedDemoTopTracks,
} from "@/lib/demo/enrich";

// Album-wall background reads the catalog → always dynamic.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Voir un exemple · loopstat",
  description:
    "À quoi ressemble ton tableau de bord loopstat : tops titres, artistes et écoutes, sur un compte de démonstration.",
};

const WALL_CELLS = 60;

/**
 * Public showcase reached from the landing's "Voir un exemple". Renders the
 * exact same demo dashboard a logged-in user sees before importing (via the
 * shared <DemoShowcase>), but standalone (no sidebar, no auth) and tuned for
 * conversion — every affordance funnels to /inscription.
 */
export default async function DemoPage() {
  const [tracks, artists, wallCovers] = await Promise.all([
    getEnrichedDemoTopTracks(),
    getEnrichedDemoTopArtists(),
    getPaddedWallCovers(null, null, WALL_CELLS),
  ]);

  return (
    <>
      <AlbumWall covers={wallCovers} />

      <header className="flex w-full items-center justify-between px-6 py-5 sm:px-8">
        <Link
          href="/"
          className="text-lg font-bold tracking-tight"
          style={{ letterSpacing: "-0.02em" }}
        >
          loopstat<span className="text-[#7c3aed]">.</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/connexion"
            className="rounded-[10px] border border-white/15 px-4 py-2 text-sm font-medium transition hover:bg-white/5"
          >
            Se connecter
          </Link>
          <Link
            href="/inscription"
            className="rounded-[10px] bg-[#7c3aed] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          >
            S&apos;inscrire
          </Link>
        </div>
      </header>

      <main
        id="main"
        className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-10"
      >
        <div className="mb-10 flex flex-col items-start gap-3 rounded-2xl border border-[#7c3aed]/30 bg-[#7c3aed]/10 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold">Exemple de compte démo</p>
            <p className="text-sm text-muted-foreground">
              Voici à quoi ressemble ton tableau de bord. Avec tes écoutes à toi,
              en mieux.
            </p>
          </div>
          <Link
            href="/inscription"
            className="shrink-0 rounded-[10px] bg-[#7c3aed] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          >
            Créer mon compte
          </Link>
        </div>

        <DemoShowcase
          tracks={tracks.slice(0, 5)}
          artists={artists.slice(0, 5)}
          interactive={false}
        />

        <div className="mt-16 flex flex-col items-center gap-4 rounded-2xl border bg-card p-8 text-center">
          <h2 className="text-xl font-semibold">Prêt à voir les tiennes&nbsp;?</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Importe ton historique Spotify et débloque tes vraies stats, sur
            toutes les périodes.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/inscription"
              className="rounded-[10px] bg-[#7c3aed] px-5 py-3 text-sm font-medium text-white transition hover:opacity-90"
            >
              S&apos;inscrire
            </Link>
            <Link
              href="/connexion"
              className="rounded-[10px] border border-white/15 px-5 py-3 text-sm font-medium transition hover:bg-white/5"
            >
              Se connecter
            </Link>
          </div>
        </div>
      </main>

      <LandingFooter />
    </>
  );
}
