"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useWelcomeModalState } from "./use-welcome-modal";

/**
 * Modal de bienvenue affichée une seule fois (per browser, localStorage flag)
 * au premier load après auth pour un user en mode démo. Direction visuelle B1 :
 * split-panel avec mur d'albums violet/mauve à gauche, body éditorial à droite
 * avec headline serif italique et accent gradient.
 *
 * Esc = Skip (équivalent au bouton).
 */
export function WelcomeModal() {
  const { isOpen, close } = useWelcomeModalState();

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, close]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(7, 7, 16, 0.85)", backdropFilter: "blur(8px)" }}
      aria-modal="true"
      role="dialog"
      aria-label="Bienvenue sur loopstat"
    >
      <div
        className="grid w-full max-w-[720px] overflow-hidden rounded-[28px] grid-cols-1 sm:grid-cols-[260px_1fr]"
        style={{
          background: "#0a0612",
          border: "1px solid rgba(124, 58, 237, 0.25)",
          boxShadow:
            "0 32px 80px rgba(124, 58, 237, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.03) inset",
        }}
      >
        {/* Visual : mur d'albums violet/mauve, masque dégradé en bas + droite */}
        <div
          className="relative hidden sm:grid"
          style={{
            gridTemplateColumns: "repeat(3, 1fr)",
            gridTemplateRows: "repeat(4, 1fr)",
            gap: "1px",
            minHeight: "380px",
            background: "#0a0612",
          }}
        >
          <div style={{ background: "linear-gradient(135deg, #7c3aed, #a855f7)" }} />
          <div style={{ background: "linear-gradient(135deg, #581c87, #7c3aed)" }} />
          <div style={{ background: "linear-gradient(135deg, #a855f7, #ec4899)" }} />
          <div style={{ background: "linear-gradient(135deg, #4c1d95, #a855f7)" }} />
          <div style={{ background: "linear-gradient(135deg, #7c3aed, #3b0764)" }} />
          <div style={{ background: "linear-gradient(135deg, #ec4899, #7c3aed)" }} />
          <div style={{ background: "linear-gradient(135deg, #6d28d9, #c026d3)" }} />
          <div style={{ background: "linear-gradient(135deg, #a855f7, #581c87)" }} />
          <div style={{ background: "linear-gradient(135deg, #7c3aed, #db2777)" }} />
          <div style={{ background: "linear-gradient(135deg, #5b21b6, #a855f7)" }} />
          <div style={{ background: "linear-gradient(135deg, #c026d3, #7c3aed)" }} />
          <div style={{ background: "linear-gradient(135deg, #7c3aed, #1e1b4b)" }} />
          {/* Masque dégradé bas + droite pour fondre vers le body */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(10,6,18,0) 30%, rgba(10,6,18,0.95) 100%)",
            }}
          />
          <div
            className="pointer-events-none absolute right-0 top-0 bottom-0 w-8"
            style={{
              background:
                "linear-gradient(90deg, rgba(10,6,18,0), rgba(10,6,18,0.95))",
            }}
          />
        </div>

        {/* Body */}
        <div
          className="flex flex-col gap-3.5 px-11 py-12"
          style={{
            background:
              "linear-gradient(135deg, #0a0612 0%, #1a0d2e 100%)",
            color: "#f4f0ff",
          }}
        >
          <span
            className="inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase"
            style={{
              background: "rgba(124, 58, 237, 0.18)",
              color: "#c4b5fd",
              letterSpacing: "1.2px",
              marginBottom: "4px",
            }}
          >
            ✨ Démo
          </span>
          <h2
            className="font-serif"
            style={{
              fontStyle: "italic",
              fontSize: "42px",
              fontWeight: 400,
              lineHeight: 0.95,
              letterSpacing: "-0.01em",
              margin: 0,
            }}
          >
            Tes stats,
            <br />
            <span
              style={{
                background: "linear-gradient(135deg, #c4b5fd, #ec4899)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
              }}
            >
              en chiffres.
            </span>
          </h2>
          <p
            className="text-sm"
            style={{ color: "#a89ec8", lineHeight: 1.55, marginTop: "8px" }}
          >
            Tu regardes une démo. Importe ton historique Spotify pour voir TES top
            tracks, ta listening clock, et plus.
          </p>
          <div className="mt-3.5 flex gap-2.5">
            <button
              type="button"
              onClick={close}
              className="flex-1 rounded-full px-4 py-2.5 text-[13px] font-medium transition hover:opacity-80"
              style={{
                background: "transparent",
                color: "#a89ec8",
                border: "1px solid rgba(168, 158, 200, 0.2)",
              }}
            >
              Explorer la démo
            </button>
            <Link
              href="/import?from=welcome"
              onClick={close}
              className="rounded-full px-4 py-2.5 text-center text-[13px] font-semibold transition hover:opacity-90"
              style={{
                background: "#7c3aed",
                color: "#ffffff",
                flex: 1.4,
                boxShadow: "0 8px 20px rgba(124, 58, 237, 0.4)",
              }}
            >
              Importer →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
