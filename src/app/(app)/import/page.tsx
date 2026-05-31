import Link from "next/link";
import { redirect } from "next/navigation";
import { ExternalLink, FileJson } from "lucide-react";
import { auth } from "@/auth";
import { ImageZoom } from "@/components/image-zoom";
import { ImportUpload } from "@/components/import-upload";

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const { from } = await searchParams;
  const isFromWelcome = from === "welcome";
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <main id="main" className="flex-1 flex flex-col px-6 py-12 max-w-2xl mx-auto w-full">
      <header className="mb-8">
        <Link
          href="/dashboard"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Retour au dashboard
        </Link>
        <div className="mt-4 flex items-center gap-3">
          <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center">
            <FileJson className="size-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">
              Importer ton historique
            </h1>
            <p className="text-sm text-muted-foreground">
              {isFromWelcome
                ? "Plus que quelques minutes avant de voir tes vraies stats."
                : "Pour avoir tes vraies écoutes lifetime, pas juste depuis ton inscription à loopstat."}
            </p>
          </div>
        </div>
      </header>

      <section className="rounded-2xl border bg-card p-8 space-y-4 mb-6">
        <div>
          <h2 className="font-semibold mb-2">Pourquoi un import ?</h2>
          <p className="text-sm text-muted-foreground">
            Spotify n&apos;expose <strong className="text-foreground">aucun</strong>{" "}
            endpoint public pour récupérer tes playcounts lifetime — c&apos;est
            volontaire de leur part. Le seul moyen légitime est de demander
            ton « Extended Streaming History » via RGPD, gratuit, puis de
            l&apos;uploader ici. Compte{" "}
            <strong className="text-foreground">~30 jours d&apos;attente</strong>{" "}
            avant que Spotify te l&apos;envoie par e-mail.
          </p>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-8 space-y-6 mb-6">
        <h2 className="font-semibold">Guide pas-à-pas</h2>

        <ol className="space-y-6">
          <Step n={1}>
            <p>
              Va sur{" "}
              <a
                href="https://www.spotify.com/account/privacy"
                target="_blank"
                rel="noreferrer"
                className="text-primary inline-flex items-center gap-1 hover:underline"
              >
                spotify.com/account/privacy
                <ExternalLink className="size-3" />
              </a>{" "}
              et descend jusqu&apos;à la section{" "}
              <strong className="text-foreground">
                « Télécharger tes données »
              </strong>
              .
            </p>
          </Step>

          <Step n={2}>
            <p className="mb-3">
              <strong className="text-foreground">
                Coche uniquement « Historique de streaming étendu »
              </strong>{" "}
              (préparation : 30 jours). Les deux autres cases (« Données de
              compte » et « Journal technique ») ne servent pas à loopstat —
              décoche-les pour ne pas rallonger l&apos;attente.
            </p>
            <ImageZoom
              src="/spotify-data-request.png"
              alt="Page Spotify : seule la case « Historique de streaming étendu » est cochée"
            />
          </Step>

          <Step n={3}>
            <p>
              Clique{" "}
              <kbd className="rounded bg-accent px-1.5 py-0.5 text-xs">
                Demander des données
              </kbd>
              .
            </p>
          </Step>

          <Step n={4}>
            <p className="mb-3">
              <strong className="text-foreground">
                Spotify t&apos;envoie immédiatement un mail de confirmation
              </strong>{" "}
              — tu dois cliquer dessus, sinon la demande n&apos;est jamais
              traitée. Ouvre ta boîte mail et clique{" "}
              <strong className="text-foreground">« Confirmer »</strong>{" "}
              dans le mail intitulé <em>« Confirme ta demande de données »</em>.
            </p>
            <ImageZoom
              src="/spotify-data-confirm-email.png"
              alt="Mail de confirmation Spotify avec le bouton « Confirmer » à cliquer"
            />
          </Step>

          <Step n={5}>
            <p>
              Tu recevras un second mail avec un lien de téléchargement{" "}
              <em>sous ~5 à 30 jours</em>. Dézippe l&apos;archive. À l&apos;intérieur
              tu trouveras plusieurs fichiers{" "}
              <code className="text-foreground">
                Streaming_History_Audio_*.json
              </code>{" "}
              (un par tranche d&apos;années).{" "}
              <strong className="text-foreground">
                Seuls ceux-ci sont utiles
              </strong>{" "}
              — les <code>Video_*.json</code> et le PDF sont automatiquement
              filtrés. Tu peux tout sélectionner d&apos;un coup, loopstat ne
              garde que les Audio.
            </p>
          </Step>

          <Step n={6}>
            <p>
              Le worker parse, dédup et insère tout en quelques minutes. À la
              fin, tes pages détail (`/track/[id]`, etc.) affichent les vrais
              compteurs lifetime, et tes pages top sont enrichies de
              playcounts précis.
            </p>
          </Step>
        </ol>

        <div className="border-t pt-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Note</strong> : en attendant,
            le polling toutes les 30 min remplit déjà ton historique
            <em> vers le futur</em>. Plus tu utilises Spotify, plus loopstat
            accumule de données — pas besoin d&apos;y revenir.
          </p>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-8">
        <h2 className="font-semibold mb-4">Déposer tes fichiers JSON</h2>
        <ImportUpload />
      </section>
    </main>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="size-7 shrink-0 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold">
        {n}
      </span>
      <div className="flex-1 pt-0.5 text-sm text-muted-foreground space-y-2">
        {children}
      </div>
    </li>
  );
}
