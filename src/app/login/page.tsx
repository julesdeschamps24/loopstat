import Link from "next/link";
import { ExternalLink, Music } from "lucide-react";
import { isSpotifyConfigured } from "@/auth";
import { LegalFooter } from "@/components/legal-footer";
import { SpotifyLoginButton } from "@/components/spotify-login-button";

// Force dynamic rendering so isSpotifyConfigured() is evaluated at each
// request against the current runtime env, rather than being baked into a
// statically prerendered HTML at build time.
export const dynamic = "force-dynamic";

export default function LoginPage() {
  if (!isSpotifyConfigured()) {
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
              Connecte-toi avec ton compte Spotify pour voir tes stats.
            </p>
          </div>
          <SpotifyLoginButton />
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
            Setup requis (1 fois, ~2 min)
          </div>
          <h1 className="text-2xl font-semibold">
            Configure ton app Spotify Developer
          </h1>
          <p className="text-sm text-muted-foreground">
            Spotify exige que <strong>l&apos;éditeur de l&apos;application</strong>{" "}
            (toi) enregistre une app sur leur dashboard, une seule fois. Après ça,
            tes utilisateurs se connectent en 1 clic — comme sur stats.fm ou
            receiptify.
          </p>
        </div>

        <ol className="space-y-4 text-sm">
          <Step n={1}>
            Va sur{" "}
            <a
              href="https://developer.spotify.com/dashboard"
              target="_blank"
              rel="noreferrer"
              className="text-primary inline-flex items-center gap-1 hover:underline"
            >
              developer.spotify.com/dashboard
              <ExternalLink className="size-3" />
            </a>
            <br />
            Connecte-toi avec ton compte Spotify perso, puis clique{" "}
            <kbd className="rounded bg-accent px-1.5 py-0.5 text-xs">
              Create app
            </kbd>
            .
          </Step>
          <Step n={2}>
            Remplis :
            <ul className="mt-2 space-y-1 text-muted-foreground">
              <li>
                <strong>App name</strong> : <code className="text-foreground">loopstat</code>
              </li>
              <li>
                <strong>App description</strong> : ce que tu veux
              </li>
              <li>
                <strong>Redirect URI</strong> :{" "}
                <code className="break-all text-foreground">
                  http://127.0.0.1:3000/api/auth/callback/spotify
                </code>
                <span className="block text-xs italic">
                  (clique <kbd className="rounded bg-accent px-1 py-0.5">Add</kbd>{" "}
                  après l&apos;avoir tapé !)
                </span>
              </li>
              <li>
                <strong>Which API/SDKs</strong> : coche <em>Web API</em>
              </li>
            </ul>
          </Step>
          <Step n={3}>
            Coche les CGU →{" "}
            <kbd className="rounded bg-accent px-1.5 py-0.5 text-xs">Save</kbd>.
            <br />
            Sur la page de l&apos;app → <strong>Settings</strong> → tu vois{" "}
            <strong>Client ID</strong> et <strong>Client secret</strong>.
          </Step>
          <Step n={4}>
            Colle les 2 valeurs dans le fichier{" "}
            <code className="text-foreground">.env.local</code> à la racine du projet
            :
            <pre className="mt-2 rounded-lg bg-accent px-3 py-2 text-xs overflow-x-auto">
              <code>
                SPOTIFY_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxx{"\n"}
                SPOTIFY_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxx
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
