import Link from "next/link";

export const dynamic = "force-static";

export const metadata = {
  title: "Conditions générales d'utilisation — loopstat",
  description: "Conditions d'utilisation du service loopstat.",
};

export default function TermsPage() {
  return (
    <main
      id="main"
      className="flex-1 flex flex-col px-6 py-12 max-w-3xl mx-auto w-full"
    >
      <header className="mb-8">
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Retour
        </Link>
        <h1 className="mt-4 text-3xl font-semibold">
          Conditions générales d&apos;utilisation
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Dernière mise à jour : 17 mai 2026.
        </p>
      </header>

      <div className="space-y-8 text-sm leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold mb-2">1. Objet</h2>
          <p>
            loopstat est un service web gratuit qui calcule et affiche tes
            statistiques d&apos;écoute Spotify (top titres, top artistes,
            répartition horaire, etc.). En te connectant via Spotify, tu
            acceptes les présentes conditions.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">2. Accès au service</h2>
          <p>
            L&apos;accès nécessite&nbsp;:
          </p>
          <ul className="mt-1 list-disc list-inside text-muted-foreground space-y-1">
            <li>Un compte Spotify actif (gratuit ou Premium)</li>
            <li>D&apos;autoriser loopstat à lire ton historique d&apos;écoute via OAuth</li>
            <li>D&apos;accepter les présentes CGU et la{" "}
              <Link href="/privacy" className="text-primary hover:underline">
                politique de confidentialité
              </Link>
            </li>
          </ul>
          <p className="mt-2">
            Le service est entièrement <strong>gratuit</strong>, sans
            publicité, sans plan payant et sans engagement.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">3. Utilisation</h2>
          <p>Tu t&apos;engages à&nbsp;:</p>
          <ul className="mt-1 list-disc list-inside text-muted-foreground space-y-1">
            <li>
              Ne pas utiliser loopstat à des fins illicites ou pour porter
              atteinte aux droits de tiers
            </li>
            <li>
              Ne pas tenter de contourner les limitations techniques (rate
              limits, authentification)
            </li>
            <li>
              Ne pas utiliser de scripts automatisés pour aspirer les données
              affichées
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">4. Données Spotify</h2>
          <p>
            Les titres, artistes, pochettes et écoutes affichés viennent de
            l&apos;API Spotify et restent soumis aux{" "}
            <a
              href="https://www.spotify.com/legal/end-user-agreement/"
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline"
            >
              conditions d&apos;utilisation Spotify
            </a>
            . loopstat n&apos;est ni affilié, ni endossé, ni sponsorisé par
            Spotify AB.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">5. Disponibilité</h2>
          <p>
            loopstat est fourni <strong>« en l&apos;état »</strong>, sans
            garantie de disponibilité, d&apos;exactitude des données ou
            d&apos;absence d&apos;interruption. Le service peut être
            indisponible temporairement pour maintenance, mise à jour, ou
            limitation imposée par l&apos;API Spotify (quotas).
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">6. Responsabilité</h2>
          <p>
            L&apos;éditeur ne peut être tenu responsable&nbsp;:
          </p>
          <ul className="mt-1 list-disc list-inside text-muted-foreground space-y-1">
            <li>
              Des données renvoyées par Spotify (exactitude, exhaustivité,
              fraîcheur)
            </li>
            <li>
              De l&apos;indisponibilité du service ou de la perte de données
              en cas d&apos;incident technique
            </li>
            <li>
              D&apos;un usage non conforme aux présentes CGU
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">7. Résiliation</h2>
          <p>
            Tu peux supprimer ton compte à tout moment depuis la page{" "}
            <Link href="/settings" className="text-primary hover:underline">
              Réglages
            </Link>
            . La suppression est effective immédiatement et irréversible (tes
            données sont effacées de la base).
          </p>
          <p className="mt-2">
            L&apos;éditeur se réserve le droit de suspendre ou supprimer un
            compte en cas de violation des CGU, sans préavis.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">8. Évolution</h2>
          <p>
            Les présentes CGU peuvent évoluer. La version applicable est
            celle en vigueur au moment de ta connexion, datée en haut de
            cette page.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">9. Droit applicable</h2>
          <p>
            Les présentes CGU sont régies par le droit français. Tout litige
            relatif à leur interprétation ou exécution relèvera, à défaut
            d&apos;accord amiable, des juridictions françaises compétentes.
          </p>
        </section>
      </div>
    </main>
  );
}
