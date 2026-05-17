import Link from "next/link";

export const dynamic = "force-static";

export const metadata = {
  title: "Politique de confidentialité — loopstat",
  description: "Données collectées par loopstat, base légale, durée de conservation, tes droits RGPD.",
};

export default function PrivacyPage() {
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
          Politique de confidentialité
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Dernière mise à jour : 17 mai 2026.
        </p>
      </header>

      <div className="space-y-8 text-sm leading-relaxed">
        <section>
          <p>
            Cette politique décrit comment loopstat collecte, utilise et
            protège tes données personnelles, conformément au Règlement
            général sur la protection des données (RGPD).
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">Responsable du traitement</h2>
          <p>
            Jules Deschamps, éditeur du site (cf.{" "}
            <Link href="/legal" className="text-primary hover:underline">
              mentions légales
            </Link>
            ). Contact&nbsp;:{" "}
            <a
              href="mailto:julesdeschamps24@gmail.com"
              className="text-primary hover:underline"
            >
              julesdeschamps24@gmail.com
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">Données collectées</h2>
          <p>loopstat collecte les données suivantes&nbsp;:</p>

          <h3 className="mt-4 font-medium">Via la connexion Spotify (OAuth)</h3>
          <ul className="mt-1 list-disc list-inside text-muted-foreground space-y-1">
            <li>Identifiant Spotify, adresse e-mail, nom d&apos;affichage</li>
            <li>Photo de profil (URL)</li>
            <li>Pays et type d&apos;abonnement Spotify</li>
            <li>
              Jetons OAuth d&apos;accès et de rafraîchissement, stockés
              chiffrés en base
            </li>
          </ul>

          <h3 className="mt-4 font-medium">Historique d&apos;écoute</h3>
          <ul className="mt-1 list-disc list-inside text-muted-foreground space-y-1">
            <li>
              Titres écoutés (identifiant Spotify), date et heure d&apos;écoute,
              durée écoutée, source (synchronisation API ou import RGPD)
            </li>
            <li>
              Si tu importes ton historique RGPD Spotify (fonction optionnelle)
              : l&apos;intégralité des écoutes contenues dans l&apos;export
            </li>
          </ul>

          <h3 className="mt-4 font-medium">Aucune donnée non collectée</h3>
          <p className="mt-1 text-muted-foreground">
            loopstat <strong>ne collecte pas</strong> ton mot de passe Spotify
            (l&apos;authentification passe par Spotify directement via OAuth),
            ni d&apos;adresse IP à des fins d&apos;analyse, ni de cookies
            tiers, ni d&apos;outils de tracking ou de publicité.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">Base légale</h2>
          <p>
            Le traitement repose sur <strong>l&apos;exécution du contrat</strong>{" "}
            (art. 6.1.b du RGPD)&nbsp;: tu crées un compte et te connectes
            volontairement pour utiliser le service de statistiques. Sans ces
            données, le service ne peut pas fonctionner.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">Finalités</h2>
          <ul className="mt-1 list-disc list-inside text-muted-foreground space-y-1">
            <li>Te permettre de te connecter (authentification)</li>
            <li>
              Calculer et afficher tes statistiques d&apos;écoute
              (tops, horloge, page détail track, etc.)
            </li>
            <li>
              Synchroniser périodiquement ton historique récent depuis
              l&apos;API Spotify
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">Durée de conservation</h2>
          <p>
            Tes données sont conservées <strong>tant que ton compte est actif</strong>.
            Tu peux le supprimer à tout moment depuis la page{" "}
            <Link href="/settings" className="text-primary hover:underline">
              Réglages
            </Link>{" "}
            — la suppression est effective immédiatement et inclut tous tes
            streams, jetons et métadonnées personnelles. Le catalogue
            partagé (titres, artistes, albums) reste anonyme et peut être
            conservé.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">Hébergement et sous-traitants</h2>
          <p>
            Tes données sont hébergées en <strong>Allemagne</strong> (Union
            européenne) chez Hetzner Online GmbH. Aucun transfert hors UE
            n&apos;est effectué par loopstat.
          </p>
          <p className="mt-2">Sous-traitants&nbsp;:</p>
          <ul className="mt-1 list-disc list-inside text-muted-foreground space-y-1">
            <li>
              <strong>Spotify AB</strong> (Suède, UE) — fournisseur des
              données d&apos;écoute via OAuth et API publique
            </li>
            <li>
              <strong>Hetzner Online GmbH</strong> (Allemagne, UE) —
              hébergement du serveur et des bases de données
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">Cookies</h2>
          <p>
            loopstat utilise uniquement des cookies <strong>strictement
            nécessaires</strong> au fonctionnement du site&nbsp;:
          </p>
          <ul className="mt-1 list-disc list-inside text-muted-foreground space-y-1">
            <li>
              Cookie de session d&apos;authentification (NextAuth) — maintient
              ta connexion entre les pages
            </li>
            <li>
              Préférence de thème (clair/sombre) — stockée en local
            </li>
          </ul>
          <p className="mt-2 text-muted-foreground">
            Aucun cookie analytique, publicitaire ou de tracking n&apos;est
            déposé. Pas de bannière cookies nécessaire au regard de la CNIL.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">Tes droits</h2>
          <p>Conformément au RGPD, tu disposes des droits suivants&nbsp;:</p>
          <ul className="mt-1 list-disc list-inside text-muted-foreground space-y-1">
            <li>
              <strong>Droit d&apos;accès</strong> — tu peux consulter toutes
              tes données depuis le dashboard et les pages détail
            </li>
            <li>
              <strong>Droit de rectification</strong> — les données viennent
              de Spotify, à corriger directement sur ton compte Spotify
            </li>
            <li>
              <strong>Droit à l&apos;effacement</strong> — un clic depuis{" "}
              <Link href="/settings" className="text-primary hover:underline">
                Réglages
              </Link>{" "}
              supprime ton compte et toutes tes données
            </li>
            <li>
              <strong>Droit à la portabilité</strong> — ton historique brut
              reste téléchargeable directement depuis Spotify (
              <a
                href="https://www.spotify.com/account/privacy"
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                spotify.com/account/privacy
              </a>
              )
            </li>
            <li>
              <strong>Droit d&apos;opposition / de limitation</strong> — par
              email à{" "}
              <a
                href="mailto:julesdeschamps24@gmail.com"
                className="text-primary hover:underline"
              >
                julesdeschamps24@gmail.com
              </a>
            </li>
          </ul>
          <p className="mt-2 text-muted-foreground">
            Tu peux également déposer une réclamation auprès de la CNIL (
            <a
              href="https://www.cnil.fr"
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline"
            >
              cnil.fr
            </a>
            ).
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-2">Sécurité</h2>
          <p>
            Les jetons OAuth Spotify sont chiffrés en base avant stockage.
            Les communications utilisent HTTPS (TLS) via Let&apos;s Encrypt.
            L&apos;accès au serveur est restreint par SSH avec clé.
          </p>
        </section>
      </div>
    </main>
  );
}
