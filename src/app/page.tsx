import Link from "next/link";

import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingHeader } from "@/components/landing/landing-header";
import { GoogleSignInButton } from "@/components/landing/google-sign-in-button";

export default function HomePage() {
  return (
    <main
      id="main"
      className="flex min-h-screen flex-col"
      style={{
        background:
          "radial-gradient(ellipse at top, #1a0d2e 0%, #070710 60%)",
        color: "#f4f0ff",
      }}
    >
      <LandingHeader />

      <section className="flex flex-1 flex-col items-center justify-center gap-7 px-6 py-12 text-center">
        <h1
          className="text-[40px] font-bold leading-none sm:text-[64px]"
          style={{ letterSpacing: "-0.03em" }}
        >
          Ton Spotify,
          <br />
          <span style={{ color: "#c4b5fd" }}>en chiffres</span>.
        </h1>

        <p
          className="max-w-xl text-base sm:text-lg"
          style={{ color: "#a89ec8", lineHeight: 1.5 }}
        >
          Tops, historique d&apos;écoute, listening clock — toutes tes stats
          Spotify, gratuites et sans pub.
        </p>

        <div className="mt-2 flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
          <GoogleSignInButton />
          <Link
            href="/u/demo"
            className="inline-flex items-center gap-1.5 px-3 py-3.5 text-[15px] font-medium transition hover:underline"
            style={{ color: "#c4b5fd" }}
          >
            Voir un exemple <span style={{ opacity: 0.6 }}>→</span>
          </Link>
        </div>

        <p className="text-[13px]" style={{ color: "#5a5070" }}>
          Gratuit · 30 secondes · sans pub
        </p>
      </section>

      <LandingFooter />
    </main>
  );
}
