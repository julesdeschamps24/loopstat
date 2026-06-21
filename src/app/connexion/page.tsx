import Link from "next/link";
import { Music } from "lucide-react";
import { LegalFooter } from "@/components/legal-footer";
import { LoginForm } from "@/components/auth/login-form";

export const dynamic = "force-dynamic";

export default function ConnexionPage() {
  return (
    <>
      <main id="main" className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm rounded-2xl border bg-card p-8 space-y-6">
          <div className="space-y-2 text-center">
            <div className="mx-auto size-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Music className="size-6 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold">Bon retour 👋</h1>
            <p className="text-sm text-muted-foreground">
              Connecte-toi pour voir tes stats Spotify.
            </p>
          </div>

          <LoginForm />

          <p className="text-xs text-muted-foreground text-center">
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
