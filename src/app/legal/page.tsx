import Link from "next/link";

// Pas de données sensibles, mais pas pré-rendu non plus : on garde la
// route dynamique pour éviter de la baker à un build figé si on tweake
// le contenu plus tard sans rebuild.
export const dynamic = "force-static";

export const metadata = {
  title: "Mentions légales — loopstat",
  description: "Mentions légales de loopstat (LCEN).",
};

export default function LegalPage() {
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
        <h1 className="mt-4 text-3xl font-semibold">Mentions légales</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Dernière mise à jour : 17 mai 2026.
        </p>
      </header>

      <div className="prose prose-sm dark:prose-invert max-w-none space-y-8 text-sm leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold mb-2">Éditeur du site</h2>
          <p>
            Le site <strong>loopstat</strong> (
            <Link href="/" className="text-primary hover:underline">
              loopstat.tech
            </Link>
            ) est édité à titre personnel par&nbsp;:
          </p>
          <ul className="mt-2 list-disc list-inside text-muted-foreground space-y-1">
            <li>
              <strong>Jules Deschamps</strong>
            </li>
            <li>
              Contact&nbsp;:{" "}
              <a
                href="mailto:julesdeschamps24@gmail.com"
                className="text-primary hover:underline"
              >
                julesdeschamps24@gmail.com
              </a>
            </li>
            <li>
              {/* TODO: remplacer par ton adresse postale (obligatoire LCEN
                  si le service est mis à disposition publiquement). */}
              Adresse postale&nbsp;: <em>à compléter</em>
            </li>
            <li>
              Statut&nbsp;: projet personnel non commercial, sans
              monétisation ni publicité.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">Directeur de la publication</h2>
          <p>Jules Deschamps.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">Hébergeur</h2>
          <p>
            <strong>Hetzner Online GmbH</strong>
            <br />
            Industriestr. 25, 91710 Gunzenhausen, Allemagne
            <br />
            Tél.&nbsp;: +49 (0)9831 505-0
            <br />
            <a
              href="https://www.hetzner.com"
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline"
            >
              hetzner.com
            </a>
          </p>
          <p className="mt-2 text-muted-foreground">
            Les données sont stockées sur un serveur situé en Allemagne (Union
            européenne).
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">Propriété intellectuelle</h2>
          <p>
            Le code source de loopstat est publié sous licence libre. Les
            données affichées (titres, artistes, pochettes) proviennent de
            l&apos;API publique de Spotify et restent la propriété de
            Spotify AB et des ayants droit respectifs. loopstat n&apos;est ni
            affilié ni endossé par Spotify.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">Contact</h2>
          <p>
            Pour toute question relative au site, à tes données personnelles
            ou pour exercer tes droits (cf.{" "}
            <Link href="/privacy" className="text-primary hover:underline">
              politique de confidentialité
            </Link>
            ), écris à{" "}
            <a
              href="mailto:julesdeschamps24@gmail.com"
              className="text-primary hover:underline"
            >
              julesdeschamps24@gmail.com
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
