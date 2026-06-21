import Link from "next/link";

import { FloatingCluster } from "@/components/landing/floating-cluster";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingHeader } from "@/components/landing/landing-header";

export default function HomePage() {
  return (
    <main
      id="main"
      className="flex min-h-[100svh] flex-col"
      style={{
        background: "radial-gradient(ellipse at 78% 0%, #1c0f31 0%, #070710 60%)",
        color: "#f4f0ff",
      }}
    >
      <LandingHeader />

      <section className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-8 px-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] md:px-12">
        <div className="flex flex-col items-center gap-4 text-center md:items-start md:text-left">
          <h1
            className="ls-rise text-[40px] font-medium leading-[1.04] sm:text-[56px]"
            style={{ letterSpacing: "-0.03em", animationDelay: "0.04s" }}
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

          <p
            className="ls-rise max-w-md text-base sm:text-lg"
            style={{ color: "#a89ec8", lineHeight: 1.5, animationDelay: "0.12s" }}
          >
            Comme ton Spotify Wrapped — mais disponible toute l&apos;année, et
            bien plus détaillé.
          </p>

          <ul
            className="ls-rise flex flex-col gap-2 text-left text-[15px]"
            style={{ color: "#cfc6ea", animationDelay: "0.2s" }}
          >
            <li className="flex items-start gap-2.5">
              <span aria-hidden="true" style={{ color: "#a78bfa" }}>✓</span>
              <span>Tes tops titres, artistes &amp; albums, sur toutes les périodes</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span aria-hidden="true" style={{ color: "#a78bfa" }}>✓</span>
              <span>Ton historique complet — pas juste les 4 dernières semaines</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span aria-hidden="true" style={{ color: "#a78bfa" }}>✓</span>
              <span>Des cartes à partager, taillées pour tes stories</span>
            </li>
          </ul>

          <div
            className="ls-rise mt-1 flex flex-col items-center gap-3 sm:flex-row md:items-start"
            style={{ animationDelay: "0.28s" }}
          >
            <Link
              href="/inscription"
              className="rounded-[10px] bg-[#7c3aed] px-5 py-3 text-[15px] font-medium text-white transition hover:opacity-90"
            >
              S&apos;inscrire
            </Link>
            <Link
              href="/connexion"
              className="rounded-[10px] border border-white/15 px-5 py-3 text-[15px] font-medium transition hover:bg-white/5"
              style={{ color: "#f4f0ff" }}
            >
              Se connecter
            </Link>
          </div>

          <Link
            href="/u/demo"
            className="ls-rise inline-flex items-center gap-1.5 text-[15px] font-medium transition hover:underline"
            style={{ color: "#c4b5fd", animationDelay: "0.34s" }}
          >
            Voir un exemple <span style={{ opacity: 0.6 }}>→</span>
          </Link>

          <p className="ls-rise text-[13px]" style={{ color: "#5a5070", animationDelay: "0.4s" }}>
            Prêt en 30 secondes · sans pub
          </p>
        </div>

        <div
          className="ls-rise relative h-[300px] w-full md:h-[520px]"
          style={{ animationDelay: "0.15s" }}
        >
          <FloatingCluster />
        </div>
      </section>

      <LandingFooter />
    </main>
  );
}
