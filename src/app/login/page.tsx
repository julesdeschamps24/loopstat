import Link from "next/link";
import { ExternalLink, Music } from "lucide-react";
import { isAuthConfigured } from "@/auth";
import { LegalFooter } from "@/components/legal-footer";
import { GoogleSignInButton } from "@/components/landing/google-sign-in-button";

// Force dynamic rendering so isAuthConfigured() is evaluated at each
// request against the current runtime env, rather than being baked into a
// statically prerendered HTML at build time.
export const dynamic = "force-dynamic";

export default function LoginPage() {
  if (!isAuthConfigured()) {
    return <SetupNeeded />;
  }

  return (
    <>
      <main id="main" className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm rounded-2xl border bg-card p-8 text-center space-y-6">
          <div className="space-y-2">
            <div className="mx-auto size-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Music className="size-6 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold">Bienvenue 👋</h1>
            <p className="text-sm text-muted-foreground">
              Connecte-toi pour voir tes stats Spotify.
            </p>
          </div>
          <GoogleSignInButton />
          <p className="text-xs text-muted-foreground">
            En te connectant, tu acceptes nos{" "}
            <Link href="/terms" className="underline hover:text-foreground">
              CGU
            </Link>{" "}
            et notre{" "}
            <Link href="/privacy" className="underline hover:text-foreground">
              politique de confidentialité
            </Link>
            .
          </p>
        </div>
      </main>
      <LegalFooter />
    </>
  );
}

function SetupNeeded() {
  return (
    <main id="main" className="flex-1 flex flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-xl rounded-2xl border bg-card p-8 space-y-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs uppercase tracking-wider text-muted-foreground">
            Setup requis (1 fois, ~5 min)
          </div>
          <h1 className="text-2xl font-semibold">
            Configure ton client OAuth Google
          </h1>
          <p className="text-sm text-muted-foreground">
            Google demande qu&apos;une app cliente soit enregistrée pour
            authentifier les users via OAuth. Setup en 5 min, gratuit, jusqu&apos;à
            100 testeurs whitelistés sans verification Google.
          </p>
        </div>

        <ol className="space-y-4 text-sm">
          <Step n={1}>
            Va sur{" "}
            <a
              href="https://console.cloud.google.com/apis/credentials"
              target="_blank"
              rel="noreferrer"
              className="text-primary inline-flex items-center gap-1 hover:underline"
            >
              console.cloud.google.com/apis/credentials
              <ExternalLink className="size-3" />
            </a>
            <br />
            Crée un projet si tu n&apos;en as pas, puis clique{" "}
            <kbd className="rounded bg-accent px-1.5 py-0.5 text-xs">
              + Create credentials → OAuth client ID
            </kbd>
            .
          </Step>
          <Step n={2}>
            Type : <strong>Web application</strong>
            <br />
            Name : <code className="text-foreground">loopstat</code>
            <br />
            <strong>Authorized redirect URIs</strong> — ajoute :
            <pre className="mt-2 rounded-lg bg-accent px-3 py-2 text-xs overflow-x-auto">
              <code>http://127.0.0.1:3000/api/auth/callback/google</code>
            </pre>
          </Step>
          <Step n={3}>
            Clique <kbd className="rounded bg-accent px-1.5 py-0.5 text-xs">Create</kbd>.
            <br />
            Copie <strong>Client ID</strong> et <strong>Client secret</strong>{" "}
            depuis le dialog.
          </Step>
          <Step n={4}>
            Configure le consent screen (
            <a
              href="https://console.cloud.google.com/apis/credentials/consent"
              target="_blank"
              rel="noreferrer"
              className="text-primary inline-flex items-center gap-1 hover:underline"
            >
              ici
              <ExternalLink className="size-3" />
            </a>
            ) : External, Testing, ajoute ton email dans &quot;Test users&quot;.
          </Step>
          <Step n={5}>
            Colle les 2 valeurs dans{" "}
            <code className="text-foreground">.env.local</code> :
            <pre className="mt-2 rounded-lg bg-accent px-3 py-2 text-xs overflow-x-auto">
              <code>
                GOOGLE_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxx{"\n"}
                GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxx
              </code>
            </pre>
            Puis redémarre le serveur ({" "}
            <kbd className="rounded bg-accent px-1.5 py-0.5 text-xs">Ctrl+C</kbd>{" "}
            puis <code>pnpm dev</code> ).
          </Step>
        </ol>

        <div className="flex items-center justify-between border-t pt-4 text-xs text-muted-foreground">
          <span>Cette page disparaîtra automatiquement une fois configuré.</span>
          <Link href="/" className="hover:text-foreground">
            ← Retour
          </Link>
        </div>
      </div>
    </main>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="size-7 shrink-0 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold">
        {n}
      </span>
      <div className="flex-1 pt-0.5">{children}</div>
    </li>
  );
}
