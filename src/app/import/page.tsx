import Link from "next/link";
import { redirect } from "next/navigation";
import { ExternalLink, FileJson } from "lucide-react";
import { auth } from "@/auth";
import { ImportUpload } from "@/components/import-upload";

export default async function ImportPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <main className="flex-1 flex flex-col px-6 py-12 max-w-2xl mx-auto w-full">
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
              Pour analyser toute ta vie d&apos;écoute, pas juste les
              écoutes récentes.
            </p>
          </div>
        </div>
      </header>

      <section className="rounded-2xl border bg-card p-8 space-y-3 mb-6">
        <h2 className="font-semibold">Comment récupérer tes fichiers ?</h2>
        <p className="text-sm text-muted-foreground">
          La synchro automatique (toutes les 30 min) ne capte que tes écoutes
          récentes. Pour ton historique complet, il faut le demander à
          Spotify :
        </p>
        <ol className="space-y-2 text-sm text-muted-foreground list-decimal pl-5">
          <li>
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
            et coche{" "}
            <strong className="text-foreground">
              « Extended streaming history »
            </strong>
            .
          </li>
          <li>
            Spotify t&apos;envoie le dump par e-mail sous forme de ZIP (compte
            ~30 jours d&apos;attente).
          </li>
          <li>
            Dézippe-le et dépose ici les fichiers{" "}
            <code className="text-foreground">
              Streaming_History_Audio_*.json
            </code>
            .
          </li>
        </ol>
      </section>

      <section className="rounded-2xl border bg-card p-8">
        <ImportUpload />
      </section>
    </main>
  );
}
