import Link from "next/link";

import { FloatingCluster } from "@/components/landing/floating-cluster";
import { GoogleSignInButton } from "@/components/landing/google-sign-in-button";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingHeader } from "@/components/landing/landing-header";

export default function HomePage() {
  return (
    <main
      id="main"
      className="flex min-h-[100svh] flex-col"
      style={{
        background: "radial-gradient(ellipse at 80% 0%, #1a0d2e 0%, #070710 62%)",
        color: "#f4f0ff",
      }}
    >
      <LandingHeader />

      <section className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-8 px-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] md:px-12">
        <div className="flex flex-col items-center gap-5 text-center md:items-start md:text-left">
          <h1
            className="text-[40px] font-medium leading-[1.04] sm:text-[56px]"
            style={{ letterSpacing: "-0.03em" }}
          >
            Ton Spotify,
            <br />
            <span
              style={{
                fontFamily: "var(--font-instrument-serif), serif",
                fontStyle: "italic",
                color: "#c4b5fd",
              }}
            >
              en chiffres.
            </span>
          </h1>

          <p className="max-w-md text-base sm:text-lg" style={{ color: "#a89ec8", lineHeight: 1.5 }}>
            Tops, historique d&apos;écoute, listening clock — toutes tes stats,
            gratuit et sans pub.
          </p>

          <div className="mt-1 flex flex-col items-center gap-3 md:items-start">
            <GoogleSignInButton />
            <Link
              href="/u/demo"
              className="inline-flex items-center gap-1.5 text-[15px] font-medium transition hover:underline"
              style={{ color: "#c4b5fd" }}
            >
              Voir un exemple <span style={{ opacity: 0.6 }}>→</span>
            </Link>
          </div>

          <p className="text-[13px]" style={{ color: "#5a5070" }}>
            Gratuit · 30 secondes · sans pub
          </p>
        </div>

        <div className="relative h-[280px] w-full md:h-[440px]">
          <FloatingCluster />
        </div>
      </section>

      <LandingFooter />
    </main>
  );
}
